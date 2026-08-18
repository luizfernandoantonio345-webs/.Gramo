# TESTING.md — Como testar o .GRAMO

Pirâmide de testes do projeto e como rodá-la. Tudo roda no CI a cada push
(`.github/workflows/ci.yml`).

## Camadas

| Camada             | O que cobre                                                            | Comando                               | Depende de                                                |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| **Unitário**       | regras de negócio puras + serviços                                     | `npm test`                            | nada                                                      |
| **e2e banco**      | RLS (isolamento), NSR (concorrência), imutabilidade, boundary do super | `npm run test:e2e -w @repp/api`       | Postgres **embarcado** (baixado pelo `embedded-postgres`) |
| **e2e fluxo**      | API real: login admin/func → dashboard → ponto → apuração              | `npm run test:e2e:fluxo -w @repp/api` | API **buildada** + PG embarcado                           |
| **e2e authz/IDOR** | gestor de obra não acessa outra obra (200/403/401)                     | `npm run test:e2e:authz -w @repp/api` | API buildada + PG embarcado                               |
| **UI fumaça**      | telas de acesso renderizam (anti "tela branca")                        | `npm run test:e2e -w @repp/web`       | web **buildado**                                          |
| **UI integração**  | navegador ↔ API real: login → Dashboard/Apuração/Ponto                 | `npm run test:e2e:integ -w @repp/web` | web + API buildados                                       |

## Pré-requisitos por camada

- **e2e de API** (`fluxo`/`authz`): a API precisa estar compilada em `apps/api/dist`.
  No CI, `npm run build -w @repp/api` (nest build). Localmente (máquina apertada),
  use SWC: `cd apps/api && npx swc src -d dist --config-file .swcrc --copy-files`.
  O runner detecta `dist/src/main.js` (SWC) ou `dist/main.js` (nest).
- **e2e de UI**: `npm run build -w @repp/web` antes (o Playwright sobe `vite preview`).
- **Navegador do Playwright**: `npx playwright install chromium` (no CI, `--with-deps`).

## Infraestrutura de e2e

Um único módulo, `apps/api/test/e2e/boot-stack.mjs`, sobe todo o backend real:
Postgres embarcado → roles + migrations + `rls-policies.sql` → `seed-gramo` → a
API HTTP (com `DEV_BYPASS_2FA=true`, pois `NODE_ENV=test`). É reusado pelos
runners de fluxo e de authz, e pelo `globalSetup` do Playwright de integração.

## Cobertura

Há **gate de cobertura** no `@repp/shared` (o coração do domínio): lines/stmts
≥ 92%, funcs ≥ 92%, branches ≥ 80% (`packages/shared/vitest.config.ts`). O
`vitest run` do CI falha se cair abaixo.

## Filosofia

- Regras críticas (ponto, geofence, jornada, apuração, auth) têm teste unitário
  puro em `@repp/shared` sempre que possível.
- Garantias que só o banco prova (RLS, NSR, imutabilidade) têm e2e contra
  Postgres real — **nunca** mockadas.
- Sem coverage artificial: priorize código crítico.
