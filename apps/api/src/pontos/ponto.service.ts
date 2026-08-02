import { ConflictException, Injectable } from '@nestjs/common';
import {
  OrigemHora,
  StatusAusencia,
  StatusExcecao,
  StatusValidacaoPonto,
  TipoExcecao,
  TipoMarcacao,
} from '@prisma/client';
import {
  avaliarRegap,
  dentroDoHorario,
  montarConteudoCanonicoPonto,
  proximoTipoMarcacao,
  ResultadoSyncItem,
  type AreaRegap,
  type SyncPontoResultado,
} from '@repp/shared';
import { hashToken } from '../common/crypto/tokens';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService, type PrismaTxClient } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NsrService } from './nsr.service';
import type { RegistrarPontoDto, SyncItemDto } from './dto/ponto.dto';

export interface PontoResumo {
  id: string;
  nsr: number;
  tipo: TipoMarcacao;
  registradoEm: string;
  origemHora: OrigemHora;
  statusValidacao: StatusValidacaoPonto;
  dentroRegap: boolean;
  latitude: number | null;
  longitude: number | null;
  justificativa: string | null;
}

interface DadosCriacao {
  funcionarioId: string;
  filialId: string;
  tipo: TipoMarcacao;
  registradoEm: Date;
  origemHora: OrigemHora;
  latitude: number | null;
  longitude: number | null;
  precisaoMetros: number | null;
  fotoRef: string | null;
  justificativa: string | null;
  uuidIdempotencia: string;
}

