import { describe, expect, it } from 'vitest';
import { formatarCpf, isCpfValido, normalizarCpf } from './cpf';

describe('normalizarCpf', () => {
  it('remove mascara e caracteres nao numericos', () => {
    expect(normalizarCpf('529.982.247-25')).toBe('52998224725');
    expect(normalizarCpf(' 111a222b333c44 ')).toBe('11122233344');
  });
});

describe('formatarCpf', () => {
  it('aplica a mascara 000.000.000-00', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });

  it('formata progressivamente SEM preencher com zeros (regressao do bug de digitacao)', () => {
    expect(formatarCpf('5')).toBe('5');
    expect(formatarCpf('529')).toBe('529');
    expect(formatarCpf('5299')).toBe('529.9');
    expect(formatarCpf('529982247')).toBe('529.982.247');
    expect(formatarCpf('5299822472')).toBe('529.982.247-2');
  });

  it('ignora excesso de digitos e mascara ja aplicada', () => {
    expect(formatarCpf('529.982.247-25')).toBe('529.982.247-25');
    expect(formatarCpf('5299822472599')).toBe('529.982.247-25');
  });
});

describe('isCpfValido', () => {
  it('aceita CPFs validos (com e sem mascara)', () => {
    // CPFs validos conhecidos, gerados apenas para teste.
    expect(isCpfValido('529.982.247-25')).toBe(true);
    expect(isCpfValido('52998224725')).toBe(true);
    expect(isCpfValido('168.995.350-09')).toBe(true);
  });

  it('rejeita digito verificador incorreto', () => {
    expect(isCpfValido('529.982.247-24')).toBe(false);
    expect(isCpfValido('11144477736')).toBe(false);
  });

  it('rejeita tamanho invalido', () => {
    expect(isCpfValido('123')).toBe(false);
    expect(isCpfValido('')).toBe(false);
    expect(isCpfValido('529982247250')).toBe(false);
  });

  it('rejeita sequencias repetidas', () => {
    expect(isCpfValido('00000000000')).toBe(false);
    expect(isCpfValido('111.111.111-11')).toBe(false);
    expect(isCpfValido('99999999999')).toBe(false);
  });
});
