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

type TomFeedback = 'sucesso' | 'erro' | 'aviso' | 'info';

interface Exportacao {
  id: string;
  tipoArquivo: string;
  periodoReferencia: string;
  totalRegistros: number;
  hashArquivo: string;
  criadoEm: string;
}

interface FilialRef {
  id: string;
  nome: string;
}

/** ADM 6 -- Relatorios e Exportacoes legais (AFD/AEJ, fiscalizacao). */
export function PainelRelatorios() {
  const [inicio, setInicio] = useState('2026-07-01');
  const [fim, setFim] = useState('2026-07-31');
  const [filialId, setFilialId] = useState('');
  const [filiais, setFiliais] = useState<FilialRef[]>([]);
  const [lista, setLista] = useState<Exportacao[]>([]);
  const [feedback, setFeedback] = useState<{ tom: TomFeedback; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      setLista(await apiGet<Exportacao[]>('/admin/exportacoes'));
      setFiliais(await apiGet<FilialRef[]>('/admin/configuracoes/filiais'));
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao carregar.' });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function periodo() {
    return {
      inicio: new Date(inicio).toISOString(),
      fim: new Date(`${fim}T23:59:59`).toISOString(),
      // AFD/AEJ sao por estabelecimento (NSR sequencial por filial).
      ...(filialId ? { filialId } : {}),
    };
  }

  async function gerar(tipo: 'afd' | 'aej') {
    setFeedback(null);
    try {
      const r = await apiPost<{ hashArquivo: string; totalRegistros: number }>(
        `/admin/exportacoes/${tipo}`,
        periodo(),
        true,
      );
      setFeedback({
        tom: 'sucesso',
        texto: `${tipo.toUpperCase()} gerado: ${r.totalRegistros} registros · hash ${r.hashArquivo.slice(0, 16)}…`,
      });
      await carregar();
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao gerar.' });
    }
  }

  async function pacote() {
    setFeedback(null);
    try {
      const r = await apiPost<{
        afd: { hash: string };
        aej: { hash: string };
        trilha: { marcacoes: number };
      }>('/admin/relatorios/fiscalizacao', periodo(), true);
      setFeedback({
        tom: 'sucesso',
        texto: `Pacote gerado (AFD + AEJ + trilha). Marcações: ${r.trilha.marcacoes}.`,
      });
      await carregar();
    } catch (e) {
      setFeedback({
        tom: 'erro',
        texto: e instanceof Error ? e.message : 'Falha ao gerar pacote.',
      });
    }
  }

  async function baixarCsv() {
    setFeedback(null);
    try {
      const r = await apiPost<{ nomeArquivo: string; conteudo: string; totalMarcacoes: number }>(
        '/admin/relatorios/espelho-csv',
        periodo(),
        true,
      );
      const blob = new Blob([r.conteudo], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.nomeArquivo;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback({
        tom: 'sucesso',
        texto: `Espelho gerado: ${r.totalMarcacoes} marcações (CSV).`,
      });
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao gerar CSV.' });
    }
  }

  async function baixar(id: string, tipo: string) {
    const r = await apiGet<{
      conteudoBase64: string;
      integridadeOk: boolean;
      assinaturaValida: boolean;
    }>(`/admin/exportacoes/${id}/download`);
    const a = document.createElement('a');
    a.href = `data:application/octet-stream;base64,${r.conteudoBase64}`;
    a.download = `${tipo}_${id.slice(0, 8)}.txt`;
    a.click();
    const ok = r.integridadeOk && r.assinaturaValida;
    setFeedback({
      tom: ok ? 'sucesso' : 'erro',
      texto: `Download ${tipo} · integridade ${r.integridadeOk ? 'OK' : 'FALHOU'} · assinatura ${r.assinaturaValida ? 'válida' : 'inválida'}.`,
    });
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-4)' }}>
      <CabecalhoPagina
        titulo="Relatórios e exportações"
        subtitulo="Portaria 671: AFD, AEJ e pacote de fiscalização (com hash + assinatura do servidor)"
      />
      {feedback && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom={feedback.tom}>{feedback.texto}</Feedback>
        </div>
      )}

      <Cartao>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
          <Campo
            label="Início"
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
          <Campo label="Fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <Selecao
          label="Filial (obrigatória p/ AFD quando há mais de uma)"
          value={filialId}
          onChange={(e) => setFilialId(e.target.value)}
        >
          <option value="">Todas / única filial</option>
          {filiais.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </Selecao>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Botao onClick={() => gerar('afd')}>Gerar AFD</Botao>
          <Botao onClick={() => gerar('aej')}>Gerar AEJ</Botao>
          <Botao variante="secundario" onClick={pacote}>
            Pacote fiscalização
          </Botao>
          <Botao variante="secundario" onClick={baixarCsv}>
            Espelho (CSV/Excel)
          </Botao>
        </div>
      </Cartao>

      <div style={{ height: 'var(--space-3)' }} />
      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Exportações geradas</h2>
        {carregando ? (
          <EstadoVazio>Carregando…</EstadoVazio>
        ) : lista.length === 0 ? (
          <EstadoVazio>Nenhuma exportação gerada.</EstadoVazio>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {lista.map((e) => (
              <li
                key={e.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <Badge cor="var(--color-navy-900)">{e.tipoArquivo}</Badge>
                <span style={{ font: '12px var(--font-mono)' }}>{e.periodoReferencia}</span>
                <span style={{ font: '12px var(--font-body)' }}>{e.totalRegistros} reg.</span>
                <span style={{ font: '11px var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  {e.hashArquivo.slice(0, 12)}…
                </span>
                <button
                  onClick={() => baixar(e.id, e.tipoArquivo)}
                  style={{
                    minHeight: 44,
                    padding: '0 var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-accent)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    font: '600 13px var(--font-body)',
                  }}
                >
                  Baixar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
