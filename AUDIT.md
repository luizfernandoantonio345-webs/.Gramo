# AUDIT.md — Auditoria de release do .GRAMO (REP-P)

> Auditoria técnica conduzida em `2026-08-18` sobre o branch `fase-b-estabilizacao`
> (em produção). Cada achado é ancorado em **evidência executada**, não em
> aparência. Severidades: CRITICAL / HIGH / MEDIUM / LOW / INFO.

---

## 1. Estado inicial (linha de base)

**Stack:** monorepo npm (workspaces). `packages/shared` (domínio puro, TS) ·
`apps/api` (NestJS 11 + Prisma 5 + PostgreSQL 16, RLS) · `apps/web` (React 18 +
Vite 5, PWA offline-first).

**Arquitetura:** camadas coerentes — Controllers (guards RBAC + tenant) →
Services → Prisma (`forTenant` seta `app.current_empresa_id`) → Postgres com
**RLS**. Regras de negócio puras isoladas em `@repp/shared` (testáveis). Sem SQL
solto em rotas; sem lógica de negócio relevante em controllers.

**Entrypoints/scripts:** API `dist/main.js` (nest build) ou `dist/src/main.js`
(SWC local). Testes: `npm test` (vitest); e2e de banco `test:e2e`; e2e de fluxo
autossuficiente `test:e2e:fluxo`; e2e de UI `test:e2e`/`test:e2e:integ` (web).
Migrations Prisma (12) + `sql/rls-policies.sql`. Seed `scripts/seed-gramo.mjs`.

