import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      // Gate de qualidade: o coracao do sistema (regras de negocio puras) nao
      // pode regredir em cobertura. Enforcado sempre (enabled) — o `vitest run`
      // do CI ja falha se cair abaixo. Pisos ~4pts abaixo do atual (2026-08:
      // lines/stmts 96%, funcs 98%, branches 86%) para travar sem flakiness.
      enabled: true,
      thresholds: {
        lines: 92,
        statements: 92,
        functions: 92,
        branches: 80,
      },
    },
  },
});
