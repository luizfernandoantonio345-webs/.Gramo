import { useCallback, useEffect, useState } from 'react';
import {
  Botao,
  Campo,
  Cartao,
  CabecalhoPagina,
  EstadoVazio,
  Feedback,
  Kpi,
  Tabela,
  TituloSecao,
} from '../design-system/components';
import { apiGet } from '../lib/api';

interface Parcela {
  horas: number;
  valor: number;
}
interface ItemApuracao {
  funcionario: string;
  obra: string;
  valorHora: number;
  normais: Parcela;
  extras: Parcela;
  adicionalPericulosidade: number;
  adicionalNoturno: Parcela;
  total: number;
}
interface Apuracao {
  periodo: { inicio: string; fim: string };
  parametros: {
    percentualExtra: number;
    percentualPericulosidade: number;
    percentualNoturno: number;
    divisorMensal: number;
  };
  itens: ItemApuracao[];
  consolidado: {
    valorNormais: number;
    valorExtras: number;
    adicionalPericulosidade: number;
    valorNoturno: number;
    total: number;
  };
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Competencia 21->20: do dia 21 do mes anterior ao dia 20 do mes corrente.
function competenciaPadrao(): { inicio: string; fim: string } {
  const hoje = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 21);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 20);
  return { inicio: iso(inicio), fim: iso(fim) };
}

/**
 * Apuracao de horas VALORADA da competencia (ex.: 21->20): por funcionario,
 * horas normais/extras + adicionais, pronta para a folha CONFERIR. Percentuais
 * configuraveis. Nao substitui a folha (imposto/INSS/FGTS sao do contador).
 */
export function PainelApuracao() {
  const pad = competenciaPadrao();
  const [inicio, setInicio] = useState(pad.inicio);
  const [fim, setFim] = useState(pad.fim);
  const [percExtra, setPercExtra] = useState('50');
  const [percPeric, setPercPeric] = useState('30');
  const [percNoturno, setPercNoturno] = useState('20');
  const [valorHoraPadrao, setValorHoraPadrao] = useState('12,14');
  const [d, setD] = useState<Apuracao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const apurar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dec = (s: string) => (Number(s.replace(',', '.')) || 0) / 100;
      const vhp = Number(valorHoraPadrao.replace(',', '.')) || 0;
      const q =
        `?inicio=${new Date(inicio).toISOString()}&fim=${new Date(`${fim}T23:59:59`).toISOString()}` +
        `&percentualExtra=${dec(percExtra)}&percentualPericulosidade=${dec(percPeric)}` +
        `&percentualNoturno=${dec(percNoturno)}&valorHoraPadrao=${vhp}`;
      setD(await apiGet<Apuracao>(`/admin/banco-horas/apuracao${q}`));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao apurar.');
    } finally {
      setCarregando(false);
    }
  }, [inicio, fim, percExtra, percPeric, percNoturno, valorHoraPadrao]);

  // Apura uma vez ao abrir; ajustes de parametro so refazem ao clicar "Apurar".
  useEffect(() => {
    void apurar();
    // deps vazias de proposito: nao re-apurar a cada tecla nos parametros.
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <CabecalhoPagina
        titulo="Apuração de horas"
        subtitulo="Horas normais, extras e adicionais valorados por funcionário — pronto para a folha conferir"
      />

      <Cartao>
        <TituloSecao meta={<span>competência (padrão 21 → 20)</span>}>Parâmetros</TituloSecao>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 'var(--space-4)',
            alignItems: 'end',
          }}
        >
          <Campo
            label="Início"
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
          <Campo label="Fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          <Campo label="Extra %" value={percExtra} onChange={(e) => setPercExtra(e.target.value)} />
          <Campo
            label="Periculosidade %"
            value={percPeric}
            onChange={(e) => setPercPeric(e.target.value)}
          />
          <Campo
            label="Noturno %"
            value={percNoturno}
            onChange={(e) => setPercNoturno(e.target.value)}
          />
          <Campo
            label="Valor-hora padrão"
            value={valorHoraPadrao}
            onChange={(e) => setValorHoraPadrao(e.target.value)}
            dica="usado quando o salário do cargo não está cadastrado"
          />
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <Botao onClick={apurar} disabled={carregando} bloco={false}>
              {carregando ? 'Apurando…' : 'Apurar'}
            </Botao>
          </div>
        </div>
      </Cartao>

      {erro && <Feedback tom="erro">{erro}</Feedback>}

      {d && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'var(--space-5)',
            }}
          >
            <Kpi rotulo="Horas normais" valor={brl(d.consolidado.valorNormais)} />
            <Kpi rotulo="Horas extras" valor={brl(d.consolidado.valorExtras)} />
            <Kpi rotulo="Periculosidade" valor={brl(d.consolidado.adicionalPericulosidade)} />
            <Kpi rotulo="Adicional noturno" valor={brl(d.consolidado.valorNoturno)} />
            <Kpi rotulo="Total do período" valor={brl(d.consolidado.total)} tom="ok" />
          </div>

          <Cartao>
            <TituloSecao meta={<span>{d.itens.length} funcionário(s)</span>}>
              Demonstrativo por funcionário
            </TituloSecao>
            {d.itens.length === 0 ? (
              <EstadoVazio>Nenhum funcionário com marcações no período.</EstadoVazio>
            ) : (
              <Tabela minWidth={720}>
                <thead>
                  <tr>
                    <th>Funcionário</th>
                    <th>Obra</th>
                    <th className="g-num">Normais</th>
                    <th className="g-num">Extras</th>
                    <th className="g-num">Periculosidade</th>
                    <th className="g-num">Noturno</th>
                    <th className="g-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {d.itens.map((i, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>{i.funcionario}</td>
                      <td>{i.obra}</td>
                      <td className="g-num">
                        {i.normais.horas}h · {brl(i.normais.valor)}
                      </td>
                      <td className="g-num">
                        {i.extras.horas}h · {brl(i.extras.valor)}
                      </td>
                      <td className="g-num">{brl(i.adicionalPericulosidade)}</td>
                      <td className="g-num">{brl(i.adicionalNoturno.valor)}</td>
                      <td className="g-num" style={{ fontWeight: 600 }}>
                        {brl(i.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            )}
          </Cartao>

          <p style={{ font: 'var(--text-xs) var(--font-body)', color: 'var(--color-text-faint)' }}>
            Valores de HORAS para conferência da folha. Impostos, INSS, FGTS e descontos legais
            seguem com a folha/contador. Percentuais configuráveis acima.
          </p>
        </>
      )}
    </div>
  );
}
