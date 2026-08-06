import { formatarCpf, isCpfValido, normalizarCpf } from '@repp/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  EstadoVazio,
  Feedback,
  Selecao,
} from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

interface OpcaoRef {
  id: string;
  nome: string;
}

interface Funcionario {
  id: string;
  nome: string;
  cpf: string;
  cargo: string | null;
  status: string;
  fotoAprovada: boolean;
}

interface Documento {
  id: string;
  tipo: string;
  status: string;
  nomeArquivo: string | null;
  motivoRejeicao: string | null;
}

const COR_DOC: Record<string, string> = {
  APROVADO: 'var(--color-teal-success)',
  REJEITADO: 'var(--color-red-alert)',
  EM_ANALISE: 'var(--color-accent)',
  PENDENTE: 'var(--color-amber-warning)',
};
const humaniza = (s: string) => s.toLowerCase().replace(/_/g, ' ');

/** ADM 2 -- Gestao de Funcionarios. */
export function GestaoFuncionarios() {
  const [lista, setLista] = useState<Funcionario[]>([]);
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Funcionario | null>(null);
  const [docs, setDocs] = useState<Documento[]>([]);
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
    setDocs(await apiGet<Documento[]>(`/admin/funcionarios/${f.id}/documentos`));
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
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-4)' }}>
      <CabecalhoPagina
        titulo="Gestão de funcionários"
        subtitulo="Cadastro, convite, aprovação de foto e documentos"
      />
      {erro && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <NovoFuncionario onCriado={carregar} />
          <div style={{ height: 'var(--space-3)' }} />
          <Cartao>
            <input
              placeholder="Buscar por nome ou CPF"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar funcionário"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 44,
                padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                font: '400 15px var(--font-body)',
                marginBottom: 'var(--space-2)',
                background: 'var(--color-surface)',
                color: 'var(--color-navy-900)',
              }}
            />
            {carregando ? (
              <EstadoVazio>Carregando…</EstadoVazio>
            ) : lista.length === 0 ? (
              <EstadoVazio>Nenhum funcionário encontrado.</EstadoVazio>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {lista.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => abrir(f)}
                      style={{
                        display: 'flex',
                        width: '100%',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        minHeight: 44,
                        padding: 'var(--space-2)',
                        border: 'none',
                        borderBottom: '1px solid var(--color-border)',
                        background: sel?.id === f.id ? 'var(--color-neutral-bg)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ flex: 1, font: '500 14px var(--font-body)' }}>{f.nome}</span>
                      <span
                        style={{ font: '12px var(--font-mono)', color: 'var(--color-text-muted)' }}
                      >
                        {f.cpf}
                      </span>
                      <Badge
                        cor={
                          f.status === 'ATIVO' ? 'var(--color-teal-success)' : 'var(--color-border)'
                        }
                      >
                        {humaniza(f.status)}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>

        <div>
          {sel ? (
            <Cartao>
              <h2 style={{ font: '600 18px var(--font-display)', marginTop: 0 }}>{sel.nome}</h2>
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-2)',
                  alignItems: 'center',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <Badge
                  cor={
                    sel.fotoAprovada ? 'var(--color-teal-success)' : 'var(--color-amber-warning)'
                  }
                >
                  {sel.fotoAprovada ? 'foto aprovada' : 'foto pendente'}
                </Badge>
                {!sel.fotoAprovada && (
                  <button onClick={() => aprovarFoto(sel)} style={acao('var(--color-accent)')}>
                    Aprovar foto
                  </button>
                )}
              </div>
              <h3 style={{ font: '600 15px var(--font-body)' }}>Documentos</h3>
              {docs.length === 0 ? (
                <EstadoVazio>Nenhum documento enviado.</EstadoVazio>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {docs.map((d) => (
                    <li
                      key={d.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2) 0',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <span style={{ flex: 1, font: '500 14px var(--font-body)' }}>{d.tipo}</span>
                      <Badge cor={COR_DOC[d.status] ?? 'var(--color-border)'}>
                        {humaniza(d.status)}
                      </Badge>
                      {d.status === 'EM_ANALISE' && (
                        <span style={{ display: 'flex', gap: 'var(--space-1)' }}>
                          <button
                            onClick={() => decidirDoc(d.id, true)}
                            style={acao('var(--color-teal-success)')}
                          >
                            Aprovar
                          </button>
                          <button
                            onClick={() => decidirDoc(d.id, false)}
                            style={acao('var(--color-red-alert)')}
                          >
                            Rejeitar
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <FechamentoMensal funcionarioId={sel.id} />
              <BancoHoras funcionarioId={sel.id} />
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

function NovoFuncionario({ onCriado }: { onCriado: () => void }) {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
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

  async function criar() {
    setErro(null);
    setCodigo(null);
    if (!cpfValido) return setErro('CPF inválido (dígito verificador).');
    if (!filialId)
      return setErro('Selecione a filial (obrigatório para o funcionário bater ponto).');
    try {
      // /convites cria o funcionario E gera o codigo de primeiro acesso de uma vez.
      const r = await apiPost<{ codigo: string; expiraEm: string }>(
        '/convites',
        {
          nome,
          cpf: normalizarCpf(cpf),
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
      <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Novo funcionário</h2>
      <Campo label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <Campo
        label="CPF"
        inputMode="numeric"
        value={cpf.length ? formatarCpf(cpf) : ''}
        onChange={(e) => setCpf(normalizarCpf(e.target.value))}
        erro={cpf.length >= 11 && !cpfValido ? 'Dígito verificador inválido' : undefined}
        placeholder="000.000.000-00"
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
        <div style={{ marginBottom: 'var(--space-3)' }}>
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
        <div style={{ marginBottom: 'var(--space-2)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}
      {codigo && (
        <div style={{ margin: 'var(--space-2) 0' }}>
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
    <div
      style={{
        marginTop: 'var(--space-3)',
        borderTop: '1px solid var(--color-border)',
        paddingTop: 'var(--space-3)',
      }}
    >
      <h3 style={{ font: '600 15px var(--font-body)', marginTop: 0 }}>
        Fechamento mensal (espelho de ponto)
      </h3>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Campo
            label="Competência"
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Botao onClick={gerar} disabled={!competencia}>
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

  return (
    <div
      style={{
        marginTop: 'var(--space-3)',
        borderTop: '1px solid var(--color-border)',
        paddingTop: 'var(--space-3)',
      }}
    >
      <h3 style={{ font: '600 15px var(--font-body)', marginTop: 0 }}>Banco de horas ({comp})</h3>
      {dados && (
        <div style={{ font: '13px var(--font-body)', marginBottom: 'var(--space-2)' }}>
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
          <div style={{ color: 'var(--color-text-muted)', font: '12px var(--font-body)' }}>
            {dados.observacao}
          </div>
          {dados.alertas.map((a, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              <Badge cor="var(--color-amber-warning)">{a}</Badge>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
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
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Botao onClick={lancar} disabled={!min || !motivo}>
            Lançar
          </Botao>
        </div>
      </div>
      {erro && <Feedback tom="erro">{erro}</Feedback>}
    </div>
  );
}

function acao(cor: string) {
  return {
    minHeight: 44,
    padding: '0 var(--space-3)',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: cor,
    color: 'var(--color-navy-deep)',
    cursor: 'pointer',
    font: '600 12px var(--font-body)',
  } as const;
}
