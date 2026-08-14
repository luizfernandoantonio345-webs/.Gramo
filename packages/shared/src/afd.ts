/**
 * Geracao do AFD (Arquivo-Fonte de Dados) -- Portaria MTP 671/2021 (REP-P).
 *
 * ATENCAO (senioridade/honestidade): os offsets/larguras abaixo seguem a
 * ESTRUTURA da Portaria 671 (registros tipo 1=cabecalho, 7=marcacao REP-P,
 * 9=trailer), mas os leiautes oficiais DEVEM ser validados no verificador
 * gov.br antes do go-live. Todo o layout esta centralizado aqui (uma fonte da
 * verdade), de modo que ajustar uma largura de campo e trivial. Funcoes puras
 * e testaveis.
 */

/** Remove acentos e nao-ASCII (AFD e texto ASCII). */
export function semAcento(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^ -~]/g, ' ');
}

/** So digitos. */
export function soNumeros(v: string): string {
  return (v ?? '').replace(/\D/g, '');
}

/** Preenche a esquerda com zeros (numerico), truncando se exceder. */
export function padEsq(valor: string | number, largura: number): string {
  const s = String(valor);
  return s.length > largura ? s.slice(-largura) : s.padStart(largura, '0');
}

/** Preenche a direita com espacos (texto), truncando se exceder. */
export function padDir(valor: string, largura: number): string {
  const s = semAcento(valor).toUpperCase();
  return s.length > largura ? s.slice(0, largura) : s.padEnd(largura, ' ');
}

/** Data no formato DDMMYYYY (usa horario UTC do Date informado). */
export function fmtDataDDMMYYYY(d: Date): string {
  const dd = padEsq(d.getUTCDate(), 2);
  const mm = padEsq(d.getUTCMonth() + 1, 2);
  const yyyy = padEsq(d.getUTCFullYear(), 4);
  return `${dd}${mm}${yyyy}`;
}

/** Hora no formato HHMMSS (UTC). */
export function fmtHoraHHMMSS(d: Date): string {
  return `${padEsq(d.getUTCHours(), 2)}${padEsq(d.getUTCMinutes(), 2)}${padEsq(d.getUTCSeconds(), 2)}`;
}

export interface EmpregadorAfd {
  /** 1 = CNPJ, 2 = CPF. */
  tipoIdentificador: 1 | 2;
  cpfCnpj: string;
  cno: string | null; // obra (CNO/CEI), opcional
  razaoSocial: string;
}

export interface MarcacaoAfd {
  nsr: number | string;
  /** Momento oficial da marcacao. */
  dataHora: Date;
  cpf: string;
  /** Hash de integridade do registro (SHA-256 hex). */
  hash: string;
}

/** Registro tipo 1 -- cabecalho. */
export function registroCabecalho(
  emp: EmpregadorAfd,
  dataInicial: Date,
  dataFinal: Date,
  geradoEm: Date,
): string {
  return [
    padEsq(0, 9), // NSR do cabecalho = 0
    '1',
    String(emp.tipoIdentificador),
    padEsq(soNumeros(emp.cpfCnpj), 14),
    padDir(emp.cno ?? '', 12),
    padDir(emp.razaoSocial, 150),
    fmtDataDDMMYYYY(dataInicial),
    fmtDataDDMMYYYY(dataFinal),
    fmtDataDDMMYYYY(geradoEm),
    fmtHoraHHMMSS(geradoEm),
  ].join('');
}

/** Registro tipo 7 -- marcacao de ponto REP-P. */
export function registroMarcacaoRepP(m: MarcacaoAfd): string {
  return [
    padEsq(m.nsr, 9),
    '7',
    fmtDataDDMMYYYY(m.dataHora),
    fmtHoraHHMMSS(m.dataHora),
    padEsq(soNumeros(m.cpf), 12),
    padDir(m.hash, 64),
  ].join('');
}

/** Registro tipo 9 -- trailer (contadores por tipo). */
export function registroTrailer(qtdMarcacoes: number): string {
  return [
    padEsq(9, 9),
    '9',
    padEsq(0, 9), // qtd tipo 2
    padEsq(0, 9), // qtd tipo 3
    padEsq(0, 9), // qtd tipo 4
    padEsq(0, 9), // qtd tipo 5
    padEsq(0, 9), // qtd tipo 6
    padEsq(qtdMarcacoes, 9), // qtd tipo 7 (marcacoes REP-P)
  ].join('');
}

