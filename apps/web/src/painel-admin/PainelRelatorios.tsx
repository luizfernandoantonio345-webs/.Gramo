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
  Tabela,
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
  const [competencia, setCompetencia] = useState('2026-07');
  const [gerandoFechamento, setGerandoFechamento] = useState(false);
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

  async function fechamentoObra() {
    setFeedback(null);
    setGerandoFechamento(true);
    try {
      const r = await apiPost<{
        nomeArquivo: string;
        conteudoBase64: string;
        totalFuncionarios: number;
      }>('/admin/relatorios/fechamento-obra', { filialId, competencia }, true);
      const bin = atob(r.conteudoBase64);
      const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = r.nomeArquivo;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback({
        tom: 'sucesso',
        texto: `Fechamento gerado: ${r.totalFuncionarios} funcionário(s) na obra (PDF).`,
      });
    } catch (e) {
      setFeedback({
        tom: 'erro',
        texto: e instanceof Error ? e.message : 'Falha ao gerar o fechamento.',
      });
    } finally {
      setGerandoFechamento(false);
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

  const tituloCartao = {
    font: '600 var(--text-lg) var(--font-display)',
    letterSpacing: '-0.01em',
    margin: '0 0 var(--space-5)',
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <CabecalhoPagina
        titulo="Relatórios e exportações"
        subtitulo="Portaria 671: AFD, AEJ e pacote de fiscalização (com hash + assinatura do servidor)"
      />
      {feedback && <Feedback tom={feedback.tom}>{feedback.texto}</Feedback>}

      <Cartao>
        <h2 style={tituloCartao}>Exportações legais (fiscalização)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
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
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Botao bloco={false} onClick={() => gerar('afd')}>
            Gerar AFD
          </Botao>
          <Botao bloco={false} onClick={() => gerar('aej')}>
            Gerar AEJ
          </Botao>
          <Botao variante="secundario" bloco={false} onClick={pacote}>
            Pacote fiscalização
          </Botao>
          <Botao variante="secundario" bloco={false} onClick={baixarCsv}>
            Espelho (CSV/Excel)
          </Botao>
        </div>
      </Cartao>

      <Cartao>
        <h2 style={tituloCartao}>Fechamento mensal por obra (PDF gerencial)</h2>
        <p
          style={{
            font: 'var(--text-sm) var(--font-body)',
            color: 'var(--color-text-muted)',
            margin: '0 0 var(--space-5)',
          }}
        >
          Consolida todos os funcionários da obra na competência — trabalhado, extras, faltas, saldo
          do banco e adicional noturno. Conferência de folha do gestor. Não substitui o AFD/AEJ.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)' }}>
          <Selecao
            label="Obra / filial"
            value={filialId}
            onChange={(e) => setFilialId(e.target.value)}
          >
            <option value="">Selecione a obra…</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Selecao>
          <Campo
            label="Competência"
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
          />
        </div>
        <Botao bloco={false} onClick={fechamentoObra} disabled={!filialId || gerandoFechamento}>
          {gerandoFechamento ? 'Gerando…' : 'Gerar fechamento (PDF)'}
        </Botao>
      </Cartao>

      <Cartao>
        <h2 style={tituloCartao}>Exportações geradas</h2>
        {carregando ? (
          <EstadoVazio>Carregando…</EstadoVazio>
        ) : lista.length === 0 ? (
          <EstadoVazio>Nenhuma exportação gerada.</EstadoVazio>
        ) : (
          <Tabela minWidth={560}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Período</th>
                <th className="g-num">Registros</th>
                <th>Hash</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Badge cor="var(--color-accent)">{e.tipoArquivo}</Badge>
                  </td>
                  <td style={{ font: 'var(--text-sm) var(--font-mono)' }}>{e.periodoReferencia}</td>
                  <td className="g-num">{e.totalRegistros}</td>
                  <td
                    style={{
                      font: 'var(--text-xs) var(--font-mono)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {e.hashArquivo.slice(0, 12)}…
                  </td>
                  <td className="g-num">
                    <Botao
                      tamanho="sm"
                      variante="secundario"
                      bloco={false}
                      onClick={() => baixar(e.id, e.tipoArquivo)}
                    >
                      Baixar
                    </Botao>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Cartao>
    </div>
  );
}