@Injectable()
export class PontoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nsr: NsrService,
    private readonly storage: StorageService,
  ) {}

  /** Registro online: hora oficial do servidor. NUNCA bloqueia. */
  async registrar(funcionarioId: string, dto: RegistrarPontoDto): Promise<PontoResumo> {
    const funcionario = await this.carregarFuncionarioComFilial(funcionarioId);
    const fotoRef = dto.fotoBase64 ? await this.storage.salvarImagem(dto.fotoBase64) : null;

    return this.prisma.forTenant(async (tx) => {
      const tipo = dto.tipo ?? (await this.deduzirTipo(tx, funcionarioId));
      return this.criarOuRecuperar(tx, {
        funcionarioId,
        filialId: funcionario.filialId,
        tipo,
        registradoEm: new Date(),
        origemHora: OrigemHora.SERVIDOR,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        precisaoMetros: dto.precisaoMetros ?? null,
        fotoRef,
        justificativa: dto.justificativa ?? null,
        uuidIdempotencia: dto.uuidIdempotencia,
      });
    });
  }

  /**
   * Sync da fila offline. Cada item e processado de forma independente e
   * idempotente (mesmo uuidIdempotencia nunca duplica). Hora = do dispositivo.
   */
  async sync(funcionarioId: string, registros: SyncItemDto[]): Promise<SyncPontoResultado[]> {
    const funcionario = await this.carregarFuncionarioComFilial(funcionarioId);
    const resultados: SyncPontoResultado[] = [];

    for (const item of registros) {
      try {
        const fotoRef = item.fotoBase64 ? await this.storage.salvarImagem(item.fotoBase64) : null;
        const { ponto, duplicado } = await this.prisma.forTenant((tx) =>
          this.criarOuRecuperarComFlag(tx, {
            funcionarioId,
            filialId: funcionario.filialId,
            tipo: item.tipo,
            registradoEm: new Date(item.capturadoEm),
            origemHora: OrigemHora.DISPOSITIVO,
            latitude: item.latitude ?? null,
            longitude: item.longitude ?? null,
            precisaoMetros: item.precisaoMetros ?? null,
            fotoRef,
            justificativa: item.justificativa ?? null,
            uuidIdempotencia: item.uuidIdempotencia,
          }),
        );
        // Achata o registro no formato do contrato compartilhado (nsr/pontoId/etc).
        resultados.push({
          uuidIdempotencia: item.uuidIdempotencia,
          resultado: duplicado ? ResultadoSyncItem.ACEITO_DUPLICADO : ResultadoSyncItem.ACEITO,
          nsr: ponto.nsr,
          pontoId: ponto.id,
          statusValidacao: ponto.statusValidacao,
          registradoEm: ponto.registradoEm,
          erro: null,
        });
      } catch (e) {
        resultados.push({
          uuidIdempotencia: item.uuidIdempotencia,
          resultado: ResultadoSyncItem.REJEITADO,
          nsr: null,
          pontoId: null,
          statusValidacao: null,
          registradoEm: null,
          erro: e instanceof Error ? e.message : 'erro',
        });
      }
    }
    return resultados;
  }

  /** Status de REGAP em tempo real (anel de presenca), sem registrar nada. */
  async statusRegap(
    funcionarioId: string,
    latitude: number,
    longitude: number,
  ): Promise<{ dentro: boolean; distanciaMetros: number | null }> {
    const funcionario = await this.prisma.forTenant((tx) =>
      tx.funcionario.findUniqueOrThrow({ where: { id: funcionarioId } }),
    );
    const regaps = await this.carregarRegaps(funcionario.filialId);
    const r = avaliarRegap(latitude, longitude, regaps);
    return { dentro: r.dentro, distanciaMetros: r.distanciaMetros };
  }

  /** Espelho de ponto do dia corrente (Tela 3). */
  async espelhoDoDia(funcionarioId: string): Promise<PontoResumo[]> {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 1);

    const pontos = await this.prisma.forTenant((tx) =>
      tx.ponto.findMany({
        where: { funcionarioId, registradoEm: { gte: inicio, lt: fim } },
        orderBy: { registradoEm: 'asc' },
      }),
    );
    return pontos.map((p) => this.mapear(p));
  }

  // ---- internos ----

  private async carregarFuncionarioComFilial(
    funcionarioId: string,
  ): Promise<{ filialId: string }> {
    const funcionario = await this.prisma.forTenant((tx) =>
      tx.funcionario.findUniqueOrThrow({ where: { id: funcionarioId } }),
    );
    if (!funcionario.filialId) {
      // Precondicao de configuracao (nao e bloqueio de geolocalizacao/horario):
      // um ponto legal exige um estabelecimento para o NSR sequencial.
      throw new ConflictException(
        'Funcionario sem estabelecimento (filial) vinculado. Contate o RH.',
      );
    }
    return { filialId: funcionario.filialId };
  }

  private async carregarRegaps(filialId: string | null): Promise<AreaRegap[]> {
    const regaps = await this.prisma.forTenant((tx) =>
      tx.regap.findMany({ where: { ativo: true, filialId: filialId ?? undefined } }),
    );
    return regaps.map((r) => ({
      id: r.id,
      latitude: Number(r.latitudeCentro),
      longitude: Number(r.longitudeCentro),
      raioMetros: r.raioMetros,
    }));
  }

  private async deduzirTipo(tx: PrismaTxClient, funcionarioId: string): Promise<TipoMarcacao> {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const hoje = await tx.ponto.findMany({
      where: { funcionarioId, registradoEm: { gte: inicio } },
      orderBy: { registradoEm: 'asc' },
      select: { tipo: true },
    });
    return proximoTipoMarcacao(hoje.map((p) => p.tipo));
  }

  private async criarOuRecuperar(tx: PrismaTxClient, dados: DadosCriacao): Promise<PontoResumo> {
    return (await this.criarOuRecuperarComFlag(tx, dados)).ponto;
  }

  private async criarOuRecuperarComFlag(
    tx: PrismaTxClient,
    dados: DadosCriacao,
  ): Promise<{ ponto: PontoResumo; duplicado: boolean }> {
    const empresaId = TenantContext.requireEmpresaId();

    // Idempotencia: reenvio do mesmo UUID devolve o registro existente.
    const existente = await tx.ponto.findFirst({
      where: { uuidIdempotencia: dados.uuidIdempotencia },
    });
    if (existente) return { ponto: this.mapear(existente), duplicado: true };

    // REGAP -> status. O botao NUNCA bloqueia: fora da area vira pendente.
    const regaps = (await tx.regap.findMany({ where: { ativo: true, filialId: dados.filialId } })).map(
      (r) => ({
        id: r.id,
        latitude: Number(r.latitudeCentro),
        longitude: Number(r.longitudeCentro),
        raioMetros: r.raioMetros,
      }),
    );
    const avaliacao = avaliarRegap(dados.latitude, dados.longitude, regaps);

    // Horario/jornada (ADM 7). Nunca bloqueia -> apenas classifica.
    const dentroHorario = await this.avaliarHorario(tx, dados);

    // Prioridade: fora da area > fora do horario > valido.
    const statusValidacao = !avaliacao.dentro
      ? StatusValidacaoPonto.PENDENTE_REGAP
      : !dentroHorario
        ? StatusValidacaoPonto.PENDENTE_HORARIO
        : StatusValidacaoPonto.VALIDO;

    const nsr = await this.nsr.proximo(tx, empresaId, dados.filialId);
    const registradoIso = dados.registradoEm.toISOString();

    // Hash de integridade (SHA-256 do conteudo canonico).
    const hashIntegridade = hashToken(
      montarConteudoCanonicoPonto({
        empresaId,
        funcionarioId: dados.funcionarioId,
        nsr: nsr.toString(),
        tipo: dados.tipo,
        registradoEm: registradoIso,
        origemHora: dados.origemHora,
        latitude: dados.latitude,
        longitude: dados.longitude,
        dentroRegap: avaliacao.dentro,
        uuidIdempotencia: dados.uuidIdempotencia,
      }),
    );

    const ponto = await tx.ponto.create({
      data: {
        empresaId,
        filialId: dados.filialId,
        funcionarioId: dados.funcionarioId,
        nsr,
        uuidIdempotencia: dados.uuidIdempotencia,
        tipo: dados.tipo,
        registradoEm: dados.registradoEm,
        origemHora: dados.origemHora,
        latitude: dados.latitude,
        longitude: dados.longitude,
        precisaoMetros: dados.precisaoMetros,
        dentroRegap: avaliacao.dentro,
        statusValidacao,
        justificativa: dados.justificativa,
        fotoCapturaRef: dados.fotoRef,
        hashIntegridade,
      },
    });

    // Pendencia -> entra na fila de excecoes do RH (ADM 4), com o tipo correto.
    if (statusValidacao !== StatusValidacaoPonto.VALIDO) {
      await tx.aprovacaoExcecao.create({
        data: {
          empresaId,
          funcionarioId: dados.funcionarioId,
          pontoId: ponto.id,
          tipo:
            statusValidacao === StatusValidacaoPonto.PENDENTE_HORARIO
              ? TipoExcecao.HORARIO
              : TipoExcecao.REGAP,
          motivo: dados.justificativa,
          status: StatusExcecao.PENDENTE,
        },
      });
    }

    await tx.logAuditoria.create({
      data: {
        empresaId,
        usuarioId: dados.funcionarioId,
        usuarioTipo: 'funcionario',
        acao: 'ponto.criar',
        entidadeAfetada: 'pontos',
        entidadeId: ponto.id,
        valorNovo: { nsr: nsr.toString(), tipo: dados.tipo, statusValidacao },
      },
    });

    return { ponto: this.mapear(ponto), duplicado: false };
  }

  /**
   * Avalia se a marcacao esta dentro do horario da jornada do funcionario
   * (considerando tolerancia, dias de escala, feriados e o fuso da filial).
   * Sem jornada configurada -> nao avalia (dentro).
   */
  private async avaliarHorario(tx: PrismaTxClient, dados: DadosCriacao): Promise<boolean> {
    const func = await tx.funcionario.findUnique({
      where: { id: dados.funcionarioId },
      select: { jornadaId: true },
    });
    if (!func?.jornadaId) return true;

    const [jornada, filial] = await Promise.all([
      tx.jornada.findFirst({ where: { id: func.jornadaId, ativo: true } }),
      tx.filial.findFirst({ where: { id: dados.filialId }, select: { timezone: true } }),
    ]);
    if (!jornada) return true;

    const tz = filial?.timezone ?? 'America/Sao_Paulo';
    const { minutosDoDia, diaSemana, dataLocal } = this.minutosEDia(dados.registradoEm, tz);

    // Abono: ferias/afastamento aprovado cobrindo o dia -> nao gera pendencia (ADM 10).
    const ausencia = await tx.feriasAfastamento.findFirst({
      where: {
        funcionarioId: dados.funcionarioId,
        status: StatusAusencia.APROVADA,
        dataInicio: { lte: new Date(dataLocal) },
        dataFim: { gte: new Date(dataLocal) },
      },
      select: { id: true },
    });
    if (ausencia) return true;

    const feriado = await tx.feriado.findFirst({
      where: {
        data: new Date(dataLocal),
        OR: [{ filialId: null }, { filialId: dados.filialId }],
      },
      select: { id: true },
    });

    return dentroDoHorario({
      tipo: dados.tipo,
      minutosDoDia,
      diaSemana,
      ehFeriado: feriado !== null,
      jornada: {
        horaEntrada: jornada.horaEntrada,
        horaSaida: jornada.horaSaida,
        toleranciaMinutos: jornada.toleranciaMinutos,
        diasSemana: jornada.diasSemana,
      },
    });
  }

  /** Minutos-do-dia, dia-da-semana e data local (YYYY-MM-DD) no fuso informado. */
  private minutosEDia(date: Date, tz: string): { minutosDoDia: number; diaSemana: number; dataLocal: string } {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    }).formatToParts(date);
    const p = (t: string) => partes.find((x) => x.type === t)?.value ?? '';
    const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      minutosDoDia: Number(p('hour')) * 60 + Number(p('minute')),
      diaSemana: dias[p('weekday')] ?? 0,
      dataLocal: `${p('year')}-${p('month')}-${p('day')}`,
    };
  }

  private mapear(p: {
    id: string;
    nsr: bigint;
    tipo: TipoMarcacao;
    registradoEm: Date;
    origemHora: OrigemHora;
    statusValidacao: StatusValidacaoPonto;
    dentroRegap: boolean;
    latitude: unknown;
    longitude: unknown;
    justificativa: string | null;
  }): PontoResumo {
    return {
      id: p.id,
      nsr: Number(p.nsr),
      tipo: p.tipo,
      registradoEm: p.registradoEm.toISOString(),
      origemHora: p.origemHora,
      statusValidacao: p.statusValidacao,
      dentroRegap: p.dentroRegap,
      latitude: p.latitude == null ? null : Number(p.latitude),
      longitude: p.longitude == null ? null : Number(p.longitude),
      justificativa: p.justificativa,
    };
  }
}
