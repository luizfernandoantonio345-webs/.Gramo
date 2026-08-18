# DEPLOYMENT.md — Deploy e operação do .GRAMO

Produção: VPS Hostinger (Ubuntu 24.04), Docker Compose, HTTPS via Caddy.
URL: https://gramoengenharia.online · branch de deploy: `fase-b-estabilizacao`.

## Arquitetura de runtime

`docker compose` em `/root/REP-P` com 4 serviços: `postgres` (16-alpine),
`api` (NestJS), `web` (Nginx servindo o build) e `caddy` (TLS + proxy). O
`COMPOSE_FILE` no `.env` encadeia `docker-compose.yml:docker-compose.prod.yml`.
API e Postgres publicam **só no loopback** (127.0.0.1); só 22/80/443 abertos no
UFW.

## Segredos

O `.env` de produção mora **apenas no servidor** (gitignored), gerado por
`scripts/gerar-segredos.mjs`. A API valida no boot (fail-fast) que os segredos
existem e têm ≥ 32 chars (`apps/api/src/config/env.ts`). `ADMIN_2FA_OPCIONAL`
**não** deve existir em produção (2FA obrigatório).

## Procedimento de deploy

```bash
ssh -i ~/.ssh/gramo_deploy root@179.198.121.42
cd /root/REP-P
git fetch origin fase-b-estabilizacao
git merge --ff-only origin/fase-b-estabilizacao      # produção segue o remoto
docker compose build api web                          # só o que mudou
docker compose up -d api web
```

Validação pós-deploy:

```bash
curl -s http://localhost:3000/api/v1/health/ready      # {"status":"ok","db":"up"}
curl -sk -o /dev/null -w "%{http_code}\n" https://gramoengenharia.online/   # 200
```

**Atenção — antes de qualquer `merge`/`reset` em produção:** rode `git status`.
Se houver mudança local real (conteúdo), faça backup (`cp .env .env.bak.<ts>`,
`git stash -u`) antes. Mudança só de **modo** de arquivo (`chmod`) pode ser
descartada com `git checkout -- <arquivo>` — os scripts `.sh` já têm o bit de
execução gravado no git (`100755`).

## Migrations

Sem mudança de schema, o deploy acima basta. Com migration nova:

```bash
docker compose run --rm api npm run db:migrate -w @repp/api   # prisma migrate deploy
# se a migration mexer em RLS: aplicar também sql/rls-policies.sql
```

## Backup e monitor (cron do root)

- `0 3 * * * bash /root/REP-P/scripts/backup-prod.sh` — dump `pg_dump -Fc` +
  tar do volume de storage, verificados (`pg_restore -l` / `tar -tzf`),
  retenção 14 dias, log em `/root/backups`.
- `*/15 * * * * bash /root/REP-P/scripts/monitor-prod.sh` — checa site, API,
  banco, disco, cert TLS e frescor do backup; grava em `/root/monitor.log`.

> Os crons chamam via `bash` de propósito: assim não dependem do bit +x, que o
> `git checkout` pode resetar.

## Rollback

```bash
cd /root/REP-P
git log --oneline -5
git checkout <commit_bom> -- .        # ou: git reset --hard <commit_bom>
docker compose build api web && docker compose up -d api web
```

## Pendências operacionais

- **Backup offsite** (cópia fora da VPS) — ver `AUDIT.md` (H2).
- **CI/CD de deploy** automatizado — hoje o deploy é manual por SSH.
- **Staging** espelhando produção.
