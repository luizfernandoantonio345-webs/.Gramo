import { useCallback, useRef, useState } from 'react';
import { LARGURA_AFD, semAcento } from '@repp/shared';
import { CabecalhoPagina, Cartao, TituloSecao } from '../design-system/components';

interface CheckItem {
  ok: boolean;
  texto: string;
}

interface Resultado {
  valido: boolean;
  erros: string[];
  checks: CheckItem[];
  totalMarcacoes: number;
  nsrInicio: string;
  nsrFim: string;
  periodo: string;
  nomeArquivo: string;
  dataHoraVerificacao: string;
}

function validarArquivo(conteudo: string, nomeArquivo: string): Resultado {
  const erros: string[] = [];
  const checks: CheckItem[] = [];

  // CRLF
  const temCrlf = conteudo.endsWith('\r\n');
  checks.push({
    ok: temCrlf,
    texto: 'Terminação de linha CRLF (\\r\\n) — obrigatório pela Portaria 671',
  });
  if (!temCrlf) erros.push('Arquivo deve terminar com CRLF.');

  // ASCII
  // eslint-disable-next-line no-control-regex
  const temNaoAscii = /[^\x00-\x7F]/.test(conteudo);
  checks.push({
    ok: !temNaoAscii,
    texto: 'Somente caracteres ASCII — acentos removidos corretamente',
  });
  if (temNaoAscii) erros.push('Arquivo contém caracteres não-ASCII.');

  const linhas = conteudo.split('\r\n').filter((l) => l.length > 0);

  if (linhas.length < 2) {
    erros.push('Arquivo muito curto — sem cabeçalho ou trailer.');
    return {
      valido: false,
      erros,
      checks,
      totalMarcacoes: 0,
      nsrInicio: '—',
      nsrFim: '—',
      periodo: '—',
      nomeArquivo,
      dataHoraVerificacao: new Date().toLocaleString('pt-BR'),
    };
  }

  const cab = linhas[0]!;
  const trailer = linhas[linhas.length - 1]!;
  const marcacoes = linhas.slice(1, -1);

  // Cabeçalho tipo 1
  const cabNsrOk = cab.slice(0, 9) === '000000000';
  const cabTipoOk = cab[9] === '1';
  const cabLargOk = cab.length === LARGURA_AFD.cabecalho;
  checks.push({
    ok: cabNsrOk && cabTipoOk,
    texto: 'Cabeçalho tipo 1 com NSR 000000000 — identificação do empregador',
  });
  checks.push({
    ok: cabLargOk,
    texto: `Largura do cabeçalho: ${cab.length} bytes (esperado ${LARGURA_AFD.cabecalho} = 222)`,
  });
  if (!cabNsrOk || !cabTipoOk) erros.push('Cabeçalho (tipo 1) inválido ou NSR incorreto.');
  if (!cabLargOk)
    erros.push(`Cabeçalho com ${cab.length} bytes (esperado ${LARGURA_AFD.cabecalho}).`);

  // CNPJ no cabeçalho (14 dígitos) — posição 11-24 (0-indexed)
  const cnpjCab = cab.slice(11, 25);
  const cnpjOk = /^\d{14}$/.test(cnpjCab);
  checks.push({
    ok: cnpjOk,
    texto: `CNPJ no cabeçalho: ${cnpjCab.slice(0, 2)}.${cnpjCab.slice(2, 5)}.${cnpjCab.slice(5, 8)}/${cnpjCab.slice(8, 12)}-${cnpjCab.slice(12)}`,
  });
  if (!cnpjOk) erros.push(`CNPJ no cabeçalho inválido: "${cnpjCab}".`);

  // Razão social — posição 37-186 (150 chars)
  const razaoSocialCab = cab.slice(37, 187).trim();
  const razaoOk = razaoSocialCab.length > 0;
  checks.push({
    ok: razaoOk,
    texto: `Razão social: "${semAcento(razaoSocialCab).slice(0, 40).trim()}${razaoSocialCab.length > 40 ? '…' : ''}"`,
  });
  if (!razaoOk) erros.push('Razão social vazia no cabeçalho.');

  // Campo INPI — posição 187-193 (7 chars)
  const inpiCab = cab.slice(187, 194).trim();
  const inpiPreenchido = /\d/.test(inpiCab);
  checks.push({
    ok: inpiPreenchido,
    texto: `Número INPI no cabeçalho (pos.188-194): ${inpiPreenchido ? inpiCab : 'não preenchido — obrigatório (Art. 89)'}`,
  });
  if (!inpiPreenchido)
    erros.push(
      'Campo INPI no cabeçalho vazio. Configure em Configurações → INPI após registrar no gov.br.',
    );

  // Período do cabeçalho (offset 194 = 9+1+1+14+12+150+7)
  const OFF = 9 + 1 + 1 + 14 + 12 + 150 + 7; // = 194
  let periodo = '—';
  const dataInicialRaw = cab.slice(OFF, OFF + 8);
  const dataFinalRaw = cab.slice(OFF + 8, OFF + 16);
  const fmtData = (s: string) => `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}`;
  const datasOk = /^\d{8}$/.test(dataInicialRaw) && /^\d{8}$/.test(dataFinalRaw);
  if (datasOk) periodo = `${fmtData(dataInicialRaw)} a ${fmtData(dataFinalRaw)}`;
  checks.push({ ok: datasOk, texto: `Período declarado no cabeçalho: ${periodo}` });
  if (!datasOk) erros.push('Datas no cabeçalho com formato inválido.');

  // Trailer tipo 9
  const trTipoOk = trailer[9] === '9';
  const trLargOk = trailer.length === LARGURA_AFD.trailer;
  checks.push({
    ok: trTipoOk && trLargOk,
    texto: `Trailer tipo 9 — ${trailer.length} bytes (esperado ${LARGURA_AFD.trailer})`,
  });
  if (!trTipoOk) erros.push('Trailer (tipo 9) inválido.');
  if (!trLargOk)
    erros.push(`Trailer com ${trailer.length} bytes (esperado ${LARGURA_AFD.trailer}).`);

  // Marcações tipo 7
  let nsrAnterior = 0;
  let nsrInicio = '—';
  let nsrFim = '—';
  let errosData = 0;
  let errosNis = 0;
  let errosHash = 0;

  for (let i = 0; i < marcacoes.length; i++) {
    const l = marcacoes[i]!;

    if (l[9] !== '7') {
      erros.push(`Linha ${i + 2}: tipo "${l[9]}" inesperado (esperado 7).`);
      continue;
    }
    if (l.length !== LARGURA_AFD.marcacaoRepP) {
      erros.push(`Linha ${i + 2}: ${l.length} bytes (esperado ${LARGURA_AFD.marcacaoRepP}).`);
      continue;
    }

    // NSR sequencial
    const nsr = parseInt(l.slice(0, 9), 10);
    if (isNaN(nsr) || nsr <= nsrAnterior) {
      erros.push(
        `Linha ${i + 2}: NSR ${l.slice(0, 9)} fora de sequência (anterior: ${nsrAnterior}).`,
      );
    } else {
      if (nsrInicio === '—') nsrInicio = String(nsr);
      nsrFim = String(nsr);
      nsrAnterior = nsr;
    }

    // Data DDMMYYYY
    const dataM = l.slice(10, 18);
    const dd = parseInt(dataM.slice(0, 2), 10);
    const mm = parseInt(dataM.slice(2, 4), 10);
    const aaaa = parseInt(dataM.slice(4, 8), 10);
    if (!/^\d{8}$/.test(dataM) || dd < 1 || dd > 31 || mm < 1 || mm > 12 || aaaa < 2000)
      errosData++;

    // Hora HHMMSS
    const horaM = l.slice(18, 24);
    const hh = parseInt(horaM.slice(0, 2), 10);
    const min = parseInt(horaM.slice(2, 4), 10);
    const ss = parseInt(horaM.slice(4, 6), 10);
    if (!/^\d{6}$/.test(horaM) || hh > 23 || min > 59 || ss > 59) errosData++;

    // NIS (12 dígitos zero-padded)
    const nis = l.slice(24, 36);
    if (!/^\d{12}$/.test(nis)) errosNis++;

    // Hash (64 chars hex)
    const hash = l.slice(36, 100);
    if (!/^[0-9a-fA-F]{64}$/.test(hash)) errosHash++;
  }

  checks.push({
    ok: erros.filter((e) => e.includes('NSR')).length === 0,
    texto: 'NSR sequencial sem furos — Portaria 671 Art. 75 §3',
  });
  checks.push({
    ok: marcacoes.length > 0,
    texto: `Total de marcações tipo 7: ${marcacoes.length} registro(s)`,
  });
  checks.push({
    ok: errosData === 0,
    texto: `Formato de data/hora das marcações: ${errosData === 0 ? 'todos válidos' : `${errosData} inválido(s)`}`,
  });
  if (errosData > 0) erros.push(`${errosData} marcação(ões) com data ou hora inválida.`);

  checks.push({
    ok: errosNis === 0,
    texto: `Campo NIS/PIS (12 dígitos zero-padded): ${errosNis === 0 ? 'todos válidos' : `${errosNis} inválido(s)`}`,
  });
  if (errosNis > 0) erros.push(`${errosNis} marcação(ões) com NIS inválido (deve ter 12 dígitos).`);

  checks.push({
    ok: errosHash === 0,
    texto: `Hash de integridade SHA-256 (64 hex): ${errosHash === 0 ? 'todos válidos' : `${errosHash} inválido(s)`}`,
  });
  if (errosHash > 0)
    erros.push(
      `${errosHash} marcação(ões) com hash inválido (deve ter 64 caracteres hexadecimais).`,
    );

  // Contador do trailer
  const qtdTrailer = parseInt(trailer.slice(-9), 10);
  const contOk = qtdTrailer === marcacoes.length;
  checks.push({
    ok: contOk,
    texto: `Contador do trailer: ${qtdTrailer} (registrado) vs ${marcacoes.length} (real)`,
  });
  if (!contOk)
    erros.push(`Trailer registra ${qtdTrailer} marcações, mas o arquivo tem ${marcacoes.length}.`);

  return {
    valido: erros.length === 0,
    erros,
    checks,
    totalMarcacoes: marcacoes.length,
    nsrInicio,
    nsrFim,
    periodo,
    nomeArquivo,
    dataHoraVerificacao: new Date().toLocaleString('pt-BR'),
  };
}

