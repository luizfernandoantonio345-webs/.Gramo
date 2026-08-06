import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusFuncionario } from '@prisma/client';
import { formatarCpf, formatarMinutos } from '@repp/shared';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { BancoHorasService } from '../banco-horas/banco-horas.service';
import { EscopoFilialService } from '../common/authz/escopo-filial.service';
import { PrismaService } from '../prisma/prisma.service';

// Marca .GRAMO (impresso em branco -> tema claro, print-friendly).
const NAVY = rgb(0.027, 0.043, 0.07);
const CIANO = rgb(0.133, 0.827, 0.933);
const CINZA = rgb(0.42, 0.45, 0.5);
const LINHA = rgb(0.85, 0.87, 0.9);
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Relatorios gerenciais em PDF com a marca .GRAMO (nao substituem o AFD/AEJ). */
@Injectable()
export class RelatorioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bancoHoras: BancoHorasService,
    private readonly escopo: EscopoFilialService,
  ) {}

  /** Espelho de ponto (gerencial) de um funcionario, com totais e banco de horas. */
  async espelhoPdf(
    funcionarioId: string,
    inicioIso: string,
    fimIso: string,
    autor: UsuarioAutenticado,
    competencia?: string,
  ): Promise<{ nomeArquivo: string; conteudoBase64: string }> {
    const func = await this.prisma.forTenant((tx) =>
      tx.funcionario.findFirst({
        where: { id: funcionarioId },
        select: { nome: true, cpf: true, cargo: true, filial: { select: { nome: true } } },
      }),
    );
    if (!func) throw new NotFoundException('Funcionario nao encontrado.');

    // Reusa TODA a regra do banco de horas (dias, saldo, adicional noturno).
    const bh = await this.bancoHoras.consolidado(
      funcionarioId,
      inicioIso,
      fimIso,
      autor,
      competencia,
    );

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4
    const fonte = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const L = 48;
    const R = 595.28 - 48;
    let y = 792;

    const txt = (s: string, x: number, yy: number, size = 10, b = false, cor = NAVY): void => {
      page.drawText(s, { x, y: yy, size, font: b ? bold : fonte, color: cor });
    };

    // Cabecalho de marca (barra ciano + wordmark .GRAMO).
    page.drawRectangle({ x: 0, y: 812, width: 595.28, height: 30, color: CIANO });
    txt('.GRAMO', L, 820, 15, true, NAVY);
    txt('GRAMO ENGENHARIA', R - 150, 821, 10, true, NAVY);

    txt('Espelho de Ponto', L, y, 18, true);
    y -= 16;
    txt('Documento gerencial -- nao substitui o AFD/AEJ (Portaria 671).', L, y, 8, false, CINZA);
    y -= 26;

    // Dados do funcionario
    txt('Funcionario', L, y, 8, false, CINZA);
    txt('Obra / Filial', 300, y, 8, false, CINZA);
    y -= 13;
    txt(func.nome, L, y, 11, true);
    txt(func.filial?.nome ?? '-', 300, y, 11, true);
    y -= 15;
    txt(`CPF ${formatarCpf(func.cpf)}`, L, y, 9, false, CINZA);
    txt(`Cargo: ${func.cargo ?? '-'}`, 300, y, 9, false, CINZA);
    y -= 13;
    const ini = new Date(inicioIso).toLocaleDateString('pt-BR');
    const fim = new Date(fimIso).toLocaleDateString('pt-BR');
    txt(
      `Periodo: ${ini} a ${fim}${competencia ? `  (competencia ${competencia})` : ''}`,
      L,
      y,
      9,
      false,
      CINZA,
    );
    y -= 22;

    // Cabecalho da tabela
    const cols = { data: L, trab: 250, saldo: 360, not: 470 };
    txt('DATA', cols.data, y, 8, true, CINZA);
    txt('TRABALHADO', cols.trab, y, 8, true, CINZA);
    txt('SALDO', cols.saldo, y, 8, true, CINZA);
    txt('NOTURNO', cols.not, y, 8, true, CINZA);
    y -= 6;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1, color: LINHA });
    y -= 14;

    for (const d of bh.dias) {
      if (y < 120) break; // uma pagina (mes tipico cabe); overflow raro
      txt(new Date(d.data).toLocaleDateString('pt-BR'), cols.data, y, 9);
      txt(formatarMinutos(d.trabalhadoMin), cols.trab, y, 9);
      txt(
        d.saldoMin === null ? '-' : formatarMinutos(d.saldoMin),
        cols.saldo,
        y,
        9,
        false,
        d.saldoMin !== null && d.saldoMin < 0 ? rgb(0.75, 0.2, 0.2) : NAVY,
      );
      txt(d.noturnoMin > 0 ? formatarMinutos(d.noturnoMin) : '-', cols.not, y, 9);
      y -= 15;
    }

    // Totais
    y -= 6;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1, color: LINHA });
    y -= 20;
    txt('Regime', L, y, 8, false, CINZA);
    txt(bh.regime, L, y - 13, 10, true);
    txt('Extras', 170, y, 8, false, CINZA);
    txt(formatarMinutos(bh.extrasMin), 170, y - 13, 10, true);
    txt('Faltas', 270, y, 8, false, CINZA);
    txt(formatarMinutos(bh.faltasMin), 270, y - 13, 10, true);
    txt('Saldo banco', 370, y, 8, false, CINZA);
    txt(bh.saldoFormatado ?? '-', 370, y - 13, 10, true);
    y -= 34;
    txt('Adicional noturno (CLT art. 73)', L, y, 8, false, CINZA);
    txt(
      `${bh.noturno.formatado} (hora reduzida) + ${Math.round(bh.noturno.percentual * 100)}% = ${formatarMinutos(bh.noturno.adicionalMin)}`,
      L,
      y - 13,
      10,
      true,
    );

    // Rodape
    txt(`.GRAMO -- gerado em ${new Date().toLocaleString('pt-BR')}`, L, 40, 8, false, CINZA);

    const bytes = await pdf.save();
    const comp = competencia ?? new Date(inicioIso).toISOString().slice(0, 7);
    return {
      nomeArquivo: `espelho_${func.nome.replace(/\s+/g, '_')}_${comp}.pdf`,
      conteudoBase64: Buffer.from(bytes).toString('base64'),
    };
  }

  /**
   * Fechamento GERENCIAL de uma obra (filial) na competencia: uma linha por
   * funcionario ativo, com trabalhado, extras, faltas, saldo do banco e adicional
   * noturno -- mais os totais da obra. Prepara a conferencia de folha do gestor.
   *
   * Reusa TODA a regra do banco de horas (consolidado por funcionario). E leitura;
   * nao substitui o AFD/AEJ oficial nem o espelho assinavel do fechamento formal.
   */
  async fechamentoObraPdf(filialId: string, competencia: string, autor: UsuarioAutenticado) {
    if (!COMPETENCIA.test(competencia)) {
      throw new BadRequestException('Competencia deve ser "AAAA-MM".');
    }
    // Garante que o gestor tem escopo sobre a obra pedida (RH_MASTER passa direto).
    await this.escopo.garantirFilial(autor, filialId);

    const [ano, mes] = competencia.split('-').map(Number);
    const inicioIso = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0)).toISOString();
    const fimIso = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999)).toISOString();

    const { filial, funcs } = await this.prisma.forTenant(async (tx) => {
      const filial = await tx.filial.findFirst({
        where: { id: filialId },
        select: { nome: true },
      });
      if (!filial) throw new NotFoundException('Obra/filial nao encontrada.');
      const funcs = await tx.funcionario.findMany({
        where: { filialId, status: StatusFuncionario.ATIVO },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true, cargo: true },
      });
      return { filial, funcs };
    });

    // Consolida cada funcionario reusando a MESMA regra do banco de horas.
    const linhas: Array<{
      nome: string;
      cargo: string | null;
      trabalhadoMin: number;
      extrasMin: number;
      faltasMin: number;
      saldoBancoMin: number | null;
      adicNoturnoMin: number;
    }> = [];
    const tot = { trabalhado: 0, extras: 0, faltas: 0, saldo: 0, noturno: 0 };
    for (const f of funcs) {
      const bh = await this.bancoHoras.consolidado(f.id, inicioIso, fimIso, autor, competencia);
      const trabalhadoMin = bh.dias.reduce((s, d) => s + d.trabalhadoMin, 0);
      linhas.push({
        nome: f.nome,
        cargo: f.cargo,
        trabalhadoMin,
        extrasMin: bh.extrasMin,
        faltasMin: bh.faltasMin,
        saldoBancoMin: bh.saldoBancoMin,
        adicNoturnoMin: bh.noturno.adicionalMin,
      });
      tot.trabalhado += trabalhadoMin;
      tot.extras += bh.extrasMin;
      tot.faltas += bh.faltasMin;
      tot.saldo += bh.saldoBancoMin ?? 0;
      tot.noturno += bh.noturno.adicionalMin;
    }

    const conteudoBase64 = await this.renderFechamentoObra(filial.nome, competencia, linhas, tot);
    return {
      nomeArquivo: `fechamento_${filial.nome.replace(/\s+/g, '_')}_${competencia}.pdf`,
      conteudoBase64,
      totalFuncionarios: funcs.length,
    };
  }

  private async renderFechamentoObra(
    obra: string,
    competencia: string,
    linhas: Array<{
      nome: string;
      cargo: string | null;
      trabalhadoMin: number;
      extrasMin: number;
      faltasMin: number;
      saldoBancoMin: number | null;
      adicNoturnoMin: number;
    }>,
    tot: { trabalhado: number; extras: number; faltas: number; saldo: number; noturno: number },
  ): Promise<string> {
    const pdf = await PDFDocument.create();
    const fonte = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const W = 841.89; // A4 paisagem
    const H = 595.28;
    const L = 40;
    const R = W - 40;

    // Colunas (x inicial de cada uma).
    const col = { nome: L, cargo: 250, trab: 430, extra: 520, falta: 600, saldo: 680, not: 770 };
    let page = pdf.addPage([W, H]);
    let y = 0;

    const txt = (s: string, x: number, size = 9, b = false, cor = NAVY): void => {
      page.drawText(s, { x, y, size, font: b ? bold : fonte, color: cor });
    };
    const cabecalho = (): void => {
      page.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color: CIANO });
      y = H - 20;
      txt('.GRAMO', L, 15, true);
      txt('GRAMO ENGENHARIA', R - 150, 10, true);
      y = H - 52;
      txt('Fechamento mensal por obra', L, 16, true);
      y -= 15;
      txt(
        `Documento gerencial de conferencia de folha -- nao substitui o AFD/AEJ (Portaria 671).`,
        L,
        8,
        false,
        CINZA,
      );
      y -= 16;
      txt(
        `Obra: ${obra}    Competencia: ${competencia.slice(5)}/${competencia.slice(0, 4)}    Funcionarios: ${linhas.length}`,
        L,
        10,
        true,
      );
      y -= 20;
      txt('FUNCIONARIO', col.nome, 8, true, CINZA);
      txt('CARGO', col.cargo, 8, true, CINZA);
      txt('TRABALHADO', col.trab, 8, true, CINZA);
      txt('EXTRAS', col.extra, 8, true, CINZA);
      txt('FALTAS', col.falta, 8, true, CINZA);
      txt('SALDO', col.saldo, 8, true, CINZA);
      txt('ADIC.NOT.', col.not, 8, true, CINZA);
      y -= 5;
      page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1, color: LINHA });
      y -= 13;
    };

    cabecalho();
    for (const l of linhas) {
      if (y < 60) {
        page = pdf.addPage([W, H]);
        cabecalho();
      }
      txt(this.corta(l.nome, 34), col.nome, 9);
      txt(this.corta(l.cargo ?? '-', 26), col.cargo, 9, false, CINZA);
      txt(formatarMinutos(l.trabalhadoMin), col.trab, 9);
      txt(formatarMinutos(l.extrasMin), col.extra, 9);
      txt(
        formatarMinutos(l.faltasMin),
        col.falta,
        9,
        false,
        l.faltasMin > 0 ? rgb(0.75, 0.2, 0.2) : NAVY,
      );
      txt(
        l.saldoBancoMin === null ? '-' : formatarMinutos(l.saldoBancoMin),
        col.saldo,
        9,
        false,
        l.saldoBancoMin !== null && l.saldoBancoMin < 0 ? rgb(0.75, 0.2, 0.2) : NAVY,
      );
      txt(formatarMinutos(l.adicNoturnoMin), col.not, 9);
      y -= 14;
    }

    // Totais da obra.
    y -= 4;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1, color: NAVY });
    y -= 14;
    txt('TOTAL DA OBRA', col.nome, 9, true);
    txt(formatarMinutos(tot.trabalhado), col.trab, 9, true);
    txt(formatarMinutos(tot.extras), col.extra, 9, true);
    txt(formatarMinutos(tot.faltas), col.falta, 9, true);
    txt(formatarMinutos(tot.saldo), col.saldo, 9, true);
    txt(formatarMinutos(tot.noturno), col.not, 9, true);

    txt(`.GRAMO -- gerado em ${new Date().toLocaleString('pt-BR')}`, L, 8, false, CINZA);
    // (rodape na coordenada atual; suficiente para o proposito gerencial)

    const bytes = await pdf.save();
    return Buffer.from(bytes).toString('base64');
  }

  private corta(s: string, max: number): string {
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  }
}
