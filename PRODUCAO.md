# PRODUÇÃO — Checklist de endurecimento (.GRAMO / GRAMO ENGENHARIA)

> Fase 2 da entrega. O que o **código já garante** e o que é **operação/infra (👤)**
> antes do go-live. Honesto: segurança é processo, não estado final.

## Garantido no código (verificado)

- [x] **2FA obrigatório em produção.** O boot é **recusado** (fail-fast) se
      `DEV_BYPASS_2FA=true` com `NODE_ENV=production` (`config/env.ts`) — testado
      (`env.test.ts`). O bypass é exclusivo de dev/demo.
- [x] **Env fail-fast:** faltou segredo obrigatório (JWT/AES ≥32) → API não sobe.
- [x] **SUPER_DATABASE_URL fail-fast** em produção (role `repp_super` dedicada).
- [x] **CORS por env** (`CORS_ORIGINS`): produção sem a var **nega** cross-origin
      (+ aviso no log). Defina o domínio do PWA.
- [x] **Helmet** (CSP/HSTS/etc.), **ValidationPipe** global, **Swagger só fora de
      produção**, **rate limit** global 300/min (escala de obra) + **lockout**
      5/15min no login.
- [x] **Cripto:** Argon2id (senha), AES-256-GCM (biometria/doc), Ed25519
      (assinatura), tokens só como SHA-256. **Ponto imutável** (RLS + revoke +
      trigger). **prod `npm audit` = 0**.
- [x] **Segredos fora do repo** (`.env` gitignored; `gerar-segredos.mjs`).

## Antes do go-live (operação / infra — 👤)

- [ ] Gerar segredos de produção (`node scripts/gerar-segredos.mjs`) e guardar em
      **cofre/KMS** (não `.env` em disco); definir rotação. **NÃO** setar
      `DEV_BYPASS_2FA` em produção.
- [ ] `NODE_ENV=production`, `CORS_ORIGINS=https://<dominio-da-gramo>`,
      `SUPER_DATABASE_URL` (role `repp_super`), `SMTP_*` reais.
- [ ] **TLS/HTTPS** no proxy (Caddy → HSTS automático) no domínio da GRAMO.
- [ ] **Backups** diários do Postgres + **teste de restore** (guarda de 5 anos).
- [ ] **Certificado ICP-Brasil A1/A3** (`ASSINATURA_P12_BASE64`) → PAdES válido.
- [ ] **Homologar AFD/AEJ** no verificador gov.br.
- [ ] **Pentest** externo + revisão **LGPD/DPO** (ROPA, DPIA da biometria, DPA).
- [ ] Observabilidade (logs `LOG_JSON` → agregador, `/metrics`, alertas, uptime).

## Como validar o fail-fast (prova rápida)

Em um ambiente com `NODE_ENV=production` **e** `DEV_BYPASS_2FA=true`, a API
**não sobe** (erro claro). É a garantia de que o atalho de demo não vaza para
produção.