**Infra:** Docker Compose em produção (postgres/api/web/caddy), HTTPS auto
(Caddy/Let's Encrypt), UFW, API/PG só no loopback. Backup + monitor por cron.
CI (GitHub Actions): build + lint + format + unit + e2e(PG embarcado) + e2e de
fluxo + e2e de UI (Playwright) + `npm audit` + CodeQL.

---

## 2. Evidências executadas nesta auditoria (2026-08-18)

| Gate               | Comando                                   | Resultado                                      |
| ------------------ | ----------------------------------------- | ---------------------------------------------- |
| Lint               | `npm run lint` (eslint .ts/.tsx)          | **limpo**                                      |
| Formatação         | `npm run format:check`                    | **limpo**                                      |
| SCA produção       | `npm audit --omit=dev --audit-level=high` | **0 vulnerabilidades**                         |
| Unitários          | `npm test` (shared+api+web)               | **178 passam** (85/79/14)                      |
| E2E banco          | `test:e2e` (PG embarcado)                 | **RLS+NSR+imutabilidade+super boundary: PASS** |
| E2E fluxo          | `test:e2e:fluxo`                          | login→dashboard→ponto→apuração: **PASS**       |
| E2E UI             | `test:e2e:integ` (Chromium+API real)      | **3/3 PASS**                                   |
| Segredos no código | grep credenciais em `**/src/**`           | **nenhum**                                     |
| Type-safety        | grep `any`/`@ts-ignore` em `apps/`        | **nenhum**                                     |
| Debug leftovers    | grep `console.log` em código de app       | **nenhum** (só CLIs)                           |

**Prova do núcleo crítico (nível de banco, não só código):**
`empresa A não vê dados da B`; `sem tenant → 0 linhas`; `NSR 1..60 sem furos sob
concorrência`; `UPDATE/DELETE em pontos negado ao app`; `super_admin não acessa
pontos/funcionários/documentos`. Todos **PASS**.

---

## 3. Achados

### CRITICAL — nenhum

Não foram encontrados: quebra de isolamento entre empresas, segredo exposto no
código, quebra de imutabilidade do ponto, build/testes/fluxo principal
quebrados, ou migration quebrada. Os domínios críticos passam com evidência.

### HIGH

- **H1 · Compliance legal não homologado.** `[REQUIRES DECISION — dono/jurídico]`
  O código gera AFD/AEJ e assina (Ed25519 + PAdES), mas em produção o
  certificado é **autoassinado de dev** (evidência: `CertificadoService` loga
  `Certificado AUTOASSINADO (dev) -- SEM validade ICP-Brasil`) e **não há
  homologação gov.br**. Impacto: exportações/assinaturas sem validade jurídica
  plena. Solução: obter certificado ICP-Brasil (A1/A3) + homologar leiautes.
  Status: **externo, pendente de decisão** (não é bug de código).

- **H2 · Backup sem cópia offsite.** `apps/../scripts/backup-prod.sh`
  Backup diário verificado (dump + tar + `pg_restore -l` + retenção), porém no
  **mesmo disco da VPS**. Perda total do servidor = perda dos backups. Solução:
  `rclone` cifrado para object storage. Status: **pendente** (precisa conta de
  storage do dono).

- **H3 · E2E de autorização/IDOR fora do CI.** `apps/api/test/e2e/run-e2e-http.mjs`
  Cobre IDOR multi-filial, LGPD (consentimento p/ biometria) e integridade AFD,
  mas **exige o stack de dev** e **não roda no CI** — regressão de authz pode
  passar. Solução: torná-lo autossuficiente (reusar `boot-stack.mjs`, como o
  `run-e2e-fluxo`) e plugar no CI. Status: **corrigível — recomendado como
  próxima ação desta auditoria**.

### MEDIUM

- **M1 · Apuração de folha: modelo simplificado e parâmetros não confirmados.**
  `packages/shared/src/apuracao.ts` · `banco-horas.service.ts`
  Percentuais (extra/periculosidade/noturno) são **configuráveis** e a conta é
  **transparente** (mitigação), mas o modelo v1 aplica adicionais sobre a base
  pura; a composição da base da hora extra (Súmula 264 TST) e os % reais da CCT
  **não foram confirmados**. Impacto: valores podem divergir da folha oficial.
  Solução: confirmar contra a CCT/holerite e ajustar parâmetros. Status:
  `REQUIRES DECISION`. Mitigação já aplicada: rótulo na tela deixa claro que é
  "para conferência da folha", não substitui o contador.

- **M2 · Valor-hora por cargo não persistido.** A apuração deriva de
  `salarioBase/divisor` ou usa `valorHoraPadrao`; não há cadastro de valor-hora
  por cargo/profissão. Para uso real: pequena evolução de schema + tela.

- **M3 · Sem testes de carga/escala.** Dashboard/indicadores/apuração iteram por
  funcionário; com ~450 funcionários não há medição de latência. Solução: teste
  k6/Locust do fluxo de ponto e da apuração no volume real.

- **M4 · Restore-test do backup não automatizado.** Restauração validada
  **manualmente uma vez** (36 tabelas, ~57 linhas); falta drill periódico.

- **M5 · Monitor sem canal de alerta ativo.** Detecta e registra (site/API/disco/
  cert/backup), mas por escolha do dono ficou **só-log** — depende de olhar o
  log. Gancho de webhook/e-mail já pronto no script.

### LOW / INFO

- **L1 · `remote` do git aponta para o nome antigo** (`REP-P`) via redirect;
  atualizar para `.Gramo`. INFO.
- **L2 · Documentação formal parcial.** Existe `README.md` + `ANALISE-SISTEMA.md`;
  o prompt pede também `ARCHITECTURE.md`, `SECURITY.md`, `DEPLOYMENT.md`,
  `TESTING.md`. Recomendado consolidar.
- **L3 · `run-e2e-http.mjs` acoplado ao seed rico (Matriz/Suape).** Ao torná-lo
  self-contained (H3), alinhar o seed.

---

## 4. Matriz de requisitos (núcleo do produto)

| Funcionalidade                            | Implementada | Testada                            | Segura                    | Validada                       |
| ----------------------------------------- | ------------ | ---------------------------------- | ------------------------- | ------------------------------ |
| Isolamento multi-empresa (RLS)            | ✅           | ✅ e2e banco                       | ✅ RLS + tenant no server | ✅                             |
| Ponto: registra e nunca bloqueia          | ✅           | ✅ e2e http/fluxo                  | ✅                        | ✅                             |
| NSR sequencial sob concorrência           | ✅           | ✅ e2e (60×)                       | ✅                        | ✅                             |
| Imutabilidade do ponto                    | ✅           | ✅ e2e (UPDATE/DELETE negados)     | ✅                        | ✅                             |
| Geofence (REGAP) → pendente, não bloqueia | ✅           | ⚠️ unidade (geo)                   | ✅                        | parcial (falta e2e do caminho) |
| Auth colaborador/admin + 2FA              | ✅           | ✅ unidade + fluxo                 | ✅ 2FA reativado em prod  | ✅                             |
| Autorização RBAC / IDOR por filial        | ✅           | ⚠️ e2e existe, **fora do CI (H3)** | ✅                        | parcial                        |
| LGPD (consentimento biometria)            | ✅           | ⚠️ e2e http (fora do CI)           | ✅                        | parcial                        |
| AFD/AEJ (exportação fiscal)               | ✅           | ⚠️ e2e http (fora do CI)           | ⚠️ cert dev (H1)          | ❌ homologação                 |
| Offline (fila/idempotência)               | ✅           | ✅ unidade (web)                   | ✅                        | parcial (falta e2e offline)    |
| Apuração de horas valorada                | ✅           | ✅ unidade+fluxo+UI                | ✅                        | ⚠️ parâmetros (M1)             |
| Backup + monitor                          | ✅           | restore manual 1× (M4)             | ✅                        | ⚠️ offsite (H2)                |

---

## 5. Status

**🟡 READY WITH KNOWN RISKS**

O núcleo técnico está **sólido e comprovado** (isolamento, imutabilidade, NSR,
auth/2FA, tipagem estrita, sem segredos no código, 178 testes + e2e verdes). Não
há bug CRITICAL de código. Os riscos que impedem o "verde pleno" são, em ordem:
**(H1) validade jurídica (ICP-Brasil/homologação) — externo**; **(H2) backup
offsite**; **(H3) e2e de authz/IDOR ainda fora do CI**; e **(M1) parâmetros da
apuração de folha a confirmar**. Nenhum deles é "aparência" — são residuais
reais e rastreáveis.

Decisões que dependem do dono (`REQUIRES DECISION`): H1 (jurídico), M1 (regras
da CCT/folha), H2 (provedor de storage).

Próxima ação recomendada desta auditoria: **H3** — tornar o e2e de autorização
autossuficiente e colocá-lo no CI, fechando a lacuna de regressão no domínio
mais sensível (authz/tenancy).
