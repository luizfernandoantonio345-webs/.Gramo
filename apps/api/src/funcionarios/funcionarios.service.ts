import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusDocumento, StatusFuncionario } from '@prisma/client';
import { isCpfValido, normalizarCpf, venceEmBreve } from '@repp/shared';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { EscopoFilialService } from '../common/authz/escopo-filial.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AtualizarFuncionarioDto,
  CriarFuncionarioDto,
  DecidirDocumentoDto,
  ListarFuncionariosQuery,
} from './dto/funcionario.dto';

export interface ErroLinhaCsv {
  linha: number;
  campo: string;
  mensagem: string;
}

@Injectable()
export class FuncionariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escopo: EscopoFilialService,
  ) {}

  async listar(q: ListarFuncionariosQuery, autor: UsuarioAutenticado) {
    const busca = q.busca?.trim();
    const filialEscopo = await this.escopo.escopoFilialId(autor);
    return this.prisma.forTenant((tx) =>
      tx.funcionario.findMany({
        where: {
          ...filialEscopo,
          status: q.status,
          ...(busca
            ? { OR: [{ nome: { contains: busca, mode: 'insensitive' } }, { cpf: { contains: normalizarCpf(busca) } }] }
            : {}),
        },
        select: {
          id: true,
          nome: true,
          cpf: true,
          cargo: true,
          status: true,
          fotoAprovada: true,
          filialId: true,
        },
        orderBy: { nome: 'asc' },
      }),
    );
  }

  async criar(dto: CriarFuncionarioDto, autor: UsuarioAutenticado) {
    const cpf = normalizarCpf(dto.cpf);
    if (!isCpfValido(cpf)) throw new BadRequestException('CPF invalido (digito verificador).');
    // Gestor de Filial so cadastra em filiais que gerencia.
    await this.escopo.garantirFilial(autor, dto.filialId);

    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const existe = await tx.funcionario.findFirst({ where: { cpf } });
      if (existe) throw new ConflictException('Ja existe funcionario com este CPF nesta empresa.');
      const f = await tx.funcionario.create({
        data: {
          empresaId,
          nome: dto.nome,
          cpf,
          cargo: dto.cargo,
          email: dto.email,
          telefone: dto.telefone,
          salarioBase: dto.salarioBase,
          jornadaContratual: dto.jornadaContratual,
          jornadaId: dto.jornadaId,
          filialId: dto.filialId,
          status: StatusFuncionario.PENDENTE_CADASTRO,
        },
        select: { id: true },
      });
      await this.audit(tx, empresaId, autor, 'funcionario.criar', 'funcionarios', f.id, {
        nome: dto.nome,
        cpf,
      });
      return f;
    });
  }

  async atualizar(id: string, dto: AtualizarFuncionarioDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    const filiais = await this.escopo.filiaisPermitidas(autor);
    return this.prisma.forTenant(async (tx) => {
      const atual = await tx.funcionario.findFirst({ where: { id } });
      if (!atual) throw new NotFoundException('Funcionario nao encontrado.');
      this.exigirFilial(filiais, atual.filialId); // origem
      this.exigirFilial(filiais, dto.filialId ?? atual.filialId); // destino
      const f = await tx.funcionario.update({
        where: { id },
        data: {
          cargo: dto.cargo,
          email: dto.email,
          telefone: dto.telefone,
          salarioBase: dto.salarioBase,
          jornadaContratual: dto.jornadaContratual,
          jornadaId: dto.jornadaId,
          filialId: dto.filialId,
          status: dto.status,
        },
        select: { id: true, status: true },
      });
      await this.audit(tx, empresaId, autor, 'funcionario.atualizar', 'funcionarios', id, { ...dto });
      return f;
    });
  }

  /** Aprova a foto de referencia -> libera o reconhecimento facial (ADM 2). */
  async aprovarFoto(id: string, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    const filiais = await this.escopo.filiaisPermitidas(autor);
    return this.prisma.forTenant(async (tx) => {
      const atual = await tx.funcionario.findFirst({ where: { id } });
      if (!atual) throw new NotFoundException('Funcionario nao encontrado.');
      this.exigirFilial(filiais, atual.filialId);
      await tx.funcionario.update({ where: { id }, data: { fotoAprovada: true } });
      await this.audit(tx, empresaId, autor, 'funcionario.foto_aprovar', 'funcionarios', id, {
        fotoAprovada: true,
      });
      return { id, fotoAprovada: true };
    });
  }

  /** Desligamento = soft delete (guarda legal de 5 anos; nunca apaga). */
  async desligar(id: string, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    const filiais = await this.escopo.filiaisPermitidas(autor);
    return this.prisma.forTenant(async (tx) => {
      const atual = await tx.funcionario.findFirst({ where: { id } });
      if (!atual) throw new NotFoundException('Funcionario nao encontrado.');
      this.exigirFilial(filiais, atual.filialId);
      await tx.funcionario.update({
        where: { id },
        data: { status: StatusFuncionario.DESLIGADO, desativadoEm: new Date() },
      });
      await this.audit(tx, empresaId, autor, 'funcionario.desligar', 'funcionarios', id, {
        status: StatusFuncionario.DESLIGADO,
      });
      return { id, status: StatusFuncionario.DESLIGADO };
    });
  }

  async documentos(funcionarioId: string) {
    return this.prisma.forTenant((tx) =>
      tx.documento.findMany({
        where: { funcionarioId },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          tipo: true,
          status: true,
          nomeArquivo: true,
          motivoRejeicao: true,
          dataValidade: true,
          criadoEm: true,
        },
      }),
    );
  }

  /** Aprova/rejeita um documento enviado (Central de documentos, ADM 2). */
  async decidirDocumento(documentoId: string, dto: DecidirDocumentoDto, autor: UsuarioAutenticado) {
    if (!dto.aprovar && !dto.motivo) {
      throw new BadRequestException('Informe o motivo da rejeicao.');
    }
    const empresaId = TenantContext.requireEmpresaId();
    const filiais = await this.escopo.filiaisPermitidas(autor);
    return this.prisma.forTenant(async (tx) => {
      const doc = await tx.documento.findFirst({
        where: { id: documentoId },
        include: { funcionario: { select: { filialId: true } } },
      });
      if (!doc) throw new NotFoundException('Documento nao encontrado.');
      this.exigirFilial(filiais, doc.funcionario.filialId);
      const status = dto.aprovar ? StatusDocumento.APROVADO : StatusDocumento.REJEITADO;
      const atualizado = await tx.documento.update({
        where: { id: documentoId },
        data: {
          status,
          motivoRejeicao: dto.aprovar ? null : dto.motivo,
          revisadoPorId: autor.sub,
        },
        select: { id: true, status: true },
      });
      await this.audit(tx, empresaId, autor, 'documento.decidir', 'documentos', documentoId, {
        status,
        motivo: dto.motivo ?? null,
      });
      return atualizado;
    });
  }

  /** Documentos vencendo nos proximos 30 dias (ou ja vencidos). */
  async alertasVencimento() {
    const agora = new Date();
    const limite = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
    const docs = await this.prisma.forTenant((tx) =>
      tx.documento.findMany({
        where: { dataValidade: { not: null, lte: limite }, status: StatusDocumento.APROVADO },
        select: { id: true, tipo: true, funcionarioId: true, dataValidade: true },
        orderBy: { dataValidade: 'asc' },
      }),
    );
    return docs
      .filter((d) => d.dataValidade && (venceEmBreve(d.dataValidade, agora) || d.dataValidade < agora))
      .map((d) => ({
        ...d,
        dataValidade: d.dataValidade?.toISOString() ?? null,
        vencido: d.dataValidade ? d.dataValidade < agora : false,
      }));
  }

  /**
   * Importacao em lote (CSV) TUDO-OU-NADA: valida todas as linhas antes de gravar.
   * Se qualquer linha falhar, nada e gravado e retorna o relatorio de erros
   * (linha + campo). Cabecalho esperado: nome,cpf,cargo,jornada.
   */
  async importarCsv(conteudo: string, autor: UsuarioAutenticado) {
    const linhas = conteudo
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (linhas.length < 2) throw new BadRequestException('CSV vazio (esperado cabecalho + linhas).');

    const registros: Array<{ nome: string; cpf: string; cargo?: string; jornada?: string; linha: number }> = [];
    const erros: ErroLinhaCsv[] = [];
    const cpfsNoArquivo = new Set<string>();

    for (let i = 1; i < linhas.length; i++) {
      const nLinha = i + 1;
      const cols = linhas[i]!.split(',').map((c) => c.trim());
      const [nome, cpfBruto, cargo, jornada] = cols;
      if (!nome) erros.push({ linha: nLinha, campo: 'nome', mensagem: 'Nome obrigatorio.' });
      const cpf = normalizarCpf(cpfBruto ?? '');
      if (!isCpfValido(cpf)) {
        erros.push({ linha: nLinha, campo: 'cpf', mensagem: 'CPF invalido.' });
      } else if (cpfsNoArquivo.has(cpf)) {
        erros.push({ linha: nLinha, campo: 'cpf', mensagem: 'CPF duplicado no arquivo.' });
      } else {
        cpfsNoArquivo.add(cpf);
      }
      if (nome && isCpfValido(cpf)) {
        registros.push({ nome, cpf, cargo, jornada, linha: nLinha });
      }
    }

    const empresaId = TenantContext.requireEmpresaId();
    // Duplicidade contra o banco.
    const existentes = await this.prisma.forTenant((tx) =>
      tx.funcionario.findMany({
        where: { cpf: { in: [...cpfsNoArquivo] } },
        select: { cpf: true },
      }),
    );
    const cpfsExistentes = new Set(existentes.map((e) => e.cpf));
    for (const r of registros) {
      if (cpfsExistentes.has(r.cpf)) {
        erros.push({ linha: r.linha, campo: 'cpf', mensagem: 'CPF ja cadastrado no sistema.' });
      }
    }

    if (erros.length > 0) {
      return { ok: false, inseridos: 0, erros };
    }

    // Tudo valido -> grava tudo em uma transacao.
    await this.prisma.forTenant(async (tx) => {
      await tx.funcionario.createMany({
        data: registros.map((r) => ({
          empresaId,
          nome: r.nome,
          cpf: r.cpf,
          cargo: r.cargo || null,
          jornadaContratual: r.jornada || null,
          status: StatusFuncionario.PENDENTE_CADASTRO,
        })),
      });
      await this.audit(tx, empresaId, autor, 'funcionario.importar', 'funcionarios', null, {
        inseridos: registros.length,
      });
    });
    return { ok: true, inseridos: registros.length, erros: [] as ErroLinhaCsv[] };
  }

  /** Checa (puro) se a filial esta no escopo permitido; lanca se restrito e fora. */
  private exigirFilial(filiais: string[] | null, filialId: string | null): void {
    if (filiais === null) return;
    if (!filialId || !filiais.includes(filialId)) {
      throw new ForbiddenException('Acesso restrito as filiais sob sua gestao.');
    }
  }

  private async audit(
    tx: Parameters<Parameters<PrismaService['forTenant']>[0]>[0],
    empresaId: string,
    autor: UsuarioAutenticado,
    acao: string,
    entidade: string,
    entidadeId: string | null,
    valorNovo: unknown,
  ) {
    await tx.logAuditoria.create({
      data: {
        empresaId,
        usuarioId: autor.sub,
        usuarioTipo: 'admin',
        acao,
        entidadeAfetada: entidade,
        entidadeId: entidadeId ?? undefined,
        valorNovo: valorNovo as object,
      },
    });
  }
}
