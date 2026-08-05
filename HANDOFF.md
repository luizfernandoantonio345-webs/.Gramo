# HANDOFF — REP-P (entrega do ciclo)

> Fechamento honesto do trabalho como líder técnico sênior. O que foi **entregue e
> verificado**, o que está **pronto para integrar**, e o que fica como **ponto de
> integração projetado** (com abordagem + esforço) — sem meia-boca e sem vender
> ilusão. Data: 2026-08-05. Branch: `fase-b-estabilizacao`.

---

## 1. O que foi entregue neste ciclo (commitado e verificado)

| Commit              | Entrega                                                                                       | Verificação     |
| ------------------- | --------------------------------------------------------------------------------------------- | --------------- |
| `5005837`           | **Fase B** — S2 escopo de filial, S3 magic bytes, S4 fail-fast, S1 nodemailer, homologação RH | unit + e2e      |
| `49efc5f` `0e02c7f` | **Fase C** — 16 telas + design system elevado (Feedback/EstadoVazio/Kpi, a11y, estados)       | ESLint/Prettier |
| `a5ee8e7`           | **Fase D** — resiliência de processo (guards+shutdown) + auditoria de upload                  | unit + boot     |
| `065f986`           | **NestJS 10→11 / Express 5** — **prod audit 12 → 0 vulnerabilidades**                         | unit + boot     |
| `88b3d00`           | **Onda 1.1** — Presença em tempo real (poll 15s, por filial)                                  | 4 testes + boot |
| `2b3a1c1`           | **Onda 1.2** — Exportação CSV do espelho (RH/Excel)                                           | 3 testes + boot |
| `4464195`           | **Onda 2** — Dependabot + CodeQL (SAST) + gate `npm audit` no CI                              | YAML validado   |
| `00dcf8b`           | **Onda 5** — Adicional noturno CLT art. 73 (shared puro)                                      | 7 testes        |

**Saúde atual:** 100+ testes unit verdes (shared 77 + api 37), e2e verde (RLS/NSR/
imutabilidade), **produção com 0 vulnerabilidades**, API sobe no Nest 11 e
`/health/ready` = `{db:up}`, ESLint/Prettier limpos, 11 commits limpos.

**Limite honesto:** o **frontend não foi renderizado** nesta máquina (RAM ~4GB não
comporta Vite + Postgres + API + VS Code). O front é validado por lint/compilação;
a **revisão visual tela a tela é do dono** (via `git diff`, `npx vite --host` com
RAM livre, ou build no CI).

---

## 2. Pronto para integrar (código existe, falta plugar)

- **Adicional noturno** (`@repp/shared/noturno`) → conectar no `FechamentoService`/
  `banco-horas` para compor o holerite. Esforço: baixo. Falta: somar `resumoNoturno`
  por dia trabalhado e expor no espelho.
- **Presença em tempo real** → já no Dashboard; opção futura: telão dedicado
  (rota `/presenca` full-screen) reusando o mesmo endpoint.

---

## 3. Itens restantes — ponto de integração projetado (não meia-boca)

Cada item abaixo foi **deliberadamente não empurrado** nesta sessão porque é
externo ou exige design/segurança dedicados. Segue a abordagem concreta:

### 3.1 Modo Quiosque (tablet na portaria) — esforço médio, segurança sensível

**Por que não foi feito agora:** exige um **modelo de autenticação de dispositivo**
(não pode reusar o JWT do funcionário) e refatorar levemente o `PontoService`.
Mexer no núcleo do ponto sem poder renderizar/validar o front seria imprudente.
**Design:** tabela `DispositivoKiosk(id, filialId, tokenHash, nome, ativo)` +
`KioskGuard` (valida token do device → resolve tenant/filial) + endpoint
`POST /kiosk/ponto` (CPF + foto) que acha o funcionário por CPF na filial e cria o
ponto (foto = evidência; identidade validada pelo RH; **nunca bloqueia**, coerente
com a regra do produto). Frontend: tela full-screen CPF→foto→confirma.

### 3.2 Notificações push (PWA) — esforço médio

