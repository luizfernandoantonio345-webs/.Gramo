# Tutorial de deploy — do zero ao .GRAMO no ar (para iniciante)

> Passo a passo de mão dada: **contratar o servidor** e **subir o aplicativo**.
> Você NÃO precisa de Docker na sua máquina — o servidor faz tudo.
> Tempo: ~1 hora. Faça um passo, confira, siga pro próximo.
> (Documentos irmãos: `DEPLOY.md` = referência; `GO-LIVE.md` = checklist legal.)

---

## Antes de começar, tenha em mãos

- Um **cartão** (o VPS é mensal, ~R$40–60).
- Uma conta no **GitHub** (onde está o código).
- **PowerShell** do Windows (já vem instalado) — é por ele que você entra no servidor.
- (Opcional, mas recomendado) um **domínio** (~R$40/ano) — necessário para a câmera
  do reconhecimento facial (exige HTTPS).

---

## PASSO 1 — Contratar o VPS (Hostinger, datacenter Brasil)

1. Acesse **hostinger.com.br** → menu **VPS**.
2. Escolha o plano **KVM 2** (2 vCPU, ~8 GB RAM). _(Mínimo aceitável: 4 GB.)_
3. No checkout, selecione:
   - **Localização do servidor: Brasil (São Paulo).** ← importante (LGPD + velocidade)
   - **Sistema operacional: Ubuntu 24.04** (ou 22.04). _Sem_ cPanel/Plesk.
   - Defina uma **senha de root** forte e **anote**.
4. Finalize a compra. No painel do VPS, **anote o IP** (algo como `191.x.x.x`).

> Alternativas com datacenter no Brasil: AWS Lightsail (São Paulo) ou Vultr (São Paulo).
> Escolha SEMPRE região **Brasil** para este produto (biometria = dado sensível).

---

## PASSO 2 — Entrar no servidor (SSH)

Abra o **PowerShell** e digite (troque pelo seu IP):

```powershell
ssh root@SEU_IP
```

- Na 1ª vez pergunta `Are you sure...?` → digite **yes** e Enter.
- Peça a senha de root (a que você anotou). **A senha não aparece enquanto digita —
  é normal.** Enter.
- Deu certo se aparecer algo como `root@srv123:~#`. **Você está dentro do servidor.**

---

## PASSO 3 — Instalar o Docker (copie e cole)

Ainda dentro do servidor, cole:

```bash
apt update && apt install -y docker.io docker-compose-plugin git
systemctl enable --now docker
docker --version   # confirma que instalou
```

---

## PASSO 4 — Baixar o código no servidor

Seu repositório é **privado** → clone com um **token do GitHub**:

1. No navegador: GitHub → sua foto → **Settings** → **Developer settings** →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
   - Dê acesso **somente ao repositório `REP-P`**, permissão **Contents: Read**.
   - **Copie o token** (começa com `github_pat_...`).
2. No servidor:

```bash
git clone https://SEU_TOKEN@github.com/luizfernandoantonio345-webs/REP-P.git gramo
cd gramo
```

---

## PASSO 5 — Gerar as senhas do sistema (`.env`)

```bash
apt install -y nodejs                 # se ainda nao tiver node
node scripts/gerar-segredos.mjs > .env
cat .env                              # LEIA e GUARDE a linha SUPER_ADMIN_SENHA
```

Depois edite o `.env` para colocar seu domínio no CORS (se já tiver domínio):

```bash
nano .env
# ache a linha CORS_ORIGINS= e deixe assim (troque pelo seu dominio):
# CORS_ORIGINS=https://app.suaempresa.com
# salvar no nano: Ctrl+O, Enter, Ctrl+X
```

---

## PASSO 6 — Subir o aplicativo (o comando mágico)

```bash
docker compose up -d --build
```

- A **1ª vez demora** (5–15 min): ele baixa, **constrói** e sobe Postgres + API + PWA.
- Acompanhe a API ficar pronta:

```bash
docker compose logs -f api      # espere aparecer "REP-P API em ..." -> Ctrl+C para sair
```

Teste no navegador: `http://SEU_IP:8080` (o app) deve abrir. 🎉
_(Sem HTTPS ainda, a câmera não liga — resolvemos no passo 7.)_

---

## PASSO 7 — Domínio + HTTPS grátis (Caddy) 👤

A câmera do reconhecimento facial **exige HTTPS**. Você precisa de um **domínio**.

1. No seu registrador de domínio, crie um registro **A**:
   `app.suaempresa.com → SEU_IP`.
2. No servidor:

```bash
apt install -y caddy
nano /etc/caddy/Caddyfile
```

Deixe o arquivo assim (troque o domínio):

```
app.suaempresa.com {
    reverse_proxy localhost:8080
}
```

Salve (Ctrl+O, Enter, Ctrl+X) e recarregue:

```bash
systemctl reload caddy
```

O Caddy **emite o certificado HTTPS sozinho** (Let's Encrypt, grátis). 3. Ajuste o CORS e reinicie:

```bash
nano .env      # CORS_ORIGINS=https://app.suaempresa.com
docker compose up -d
```

Abra **https://app.suaempresa.com** — agora com cadeado. ✅

---

## PASSO 8 — Criar a empresa GRAMO (primeiro acesso)

1. Acesse **https://app.suaempresa.com/?plataforma=1** → aba **Plataforma**.
2. Entre com **SUPER_ADMIN_EMAIL** / **SUPER_ADMIN_SENHA** (estão no seu `.env`) →
   **configure o 2FA** (app autenticador no celular).
3. Cadastre a **empresa GRAMO** (com um subdomínio) e o **admin de RH**.
4. Saia, entre como **Administrador** (RH) e configure:
   - **Obras (filiais)**, **jornadas** e **áreas REGAP** (em Configurações / Gestão de ponto);
   - **Importe os funcionários** por CSV (tela Funcionários → "Importar em lote").

> Em produção você cadastra as **obras reais** da GRAMO (o seed de exemplo é só para a demo local).

---

## PASSO 9 — Backup automático (não pule!)

Guarda legal = 5 anos. Já existe o script pronto:

```bash
crontab -e
# cole a linha (backup diário às 2h):
0 2 * * * bash /root/gramo/scripts/backup.sh /backup >> /var/log/repp-backup.log 2>&1
```

**Leve os backups para fora do servidor** (S3/Backblaze/Drive) e **teste o restore
uma vez** — backup que nunca foi restaurado não vale.

---

## Atualizar o app depois (quando eu entregar melhorias)

```bash
cd /root/gramo && git pull && docker compose up -d --build
```

---

## Se algo der errado (troubleshooting)

- **`docker compose up` falhou no build por falta de memória** → seu VPS tem menos
  de 4 GB. Faça upgrade do plano OU me chame para migrar o build para a nuvem
  (GitHub Actions) e o VPS só baixar a imagem.
- **App abre mas "sem conexão" / erro de login** → veja o log: `docker compose logs api`.
  Cheque `CORS_ORIGINS` no `.env` e rode `docker compose up -d` de novo.
- **Câmera não liga** → você está em `http://` (sem S). A câmera só funciona em
  **https://** (passo 7).
- **Esqueci a senha do super admin** → está no `.env` (`cat .env`).

---

**Importante (honestidade):** eu preparei e testei tudo isto **estaticamente**
(os builds, o compose, as roles do banco), mas **não subi containers reais** aqui
(não tenho Docker nesta máquina). Então na **primeira subida real a gente faz
junto**: me manda o `docker compose logs api` se algo travar, que eu ajusto na hora.
