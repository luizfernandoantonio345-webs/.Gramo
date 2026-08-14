import { describe, expect, it } from 'vitest';
import {
  fmtDataDDMMYYYY,
  fmtHoraHHMMSS,
  LARGURA_AFD,
  montarAfd,
  padDir,
  padEsq,
  registroCabecalho,
  registroMarcacaoRepP,
  registroTrailer,
  semAcento,
  soNumeros,
  validarAfd,
  type EmpregadorAfd,
  type MarcacaoAfd,
} from './afd';

describe('AFD - formatadores', () => {
  it('semAcento remove acentos e nao-ASCII', () => {
    expect(semAcento('Construção Ltda ç ã é')).toBe('Construcao Ltda c a e');
  });
  it('padEsq preenche zeros e trunca pela direita', () => {
    expect(padEsq(42, 9)).toBe('000000042');
    expect(padEsq(1234567890, 9)).toBe('234567890');
  });
  it('padDir preenche espacos, upper e trunca', () => {
    expect(padDir('abc', 5)).toBe('ABC  ');
    expect(padDir('abcdef', 3)).toBe('ABC');
  });
  it('soNumeros mantem so digitos', () => {
    expect(soNumeros('12.345.678/0001-90')).toBe('12345678000190');
  });
  it('formata data e hora em UTC', () => {
    const d = new Date('2026-07-31T09:05:07.000Z');
    expect(fmtDataDDMMYYYY(d)).toBe('31072026');
    expect(fmtHoraHHMMSS(d)).toBe('090507');
  });
});

describe('AFD - montagem', () => {
  const emp: EmpregadorAfd = {
    tipoIdentificador: 1,
    cpfCnpj: '12.345.678/0001-90',
    cno: null,
    razaoSocial: 'Empresa Piloto Ltda',
  };
  const marcacoes: MarcacaoAfd[] = [
    { nsr: 1, dataHora: new Date('2026-07-31T08:00:00Z'), cpf: '52998224725', hash: 'abc' },
    { nsr: 2, dataHora: new Date('2026-07-31T12:00:00Z'), cpf: '52998224725', hash: 'def' },
  ];

  it('cabecalho comeca com NSR 0 e tipo 1', () => {
    const h = registroCabecalho(emp, marcacoes[0]!.dataHora, marcacoes[1]!.dataHora, new Date());
    expect(h.startsWith('000000000' + '1')).toBe(true);
  });

  it('trailer conta as marcacoes tipo 7', () => {
    const t = registroTrailer(2);
    expect(t.startsWith('000000009' + '9')).toBe(true);
    expect(t.endsWith('000000002')).toBe(true);
  });

  it('monta AFD: cabecalho + N marcacoes + trailer', () => {
    const afd = montarAfd(
      emp,
      marcacoes,
      { inicio: marcacoes[0]!.dataHora, fim: marcacoes[1]!.dataHora },
      new Date(),
    );
    const linhas = afd.trimEnd().split('\r\n');
    expect(linhas).toHaveLength(1 + 2 + 1);
    expect(linhas[1]!.slice(9, 10)).toBe('7'); // primeira marcacao e tipo 7
    expect(linhas[3]!.slice(9, 10)).toBe('9'); // trailer
  });

  it('cada registro tem a largura fixa esperada (snapshot do leiaute)', () => {
    const h = registroCabecalho(emp, marcacoes[0]!.dataHora, marcacoes[1]!.dataHora, new Date());
    expect(h).toHaveLength(LARGURA_AFD.cabecalho);
    expect(registroMarcacaoRepP(marcacoes[0]!)).toHaveLength(LARGURA_AFD.marcacaoRepP);
    expect(registroTrailer(2)).toHaveLength(LARGURA_AFD.trailer);
  });
});

describe('AFD - validador estrutural (Portaria 671)', () => {
  const emp: EmpregadorAfd = {
    tipoIdentificador: 1,
    cpfCnpj: '12345678000190',
    cno: null,
    razaoSocial: 'Empresa Piloto Ltda',
  };
  const marcacoes: MarcacaoAfd[] = [
    { nsr: 1, dataHora: new Date('2026-07-31T08:00:00Z'), cpf: '52998224725', hash: 'abc' },
    { nsr: 2, dataHora: new Date('2026-07-31T12:00:00Z'), cpf: '52998224725', hash: 'def' },
    { nsr: 3, dataHora: new Date('2026-07-31T13:00:00Z'), cpf: '52998224725', hash: 'ghi' },
  ];
  const periodo = { inicio: marcacoes[0]!.dataHora, fim: marcacoes[2]!.dataHora };

  it('aprova um AFD bem-formado', () => {
    const r = validarAfd(montarAfd(emp, marcacoes, periodo, new Date()));
    expect(r).toEqual({ valido: true, erros: [] });
  });

  it('reprova NSR fora de sequencia (furo/duplicata)', () => {
    const ruim: MarcacaoAfd[] = [marcacoes[0]!, { ...marcacoes[1]!, nsr: 1 }];
    const r = validarAfd(montarAfd(emp, ruim, periodo, new Date()));
    expect(r.valido).toBe(false);
    expect(r.erros.some((e) => /sequencia/.test(e))).toBe(true);
  });

  it('reprova contagem do trailer divergente', () => {
    const afd = montarAfd(emp, marcacoes, periodo, new Date());
    // adultera o trailer para contar 2 em vez de 3
    const adulterado = afd.replace(/000000003\r\n$/, '000000002\r\n');
    const r = validarAfd(adulterado);
    expect(r.valido).toBe(false);
    expect(r.erros.some((e) => /Trailer conta/.test(e))).toBe(true);
  });

  it('reprova caractere nao-ASCII', () => {
    const afd = montarAfd(emp, marcacoes, periodo, new Date()).replace('EMPRESA', 'EMPRESÃ');
    const r = validarAfd(afd);
    expect(r.valido).toBe(false);
    expect(r.erros.some((e) => /nao-ASCII/.test(e))).toBe(true);
  });
});
