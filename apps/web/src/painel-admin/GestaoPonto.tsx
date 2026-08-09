import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  EstadoVazio,
  Feedback,
  Kpi,
  LinhaLista,
  TituloSecao,
} from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

// Mapa (Leaflet) carregado sob demanda -- nao pesa o bundle principal.
const MapaObras = lazy(() => import('./MapaObras'));

interface Dashboard {
  marcacoesHoje: number;
  foraRegapHoje: number;
  excecoesPendentes: number;
  funcionariosPresentes: number;
}

interface ItemExcecao {
  id: string;
  tipo: string;
  motivo: string | null;
  funcionario: { nome: string; cpf: string };
  ponto: { nsr: number; tipo: string; registradoEm: string; dentroRegap: boolean };
}

interface Regap {
  id: string;
  nome: string;
  raioMetros: number;
  ativo: boolean;
  latitudeCentro: string | number;
  longitudeCentro: string | number;
}

/** ADM 4 -- Gestao de Ponto: dashboard, fila de excecoes e REGAP. */
export function GestaoPonto() {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [excecoes, setExcecoes] = useState<ItemExcecao[]>([]);
  const [regaps, setRegaps] = useState<Regap[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [d, e, r] = await Promise.all([
        apiGet<Dashboard>('/admin/pontos/dashboard'),
        apiGet<ItemExcecao[]>('/admin/pontos/excecoes'),
        apiGet<Regap[]>('/admin/regaps'),
      ]);
      setDash(d);
      setExcecoes(e);
      setRegaps(r);
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function decidir(id: string, aprovar: boolean) {
    const motivoResposta = window.prompt(
      aprovar ? 'Justificativa da aprovação:' : 'Justificativa da recusa:',
    );
    if (!motivoResposta) return;
    try {
      await apiPost(`/admin/pontos/excecoes/${id}/decidir`, { aprovar, motivoResposta }, true);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao decidir.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <CabecalhoPagina
        titulo="Gestão de ponto"
        subtitulo="Fila de exceções, presença do dia e áreas REGAP"
      />

      {erro && <Feedback tom="erro">{erro}</Feedback>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        <Kpi rotulo="Presentes" valor={dash?.funcionariosPresentes ?? '—'} />
        <Kpi rotulo="Marcações hoje" valor={dash?.marcacoesHoje ?? '—'} />
        <Kpi
          rotulo="Fora da REGAP"
          valor={dash?.foraRegapHoje ?? '—'}
          tom={dash && dash.foraRegapHoje > 0 ? 'aviso' : 'neutro'}
        />
        <Kpi
          rotulo="Pendências"
          valor={dash?.excecoesPendentes ?? '—'}
          tom={dash && dash.excecoesPendentes > 0 ? 'alerta' : 'ok'}
        />
      </div>

      {/* Fila de excecoes -- superficie de decisao principal do RH */}
      <Cartao>
        <TituloSecao>Fila de exceções</TituloSecao>
        {carregando ? (
          <EstadoVazio>Carregando…</EstadoVazio>
        ) : excecoes.length === 0 ? (
          <EstadoVazio>Nenhuma pendência — exceções em dia.</EstadoVazio>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {excecoes.map((e) => (
              <LinhaLista key={e.id}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong style={{ font: '600 var(--text-md) var(--font-body)' }}>
                      {e.funcionario.nome}
                    </strong>
                    <Badge cor="var(--color-warning)">{e.tipo}</Badge>
                  </div>
                  <div
                    style={{
                      font: 'var(--text-xs) var(--font-mono)',
                      color: 'var(--color-text-muted)',
                      marginTop: 'var(--space-2)',
                    }}
                  >
                    NSR {e.ponto.nsr} · {new Date(e.ponto.registradoEm).toLocaleString('pt-BR')}
                    {e.ponto.dentroRegap ? '' : ' · fora da área'}
                  </div>
                  {e.motivo && (
                    <div
                      style={{
                        font: '400 var(--text-sm) var(--font-body)',
                        color: 'var(--color-text-muted)',
                        marginTop: 'var(--space-2)',
                      }}
                    >
                      “{e.motivo}”
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flex: '0 0 auto' }}>
                  <Botao tamanho="sm" bloco={false} onClick={() => decidir(e.id, true)}>
                    Aprovar
                  </Botao>
                  <Botao
                    tamanho="sm"
                    variante="perigo"
                    bloco={false}
                    onClick={() => decidir(e.id, false)}
                  >
                    Recusar
                  </Botao>
                </div>
              </LinhaLista>
            ))}
          </div>
        )}
      </Cartao>

      <NovaRegap onCriada={carregar} />

      <Cartao>
        <TituloSecao>Áreas (REGAP)</TituloSecao>
        {regaps.length === 0 ? (
          <EstadoVazio>Nenhuma área cadastrada.</EstadoVazio>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Suspense
              fallback={
                <div
                  style={{
                    height: 320,
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-5)',
                  }}
                  className="g-skel"
                />
              }
            >
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <MapaObras
                  obras={regaps
                    .map((r) => ({
                      nome: r.nome,
                      lat: Number(r.latitudeCentro),
                      lng: Number(r.longitudeCentro),
                      raio: r.raioMetros,
                      ativo: r.ativo,
                    }))
                    .filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lng) && o.lat !== 0)}
                />
              </div>
            </Suspense>
            {regaps.map((r) => (
              <LinhaLista key={r.id}>
                <span style={{ flex: 1, fontWeight: 500 }}>{r.nome}</span>
                <span
                  style={{
                    font: 'var(--text-sm) var(--font-mono)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  raio {r.raioMetros} m
                </span>
                <Badge cor={r.ativo ? 'var(--color-success)' : 'var(--color-text-muted)'}>
                  {r.ativo ? 'ativa' : 'inativa'}
                </Badge>
              </LinhaLista>
            ))}
          </div>
        )}
      </Cartao>
    </div>
  );
}

function NovaRegap({ onCriada }: { onCriada: () => void }) {
  const [nome, setNome] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [raio, setRaio] = useState('150');
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  async function criar() {
    setErro(null);
    setCriando(true);
    try {
      await apiPost(
        '/admin/regaps',
        {
          nome,
          latitudeCentro: Number(lat),
          longitudeCentro: Number(lng),
          raioMetros: Number(raio),
        },
        true,
      );
      setNome('');
      setLat('');
      setLng('');
      onCriada();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao criar REGAP.');
    } finally {
      setCriando(false);
    }
  }

  return (
    <Cartao>
      <TituloSecao>Nova área (REGAP)</TituloSecao>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <Campo label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Campo label="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
        <Campo label="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
        <Campo label="Raio (m)" value={raio} onChange={(e) => setRaio(e.target.value)} />
      </div>
      {erro && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}
      <Botao onClick={criar} disabled={!nome || !lat || !lng || criando} bloco={false}>
        {criando ? 'Criando…' : 'Criar área'}
      </Botao>
    </Cartao>
  );
}
