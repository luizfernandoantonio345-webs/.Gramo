import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusExcecao, StatusValidacaoPonto } from '@prisma/client';
import { calcularHorasDia, saldoDia, type MarcacaoDia } from '@repp/shared';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { EscopoFilialService } from '../common/authz/escopo-filial.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AjusteManualDto,
  AtualizarRegapDto,
  CriarRegapDto,
  DecidirExcecaoDto,
} from './dto/gestao.dto';

/** ADM 4 -- Gestao de Ponto: dashboard, fila de excecoes, espelho, REGAP. */
@Injectable()
export class GestaoPontoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escopo: EscopoFilialService,
  ) {}

  async dashboardDia(autor: UsuarioAutenticado) {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const f = await this.escopo.escopoFilialId(autor); // {} ou { filialId: { in } }
    const funcFiltro = f.filialId ? { funcionario: { is: { filialId: f.filialId } } } : {};
    return this.prisma.forTenant(async (tx) => {
      const [marcacoesHoje, foraRegapHoje, excecoesPendentes] = await Promise.all([
        tx.ponto.count({ where: { ...f, registradoEm: { gte: inicio } } }),
        tx.ponto.count({ where: { ...f, registradoEm: { gte: inicio }, dentroRegap: false } }),
        tx.aprovacaoExcecao.count({ where: { ...funcFiltro, status: StatusExcecao.PENDENTE } }),
      ]);
      const presentes = await tx.ponto.findMany({
        where: { ...f, registradoEm: { gte: inicio } },
        distinct: ['funcionarioId'],
        select: { funcionarioId: true },
      });
      return {
        marcacoesHoje,
        foraRegapHoje,
        excecoesPendentes,
        funcionariosPresentes: presentes.length,
      };
    });
  }

  /** Fila de excecoes pendentes (ADM 4). */
  async filaExcecoes(autor: UsuarioAutenticado) {
    const f = await this.escopo.escopoFilialId(autor);
    const funcFiltro = f.filialId ? { funcionario: { is: { filialId: f.filialId } } } : {};
    return this.prisma.forTenant((tx) =>
      tx.aprovacaoExcecao.findMany({
        where: { ...funcFiltro, status: StatusExcecao.PENDENTE },
        orderBy: { criadoEm: 'asc' },
        include: {
          funcionario: { select: { id: true, nome: true, cpf: true } },
          ponto: {
            select: {
              id: true,
              nsr: true,
              tipo: true,
              registradoEm: true,
              dentroRegap: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      }),
    );
  }

  /**
   * Decisao do RH sobre uma excecao. NUNCA altera o ponto (imutavel) -- apenas
   * resolve a aprovacao, com motivo obrigatorio e trilha de auditoria.
   */
  async decidirExcecao(id: string, dto: DecidirExcecaoDto, aprovador: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const excecao = await tx.aprovacaoExcecao.findFirst({ where: { id } });
      if (!excecao) throw new NotFoundException('Excecao nao encontrada.');
      if (excecao.status !== StatusExcecao.PENDENTE) {
        throw new BadRequestException('Excecao ja foi decidida.');
      }
      const novoStatus = dto.aprovar ? StatusExcecao.APROVADA : StatusExcecao.RECUSADA;
      const atualizada = await tx.aprovacaoExcecao.update({
        where: { id },
        data: {
          status: novoStatus,
          aprovadorId: aprovador.sub,
          motivoResposta: dto.motivoResposta,
          dataResposta: new Date(),
        },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: aprovador.sub,
          usuarioTipo: 'admin',
          acao: 'excecao.decidir',
          entidadeAfetada: 'justificativas_autorizacoes',
          entidadeId: id,
          valorAnterior: { status: StatusExcecao.PENDENTE },
          valorNovo: { status: novoStatus, motivoResposta: dto.motivoResposta },
        },
      });
      return atualizada;
    });
  }

  /** Ajuste manual: cria PontoAjuste vinculado, sem tocar no ponto original. */
  async ajusteManual(pontoId: string, dto: AjusteManualDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const ponto = await tx.ponto.findFirst({ where: { id: pontoId } });
      if (!ponto) throw new NotFoundException('Ponto nao encontrado.');
      const ajuste = await tx.pontoAjuste.create({
        data: {
          empresaId,
          pontoOriginalId: pontoId,
          autorAdminId: autor.sub,
          motivo: dto.motivo,
          novoValor: {
            novoRegistradoEm: dto.novoRegistradoEm ?? null,
            observacao: dto.observacao ?? null,
          },
        },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'ponto.ajuste_manual',
          entidadeAfetada: 'pontos',
          entidadeId: pontoId,
          valorNovo: { ajusteId: ajuste.id, motivo: dto.motivo },
        },
      });
      return ajuste;
    });
  }

  /** Espelho de ponto por funcionario/periodo, com status efetivo. */
  async espelho(
    funcionarioId: string,
    inicioIso: string,
    fimIso: string,
    autor: UsuarioAutenticado,
  ) {
    const inicio = new Date(inicioIso);
    const fim = new Date(fimIso);
    const filiais = await this.escopo.filiaisPermitidas(autor);
    return this.prisma.forTenant(async (tx) => {
      if (filiais !== null) {
        const f = await tx.funcionario.findFirst({
          where: { id: funcionarioId },
          select: { filialId: true },
        });
        if (!f || !f.filialId || !filiais.includes(f.filialId)) {
          throw new NotFoundException('Funcionario fora do seu escopo de filial.');
        }
      }
      const pontos = await tx.ponto.findMany({
        where: { funcionarioId, registradoEm: { gte: inicio, lte: fim } },
        orderBy: { registradoEm: 'asc' },
        include: {
          aprovacoes: { orderBy: { criadoEm: 'desc' }, take: 1 },
          ajustes: { orderBy: { criadoEm: 'desc' } },
        },
      });
      return pontos.map((p) => ({
        id: p.id,
        nsr: Number(p.nsr),
        tipo: p.tipo,
        registradoEm: p.registradoEm.toISOString(),
        origemHora: p.origemHora,
        dentroRegap: p.dentroRegap,
        statusValidacao: p.statusValidacao,
        // Status efetivo = registro + ultima decisao do RH (nunca altera o ponto).
        statusEfetivo:
          p.statusValidacao === StatusValidacaoPonto.VALIDO
            ? 'VALIDO'
            : (p.aprovacoes[0]?.status ?? 'PENDENTE'),
        temAjuste: p.ajustes.length > 0,
        hashIntegridade: p.hashIntegridade,
      }));
    });
  }

  /**
   * Banco de horas por funcionario/periodo: agrupa as marcacoes por dia (no fuso
   * da filial), calcula horas trabalhadas liquidas e o saldo vs. a carga diaria
   * da jornada. Marcacoes esquecidas (par incompleto) ficam de fora do calculo.
   */
  async bancoHoras(
    funcionarioId: string,
    inicioIso: string,
    fimIso: string,
    autor: UsuarioAutenticado,
  ) {
    const filiais = await this.escopo.filiaisPermitidas(autor);
    const inicio = new Date(inicioIso);
    const fim = new Date(fimIso);
    return this.prisma.forTenant(async (tx) => {
      const func = await tx.funcionario.findFirst({
        where: { id: funcionarioId },
        select: { filialId: true, jornada: { select: { cargaDiariaMinutos: true } } },
      });
      if (!func) throw new NotFoundException('Funcionario nao encontrado.');
      if (filiais !== null && (!func.filialId || !filiais.includes(func.filialId))) {
        throw new NotFoundException('Funcionario fora do seu escopo de filial.');
      }
      const filial = func.filialId
        ? await tx.filial.findFirst({ where: { id: func.filialId }, select: { timezone: true } })
        : null;
      const tz = filial?.timezone ?? 'America/Sao_Paulo';
      const carga = func.jornada?.cargaDiariaMinutos ?? null;

      const pontos = await tx.ponto.findMany({
        where: { funcionarioId, registradoEm: { gte: inicio, lte: fim } },
        orderBy: { registradoEm: 'asc' },
        select: { tipo: true, registradoEm: true },
      });

      const porDia = new Map<string, MarcacaoDia[]>();
      for (const p of pontos) {
        const { data, minutosDoDia } = this.localData(p.registradoEm, tz);
        if (!porDia.has(data)) porDia.set(data, []);
        porDia.get(data)!.push({ tipo: p.tipo, minutosDoDia });
      }

      let saldoTotal = 0;
      const dias = [...porDia.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([data, marcacoes]) => {
          const { trabalhadoMin } = calcularHorasDia(marcacoes);
          const saldo = saldoDia(trabalhadoMin, carga);
          if (saldo !== null) saldoTotal += saldo;
          return { data, trabalhadoMin, saldoMin: saldo };
        });

      return { cargaDiariaMinutos: carga, saldoTotalMin: carga === null ? null : saldoTotal, dias };
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

  // ---- REGAP CRUD ----

  async criarRegap(dto: CriarRegapDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const regap = await tx.regap.create({
        data: {
          empresaId,
          nome: dto.nome,
          filialId: dto.filialId,
          latitudeCentro: dto.latitudeCentro,
          longitudeCentro: dto.longitudeCentro,
          raioMetros: dto.raioMetros,
        },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'regap.criar',
          entidadeAfetada: 'regap',
          entidadeId: regap.id,
          valorNovo: { nome: dto.nome, raioMetros: dto.raioMetros },
        },
      });
      return regap;
    });
  }

  async listarRegaps() {
    return this.prisma.forTenant((tx) => tx.regap.findMany({ orderBy: { nome: 'asc' } }));
  }

  async atualizarRegap(id: string, dto: AtualizarRegapDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const atual = await tx.regap.findFirst({ where: { id } });
      if (!atual) throw new NotFoundException('REGAP nao encontrada.');
      const regap = await tx.regap.update({
        where: { id },
        data: {
          nome: dto.nome,
          latitudeCentro: dto.latitudeCentro,
          longitudeCentro: dto.longitudeCentro,
          raioMetros: dto.raioMetros,
          ativo: dto.ativo,
        },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'regap.atualizar',
          entidadeAfetada: 'regap',
          entidadeId: id,
          valorAnterior: { nome: atual.nome, raioMetros: atual.raioMetros, ativo: atual.ativo },
          valorNovo: { ...dto },
        },
      });
      return regap;
    });
  }
}
