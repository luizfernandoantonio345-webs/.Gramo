# RELEASE_AUDIT.md — Relatório final de auditoria (.GRAMO / REP-P)

> Data: `2026-08-18` · Branch: `fase-b-estabilizacao` (produção) · Base de
> evidências: `AUDIT.md`. Este relatório resume a auditoria de release e o
> estado do sistema para produção. Sem "parece bom" — só evidência.

## Resumo executivo

O .GRAMO é um sistema corporativo de ponto eletrônico **em produção**, com base
técnica sólida e comprovada por testes. A auditoria **não encontrou bug
CRITICAL de código**, quebra de isolamento entre empresas, segredo exposto no
código ou quebra de imutabilidade do ponto. O que separa o sistema do "verde
pleno" são riscos **conhecidos e rastreáveis** — principalmente **legais/
externos** (homologação ICP-Brasil/gov.br) e **operacionais** (backup offsite),
além de parâmetros da apuração de folha a confirmar com a convenção coletiva.

**Status final: 🟡 READY WITH KNOWN RISKS.**

## Arquitetura

Monorepo em camadas coerentes: `@repp/shared` (domínio puro/testável) →
`apps/api` (NestJS: Controllers com guards RBAC+tenant → Services → Prisma
`forTenant` → PostgreSQL com **RLS**) → `apps/web` (React/Vite PWA). Sem SQL em
rotas, sem lógica de negócio relevante em controllers, sem dependências
circulares observadas. **Nenhuma reescrita foi feita** — a auditoria preservou
stack, contratos e identidade do projeto.

## Segurança

- **Isolamento multi-empresa**: RLS no Postgres (não só no código) — provado por
  e2e (empresa A não vê B; sem tenant → 0 linhas).
- **Autorização/IDOR**: RBAC + escopo por filial; gestor restrito **não** acessa
  outra obra — agora com e2e no CI (H3 corrigido nesta auditoria).
- **Auth**: Argon2; 2FA (TOTP) **reativado em produção** durante a sessão (havia
  sido desligado no piloto via `ADMIN_2FA_OPCIONAL`); lockout; JWT HS256 fixo.
- **Dados**: AES-256 em repouso (biometria/documentos); segredos fora do git
  (grep em `**/src/**` = **nenhum** hardcoded); tipagem estrita (**zero** `any`/
  `@ts-ignore`).
- **HTTP**: Helmet, throttler, CORS restrito, whitelist de DTOs, Swagger off em
  prod. SAST (CodeQL) + SCA (`npm audit` prod = **0 vulnerabilidades**) no CI.

## Banco de dados

12 migrations + `rls-policies.sql`. **Imutabilidade** do ponto imposta no banco
(UPDATE/DELETE negados ao papel da aplicação — provado). **NSR** atômico e sem
furos sob concorrência 60× (provado). Provisionamento do zero (migrations + RLS

- seed) validado a cada run do e2e autossuficiente (`boot-stack`).

## Testes

- **178 unitários** (shared 85, api 79, web 14) — regras críticas cobertas.
- **e2e de banco**: RLS, NSR, imutabilidade, boundary do super admin.
- **e2e de fluxo** (API real, PG embarcado): login admin/funcionário → dashboard
  → bater ponto → apuração.
- **e2e de autorização/IDOR** (novo): multi-filial, 200/403/401.
- **e2e de UI**: fumaça das telas + integração navegador↔API real (login →
  Dashboard / Apuração / Bater Ponto).
- Gate de cobertura no `@repp/shared` (o coração do domínio).

## Performance

Sem otimização prematura. Agregações usam `groupBy`/consultas em lote (sem N+1
óbvio). **Pendência (M3)**: sem teste de carga para o volume real (~450
funcionários) — recomendado k6/Locust no ponto e na apuração.

## Código removido / refatorado (nesta sessão de auditoria/evolução)

- Extração de `boot-stack.mjs` (fonte única do backend de e2e — dedup).
- Remoção de **credenciais hardcoded** do script de captura (agora por env).
- Normalização de formatação (27 arquivos) + gate de `format:check`.

## Dependências

0 vulnerabilidades de produção. Adicionados apenas **devDependencies**
(`@playwright/test`, `playwright`, `@vitest/coverage-v8`) — não entram no bundle
nem no `npm audit` de produção.

## Bugs encontrados e corrigidos (sessão)

1. **2FA desligado em produção** (`ADMIN_2FA_OPCIONAL=true`) → reativado.
2. **Backup quebrando após deploy** (perda do bit +x) → +x no git (100755) +
   cron via `bash`.
3. **CI não rodava no branch de deploy** → passa a disparar em
   `fase-b-estabilizacao`.
4. **Telas em branco no PDF** (PNG com alpha no pdfkit) → JPEG.
5. **Explosão de páginas no PDF** (rodapé fora da margem) → margem zerada no
   rodapé.
6. **Flakiness de E2E** (service worker recarregando) → SW bloqueado nos testes.

## Testes adicionados

`apuracao`, `decompor-dia`, `indicadores-rh`, `extras-agregadas`,
`alertas-ponto` (unit); `run-e2e-fluxo`, `run-e2e-authz` (e2e de API real);
`login.spec` (UI fumaça); `fluxo.spec` (UI integração).

## Vulnerabilidades

Nenhuma encontrada no código; `npm audit --omit=dev` = 0. IDOR/broken access
control agora com regressão guardada no CI.

## Pendências / decisões do dono (`REQUIRES DECISION`)

- **H1 — ICP-Brasil + homologação gov.br** (validade jurídica de AFD/assinatura).
- **M1 — parâmetros da apuração de folha** (percentuais e base do extra conforme
  a CCT; hoje configuráveis e transparentes, mas não confirmados).
- **H2 — backup offsite** (precisa conta de object storage).
- **M2** — valor-hora por cargo persistente · **M3** — testes de carga · **M4** —
  restore-test automatizado · **M5** — canal de alerta ativo do monitor.

## Riscos residuais

1. AFD/assinatura sem validade jurídica plena até ICP-Brasil/homologação.
2. Valores da apuração podem divergir da folha oficial até validação contra a
   CCT (mitigado: rótulo "para conferência", não substitui o contador).
3. Perda total da VPS = perda dos backups (até offsite).

## Checklist de produção

- [x] Build reproduzível (CI) · [x] Lint/format/tipos limpos · [x] 0 vulns prod
- [x] Isolamento multi-tenant provado · [x] Imutabilidade/NSR provados
- [x] Auth + 2FA + RBAC/IDOR (e2e no CI) · [x] HTTPS, hardening, segredos fora do git
- [x] Backup diário verificável + monitor · [ ] Backup **offsite** (H2)
- [x] E2E (banco, fluxo, authz, UI) no CI · [ ] Testes de **carga** (M3)
- [ ] Validade jurídica AFD/assinatura (H1) · [ ] Parâmetros de folha validados (M1)

## Status final

**🟡 READY WITH KNOWN RISKS** — apto a operar (e já opera) com os riscos acima
mapeados. Para **🟢 READY FOR PRODUCTION** pleno como produto vendável, faltam
H1 (jurídico) e H2 (offsite); os demais são evoluções rastreadas.
