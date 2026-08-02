# REVISÃO DE SEGURANÇA — REP-P

> Auditoria de segurança de ponta a ponta das Fases 0–6. Data: 2026-07-31.
> Escopo: authz/IDOR, isolamento multi-tenant (RLS), criptografia e dados
> sensíveis (LGPD), upload de arquivos, autenticação/JWT, injeção, exposição de
> superfície e segredos. Metodologia: leitura de código + testes e2e contra
> Postgres real.

## Resumo

- **Achados corrigidos:** 2 **Altos**, 6 **Médios/Hardening** + **R1 (authz por
  filial)** corrigido em seguida.
- **Riscos aceitos/documentados:** 2 (dependem de infra/produto).
- Após as correções: **66 testes de unidade + 18 e2e verdes**, lint limpo.

---

## Achados corrigidos

### 🔴 A1 — IDOR no comprovante de assinatura (Alta)
Um funcionário autenticado podia obter o **comprovante de assinatura de outro
funcionário da mesma empresa** informando o `id` na rota
`GET /assinaturas/:id/comprovante` — vazando CPF, hash e timestamp. A RLS
impedia vazamento **entre** empresas, mas não **entre funcionários** do mesmo
tenant.
**Correção:** `comprovante(id, funcionarioId?)` passou a escopar ao **dono**
quando chamado pelo funcionário; o endpoint administrativo (ADM 3) permanece
amplo por empresa (legítimo). — `assinatura.service.ts`, `assinatura.controller.ts`.

### 🔴 A2 — Upload sem limite de tamanho/MIME (Alta — DoS)
`POST /admin/assinaturas` decodificava o base64 **sem limite de tamanho nem
whitelist de MIME**; e as fotos de ponto (`POST /pontos`) também não tinham
teto — permitindo exaustão de memória/disco.
**Correção:** validação de tamanho (15MB) + MIME (PDF/JPG/PNG) no envio de
assinatura; e **teto central de 20MB no `StorageService`** (defesa em
profundidade que cobre toda entrada de arquivo). — `assinatura.service.ts`,
`storage.service.ts`.

### 🟡 A3 — Corpo da requisição sem limite (Média — DoS + bug funcional)
O parser JSON padrão do Express tem limite de **100kb**, o que **quebraria** os
uploads base64 e não dava controle de DoS.
**Correção:** parser com **teto explícito de 25MB** (`json`/`urlencoded`),
alinhado ao teto de arquivo. — `main.ts`.

### 🟡 A4 — Swagger exposto em produção (Média)
`/api/docs` expunha a superfície completa da API.
**Correção:** Swagger habilitado **apenas fora de produção**
(`NODE_ENV !== 'production'`). — `main.ts`.

### 🟡 A5 — Algoritmo do JWT não fixado (Média — hardening)
As verificações de JWT não fixavam o algoritmo.
**Correção:** `algorithms: ['HS256']` em todas as verificações (guards de tenant
e de plataforma + desafios de 2FA). — `jwt-auth.guard.ts`, `super-auth.guard.ts`,
`admin-auth.service.ts`, `super-auth.service.ts`.

### 🟡 A6 — Bypass do TenantMiddleware por substring (Média)
A isenção de tenant usava `path.includes('/super' | '/docs' | '/health')` —
frágil a falso-positivo por substring.
**Correção:** checagem **precisa por segmento**
(`/^\/api(\/v\d+)?\/(health|super)(\/|$)/` + `startsWith('/api/docs')`). —
`tenant.middleware.ts`.

### 🟡 A7 — Força mínima dos segredos JWT (Baixa — hardening)
`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` exigiam ≥16 chars.
**Correção:** mínimo elevado para **32**. — `config/env.ts`.

---

## Controles verificados (sem achado)

- **Isolamento multi-tenant (RLS):** provado em e2e — empresa A não vê dados de
  B; sem tenant → 0 linhas; `repp_super` é **negado** em todas as tabelas
  operacionais. Toda query de negócio passa por `forTenant` (SET LOCAL + RLS).
- **Anti-replay de token entre tenants:** `JwtAuthGuard` exige `empresaId` do
  token == tenant resolvido pelo subdomínio.
- **Imutabilidade:** `pontos`, `assinaturas_virtuais`, `exportacoes_afd_aej`,
  logs — `UPDATE/DELETE` revogados no banco (provado em e2e) + trigger no ponto.
- **Criptografia:** senhas **Argon2id** (OWASP); **AES-256-GCM** em repouso
  (biometria/documentos, com detecção de adulteração); **Ed25519** (assinatura),
  chave por HKDF (separação de chave); tokens opacos guardados só como SHA-256;
  segredo TOTP cifrado.
- **Injeção SQL:** nenhum `queryRawUnsafe`/`executeRawUnsafe`; todo SQL cru usa
  templates parametrizados do Prisma.
- **Segredos:** nenhum log de senha/token/segredo; `.env`, `storage/`, chaves
  fora do repo (`.gitignore`); validação de env fail-fast no boot.
- **IDOR (demais rotas):** endpoints do funcionário escopam por `user.sub`
  (ponto, documentos, assinar/visualizar/recusar/histórico); os administrativos
  são escopados por empresa via RLS (comportamento pretendido).
- **Força bruta:** lockout 5/15min + **rate limiting** global (throttler) +
  resposta genérica no login; 2FA obrigatório para admin/super.

---

## Riscos aceitos / pendentes (infra ou produto)

### ✅ R1 — Escopo por filial do Gestor de Filial (autorização) — CORRIGIDO
Era: o `GESTOR_FILIAL` podia ver/gerir funcionários e ponto de **outras filiais**
da mesma empresa (over-privilege intra-tenant). **Correção:** `EscopoFilialService`
(global) restringe o `GESTOR_FILIAL` às filiais de `AdminFilialAcesso` — aplicado
em `FuncionariosService` (listar + criar/atualizar/desligar/aprovar foto + decidir
documento) e `GestaoPontoService` (dashboard, fila de exceções, espelho). RH
Master/Financeiro/Auditoria seguem com visão de empresa inteira.

### R2 — Conteúdo de arquivo vs. MIME declarado — BAIXO
O MIME é validado contra whitelist, mas **não** verificado contra o conteúdo
real (magic bytes). Impacto mitigado: arquivos são cifrados, nunca executados, e
`data:` URLs em iframe têm origem opaca (não acessam o pai) + `helmet` (CSP).
**Recomendação:** validar magic bytes no upload.

### R3 — `SUPER_DATABASE_URL` com fallback em dev — BAIXO
Em dev, `PrismaSuperService` cai para `DATABASE_URL` (role `repp_app`) se
`SUPER_DATABASE_URL` não estiver definida — o super simplesmente **não funciona**
(sem vazamento, pois `repp_app` não lê tabelas de plataforma). **Recomendação:**
exigir `SUPER_DATABASE_URL` (fail-fast) em produção.

---

## Endurecimento recomendado para produção (infra)

- TLS terminado no proxy (helmet já emite HSTS); CORS restrito à origem do PWA.
- Chaves (`DATA_ENCRYPTION_KEY`, Ed25519, JWT, P12 ICP-Brasil) em **HSM/KMS**
  com rotação; `chaveServidorId` já versiona a chave de assinatura.
- Entrega real de e-mail/SMS/push (recuperação/convite/notificações — hoje stub).
- Observabilidade (logs estruturados, alertas) e backup/retention por tenant.
- Rotação/expiração de sessões e detecção de reuso de refresh do Super Admin.
