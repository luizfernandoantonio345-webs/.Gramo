import {
  formatarCpf,
  formatarNis,
  isCpfValido,
  isNisValido,
  normalizarCpf,
  soDigitosNis,
} from '@repp/shared';
import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import {
  Badge,
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  EstadoVazio,
  Feedback,
  Selecao,
  TituloSecao,
} from '../design-system/components';
import { apiGet, apiPatch, apiPost } from '../lib/api';

interface OpcaoRef {
  id: string;
  nome: string;
}

interface Funcionario {
  id: string;
  nome: string;
  cpf: string;
  pis: string | null;
  cargo: string | null;
  salarioBase: number | null;
  status: string;
  fotoAprovada: boolean;
  fotoPendente?: boolean;
}

interface Documento {
  id: string;
  tipo: string;
  status: string;
  nomeArquivo: string | null;
  motivoRejeicao: string | null;
}

const COR_DOC: Record<string, string> = {
  APROVADO: 'var(--color-success)',
  REJEITADO: 'var(--color-danger)',
  EM_ANALISE: 'var(--color-accent)',
  PENDENTE: 'var(--color-warning)',
};
const humaniza = (s: string) => s.toLowerCase().replace(/_/g, ' ');

/** ADM 2 -- Gestao de Funcionarios. */
export function GestaoFuncionarios() {
  const [lista, setLista] = useState<Funcionario[]>([]);
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Funcionario | null>(null);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [fotoRef, setFotoRef] = useState<{
    disponivel: boolean;
    aprovada: boolean;
    fotoBase64?: string;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const q = busca ? `?busca=${encodeURIComponent(busca)}` : '';
      setLista(await apiGet<Funcionario[]>(`/admin/funcionarios${q}`));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function abrir(f: Funcionario) {
    setSel(f);
    setFotoRef(null);
    setDocs(await apiGet<Documento[]>(`/admin/funcionarios/${f.id}/documentos`));
    setFotoRef(
      await apiGet<{ disponivel: boolean; aprovada: boolean; fotoBase64?: string }>(
        `/admin/funcionarios/${f.id}/foto-referencia`,
      ).catch(() => null),
    );
  }

  async function decidirDoc(id: string, aprovar: boolean) {
    const motivo = aprovar ? undefined : (window.prompt('Motivo da rejeição:') ?? undefined);
    if (!aprovar && !motivo) return;
    await apiPost(`/admin/documentos/${id}/decidir`, { aprovar, motivo }, true);
    if (sel) await abrir(sel);
  }

  async function aprovarFoto(f: Funcionario) {
    await apiPost(`/admin/funcionarios/${f.id}/foto/aprovar`, {}, true);
    await carregar();
    setSel({ ...f, fotoAprovada: true });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <CabecalhoPagina
        titulo="Funcionários"
        subtitulo="Cadastro, convite, aprovação de foto e documentos"
      />
      {erro && <Feedback tom="erro">{erro}</Feedback>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <NovoFuncionario onCriado={carregar} />
          <ImportarLote onImportado={carregar} />
          <Cartao padding="var(--space-5)">
            <input
              className="g-input"
              placeholder="Buscar por nome ou CPF"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar funcionário"
              style={{ marginBottom: 'var(--space-4)' }}
            />
            {carregando ? (
              <EstadoVazio>Carregando…</EstadoVazio>
            ) : lista.length === 0 ? (
              <EstadoVazio>Nenhum funcionário encontrado.</EstadoVazio>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {lista.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => abrir(f)}
                    className={`g-nav-item${sel?.id === f.id ? ' g-nav-item--active' : ''}`}
                  >
                    <span style={{ flex: 1, fontWeight: 500 }}>{f.nome}</span>
                    {f.fotoPendente && <Badge cor="var(--color-warning)">foto p/ aprovar</Badge>}
                    <span
                      style={{
                        font: 'var(--text-xs) var(--font-mono)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {f.cpf}
                    </span>
                    <Badge
                      cor={
                        f.status === 'ATIVO' ? 'var(--color-success)' : 'var(--color-text-muted)'
                      }
                    >
                      {humaniza(f.status)}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </Cartao>
        </div>

        <div>
          {sel ? (
            <Cartao>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                <div>
                  <h2
                    style={{
                      font: '600 var(--text-xl) var(--font-display)',
                      letterSpacing: '-0.01em',
                      margin: '0 0 var(--space-3)',
                    }}
                  >
                    {sel.nome}
                  </h2>
                  <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                    {fotoRef?.disponivel && fotoRef.fotoBase64 ? (
                      <img
                        src={fotoRef.fotoBase64}
                        alt={`Foto de referência de ${sel.nome}`}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 'var(--radius-md)',
                          objectFit: 'cover',
                          border: `2px solid ${sel.fotoAprovada ? 'var(--color-success)' : 'var(--color-warning)'}`,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--color-surface-2)',
                          border: '1px dashed var(--color-border-strong)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          font: 'var(--text-xs) var(--font-body)',
                          color: 'var(--color-text-faint)',
                          textAlign: 'center',
                          padding: 4,
                        }}
                      >
                        sem foto
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        gap: 'var(--space-3)',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Badge
                        cor={sel.fotoAprovada ? 'var(--color-success)' : 'var(--color-warning)'}
                      >
                        {sel.fotoAprovada
                          ? 'foto aprovada'
                          : fotoRef?.disponivel
                            ? 'aguardando aprovação'
                            : 'sem foto de referência'}
                      </Badge>
                      {!sel.fotoAprovada && fotoRef?.disponivel && (
                        <Botao tamanho="sm" bloco={false} onClick={() => aprovarFoto(sel)}>
                          Aprovar foto
                        </Botao>
                      )}
                    </div>
                  </div>
                </div>

                <EditarFolha key={sel.id} funcionario={sel} onSalvo={(f) => setSel(f)} />

                <div>
                  <TituloSecao>Documentos</TituloSecao>
                  {docs.length === 0 ? (
                    <EstadoVazio>Nenhum documento enviado.</EstadoVazio>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {docs.map((d) => (
                        <div
                          key={d.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 'var(--space-3)',
                            padding: 'var(--space-4) 0',
                            borderBottom: '1px solid var(--color-divider)',
                          }}
                        >
                          <span style={{ flex: 1, fontWeight: 500 }}>{d.tipo}</span>
                          <Badge cor={COR_DOC[d.status] ?? 'var(--color-text-muted)'}>
                            {humaniza(d.status)}
                          </Badge>
                          {d.status === 'EM_ANALISE' && (
                            <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
                              <Botao
                                tamanho="sm"
                                bloco={false}
                                onClick={() => decidirDoc(d.id, true)}
                              >
                                Aprovar
                              </Botao>
                              <Botao
                                tamanho="sm"
                                variante="perigo"
                                bloco={false}
                                onClick={() => decidirDoc(d.id, false)}
                              >
                                Rejeitar
                              </Botao>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <FechamentoMensal funcionarioId={sel.id} />
                <BancoHoras funcionarioId={sel.id} />
              </div>
            </Cartao>
          ) : (
            <Cartao>
              <EstadoVazio>Selecione um funcionário para ver documentos e fechamento.</EstadoVazio>
            </Cartao>
          )}
        </div>
      </div>
    </div>
  );
}

interface ResultadoImport {
  ok: boolean;
  inseridos: number;
  erros: Array<{ linha: number; campo: string; mensagem: string }>;
}

const MODELO_CSV = `nome,cpf,cargo,obra,jornada
José da Silva,529.982.247-25,Pedreiro,Canteiro Suape,Administrativo (08h-18h)
Maria Souza,168.995.350-09,Mestre de obras,Canteiro Suape,`;

/** ADM 2 -- Importacao em lote de funcionarios por CSV (tudo-ou-nada). */
function ImportarLote({ onImportado }: { onImportado: () => void }) {
  const [conteudo, setConteudo] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [res, setRes] = useState<ResultadoImport | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function baixarModelo() {
    const url = URL.createObjectURL(new Blob([MODELO_CSV], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-funcionarios.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(file.name);
    setConteudo(await file.text());
    setRes(null);
    setErro(null);
  }

  async function importar() {
    setErro(null);
    setRes(null);
    setEnviando(true);
    try {
      const r = await apiPost<ResultadoImport>('/admin/funcionarios/importar', { conteudo }, true);
      setRes(r);
      if (r.ok) {
        setConteudo('');
        setNomeArquivo('');
        onImportado();
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao importar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Cartao padding="var(--space-5)">
      <TituloSecao>Importar em lote (CSV)</TituloSecao>
      <p
        style={{
          font: 'var(--text-sm) var(--font-body)',
          color: 'var(--color-text-muted)',
          margin: '0 0 var(--space-4)',
        }}
      >
        Colunas: <strong>nome, cpf, obra</strong> (obrigatórias) + cargo, jornada (opcionais). A
        obra e a jornada devem existir com o mesmo nome. Importação tudo-ou-nada.
      </p>

      <div
        style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}
      >
        <label className="g-btn g-btn--sm g-btn--secondary" style={{ cursor: 'pointer' }}>
          {nomeArquivo || 'Escolher arquivo .csv'}
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={aoEscolher}
            style={{ display: 'none' }}
          />
        </label>
        <button type="button" className="g-link" onClick={baixarModelo} style={btnLink}>
          Baixar modelo
        </button>
      </div>

      {conteudo && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Botao onClick={importar} disabled={enviando} bloco={false}>
            {enviando ? 'Importando…' : 'Importar'}
          </Botao>
        </div>
      )}

      {erro && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}

      {res?.ok && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Feedback tom="sucesso">
            {res.inseridos} funcionário(s) importado(s) com sucesso.
          </Feedback>
        </div>
      )}

      {res && !res.ok && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Feedback tom="erro">
            Nada foi importado — corrija {res.erros.length} erro(s) e tente de novo:
          </Feedback>
          <div style={{ marginTop: 'var(--space-3)', maxHeight: 220, overflowY: 'auto' }}>
            {res.erros.map((e, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-2) 0',
                  borderBottom: '1px solid var(--color-divider)',
                  font: 'var(--text-sm) var(--font-body)',
                }}
              >
                <span
                  style={{
                    font: 'var(--text-xs) var(--font-mono)',
                    color: 'var(--color-text-muted)',
                    minWidth: 60,
                  }}
                >
                  linha {e.linha}
                </span>
                <span>
                  <strong>{e.campo}</strong>: {e.mensagem}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Cartao>
  );
}

const btnLink = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: '500 var(--text-sm) var(--font-body)',
} as const;

function EditarFolha({
  funcionario,
  onSalvo,
}: {
  funcionario: Funcionario;
  onSalvo: (f: Funcionario) => void;
}) {
  const [cargo, setCargo] = useState(funcionario.cargo ?? '');
  const [salario, setSalario] = useState(
    funcionario.salarioBase != null ? String(funcionario.salarioBase) : '',
  );
  const [pis, setPis] = useState(funcionario.pis ? formatarNis(funcionario.pis) : '');
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const pisDigitos = soDigitosNis(pis);
  const pisValido = pisDigitos.length === 0 || isNisValido(pisDigitos);

  async function salvar() {
    setSalvando(true);
    setFeedback(null);
    try {
      if (pisDigitos.length > 0 && !pisValido) {
        setFeedback({ ok: false, msg: 'PIS/PASEP inválido (dígito verificador).' });
        return;
      }
      const salarioNum = salario ? parseFloat(salario.replace(',', '.')) : undefined;
      if (salario && (isNaN(salarioNum!) || salarioNum! <= 0)) {
        setFeedback({ ok: false, msg: 'Salário deve ser um número positivo.' });
        return;
      }
      await apiPatch(`/admin/funcionarios/${funcionario.id}`, {
        pis: pisDigitos || undefined,
        cargo: cargo || undefined,
        salarioBase: salarioNum,
      });
      onSalvo({
        ...funcionario,
        pis: pisDigitos || null,
        cargo: cargo || null,
        salarioBase: salarioNum ?? null,
      });
      setFeedback({ ok: true, msg: 'Dados de folha atualizados.' });
    } catch (e) {
      setFeedback({ ok: false, msg: e instanceof Error ? e.message : 'Falha ao salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <TituloSecao>Dados de folha e compliance</TituloSecao>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Campo
          label="PIS / PASEP (NIS)"
          inputMode="numeric"
          value={pisDigitos.length ? formatarNis(pis) : ''}
          onChange={(e) => setPis(e.target.value)}
          erro={pisDigitos.length >= 11 && !pisValido ? 'Dígito verificador inválido' : undefined}
          placeholder="000.00.000.00-0"
          dica="Obrigatório para geração do AFD (Portaria 671). Carteira de trabalho ou holerite."
        />
        <Campo label="Cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} />
        <Campo
          label="Salário base (R$)"
          inputMode="decimal"
          value={salario}
          onChange={(e) => setSalario(e.target.value)}
          placeholder="ex.: 3380.00"
          dica="usado na apuração de horas quando não há valor-hora padrão"
        />
        {feedback && <Feedback tom={feedback.ok ? 'sucesso' : 'erro'}>{feedback.msg}</Feedback>}
        <Botao tamanho="sm" bloco={false} onClick={() => void salvar()} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Botao>
      </div>
    </div>
  );
}

function NovoFuncionario({ onCriado }: { onCriado: () => void }) {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [pis, setPis] = useState('');
  const [cargo, setCargo] = useState('');
  const [email, setEmail] = useState('');
  const [filialId, setFilialId] = useState('');
  const [jornadaId, setJornadaId] = useState('');
  const [filiais, setFiliais] = useState<OpcaoRef[]>([]);
  const [jornadas, setJornadas] = useState<OpcaoRef[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setFiliais(await apiGet<OpcaoRef[]>('/admin/configuracoes/filiais'));
        setJornadas(await apiGet<OpcaoRef[]>('/admin/configuracoes/jornadas'));
      } catch {
        /* mantem vazio; a validacao abaixo orienta */
      }
    })();
  }, []);

  const cpfValido = isCpfValido(cpf);
  const pisDigitos = soDigitosNis(pis);
  const pisValido = pisDigitos.length === 0 || isNisValido(pisDigitos);

  async function criar() {
    setErro(null);
    setCodigo(null);
    if (!cpfValido) return setErro('CPF inválido (dígito verificador).');
    if (pisDigitos.length > 0 && !pisValido)
      return setErro('PIS/PASEP inválido (dígito verificador).');
    if (!filialId)
      return setErro('Selecione a filial (obrigatório para o funcionário bater ponto).');
    try {
      const r = await apiPost<{ codigo: string; expiraEm: string }>(
        '/convites',
        {
          nome,
          cpf: normalizarCpf(cpf),
          pis: pisDigitos || undefined,
          cargo: cargo || undefined,
          email: email || undefined,
          filialId,
          jornadaId: jornadaId || undefined,
        },
        true,
      );
      setCodigo(r.codigo);
      setNome('');
      setCpf('');
      setPis('');
      setCargo('');
      setEmail('');
      setJornadaId('');
      onCriado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao cadastrar.');
    }
  }

  return (
    <Cartao>
      <TituloSecao>Novo funcionário</TituloSecao>
      <Campo label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <Campo
        label="CPF"
        inputMode="numeric"
        value={cpf.length ? formatarCpf(cpf) : ''}
        onChange={(e) => setCpf(normalizarCpf(e.target.value))}
        erro={cpf.length >= 11 && !cpfValido ? 'Dígito verificador inválido' : undefined}
        placeholder="000.000.000-00"
      />
      <Campo
        label="PIS / PASEP (NIS)"
        inputMode="numeric"
        value={pisDigitos.length ? formatarNis(pis) : ''}
        onChange={(e) => setPis(e.target.value)}
        erro={pisDigitos.length >= 11 && !pisValido ? 'Dígito verificador inválido' : undefined}
        placeholder="000.00.000.00-0"
        dica="Obrigatório para geração do AFD (Portaria 671). Carteira de trabalho ou holerite."
      />
      <Campo label="Cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} />
      <Campo
        label="E-mail (recebe o convite / recuperação)"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="opcional"
      />
      <Selecao label="Filial" value={filialId} onChange={(e) => setFilialId(e.target.value)}>
        <option value="">Selecione…</option>
        {filiais.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
          </option>
        ))}
      </Selecao>
      {filiais.length === 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <Feedback tom="aviso">
            Nenhuma filial cadastrada. Crie uma em Configurações &gt; Filiais.
          </Feedback>
        </div>
      )}
      <Selecao
        label="Jornada (opcional)"
        value={jornadaId}
        onChange={(e) => setJornadaId(e.target.value)}
      >
        <option value="">Sem jornada definida</option>
        {jornadas.map((j) => (
          <option key={j.id} value={j.id}>
            {j.nome}
          </option>
        ))}
      </Selecao>
      {erro && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}
      {codigo && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Feedback tom="sucesso">
            Código de 1º acesso: <strong>{codigo}</strong> — informe ao funcionário (também enviado
            por e-mail).
          </Feedback>
        </div>
      )}
      <Botao onClick={criar} disabled={!nome || !cpf || !filialId}>
        Cadastrar e gerar convite
      </Botao>
    </Cartao>
  );
}

function FechamentoMensal({ funcionarioId }: { funcionarioId: string }) {
  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const [competencia, setCompetencia] = useState(mesAtual);
  const [feedback, setFeedback] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);

  async function gerar() {
    setFeedback(null);
    try {
      const r = await apiPost<{ titulo: string }>(
        '/admin/fechamentos',
        { funcionarioId, competencia },
        true,
      );
      setFeedback({
        tom: 'sucesso',
        texto: `${r.titulo} gerado e enviado para assinatura do funcionário.`,
      });
    } catch (e) {
      setFeedback({
        tom: 'erro',
        texto: e instanceof Error ? e.message : 'Falha ao gerar fechamento.',
      });
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-5)' }}>
      <TituloSecao>Fechamento mensal (espelho de ponto)</TituloSecao>
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Campo
            label="Competência"
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <Botao onClick={gerar} disabled={!competencia} bloco={false}>
            Gerar espelho
          </Botao>
        </div>
      </div>
      {feedback && <Feedback tom={feedback.tom}>{feedback.texto}</Feedback>}
    </div>
  );
}

interface Consolidado {
  regime: string;
  saldoFormatado: string | null;
  extrasMin: number;
  faltasMin: number;
  ajustesMin: number;
  observacao: string;
  alertas: string[];
  noturno?: { relogioMin: number; formatado: string; adicionalMin: number; percentual: number };
}

function BancoHoras({ funcionarioId }: { funcionarioId: string }) {
  const hoje = new Date();
  const ini = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const fimStr = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`;
  const comp = ini.slice(0, 7);
  const [dados, setDados] = useState<Consolidado | null>(null);
  const [min, setMin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setDados(
        await apiGet<Consolidado>(
          `/admin/banco-horas/${funcionarioId}?inicio=${ini}T00:00:00Z&fim=${fimStr}T23:59:59Z&competencia=${comp}`,
        ),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar banco de horas.');
    }
  }, [funcionarioId, ini, fimStr, comp]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function lancar() {
    setErro(null);
    const m = Number(min);
    if (!Number.isInteger(m) || m === 0) return setErro('Informe minutos (+credita / -debita).');
    if (motivo.trim().length < 3) return setErro('Descreva o motivo.');
    try {
      await apiPost(
        '/admin/banco-horas/ajuste',
        {
          funcionarioId,
          minutos: m,
          tipo: m > 0 ? 'CREDITO_MANUAL' : 'DEBITO_MANUAL',
          motivo,
          competencia: comp,
        },
        true,
      );
      setMin('');
      setMotivo('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao lançar ajuste.');
    }
  }

  async function baixarPdf() {
    setErro(null);
    try {
      const r = await apiPost<{ nomeArquivo: string; conteudoBase64: string }>(
        `/admin/relatorios/espelho-pdf/${funcionarioId}`,
        { inicio: `${ini}T00:00:00Z`, fim: `${fimStr}T23:59:59Z`, competencia: comp },
        true,
      );
      const bin = atob(r.conteudoBase64);
      const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = r.nomeArquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar o PDF.');
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-5)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <TituloSecao>Banco de horas · {comp}</TituloSecao>
        <Botao tamanho="sm" variante="secundario" bloco={false} onClick={baixarPdf}>
          Espelho (PDF)
        </Botao>
      </div>
      {dados && (
        <div
          style={{
            font: 'var(--text-sm) var(--font-body)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          <div>
            Regime: <strong>{dados.regime}</strong>
          </div>
          <div>
            Saldo: <strong>{dados.saldoFormatado ?? '—'}</strong> · extras {dados.extrasMin}min ·
            faltas {dados.faltasMin}min · ajustes {dados.ajustesMin}min
          </div>
          {dados.noturno && dados.noturno.relogioMin > 0 && (
            <div>
              Noturno (art. 73): <strong>{dados.noturno.formatado}</strong> (hora reduzida) +
              adicional {Math.round(dados.noturno.percentual * 100)}% ={' '}
              <strong>{dados.noturno.adicionalMin}min</strong>
            </div>
          )}
          <div
            style={{ color: 'var(--color-text-muted)', font: 'var(--text-xs) var(--font-body)' }}
          >
            {dados.observacao}
          </div>
          {dados.alertas.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-1)',
              }}
            >
              {dados.alertas.map((a, i) => (
                <Badge key={i} cor="var(--color-warning)">
                  {a}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
        <div style={{ width: 120 }}>
          <Campo
            label="Ajuste (min)"
            inputMode="numeric"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="+/- min"
          />
        </div>
        <div style={{ flex: 1 }}>
          <Campo
            label="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="ex.: compensação acordada"
          />
        </div>
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <Botao onClick={lancar} disabled={!min || !motivo} bloco={false}>
            Lançar
          </Botao>
        </div>
      </div>
      {erro && <Feedback tom="erro">{erro}</Feedback>}
    </div>
  );
}
