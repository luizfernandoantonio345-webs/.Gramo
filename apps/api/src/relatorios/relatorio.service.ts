import { Injectable, NotFoundException } from '@nestjs/common';
import { formatarCpf, formatarMinutos } from '@repp/shared';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { BancoHorasService } from '../banco-horas/banco-horas.service';
import { PrismaService } from '../prisma/prisma.service';

// Marca .GRAMO (impresso em branco -> tema claro, print-friendly).
const NAVY = rgb(0.027, 0.043, 0.07);
const CIANO = rgb(0.133, 0.827, 0.933);
const CINZA = rgb(0.42, 0.45, 0.5);
const LINHA = rgb(0.85, 0.87, 0.9);

/** Relatorios gerenciais em PDF com a marca .GRAMO (nao substituem o AFD/AEJ). */
@Injectable()
export class RelatorioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bancoHoras: BancoHorasService,
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
}