`web-push` (VAPID) no backend + `subscriptions` por funcionário + service worker no
PWA (a base `vite-plugin-pwa` já existe). Disparos: exceção decidida, contestação
respondida, documento vencendo. Fallback gracioso (como o e-mail hoje) quando VAPID
não configurado. 👤 gerar par de chaves VAPID.

### 3.3 Trilha de auditoria à prova de adulteração (hash-chain) — esforço médio

Adicionar `hashAnterior`/`hash` em `LogAuditoria` (cada registro encadeia o hash do
anterior). Migration + ajuste no ponto único de escrita do log. Detecta remoção/
edição de qualquer entrada. Export do encadeamento assinado (Ed25519 já existe).

### 3.4 Observabilidade — esforço médio

`prom-client` expondo `/metrics` (Prometheus) + `OpenTelemetry` (tracing) +
dashboards Grafana + alertas. Logs estruturados (`LOG_JSON`) e `requestId` já
existem — é o gancho.

### 3.5 SSO corporativo (Azure AD / Keycloak) — esforço alto, precisa do IdP 👤

`passport-saml`/OIDC no backend + SCIM para provisionamento. Manter CPF+senha só
para o funcionário de campo. Depende do IdP e metadados que **a Petrobras fornece**.

### 3.6 eSocial / folha reais — esforço alto, externo 👤

Fila (BullMQ/Redis) de eventos S-1200/S-1210 + assinatura XML ICP-Brasil +
reconciliação de recibos. Conector de folha (Senior/TOTVS/SAP) via a `ChaveApi` que
já existe. Depende de credenciais/ambiente gov.

### 3.7 Reconhecimento facial com liveness — esforço alto, decisão de produto/LGPD 👤

Hoje é captura+storage (evidência). Ativar _matching_+liveness exige provedor
biométrico + **DPIA/consentimento reforçado** (dado sensível). Decisão de negócio
antes do código.

### 3.8 Anti-drift de migration no CI — esforço baixo

`prisma migrate diff` exige um **serviço Postgres** no job (shadow DB). Adicionar
`services: postgres` ao workflow + o passo (documentado, removido do CI para não
ficar `continue-on-error` inútil).

---

## 4. O que NÃO é código (responsabilidade externa — 👤)

Pentest profissional · homologação AFD/AEJ no **verificador gov.br** · certificado
**ICP-Brasil A1/A3** · revisão **LGPD por jurídico + DPO** (ROPA/DPIA) · registro
**INPI** · ISO 27001/SOC2 · contratação de VPS/KMS/SMTP · IdP corporativo para SSO.
Segurança é processo contínuo, não estado final — o código prepara o terreno para
ser **auditável**, não promete perfeição.

---

## 5. Como rodar / implantar / compartilhar

- **Rodar local (4GB):** `RODAR-LOCAL.md` (SWC + Postgres embarcado; Vite só com RAM
  livre).
- **Deploy (VPS + Docker + Caddy TLS + subdomínio-tenant):** `DEPLOY.md`
  (`docker compose up -d --build`; migrations+RLS rodam no start).
- **Compartilhar com funcionários:** RH cadastra → gera convite → funcionário abre
  `https://<empresa>.<dominio>` no celular (HTTPS obrigatório p/ câmera) → primeiro
  acesso (código+CPF+senha+LGPD) → "adicionar à tela inicial" (PWA). QR no mural =
  distribuição mais simples.
- **Roadmap completo:** `VISAO-ENTERPRISE.md` · **Auditoria/progresso:**
  `AUDITORIA.md` · **Decisões:** `RELATORIO.md`.

---

## 6. Próximos passos recomendados (ordem)

1. Abrir o **PR** (branch já publicada) e revisar o diff / rodar o front no CI.
2. Integrar **adicional noturno** no fechamento (rápido, alto valor).
3. **Quiosque** e **push** (Onda 1) numa sessão dedicada com o front renderizável.
4. **Observabilidade** + **hash-chain** (Onda 2 — sustenta produção).
5. Em paralelo, destravar os itens 👤 (homologação, pentest, ICP-Brasil, SSO).
