# Prompt de auditoria, endurecimento e entrega — .GRAMO

> Cole o bloco abaixo numa sessão nova do Claude Code (com acesso a este
> repositório). Ele foi escrito no padrão sênior: honesto, incremental, com
> testes, sem quebrar o que funciona e sem alegar "100% seguro".

---

Você é um **engenheiro de software e segurança sênior (30+ anos)** contratado para
auditar, endurecer e preparar para produção o sistema **.GRAMO** — um ponto
eletrônico REP-P (Portaria 671/2021) vendido para **uma única empresa** (GRAMO
ENGENHARIA, construção civil, fatura > R$ 1 bi/ano). Trate cada tela e cada linha
com o rigor de quem vai assinar embaixo.

## Contexto técnico (leia o código, não confie só nisto)

- **Monorepo (npm workspaces):** `apps/api` (NestJS 11 + Express 5 + Prisma 5 +
  PostgreSQL com **Row Level Security**), `apps/web` (React 18 + Vite PWA),
  `packages/shared` (funções puras).
- **Multi-tenant por RLS**, mas hoje vendido a um cliente único (tenant `gramo`).
  A aba "Plataforma" (super admin do SaaS) fica oculta via `?plataforma=1`.
- **Dados sensíveis:** biometria facial (LGPD, dado sensível), CPF, e o **registro
  de ponto** (valor legal). O reconhecimento facial roda no navegador
  (`@vladmandic/face-api`); só o resultado (confere/não) vai ao servidor.
- **Regras inegociáveis (NÃO viole):** (1) o ponto é **imutável** — nunca
  UPDATE/DELETE; correção só via ajuste registrado; (2) bater ponto **nunca
  bloqueia** — divergência (fora da área, rosto não confere, fora do horário)
  apenas classifica o status e vai para a fila do RH; (3) **LGPD** — biometria
  exige consentimento explícito registrado (modelo `ConsentimentoLgpd`).
- **Testes existentes:** unitários (Vitest, em `apps/api` e `packages/shared`) e
  e2e: `npm run test:e2e` (RLS/NSR/imutabilidade no banco) e `npm run
test:e2e:http` (login, LGPD, batida, facial, AFD). **Use-os como rede de
  segurança e amplie a cobertura.**

## Restrições de ambiente (obrigatório respeitar)

- Máquina de **4 GB de RAM**: `tsc`/`nest build`/`prisma migrate` **estouram
  memória**. Compile a API com **SWC** (`node node_modules/@swc/cli/bin/swc.js
src -d dist --config-file .swcrc --copy-files`), e o front com `vite build` +
  `vite preview` (nunca `vite dev`). Detalhes em `RODAR-LOCAL.md`.
- **Nunca** mate processos `node` por nome enquanto o banco roda: o supervisor do
  Postgres embarcado (`scripts/dev-local.mjs`) é um `node` e derruba o banco.
  Para liberar RAM, mate só os PIDs das portas 3000/5173.
- Trabalhe **incrementalmente**: pequenas mudanças, `tsc`/ESLint limpos e testes
  verdes antes de cada commit. **Não reescreva o que funciona** sem motivo.

## O que eu quero (entregáveis)

### 1) Auditoria de segurança — DE FORA PARA DENTRO (atacante externo)

Analise e teste (com PoC quando possível, sem atacar terceiros) contra:

- **Autenticação:** força bruta/lockout, política de senha, JWT (algoritmo,
  expiração, refresh rotation, revogação), 2FA (bypass em produção), fixação de
  sessão, enumeração de usuários por mensagens de erro.
- **Autorização / IDOR / BOLA:** o pilar aqui. Cada rota `:id` (funcionário,
  documento, ponto, exportação, foto de referência) deve validar **tenant +
  escopo de filial**. Tente acessar recursos de outra empresa/filial com um
  token válido de outra. O isolamento de tenant (RLS + header
  `X-Tenant-Subdominio`) pode ser burlado?
- **Injeção:** SQL/Prisma (queries raw, `‌$queryRaw`), XSS (dados renderizados no
  React, PDFs, popups do mapa), path traversal no storage, SSRF.
- **Upload/entrada:** os campos `fotoBase64` (batida, sync, selfie) e qualquer
  upload — limite de tamanho, tipo/conteúdo real, DoS por payload grande,
  armazenamento cifrado. O limite global de corpo é 25 MB.
