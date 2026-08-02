# CHECKLIST DE GO-LIVE — REP-P

> Guia prático para colocar o REP-P em produção. Marca o que **já está pronto no
> código** (✅) e o que depende de **você / infra / atos externos** (⬜).
> Legenda de responsável: **[Dev]** feito no código · **[Infra]** DevOps/servidor
> · **[Você]** decisão/ato do dono · **[Jurídico]** advogado/contador.

---

## 0. Pré-requisitos de produção

- ✅ **[Dev]** Monorepo compila, 79 testes de unidade + 18 e2e verdes, lint limpo.
- ✅ **[Dev]** Migrations versionadas (`apps/api/prisma/migrations`) e RLS
  (`apps/api/prisma/sql/rls-policies.sql`).
- ⬜ **[Infra]** Servidor/orquestrador (VM, ECS, Kubernetes ou Docker host) com
  **≥ 2 GB RAM** (a máquina de dev tinha ~500 MB e sofria OOM no build).
- ⬜ **[Infra]** Node 20+ e Docker/Compose instalados no host.

## 1. Banco de dados (PostgreSQL + 3 roles)

- ✅ **[Dev]** Modelo de **3 roles**: `repp_owner` (DDL/migrations),
  `repp_app` (runtime, RLS), `repp_super` (plataforma, sem dados operacionais).
- ⬜ **[Infra]** Provisionar PostgreSQL 16 gerenciado (RDS/Cloud SQL) ou via
  `docker compose up -d` (o `docker/postgres-init.sh` cria `repp_app`/`repp_super`).
- ⬜ **[Infra]** Rodar **migrations + RLS**: `npm run db:setup -w @repp/api`
  (o `Dockerfile` já faz isso no start da API).
- ⬜ **[Infra]** Confirmar que a API conecta como `repp_app` (NUNCA como owner/superuser).
- ⬜ **[Infra]** **Backups automáticos** + teste de restore + retenção (guarda legal 5 anos).

## 2. Segredos e configuração (`.env`)

