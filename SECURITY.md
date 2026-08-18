# SECURITY.md — Postura de segurança do .GRAMO

Sistema corporativo de ponto eletrônico. Segurança tratada como parte do núcleo,
não como feature. Este documento reflete o que **está implementado** (verificado
por testes/auditoria — ver `AUDIT.md`).

## Isolamento multiempresa (multi-tenancy)

O `empresa_id` do contexto autenticado governa **Row-Level Security no Postgres**
(`sql/rls-policies.sql`), não apenas filtros no código. O `PrismaService.forTenant`
seta `app.current_empresa_id` por requisição; sem tenant, nenhuma linha é
visível. Provado por e2e (`test:e2e`): empresa A não enxerga dados da B.

## Autenticação

- Senhas com **Argon2** (`@node-rs/argon2`) — nunca em texto puro, nunca em log.
- **2FA (TOTP)** obrigatório para admin e super admin em produção.
- Lockout progressivo; refresh tokens; JWT com algoritmo **fixado (HS256)**.
- Recuperação de senha por token com expiração.

## Autorização

- **RBAC** por papel (`roles.guard`) + **escopo por filial** (`escopo-filial`).
- Toda autorização crítica é validada no **backend**; o frontend não é fonte de
  verdade. IDOR/broken-access-control tem e2e no CI (`test:e2e:authz`): gestor
  de uma obra recebe **403** ao acessar outra.

## Dados sensíveis

- Biometria/fotos e documentos **cifrados (AES-256)** em repouso.
- Consentimento LGPD separado para biometria; soft delete (guarda legal 5 anos).
- Ponto **imutável**: correção vira ajuste vinculado; UPDATE/DELETE negados ao
  papel da aplicação no banco (provado por e2e).

## Superfície HTTP

Helmet (CSP/HSTS), throttler global, CORS restrito por env, whitelist de DTOs
(`forbidNonWhitelisted`), limite de corpo, Swagger desativado em produção,
filtro global que não vaza stack em produção.

## Segredos

`.env` só no servidor (gitignored), validado no boot (≥ 32 chars). **Nenhum
segredo hardcoded** no código (grep em `**/src/**` = 0). Se um segredo real
vazar, trate como **comprometido**: rotacione/revogue, não apenas remova do
arquivo.

## Rede (produção)

UFW libera só 22/80/443. API (3000) e Postgres (5432) publicados apenas em
127.0.0.1. HTTPS automático (Caddy/Let's Encrypt), auto-renovado.

## Pipeline

CI roda **SAST (CodeQL)** e **SCA (`npm audit --omit=dev --audit-level=high`)**
a cada PR/push; hoje = 0 vulnerabilidades de produção.

## Pendências de segurança (ver AUDIT.md)

- **ICP-Brasil + homologação gov.br** para validade jurídica de AFD/assinatura
  (hoje certificado autoassinado de dev). — H1
- **Pentest externo** por terceiro (não há).
- **WAF/DDoS** (ex.: Cloudflare) na frente.

## Divulgação responsável

Encontrou uma vulnerabilidade? Não abra issue pública. Contate o responsável
pelo projeto diretamente para coordenar a correção.
