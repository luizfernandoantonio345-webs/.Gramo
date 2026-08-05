import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RegimeHoras, TipoAjusteBanco, TipoMarcacao } from '@prisma/client';
import {
  ADICIONAL_NOTURNO_PADRAO,
  calcularHorasDia,
  formatarMinutos,
  minutosNoturnosReduzidos,
  saldoDia,
  type MarcacaoDia,
} from '@repp/shared';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { EscopoFilialService } from '../common/authz/escopo-filial.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';

interface RegistrarAjuste {
  funcionarioId: string;
  minutos: number;
  tipo: TipoAjusteBanco;
  motivo: string;
  competencia?: string;
}

/**
 * ADM 4 -- Banco de horas completo. Suporta 3 regimes (configuraveis por
 * jornada): compensacao mensal, banco anual (CLT) e hora extra direta.
 *
 * O saldo automatico vem das marcacoes (imutaveis); os ajustes/compensacoes do
 * RH sao lancamentos append-only que somam ao saldo. Nada aqui altera o ponto.
 */
@Injectable()
export class BancoHorasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escopo: EscopoFilialService,
  ) {}

  async consolidado(
    funcionarioId: string,
    inicioIso: string,
    fimIso: string,
    autor: UsuarioAutenticado,
    competencia?: string,
  ) {
    const inicio = new Date(inicioIso);
    const fim = new Date(fimIso);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      throw new BadRequestException('Periodo invalido.');
    }
    const filiais = await this.escopo.filiaisPermitidas(autor);

    return this.prisma.forTenant(async (tx) => {
      const func = await tx.funcionario.findFirst({
        where: { id: funcionarioId },
        select: {
          filialId: true,
          jornada: {
            select: { cargaDiariaMinutos: true, regimeHoras: true, limiteExtraDiariaMin: true },
          },
        },
      });
      if (!func) throw new NotFoundException('Funcionario nao encontrado.');
      if (filiais !== null && (!func.filialId || !filiais.includes(func.filialId))) {
        throw new NotFoundException('Funcionario fora do seu escopo de filial.');
      }
      const tz = func.filialId
        ? ((await tx.filial.findFirst({ where: { id: func.filialId }, select: { timezone: true } }))
            ?.timezone ?? 'America/Sao_Paulo')
        : 'America/Sao_Paulo';
      const carga = func.jornada?.cargaDiariaMinutos ?? null;
      const regime = func.jornada?.regimeHoras ?? RegimeHoras.COMPENSACAO_MENSAL;
      const limiteExtra = func.jornada?.limiteExtraDiariaMin ?? 120;

      const pontos = await tx.ponto.findMany({
        where: { funcionarioId, registradoEm: { gte: inicio, lte: fim } },
        orderBy: { registradoEm: 'asc' },
        select: { tipo: true, registradoEm: true },
      });
      const ajustes = await tx.ajusteBancoHoras.findMany({
        where: {
          funcionarioId,
          ...(competencia ? { competencia } : {}),
          criadoEm: competencia ? undefined : { gte: inicio, lte: fim },
        },
        orderBy: { criadoEm: 'asc' },
        select: { minutos: true, tipo: true, motivo: true, competencia: true, criadoEm: true },
      });

      const dias = this.saldosPorDia(pontos, tz, carga);
      const alertas: string[] = [];
      let extrasMin = 0;
      let faltasMin = 0;
      let noturnoRelogioMin = 0;
      for (const d of dias) {
        noturnoRelogioMin += d.noturnoMin;
        if (d.saldoMin === null) continue;
        if (d.saldoMin > 0) extrasMin += d.saldoMin;
        else faltasMin += -d.saldoMin;
        if (d.saldoMin > limiteExtra) {
          alertas.push(
            `${d.data}: extra de ${formatarMinutos(d.saldoMin)} excede o limite legal (${formatarMinutos(limiteExtra)}).`,
          );
        }
      }
      const ajustesMin = ajustes.reduce((s, a) => s + a.minutos, 0);

      // Adicional noturno (CLT art. 73): hora reduzida (52min30s) + 20%. So base
      // de folha -- nao entra no saldo do banco (que e compensacao de jornada).
      const noturnoLegalMin = minutosNoturnosReduzidos(noturnoRelogioMin);
      const noturno = {
        relogioMin: noturnoRelogioMin,
        legalMin: noturnoLegalMin,
        adicionalMin: Math.round(noturnoLegalMin * ADICIONAL_NOTURNO_PADRAO),
        percentual: ADICIONAL_NOTURNO_PADRAO,
        formatado: formatarMinutos(noturnoLegalMin),
      };
      if (noturnoRelogioMin > 0) {
        alertas.push(
          `Trabalho noturno no periodo: ${formatarMinutos(noturnoLegalMin)} (com hora reduzida) + adicional de ${Math.round(ADICIONAL_NOTURNO_PADRAO * 100)}%.`,
        );
      }

      // Aplica o regime.
      let saldoBancoMin: number | null;
      let observacao: string;
      switch (regime) {
        case RegimeHoras.HORA_EXTRA:
          saldoBancoMin = 0;
          observacao =
            'Regime HORA_EXTRA: nada acumula. Extras viram hora extra paga; faltas viram desconto.';
          break;
        case RegimeHoras.BANCO_ANUAL: {
          saldoBancoMin = (carga === null ? 0 : extrasMin - faltasMin) + ajustesMin;
          observacao = 'Regime BANCO_ANUAL: acumula ate 12 meses (limite CLT).';
          const LIMITE_ANUAL = 40 * 60; // alerta acima de ~40h de saldo
          if (saldoBancoMin > LIMITE_ANUAL) {
            alertas.push(
              `Saldo do banco (${formatarMinutos(saldoBancoMin)}) elevado: avalie compensacao ou pagamento.`,
            );
          }
          break;
        }
        default: {
          saldoBancoMin = (carga === null ? 0 : extrasMin - faltasMin) + ajustesMin;
          observacao =
            'Regime COMPENSACAO_MENSAL: o saldo deve ser compensado ate o fim do mes seguinte.';
          if (carga !== null && saldoBancoMin !== 0) {
            alertas.push(
              `Saldo de ${formatarMinutos(saldoBancoMin)} pendente de compensacao no periodo.`,
            );
          }
        }
      }

      return {
        regime,
        cargaDiariaMinutos: carga,
        periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
        extrasMin,
        faltasMin,
        ajustesMin,
        saldoBancoMin,
        saldoFormatado: saldoBancoMin === null ? null : formatarMinutos(saldoBancoMin),
        observacao,
        alertas,
        noturno,
        dias,
        ajustes,
      };
    });
  }

  async registrarAjuste(dto: RegistrarAjuste, autor: UsuarioAutenticado) {
    if (!dto.minutos || !Number.isInteger(dto.minutos)) {
      throw new BadRequestException('minutos deve ser inteiro diferente de zero.');
    }
    const empresaId = TenantContext.requireEmpresaId();
    const filiais = await this.escopo.filiaisPermitidas(autor);
    return this.prisma.forTenant(async (tx) => {
      const func = await tx.funcionario.findFirst({
        where: { id: dto.funcionarioId },
        select: { filialId: true },
      });
      if (!func) throw new NotFoundException('Funcionario nao encontrado.');
      if (filiais !== null && (!func.filialId || !filiais.includes(func.filialId))) {
        throw new NotFoundException('Funcionario fora do seu escopo de filial.');
      }
      const aj = await tx.ajusteBancoHoras.create({
        data: {
          empresaId,
          funcionarioId: dto.funcionarioId,
          minutos: dto.minutos,
          tipo: dto.tipo,
          motivo: dto.motivo,
          competencia: dto.competencia,
          criadoPorAdminId: autor.sub,
        },
        select: { id: true, minutos: true, tipo: true, competencia: true, criadoEm: true },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'banco_horas.ajuste',
          entidadeAfetada: 'ajustes_banco_horas',
          entidadeId: aj.id,
          valorNovo: { funcionarioId: dto.funcionarioId, minutos: dto.minutos, tipo: dto.tipo },
        },
      });
      return aj;
    });
  }

  // --- helpers ---

  private saldosPorDia(
    pontos: { tipo: TipoMarcacao; registradoEm: Date }[],
    tz: string,
    carga: number | null,
  ) {
    const porDia = new Map<string, MarcacaoDia[]>();
    for (const p of pontos) {
      const { data, minutosDoDia } = this.localData(p.registradoEm, tz);
      if (!porDia.has(data)) porDia.set(data, []);
      porDia.get(data)!.push({ tipo: p.tipo, minutosDoDia });
    }
    return [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, marcacoes]) => {
        const { trabalhadoMin, noturnoMin } = calcularHorasDia(marcacoes);
        return { data, trabalhadoMin, noturnoMin, saldoMin: saldoDia(trabalhadoMin, carga) };
      });
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
}
