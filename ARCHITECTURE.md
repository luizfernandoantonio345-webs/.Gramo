# ARCHITECTURE.md — Arquitetura do .GRAMO

Monorepo npm (workspaces) com três camadas e um fluxo de dados claro.

```
apps/web (React/Vite PWA)
   │  lib/api.ts (Bearer + X-Tenant-Subdominio, refresh automático)
   ▼
apps/api (NestJS)
   Controllers  ── guards: JwtAuthGuard + RolesGuard (RBAC) + TenantMiddleware
      │
   Services     ── regras de orquestração; usam @repp/shared para o domínio puro
      │
   PrismaService.forTenant(tx)  ── seta app.current_empresa_id (RLS)
      ▼
PostgreSQL  ── Row-Level Security por empresa + imutabilidade do ponto
```

## Pacotes

- **`packages/shared`** — biblioteca de **domínio puro** (sem I/O): cpf, geo/
  REGAP, horário, noturno, banco de horas, apuração de folha, AFD, assinatura,
  documentos, LGPD/consentimento, password-policy, ponto-hash, csv. É onde vivem
  as regras testáveis, compartilhadas entre back e front.
- **`apps/api`** — NestJS 11 + Prisma 5. Módulos por domínio (auth, pontos,
  funcionarios, dashboard, banco-horas, ausencias, assinaturas, compliance,
  plataforma, kiosk, etc.). Cada módulo: Controller (HTTP + guards) → Service
  (orquestra) → Prisma.
- **`apps/web`** — React 18 + Vite 5, PWA offline-first (Dexie/IndexedDB para a
  fila de ponto). Design system próprio (`design-system/`), sem framework de UI
  externo.

## Princípios que o código segue

- **Regra de negócio no domínio, não no controller.** Controllers só validam,
  autorizam e delegam. Funções puras em `@repp/shared` (ex.: `apurarValores`,
  `calcularHorasDia`, `saldoDia`, `motivoAlertaPonto`).
- **Tenant vem do contexto autenticado**, nunca de um parâmetro do cliente. RLS
  no banco é a última linha de defesa.
- **O ponto é imutável.** Correções são ajustes vinculados (append-only); o
  banco nega UPDATE/DELETE ao papel da aplicação.
- **NSR** (número sequencial) é atômico por filial (`INSERT ... ON CONFLICT`),
  sem furos sob concorrência.
- **Tipagem estrita**, sem `any`/`@ts-ignore`. Erros tratados por filtro global
  que padroniza a resposta e não vaza stack em produção.

## Fluxos principais

- **Colaborador**: login (CPF+senha) → bater ponto (geo REGAP + foto, offline →
  fila → sync idempotente) → folha/documentos/férias/comunicados.
- **RH/Admin**: login (e-mail+senha+2FA) → dashboard (KPIs, presença, indicadores
  de RH) → gestão de ponto (pendências/ajustes) → apuração de horas → funcionários
  → ausências → assinaturas → relatórios (AFD/AEJ) → auditoria.
- **Plataforma (super)**: gestão comercial (empresas/planos/faturas), **sem**
  acesso a dados operacionais (barreira no nível do banco: role `repp_super`).
- **Quiosque**: dispositivo autentica por token próprio (não por pessoa).

## Persistência e RLS

Prisma modela ~37 entidades; 12 migrations + `sql/rls-policies.sql`. As roles
Postgres são segregadas: `repp_owner` (migrations), `repp_app` (aplicação, sob
RLS, sem UPDATE/DELETE em ponto), `repp_super` (plataforma, sem dados
operacionais).

## Testes como parte da arquitetura

Ver `TESTING.md`. O `boot-stack.mjs` sobe o backend real (PG embarcado + seed +
API) e é a base tanto dos e2e de API quanto do e2e de UI de integração.