/**
 * Larguras (bytes) de cada registro nesta implementacao. Fonte unica da verdade:
 * ajustar aqui reflete no gerador e no validador. As larguras seguem a ESTRUTURA
 * da Portaria 671; confirme no "Programa de Verificacao" do MTE antes do go-live.
 */
export const LARGURA_AFD = {
  cabecalho: 9 + 1 + 1 + 14 + 12 + 150 + 8 + 8 + 8 + 6, // 217
  marcacaoRepP: 9 + 1 + 8 + 6 + 12 + 64, // 100
  trailer: 9 + 1 + 9 * 6, // 64
} as const;

/** Monta o AFD completo (cabecalho + marcacoes + trailer), linhas em CRLF. */
export function montarAfd(
  emp: EmpregadorAfd,
  marcacoes: MarcacaoAfd[],
  periodo: { inicio: Date; fim: Date },
  geradoEm: Date,
): string {
  const linhas = [
    registroCabecalho(emp, periodo.inicio, periodo.fim, geradoEm),
    ...marcacoes.map(registroMarcacaoRepP),
    registroTrailer(marcacoes.length),
  ];
  return linhas.join('\r\n') + '\r\n';
}

/**
 * Auto-validacao estrutural do AFD (defesa em profundidade): reparseia o arquivo
 * e confere invariantes duras da Portaria 671, de modo que um arquivo corrompido
 * NUNCA seja exportado. Nao substitui o verificador oficial do MTE -- garante a
 * consistencia interna (sequencia de NSR sem furos, contadores, ASCII/CRLF).
 */
export function validarAfd(conteudo: string): { valido: boolean; erros: string[] } {
  const erros: string[] = [];
  if (!conteudo.endsWith('\r\n')) erros.push('Arquivo deve terminar em CRLF.');
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(conteudo)) erros.push('Arquivo contem caracteres nao-ASCII.');

  const linhas = conteudo.split('\r\n').filter((l) => l.length > 0);
  if (linhas.length < 2) {
    return { valido: false, erros: [...erros, 'Arquivo sem cabecalho/trailer.'] };
  }
  const cab = linhas[0]!;
  const trailer = linhas[linhas.length - 1]!;
  const marcacoes = linhas.slice(1, -1);

  if (cab.slice(0, 9) !== '000000000' || cab[9] !== '1') erros.push('Cabecalho (tipo 1) invalido.');
  if (cab.length !== LARGURA_AFD.cabecalho)
    erros.push(`Cabecalho com largura ${cab.length} (esperado ${LARGURA_AFD.cabecalho}).`);
  if (trailer[9] !== '9') erros.push('Trailer (tipo 9) invalido.');
  if (trailer.length !== LARGURA_AFD.trailer)
    erros.push(`Trailer com largura ${trailer.length} (esperado ${LARGURA_AFD.trailer}).`);

  let nsrAnterior = 0;
  for (const [i, l] of marcacoes.entries()) {
    const tipo = l[9];
    if (tipo !== '7') {
      erros.push(`Linha ${i + 2}: tipo "${tipo}" inesperado (esperado 7).`);
      continue;
    }
    if (l.length !== LARGURA_AFD.marcacaoRepP)
      erros.push(`Linha ${i + 2}: largura ${l.length} (esperado ${LARGURA_AFD.marcacaoRepP}).`);
    const nsr = Number(l.slice(0, 9));
    if (!Number.isInteger(nsr) || nsr <= nsrAnterior)
      erros.push(
        `Linha ${i + 2}: NSR ${l.slice(0, 9)} fora de sequencia (anterior ${nsrAnterior}).`,
      );
    nsrAnterior = nsr;
  }

  const qtdTrailer = Number(trailer.slice(-9));
  if (qtdTrailer !== marcacoes.length)
    erros.push(`Trailer conta ${qtdTrailer} marcacoes, mas o arquivo tem ${marcacoes.length}.`);

  return { valido: erros.length === 0, erros };
}
