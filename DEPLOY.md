# DEPLOY — REP-P (do zero ao ar num VPS)

> Guia prático e barato para subir o REP-P (Postgres + API + PWA) com Docker.
> O que **só você** pode fazer (comprar/contratar) está marcado com 👤.

## 0. O que você precisa contratar (👤)

- **VPS Ubuntu 22.04+** com **≥ 2 GB RAM** (ex.: Hetzner, DigitalOcean, Contabo,
  Hostinger — ~R$ 30–120/mês). Anote o IP.
- **Domínio** (~R$ 40/ano) apontando para o IP do VPS (registro A). Ex.:
  `app.suaempresa.com` e `empresa1.suaempresa.com` (subdomínio = tenant).
- (Depois, para validade legal) **Certificado ICP-Brasil A1** e **registro INPI**.

## 1. Preparar o servidor (uma vez)

```bash
# no VPS, como root:
apt update && apt install -y docker.io docker-compose-plugin git
systemctl enable --now docker
```

## 2. Enviar o projeto

```bash
git clone <seu-repositorio> repp && cd repp
# (ou envie a pasta via scp se ainda nao usa git)
```

## 3. Gerar os segredos e criar o .env

Na SUA máquina (ou no VPS, com Node instalado):

```bash
node scripts/gerar-segredos.mjs > .env
```

Depois edite o `.env`:

- `CORS_ORIGINS=https://app.suaempresa.com`
- `SUPER_ADMIN_EMAIL` / confira a `SUPER_ADMIN_SENHA` gerada (guarde-a).
- (opcional agora) `SMTP_*` do seu provedor de e-mail.

> Guarde o `.env` em local seguro. **Nunca** faça commit dele.

## 4. Subir tudo

```bash
docker compose up -d --build
docker compose logs -f api   # aguarde "REP-P API em ..." (roda migrations + RLS no start)
```

- API: `http://IP:3000/api/v1` · PWA: `http://IP:8080`

## 5. HTTPS (recomendado) 👤

Coloque um proxy TLS na frente (mais simples: Caddy):

```bash
apt install -y caddy
# /etc/caddy/Caddyfile:
#   app.suaempresa.com {
#     reverse_proxy localhost:8080
#   }
systemctl reload caddy   # Caddy emite certificado Let's Encrypt automaticamente (gratis)
```

Ajuste `CORS_ORIGINS` para `https://app.suaempresa.com` e `docker compose up -d` de novo.

## 6. Primeiro acesso

1. Abra `https://app.suaempresa.com`, aba **Plataforma** (Super Admin).
2. Login com `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_SENHA` → **configure o 2FA**.
3. Cadastre a **empresa-piloto** (com subdomínio) e o(s) admin(s) de RH.
4. RH cadastra funcionários (com e-mail) → gera convites → 1º acesso do funcionário.

## 7. Certificado ICP-Brasil (quando comprar) 👤

```bash
node scripts/preparar-certificado.mjs /caminho/certificado.p12
# cole a saida em ASSINATURA_P12_BASE64 no .env e defina ASSINATURA_P12_SENHA
docker compose up -d   # recria a API com o certificado real (PAdES valido)
```

## 8. Backups (importante — guarda legal 5 anos) 👤

Faça backup de **duas** coisas: o banco **e** os arquivos (fotos/biometria e
documentos ficam no volume `repp_storage`, não no Postgres).

```bash
# exemplo diario (cron): dump do Postgres
docker exec repp-postgres pg_dump -U repp_owner repp | gzip > /backup/repp_$(date +%F).sql.gz
# arquivos do storage (volume repp_storage)
docker run --rm -v repp_repp_storage:/data -v /backup:/out alpine \
  tar czf /out/storage_$(date +%F).tar.gz -C /data .
```

Guarde os backups fora do servidor e teste o restore. (O nome do volume tem o
prefixo do projeto: confirme com `docker volume ls`.)

## 9. Atualizacoes

```bash
git pull && docker compose up -d --build
```

---

### Custo mínimo para o piloto

VPS (~R$ 30/mês) + domínio (~R$ 40/ano) + e-mail (plano grátis). Certificado/INPI
só quando for operar oficialmente. Detalhes de conformidade em `GO-LIVE.md`.
