import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusAssinatura, TipoDocAssinatura, TipoMarcacao } from '@prisma/client';
import {
  calcularHorasDia,
  formatarMinutos,
  saldoDia,
  type MarcacaoDia,
} from '@repp/shared';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SignatureService } from '../assinaturas/signature.service';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { EscopoFilialService } from '../common/authz/escopo-filial.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * ADM 4 -- Fechamento mensal do ponto. Gera o ESPELHO da competencia (marcacoes
 * + banco de horas) como PDF, o registra como documento assinavel e deixa
 * pronto para o funcionario assinar (assinatura Ed25519 imutavel ja existente).
 *
 * O ponto em si continua imutavel; o fechamento e um artefato derivado, com hash
 * proprio -- se o espelho for regerado, gera um novo documento (nunca sobrescreve).
 */
@Injectable()
export class FechamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly signature: SignatureService,
    private readonly escopo: EscopoFilialService,
  ) {}

  async gerar(funcionarioId: string, competencia: string, autor: UsuarioAutenticado) {
    if (!COMPETENCIA.test(competencia)) {
      throw new BadRequestException('Competencia deve ser "AAAA-MM".');
    }
    const empresaId = TenantContext.requireEmpresaId();
    const filiais = await this.escopo.filiaisPermitidas(autor);

    const dados = await this.prisma.forTenant(async (tx) => {
      const func = await tx.funcionario.findFirst({
        where: { id: funcionarioId },
        select: {
          nome: true,
          cpf: true,
          filialId: true,
          jornada: { select: { cargaDiariaMinutos: true } },
          empresa: { select: { razaoSocial: true } },
        },
      });
      if (!func) throw new NotFoundException('Funcionario nao encontrado.');
      if (filiais !== null && (!func.filialId || !filiais.includes(func.filialId))) {
        throw new NotFoundException('Funcionario fora do seu escopo de filial.');
      }
      const tz = func.filialId
        ? (await tx.filial.findFirst({ where: { id: func.filialId }, select: { timezone: true } }))
            ?.timezone ?? 'America/Sao_Paulo'
        : 'America/Sao_Paulo';

      const { inicio, fim } = this.intervaloMes(competencia);
      const pontos = await tx.ponto.findMany({
        where: { funcionarioId, registradoEm: { gte: inicio, lte: fim } },
        orderBy: { registradoEm: 'asc' },
        select: { tipo: true, registradoEm: true },
      });
      return { func, tz, pontos };
    });

    const carga = dados.func.jornada?.cargaDiariaMinutos ?? null;
    const dias = this.agruparPorDia(dados.pontos, dados.tz);
    let saldoTotal = 0;
    const linhas = [...dias.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, marcacoes]) => {
        const { trabalhadoMin } = calcularHorasDia(marcacoes);
        const saldo = saldoDia(trabalhadoMin, carga);
        if (saldo !== null) saldoTotal += saldo;
        return {
          data,
          horarios: marcacoes.map((m) => this.hhmm(m.minutosDoDia)).join('  '),
          trabalhado: formatarMinutos(trabalhadoMin),
          saldo: saldo === null ? '--' : formatarMinutos(saldo),
        };
      });

    const pdf = await this.renderizarPdf({
      empresa: dados.func.empresa.razaoSocial,
      nome: dados.func.nome,
      cpf: dados.func.cpf,
      competencia,
      linhas,
      saldoTotal: carga === null ? null : formatarMinutos(saldoTotal),
    });

    const hashDocumento = this.signature.hashDocumento(pdf);
    const arquivoRef = await this.storage.salvarArquivo(Buffer.from(pdf).toString('base64'), 'espelho');
    const titulo = `Espelho de Ponto ${competencia.slice(5)}/${competencia.slice(0, 4)}`;

    return this.prisma.forTenant(async (tx) => {
      const doc = await tx.documentoAssinatura.create({
        data: {
          empresaId,
          funcionarioId,
          tipo: TipoDocAssinatura.OUTRO,
          titulo,
          competencia,
          arquivoRef,
          hashDocumento,
          mime: 'application/pdf',
          tamanhoBytes: pdf.length,
          enviadoPorAdminId: autor.sub,
          status: StatusAssinatura.ENVIADO,
        },
        select: { id: true, titulo: true, competencia: true, status: true, hashDocumento: true },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'fechamento.gerar',
          entidadeAfetada: 'documentos_assinatura',
          entidadeId: doc.id,
          valorNovo: { funcionarioId, competencia, hashDocumento },
        },
      });
      return doc;
    });
  }

  // --- helpers ---

  private intervaloMes(competencia: string): { inicio: Date; fim: Date } {
    const [ano, mes] = competencia.split('-').map(Number);
    const inicio = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0));
    const fim = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999));
    return { inicio, fim };
  }

  private agruparPorDia(pontos: { tipo: TipoMarcacao; registradoEm: Date }[], tz: string) {
    const porDia = new Map<string, MarcacaoDia[]>();
    for (const p of pontos) {
      const { data, minutosDoDia } = this.localData(p.registradoEm, tz);
      if (!porDia.has(data)) porDia.set(data, []);
      porDia.get(data)!.push({ tipo: p.tipo, minutosDoDia });
    }
    return porDia;
  }

  private localData(date: Date, tz: string): { data: string; minutosDoDia: number } {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(date);
    const p = (t: string) => partes.find((x) => x.type === t)?.value ?? '';
    return {
      data: `${p('year')}-${p('month')}-${p('day')}`,
      minutosDoDia: Number(p('hour')) * 60 + Number(p('minute')),
    };
  }

  private hhmm(min: number): string {
    return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  }

  private async renderizarPdf(d: {
    empresa: string;
    nome: string;
    cpf: string;
    competencia: string;
    linhas: { data: string; horarios: string; trabalhado: string; saldo: string }[];
    saldoTotal: string | null;
  }): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const fonte = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.078, 0.129, 0.239);
    let page = pdf.addPage([595, 842]); // A4 retrato
    let y = 800;
    const linha = (txt: string, x: number, size = 10, f = fonte) => {
      page.drawText(txt, { x, y, size, font: f, color: navy });
    };
    linha('ESPELHO DE PONTO', 40, 16, bold);
    y -= 22;
    linha(d.empresa, 40, 11, bold);
    y -= 16;
    linha(`Funcionario: ${d.nome}   CPF: ${d.cpf}`, 40);
    y -= 14;
    linha(`Competencia: ${d.competencia.slice(5)}/${d.competencia.slice(0, 4)}`, 40);
    y -= 24;
    linha('Data', 40, 9, bold);
    linha('Marcacoes', 130, 9, bold);
    linha('Trabalhado', 400, 9, bold);
    linha('Saldo', 500, 9, bold);
    y -= 4;
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: navy });
    y -= 14;
    for (const l of d.linhas) {
      if (y < 60) {
        page = pdf.addPage([595, 842]);
        y = 800;
      }
      linha(l.data, 40, 9);
      linha(l.horarios || '(sem marcacoes)', 130, 9);
      linha(l.trabalhado, 400, 9);
      linha(l.saldo, 500, 9);
      y -= 13;
    }
    y -= 10;
    if (d.saldoTotal !== null) {
      linha(`Saldo do periodo (banco de horas): ${d.saldoTotal}`, 40, 10, bold);
      y -= 16;
    }
    linha('Ao assinar, o funcionario confirma a conferencia das marcacoes acima.', 40, 8);
    return pdf.save({ useObjectStreams: false });
  }
}
