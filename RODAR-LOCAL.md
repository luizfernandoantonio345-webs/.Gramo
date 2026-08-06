# RODAR LOCAL (sem Docker) — REP-P

App rodando 100% local, sem Docker. Nesta máquina (pouca RAM) NÃO use
`npm run start` (o compilador `tsc` estoura memória). Use o **dist compilado
pelo SWC**, que é leve. Abaixo, o passo a passo que funciona.

> Use **3 terminais** (um por serviço). Deixe os três abertos enquanto usa o app.

---

## Terminal 1 — Banco de dados

```powershell
node scripts/dev-local.mjs
```

Espere `AMBIENTE LOCAL PRONTO`. **Não feche.** (Ctrl+C para parar.)
O banco fica salvo na pasta `.devdb` (não perde dados ao reiniciar).

## Terminal 2 — API

```powershell
cd apps\api
$env:NODE_OPTIONS="--max-old-space-size=512"
node dist\src\main.js
```

Espere `REP-P API em http://localhost:3000/api/v1`.

> Só recompile a API se mexer no código dela. É rápido (SWC, ~0,1s):
>
> ```powershell
> node node_modules\@swc\cli\bin\swc.js src -d dist --config-file .swcrc --copy-files
> ```
>
> (rode isso dentro de `apps\api`)

## Terminal 3 — PWA (interface)

```powershell
cd apps\web
$env:NODE_OPTIONS="--max-old-space-size=512"
npx vite --host
```

Abre em **http://localhost:5173** (no PC) e mostra também o IP da rede.

---

## Entrar no app

- **Funcionário** (aba Funcionario): CPF `529.982.247-25` · senha `Func@12345`
- **Admin de RH** (aba Administrador): subdomínio `piloto` · `admin@piloto.local` · `Piloto@12345`
  (pede para configurar o 2FA no 1º acesso)
- **Super Admin** (aba Plataforma): `super@piloto.local` · `Super@12345`

## Abrir no celular

O Vite faz proxy de `/api`, então basta **uma porta (5173)**:

- **Mesmo Wi-Fi:** abra `http://SEU_IP_LOCAL:5173` no celular (o Vite mostra o IP;
  ex. `http://192.168.0.107:5173`). Se o Firewall do Windows bloquear, use a opção abaixo.
- **PORTS do VS Code (funciona de qualquer rede):** painel **PORTS** → _Forward a Port_
  → `5173` → botão direito → _Port Visibility_ → **Public** → copie o link
  `https://...devtunnels.ms` e abra no celular.

---

## Se algo cair (falta de RAM)

Esta máquina roda os três no limite. Se um cair, só reabra aquele terminal e rode
o comando dele de novo (o banco reaproveita `.devdb`; a API reconecta sozinha).

Ordem para subir do zero: **Terminal 1 (banco) → Terminal 2 (API) → Terminal 3 (PWA)**.

## Reset total do banco

Feche o Terminal 1, apague a pasta `.devdb` e rode o Terminal 1 de novo
(recria o banco + dados de exemplo).

---

## Rodar o FRONTEND com pouca RAM (build + preview) — recomendado nesta máquina

O `vite --host` (dev/HMR) estoura memória aqui. O caminho que **cabe** é buildar e
servir o estático (leve, coexiste com API+banco):

```powershell
# 1. libere RAM: pare a API/preview antigos. Precisa de ~600MB livres p/ o build.
cd apps\web
$env:NODE_OPTIONS="--max-old-space-size=1024"
npx vite build            # NAO use "npm run build" (o tsc dele estoura). Direto.
npx vite preview --host --port 5173
```

O app buildado chama a API em `http://localhost:3000` (o CORS de dev libera :5173).
Suba a API/banco normalmente (Terminais 1 e 2). Login em localhost usa o tenant
fixo **piloto**.

## Modo Quiosque (tablet na portaria)

1. Entre como **admin de RH** → aba **Quiosque** → cadastre um dispositivo (escolha a
   filial) → **copie o token** exibido (aparece uma vez).
2. No tablet, abra **`http://<host>:5173/?modo=quiosque`** → cole o token → pronto.
3. Cada pessoa digita o **CPF** e registra o ponto (a câmera exige HTTPS; funciona
   sem foto). Confirmação grande + volta sozinho para o próximo.