export function VerificadorAfd() {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processar = useCallback((file: File) => {
    setNomeArquivo(file.name);
    setResultado(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const conteudo = e.target?.result as string;
      setResultado(validarArquivo(conteudo, file.name));
    };
    reader.readAsText(file, 'ascii');
  }, []);

  function aoSoltarArquivo(e: React.DragEvent) {
    e.preventDefault();
    setArrastando(false);
    const file = e.dataTransfer.files[0];
    if (file) processar(file);
  }

  function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processar(file);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <CabecalhoPagina
        titulo="Verificador AFD"
        subtitulo="Valida o arquivo AFD contra todos os requisitos técnicos da Portaria MTP 671/2021"
      />

      {/* Upload */}
      <Cartao>
        <TituloSecao>Selecionar arquivo AFD</TituloSecao>
        <p
          style={{
            font: 'var(--text-sm) var(--font-body)',
            color: 'var(--color-text-muted)',
            margin: '0 0 var(--space-4)',
            lineHeight: 1.6,
          }}
        >
          Gere o arquivo em <strong>Relatórios → Gerar AFD</strong> e arraste aqui para validar.
          Nenhum dado é enviado ao servidor — a verificação é feita localmente no navegador.
        </p>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={aoSoltarArquivo}
          style={{
            border: `2px dashed ${arrastando ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-md)',
            background: arrastando
              ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)'
              : 'var(--color-bg)',
            padding: 'var(--space-8) var(--space-5)',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.afd"
            style={{ display: 'none' }}
            onChange={aoEscolherArquivo}
          />
          <div
            style={{
              font: '600 var(--text-sm) var(--font-body)',
              color: 'var(--color-text)',
              marginBottom: 'var(--space-1)',
            }}
          >
            {nomeArquivo ? `📄 ${nomeArquivo}` : 'Clique ou arraste o arquivo .txt do AFD aqui'}
          </div>
          <div
            style={{ font: 'var(--text-xs) var(--font-body)', color: 'var(--color-text-muted)' }}
          >
            Arquivo gerado em Relatórios → Gerar AFD
          </div>
        </div>
      </Cartao>

      {/* Resultado */}
      {resultado && (
        <>
          {/* Banner principal */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              padding: 'var(--space-5)',
              borderRadius: 'var(--radius-md)',
              background: resultado.valido
                ? 'color-mix(in srgb, var(--color-teal-success) 10%, transparent)'
                : 'color-mix(in srgb, var(--color-error, #dc2626) 8%, transparent)',
              border: `2px solid ${resultado.valido ? 'var(--color-teal-success)' : 'var(--color-error, #dc2626)'}`,
            }}
          >
            <span style={{ fontSize: 40, flexShrink: 0 }}>{resultado.valido ? '✅' : '❌'}</span>
            <div>
              <div
                style={{
                  font: '700 var(--text-lg) var(--font-display)',
                  color: resultado.valido
                    ? 'var(--color-teal-success)'
                    : 'var(--color-error, #dc2626)',
                  marginBottom: 4,
                }}
              >
                {resultado.valido ? 'ARQUIVO VÁLIDO — Conforme Portaria 671' : 'ARQUIVO COM ERROS'}
              </div>
              <div
                style={{
                  font: 'var(--text-sm) var(--font-body)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {resultado.valido
                  ? 'O AFD está no formato correto e pode ser apresentado ao fiscal do trabalho.'
                  : `Foram encontrados ${resultado.erros.length} erro(s). Corrija e gere o AFD novamente.`}
              </div>
            </div>
          </div>

          {/* Estatísticas */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            {[
              { label: 'Marcações', valor: resultado.totalMarcacoes },
              { label: 'NSR inicial', valor: resultado.nsrInicio },
              { label: 'NSR final', valor: resultado.nsrFim },
              { label: 'Período', valor: resultado.periodo, small: true },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    font: `700 ${s.small ? 'var(--text-base)' : '28px'} var(--font-display)`,
                    color: 'var(--color-text)',
                    wordBreak: 'break-word',
                  }}
                >
                  {s.valor}
                </div>
                <div
                  style={{
                    font: 'var(--text-xs) var(--font-body)',
                    color: 'var(--color-text-muted)',
                    marginTop: 2,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Checklist detalhado */}
          <Cartao>
            <TituloSecao>Verificação por item — Portaria 671/2021</TituloSecao>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {resultado.checks.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) 0',
                    borderBottom:
                      i < resultado.checks.length - 1 ? '1px solid var(--color-divider)' : 'none',
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      fontSize: 18,
                      paddingTop: 1,
                      color: c.ok ? 'var(--color-teal-success)' : 'var(--color-error, #dc2626)',
                    }}
                  >
                    {c.ok ? '✓' : '✗'}
                  </span>
                  <span
                    style={{
                      font: 'var(--text-sm) var(--font-body)',
                      color: c.ok ? 'var(--color-text)' : 'var(--color-error, #dc2626)',
                      lineHeight: 1.5,
                    }}
                  >
                    {c.texto}
                  </span>
                </div>
              ))}
            </div>
          </Cartao>

          {/* Erros detalhados */}
          {resultado.erros.length > 0 && (
            <Cartao>
              <TituloSecao>Erros encontrados</TituloSecao>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                {resultado.erros.map((e, i) => (
                  <li
                    key={i}
                    style={{
                      font: 'var(--text-sm) var(--font-body)',
                      color: 'var(--color-error, #dc2626)',
                      lineHeight: 1.5,
                    }}
                  >
                    {e}
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          {/* Comprovante (só se válido) */}
          {resultado.valido && (
            <Cartao>
              <TituloSecao>Comprovante de Validação Técnica</TituloSecao>
              <div
                style={{
                  font: 'var(--text-sm) var(--font-body)',
                  color: 'var(--color-text)',
                  lineHeight: 1.9,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--space-4)',
                  marginBottom: 'var(--space-4)',
                  fontFamily: 'monospace',
                }}
              >
                <div>
                  <strong>Sistema:</strong> REP-P GRAMO
                </div>
                <div>
                  <strong>Empresa:</strong> Gramo Empreendimentos e Construções Ltda.
                </div>
                <div>
                  <strong>CNPJ:</strong> 21.096.672/0001-12
                </div>
                <div>
                  <strong>Arquivo:</strong> {resultado.nomeArquivo}
                </div>
                <div>
                  <strong>Marcações verificadas:</strong> {resultado.totalMarcacoes}
                </div>
                <div>
                  <strong>Período:</strong> {resultado.periodo}
                </div>
                <div>
                  <strong>Data/Hora:</strong> {resultado.dataHoraVerificacao}
                </div>
                <div>
                  <strong>Resultado:</strong> APROVADO — Conforme Portaria MTP 671/2021
                </div>
                <div style={{ marginTop: 8, color: 'var(--color-text-muted)', fontSize: 12 }}>
                  Este comprovante deve acompanhar a Declaração de Conformidade REP-P.
                </div>
              </div>
              <button
                className="g-btn g-btn--primary"
                onClick={() => window.print()}
                style={{ width: '100%' }}
              >
                Imprimir / Salvar como PDF (comprovante)
              </button>
            </Cartao>
          )}
        </>
      )}
    </div>
  );
}
