# FINALIZAR o REP-P — passo a passo (o que só VOCÊ pode fazer)

O código do núcleo está pronto e testado. Esta é a lista, em ordem, para colocar
no ar de verdade. 👤 = ato que exige você (compra/conta/decisão legal).

## Fase 1 — Colocar no ar (produção) 👤
1. **Contratar VPS** Ubuntu 22.04, ≥2 GB RAM (Hetzner/DigitalOcean/Contabo ~R$30–120/mês). Anote o IP.
2. **Registrar domínio** (~R$40/ano). Aponte registro A para o IP:
   - `app.suaempresa.com` (app) e `*.suaempresa.com` (curinga p/ subdomínios = tenants).
3. No VPS: `apt install -y docker.io docker-compose-plugin git`.
4. Enviar o projeto (git clone ou scp).
5. Gerar segredos: `node scripts/gerar-segredos.mjs > .env` e editar:
   - `CORS_ORIGINS=https://app.suaempresa.com`
   - guardar a `SUPER_ADMIN_SENHA` gerada.
6. Subir: `docker compose up -d --build` (roda migrations + RLS no start).
7. **HTTPS** com Caddy (certificado Let's Encrypt grátis). Guia em DEPLOY.md.
   > HTTPS é obrigatório: a câmera só funciona em contexto seguro.

## Fase 2 — Armazenamento em nuvem (Cloudflare R2)
8. Criar conta Cloudflare → R2 → bucket `repp-arquivos` → gerar token S3 (key/secret).
9. No `.env`: `STORAGE_DRIVER=s3` + `STORAGE_S3_ENDPOINT/BUCKET/KEY/SECRET` (ver .env.example).
10. `npm i @aws-sdk/client-s3` e `docker compose up -d`. (Driver já pronto no código.)

## Fase 3 — Conformidade legal (Portaria 671) 👤
11. Gerar um AFD real (aba Relatórios → escolher filial) e rodar no **Programa de
    Verificação do MTE** (site gov). Se acusar largura de campo, me avise o campo/tamanho —
    ajusto em `packages/shared/src/afd.ts` (constante `LARGURA_AFD`, ponto único).
12. **Certificado ICP-Brasil A1** (comprar em AC credenciada, ~R$150–300/ano):
    `node scripts/preparar-certificado.mjs certificado.p12` → colar em `ASSINATURA_P12_BASE64`
    e `ASSINATURA_P12_SENHA` no `.env`. Isso liga o PAdES com validade jurídica.

## Fase 4 — E-mail (convites/recuperação de senha)
13. Contratar SMTP (Zoho grátis, Brevo, Amazon SES). Preencher `SMTP_*` no `.env`.
    Sem isso, os e-mails só aparecem no log.

## Fase 5 — Primeiro uso
14. Acesse `https://app.suaempresa.com` → aba **Plataforma** → login Super Admin → configure 2FA.
15. Cadastre a empresa-piloto (ou use o **auto-cadastro** na aba Administrador →
    "Cadastrar minha empresa").
16. RH: Configurações → crie **Filiais** e **Jornadas** (escolha o regime de horas).
17. RH: Funcionários → cadastre (gera código de 1º acesso; vai por e-mail).
18. Funcionário: 1º acesso com o código → bate ponto.

## Fase 6 — Operação contínua 👤
19. **Backup diário** do Postgres (guarda legal de 5 anos) — cron `pg_dump` para fora do servidor; TESTE o restore.
20. **Guardar os segredos** (`.env`) em cofre (1Password/Bitwarden). Perder = perder assinaturas.
21. (Opcional) Billing (Stripe/Pagar.me), push, app nativo — quando quiser, eu integro.

## Custo mínimo do piloto
VPS ~R$30/mês + domínio ~R$40/ano + R2 (praticamente grátis no volume inicial) +
e-mail grátis. Certificado/ICP e verificação MTE só quando for operar oficialmente.

---
### O que eu (dev) ainda posso fazer no código, se pedir
- Testes de integração HTTP no CI (blindagem anti-regressão).
- Contra-assinatura do RH no fechamento mensal.
- Integração de gateway de pagamento e push (após você escolher/abrir conta).