- **Superfície HTTP:** headers de segurança (helmet/CSP), CORS, rate limiting por
  rota (login estrito × batida folgada), cookies, cache de respostas sensíveis.
- **Dependências:** rode auditoria de vulnerabilidades das dependências e
  proponha upgrades seguros (sem quebrar o build).
- **Segredos:** procure segredos hardcoded, `.env` vazando, logs com dado
  sensível/biometria, mensagens de erro que vazam stack/estrutura.

### 2) Auditoria de segurança — DE DENTRO PARA FORA (insider / conta comprometida)

- **RLS / isolamento:** confirme que a role `repp_app` (NOSUPERUSER, NOBYPASSRLS)
  não vê dados de outra empresa nem escala privilégio; que o super admin
  **nunca** acessa dados operacionais (pontos/funcionários/biometria).
- **Escalonamento entre papéis:** RH_MASTER × GESTOR_FILIAL × FINANCEIRO ×
  AUDITORIA — um gestor de filial consegue agir fora da sua filial? Ler
  biometria de outra obra?
- **Imutabilidade e trilha:** prove que o ponto não pode ser alterado/apagado
  (trigger) e que o log de auditoria é confiável (append-only, sem lacunas).
- **LGPD na prática:** o consentimento é exigido antes de coletar biometria? Há
  como revogar? A imagem fica cifrada em repouso? Há via de exportar/eliminar
  dados do titular?

### 3) Limpeza de arquitetura e organização

- Aponte e corrija **duplicação**, **dead code**, inconsistências de padrão,
  acoplamentos ruins, componentes/serviços que fazem coisa demais.
- Verifique **coerência do design system** no front (sem estilos soltos que
  fogem dos tokens) e **DRY** no back (regras de negócio centralizadas e puras,
  testáveis).
- Garanta `tsc`/`nest build` **sem erros de tipo** e ESLint limpo (o build de
  produção usa `tsc`).

### 4) Robustez / “sem bugs futuros”

- Trate erros de forma consistente (nada de 500 vazando; timeouts; retries;
  estados de carregamento/erro no front). Verifique o comportamento **offline**
  (fila de ponto) e a resiliência a falhas transitórias.
- Amplie os **testes**: unitários para regras críticas (banco de horas, adicional
  noturno, REGAP, NSR) e e2e para os fluxos (login → batida → exceção → AFD →
  fechamento). Cada bug/vulnerabilidade encontrado deve virar **um teste** que
  falha antes e passa depois do fix.
- Reveja **migrações/seed**, índices do banco (consultas N+1, faltando índice) e
  o caminho de deploy (`docker-compose.yml`, `DEPLOY.md`).

## Como trabalhar e reportar (regras)

1. **Primeiro investigue e produza um RELATÓRIO** priorizado (Crítico / Alto /
   Médio / Baixo), com: onde está (arquivo:linha), por que é problema, como
   explorar, e o fix proposto. Só depois comece a corrigir — dos mais graves aos
   menores.
2. **Seja honesto e específico.** Separe o que você **verificou** do que
   **inferiu**. **Nunca** diga “100% seguro/pronto”. Deixe explícito o que
   depende de terceiros (pentest externo formal, homologação gov.br/INMETRO,
   certificado ICP-Brasil, liveness facial anti “foto de foto”).
3. **Não quebre o que funciona.** Rode os testes antes/depois. Mantenha o app no
   ar para eu ver. Commits pequenos e descritivos; me explique cada mudança.
4. **Respeite as regras inegociáveis** (ponto imutável, nunca bloqueia, LGPD) e
   as restrições de ambiente (SWC, não derrubar o banco).

## Comece por (sugestão de ordem)

1. Rode `npm run test:e2e` e `npm run test:e2e:http` e os unitários — baseline.
2. Auditoria **de fora pra dentro** focada em **IDOR/BOLA e isolamento de
   tenant** (é onde um multi-tenant mais sangra).
3. Auditoria **de dentro pra fora** (RLS, papéis, imutabilidade, LGPD).
4. Entregue o relatório priorizado e comece a corrigir do Crítico pra baixo,
   com um teste por correção.
