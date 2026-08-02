import { describe, expect, it } from 'vitest';
import { avaliarRegap, distanciaHaversineMetros, type AreaRegap } from './geo';

describe('distanciaHaversineMetros', () => {
  it('e ~0 para o mesmo ponto', () => {
    expect(distanciaHaversineMetros(-23.55, -46.63, -23.55, -46.63)).toBeLessThan(1);
  });

  it('calcula distancia conhecida (~1 grau de latitude ~= 111 km)', () => {
    const d = distanciaHaversineMetros(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe('avaliarRegap', () => {
  const regaps: AreaRegap[] = [
    { id: 'sede', latitude: -23.5505, longitude: -46.6333, raioMetros: 150 },
  ];

  it('dentro do raio -> dentro=true', () => {
    // ~50 m de deslocamento em longitude.
    const r = avaliarRegap(-23.5505, -46.63285, regaps);
    expect(r.dentro).toBe(true);
    expect(r.regapId).toBe('sede');
  });

  it('fora do raio -> dentro=false, mas retorna a mais proxima', () => {
    const r = avaliarRegap(-23.56, -46.64, regaps);
    expect(r.dentro).toBe(false);
    expect(r.regapId).toBe('sede');
    expect(r.distanciaMetros).toBeGreaterThan(150);
  });

  it('sem coordenada ou sem REGAP -> fora (nunca bloqueia)', () => {
    expect(avaliarRegap(null, null, regaps).dentro).toBe(false);
    expect(avaliarRegap(-23.55, -46.63, []).dentro).toBe(false);
  });
});