Gere segredos fortes (ex.: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`).

- ⬜ **[Infra]** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (≥ 32 chars, distintos).
- ⬜ **[Infra]** `DATA_ENCRYPTION_KEY` (32 bytes base64 — cifra biometria/documentos/2FA).
- ⬜ **[Infra]** `DATABASE_URL` (repp_app), `SUPER_DATABASE_URL` (repp_super),
  `MIGRATION_DATABASE_URL` (repp_owner).
- ⬜ **[Infra]** `NODE_ENV=production` (desliga o Swagger automaticamente).
- ⬜ **[Você/Infra]** `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_SENHA` para o bootstrap do
  1º Super Admin (troque a senha e configure o 2FA no primeiro acesso).
- ⬜ **[Infra]** Guardar segredos em cofre (Secrets Manager/Vault/KMS), **nunca** no git.

## 3. Compliance Portaria 671 (REP-P) — atos externos

- ✅ **[Dev]** Geração de **AFD/AEJ**, comprovante **PAdES-B**, hash SHA-256,
  imutabilidade, NSR, pacote de fiscalização.
- ⬜ **[Você]** **Homologar os leiautes AFD/AEJ** no validador oficial gov.br e
  ajustar larguras/campos em `packages/shared/src/afd.ts` se necessário.
- ⬜ **[Você]** Adquirir **certificado ICP-Brasil A1/A3** e instalar via
  `ASSINATURA_P12_BASE64` + `ASSINATURA_P12_SENHA` (em dev usa autoassinado, sem
  validade jurídica).
- ⬜ **[Você]** **Registro do software no INPI** (exigência do REP-P).
- ⬜ **[Jurídico]** Revisão do fluxo da Tela 3 / ADM 4 e da assinatura virtual por
  **advogado trabalhista** (regra de nunca bloquear o ponto).

## 4. Segurança / hardening

- ✅ **[Dev]** Argon2id, 2FA obrigatório (admin/super), lockout 5/15min, RLS +
  isolamento do Super Admin, AES-256 em repouso, Ed25519, helmet, rate limiting,
  JWT com algoritmo fixado, uploads com limite/MIME. Ver `SECURITY-REVIEW.md`.
- ⬜ **[Infra]** **TLS/HTTPS** no proxy (Nginx/Cloudflare) — HSTS já é emitido pelo helmet.
- ✅ **[Dev]** **CORS** restrito por env `CORS_ORIGINS` (vazio em produção = nega). ⬜ **[Infra]** definir as origens do PWA.
- ⬜ **[Infra]** Chaves em **HSM/KMS** com rotação (`DATA_ENCRYPTION_KEY`, JWT, P12,
  Ed25519); o `chaveServidorId` já versiona a chave de assinatura.
- ⬜ **[Dev/Infra]** (Opcional) Aplicar o escopo por filial também em relatórios
  agregados e endurecer detecção de reuso de refresh do Super Admin.

## 5. Integrações e serviços externos

- ✅ **[Dev]** ADM 9: chaves de API (hash) + config folha/eSocial.
- ✅ **[Dev]** Camada de **e-mail (SMTP via nodemailer)** pronta: recuperação de
  senha e convite enviam ao e-mail do funcionário. ⬜ **[Infra]** definir `SMTP_*`
  (sem eles, e-mails são só registrados no log). SMS/push seguem pendentes.
- ⬜ **[Infra]** **Push** (comunicados / documento não lido em 5 dias).
- ⬜ **[Infra]** **Gateway de pagamento** (faturas ADM 0) e **transmissão eSocial**
  (a config existe; a chamada externa é a integrar).
- ⬜ **[Infra]** Storage: migrar `STORAGE_DRIVER=local` para **S3-compat** em produção.

## 6. Observabilidade e operação

- ⬜ **[Infra]** Logs estruturados + agregação (ex.: Loki/CloudWatch); **não logar** segredos.
- ⬜ **[Infra]** Métricas/health: `GET /api/v1/health/live` e `/ready` (prontos).
- ⬜ **[Infra]** Alertas (erros, fila de exceções/pendências, disco do storage).
- ⬜ **[Infra]** Plano de contingência p/ indisponibilidade (registro manual alternativo).

## 7. LGPD

- ✅ **[Dev]** Consentimento biométrico separado, cifragem em repouso, soft delete
  (guarda 5 anos), trilha de auditoria.
- ⬜ **[Você/Jurídico]** Nomear **DPO/encarregado**, publicar **política de
  privacidade** e **política de retenção/exclusão** de biometria.
- ⬜ **[Você]** **DPA** (contrato de tratamento de dados) por empresa-cliente (fase SaaS).
- ⬜ **[Dev/Infra]** Plano de resposta a incidentes documentado.

## 8. Deploy e verificação

- ⬜ **[Infra]** CI verde (`.github/workflows/ci.yml`: build+lint+test+e2e).
- ✅ **[Dev]** **PWA containerizado** (Nginx serve o build + proxy `/api`); serviço
  `web` no `docker-compose.yml`. `docker compose up -d` sobe **Postgres + API + PWA**.
- ⬜ **[Infra]** Subir atrás do proxy TLS; ajustar `VITE_API_BASE_URL` se a API tiver domínio próprio.
- ⬜ **[Infra]** Configurar **subdomínio por empresa** (`empresax.seuapp.com`) — o
  tenant é resolvido pelo subdomínio.
- ⬜ **[Você]** **Piloto** com 1 empresa real: 2–3 cadastros fictícios (incl. casos
  de erro), bater ponto dentro/fora da REGAP, assinar holerite, gerar AFD/AEJ.
- ⬜ **[Você]** Termo de política interna de ponto assinado pelos funcionários.

## 9. Pós-lançamento (evolução)

- Banco de horas com fechamento mensal + adicional de hora-extra/DSR (regras CLT finas).
- Liveness/matching facial (SDK vs. próprio) — decisão com trade-offs de custo/privacidade.
- Hardening ISO 27001 formal (gestão de risco, continuidade) para a fase comercial.

---

### Resumo do caminho crítico (mínimo para operar legalmente)
1. Servidor com RAM adequada + PostgreSQL (3 roles) + `db:setup` + backups.
2. Segredos fortes no cofre + `NODE_ENV=production` + TLS.
3. **Certificado ICP-Brasil** + **homologação AFD/AEJ** + **INPI** + **revisão jurídica**.
4. Provedor de e-mail/SMS.
5. Piloto com 1 empresa e política interna assinada.
