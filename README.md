# REP-P — Sistema de Ponto Eletrônico Corporativo

Plataforma **multi-tenant (SaaS)** de ponto eletrônico enquadrada como **REP-P**
(Portaria MTP 671/2021): registro de ponto por reconhecimento facial +
geolocalização (REGAP), folha de ponto, assinatura virtual e painel
administrativo com trilha de auditoria.

> **Roadmap 0–6 completo + backlog da especificação 100% coberto** (Telas 1–4,
> ADM 0–11, compliance 671, plataforma SaaS, banco de horas). Ver
> [`RELATORIO.md`](./RELATORIO.md) (estado, decisões, conformidade) e
> [`SECURITY-REVIEW.md`](./SECURITY-REVIEW.md) (auditoria de segurança).

## Princípios inegociáveis (valem em qualquer fase)

1. **O botão de bater ponto nunca bloqueia** — fora da REGAP/horário o registro é
   aceito e marcado como _pendente de validação_. Bloquear pode ser fraude de jornada.
2. **Registro de ponto é imutável** — correção = novo registro de ajuste
   vinculado, com autor/motivo/timestamp. Append-only por contrato e por permissão
   de banco.
3. **NSR sequencial por estabelecimento, sem furos** — atribuído no servidor.
4. **Hora oficial do servidor** quando online; hora do device só offline (marcada).
5. **Biometria é dado sensível (LGPD)** — consentimento separado, AES-256 em repouso.
6. **Guarda de 5 anos** — desligar funcionário nunca apaga histórico (soft delete).

## Stack

| Camada   | Tecnologia                                                            |
| -------- | --------------------------------------------------------------------- |
| Backend  | Node.js + TypeScript + **NestJS**, REST versionada `/api/v1`, OpenAPI |
| Banco    | **PostgreSQL** + **Prisma**, `empresa_id` + **Row Level Security**    |
| Frontend | **React + TypeScript + Vite** como **PWA** instalável                 |
| Offline  | IndexedDB (Dexie) + sync idempotente (UUID no client)                 |
| Auth     | JWT + refresh, argon2, 2FA admin _(Fase 1)_                           |
| Testes   | Vitest                                                                |
| Infra    | Docker Compose (app + postgres)                                       |

> **Nota de decisão:** o monorepo usa **npm workspaces** (não pnpm): o ambiente de
> desenvolvimento bloqueia a instalação do pnpm via corepack (EPERM em
> `Program Files`). npm workspaces entrega o mesmo resultado sem binário externo.

## Estrutura

```
rep-p/
├─ packages/shared/     # validador de CPF, enums, contratos de sync (back + front)
├─ apps/api/            # NestJS + Prisma
│  └─ prisma/
│     ├─ schema.prisma  # modelo multi-tenant, imutável, NSR, LGPD
│     └─ sql/rls-policies.sql  # Row Level Security (isolamento no banco)
├─ apps/web/            # PWA (app funcionário + painel admin)
├─ docker/              # init do postgres (cria role repp_app sem superuser)
└─ docker-compose.yml
```

## Como rodar (local)

Pré-requisitos: Node ≥ 20. Docker (para o Postgres) opcional mas recomendado.

```bash
# 1. Configurar ambiente
cp .env.example .env      # e ajuste os segredos

# 2. Instalar dependências (workspaces)
npm install

# 3. Subir banco + API (requer Docker)
docker compose up -d

# --- OU, sem Docker, apontando para um Postgres já existente: ---
npm run prisma:generate -w @repp/api
npm run db:setup -w @repp/api     # migrations + policies de RLS
npm run start:dev -w @repp/api    # API em http://localhost:3000/api/v1

# 4. Frontend
npm run dev -w @repp/web          # http://localhost:5173
```

### Modelo de duas roles no Postgres (por quê)

Para o RLS ser realmente aplicado, a API **não** pode conectar como superusuário
(superuser ignora RLS). Por isso há duas roles:

- `repp_owner` — dona do banco, roda migrations e o DDL de RLS (`directUrl` do Prisma).
- `repp_app` — role `NOSUPERUSER` que a API usa em runtime (`DATABASE_URL`).

## Autenticação (Fase 1)

Toda requisição identifica a empresa pelo subdomínio; em dev use o header
`X-Tenant-Subdominio: <subdominio>`. Endpoints principais (prefixo `/api/v1`):

| Método | Rota                                                     | Descrição                                                 |
| ------ | -------------------------------------------------------- | --------------------------------------------------------- |
| POST   | `/auth/admin/login`                                      | E-mail + senha → devolve `desafioToken` (2FA obrigatório) |
| POST   | `/auth/admin/2fa/setup`                                  | 1º acesso: gera segredo TOTP (otpauth p/ QR)              |
| POST   | `/auth/admin/2fa/verify`                                 | Valida código TOTP → emite `accessToken`+`refreshToken`   |
| POST   | `/auth/admin/refresh` · `/logout`                        | Rotaciona / revoga sessão                                 |
| POST   | `/admins` · `/admins/:id/revogar`                        | Gestão de admins (RH Master)                              |
| POST   | `/convites`                                              | RH gera convite de 1º acesso (RH Master / Gestor)         |
| POST   | `/auth/funcionario/primeiro-acesso`                      | Convite + CPF + senha + aceite LGPD                       |
| POST   | `/auth/funcionario/login`                                | CPF + senha (bloqueia 5 falhas / 15 min)                  |
| POST   | `/auth/funcionario/recuperar-senha` · `/redefinir-senha` | Recuperação                                               |

Regras aplicadas: 2FA TOTP obrigatório para admin, senhas Argon2id, lockout
5/15min, refresh rotacionado (hash no banco), consentimento LGPD no 1º acesso,
e vínculo do JWT ao tenant (token de outra empresa é rejeitado). Documentação
interativa em `/api/docs` (Swagger).

## Ponto (Fase 2)

Endpoints do funcionário (autenticados, `/api/v1`):

| Método | Rota                                      | Descrição                                                          |
| ------ | ----------------------------------------- | ------------------------------------------------------------------ |
| POST   | `/pontos`                                 | Registra a marcação (online). **Nunca bloqueia**; hora do servidor |
| POST   | `/pontos/sync`                            | Sincroniza a fila offline (idempotente por UUID)                   |
| GET    | `/pontos/regap-status?latitude&longitude` | Status REGAP em tempo real (anel)                                  |
| GET    | `/pontos/hoje`                            | Espelho de ponto do dia                                            |

Endpoints do ADM 4 (RH Master / Gestor; Auditoria só leitura):

| Método         | Rota                                             | Descrição                                      |
| -------------- | ------------------------------------------------ | ---------------------------------------------- |
| GET            | `/admin/pontos/dashboard`                        | Indicadores do dia                             |
| GET            | `/admin/pontos/excecoes`                         | Fila de exceções pendentes                     |
| POST           | `/admin/pontos/excecoes/:id/decidir`             | Aprova/recusa (motivo obrigatório)             |
| POST           | `/admin/pontos/:id/ajuste`                       | Ajuste manual (cria registro, não sobrescreve) |
| GET            | `/admin/pontos/espelho?funcionarioId&inicio&fim` | Espelho por período                            |
| GET·POST·PATCH | `/admin/regaps`                                  | CRUD de áreas (REGAP)                          |

Garantias: botão que nunca bloqueia, **NSR atômico por estabelecimento**, **hash
SHA-256** por registro, ponto **imutável** (correção = ajuste; exceção em tabela
à parte), foto **cifrada em repouso** (AES-256), e **offline-first** (fila Dexie +
sync idempotente).

## Funcionário e documentos (Fase 3)

Tela 4 (funcionário): `GET/POST /documentos` (status + upload cifrado até 10MB).

ADM 2 (RH Master / Gestor; Auditoria só leitura):

| Método   | Rota                                     | Descrição                                              |
| -------- | ---------------------------------------- | ------------------------------------------------------ |
| GET·POST | `/admin/funcionarios`                    | Lista (busca/status) · cadastra (valida CPF/unicidade) |
| PATCH    | `/admin/funcionarios/:id`                | Atualiza (cargo, salário, jornada, filial, status)     |
| POST     | `/admin/funcionarios/:id/foto/aprovar`   | Aprova foto de referência                              |
| POST     | `/admin/funcionarios/:id/desligar`       | Soft delete (guarda 5 anos)                            |
| GET      | `/admin/funcionarios/:id/documentos`     | Documentos do funcionário                              |
| POST     | `/admin/documentos/:id/decidir`          | Aprova/rejeita documento (motivo)                      |
| POST     | `/admin/funcionarios/importar`           | Importação CSV tudo-ou-nada                            |
| GET      | `/admin/funcionarios/alertas/vencimento` | Documentos vencendo em 30 dias                         |

## Folha e assinatura virtual (Fase 4)

Tela 2 (funcionário): `GET /assinaturas`, `GET /assinaturas/:id/visualizar`,
`POST /assinaturas/:id/assinar` (re-autentica), `POST /assinaturas/:id/recusar`,
`GET /assinaturas/:id/comprovante`, `GET /assinaturas/chave-publica`.

ADM 3 (RH Master / Gestor / Financeiro): `POST /admin/assinaturas` (+ `/lote`),
`GET /admin/assinaturas` (fila), `GET /admin/assinaturas/:id` (detalhe),
`GET /admin/assinaturas/:id/comprovante`.

Cada assinatura gera registro **imutável** com **SHA-256 do documento** +
**SHA-256 do manifesto** + **assinatura Ed25519 do servidor** + timestamp +
IP/dispositivo. O comprovante reconstrói o manifesto e confere **assinatura** e
**integridade** (re-hash do arquivo). PAdES/ICP-Brasil embarcado no PDF é a Fase 5.

## Compliance Portaria 671 (Fase 5)

ADM 6 (RH Master / Auditoria): `POST /admin/exportacoes/afd` e `/aej` (gera do
período: hash SHA-256 + assinatura Ed25519 + registro imutável), `GET
/admin/exportacoes` (lista), `GET /admin/exportacoes/:id/download` (decifra +
reconfere integridade/assinatura), `GET /admin/comprovantes/ponto/:id`
(comprovante PDF **PAdES-B**), `POST /admin/relatorios/fiscalizacao` (pacote
AFD+AEJ+trilha).

> **Homologação obrigatória antes do go-live:** validar os leiautes AFD/AEJ no
> verificador oficial gov.br e instalar um certificado **ICP-Brasil** (`.p12`)
> em `ASSINATURA_P12_BASE64`/`ASSINATURA_P12_SENHA` (em dev, um cert autoassinado
> é gerado automaticamente — sem validade jurídica).

## Plataforma / Super Admin (Fase 6)

Portal `/super` (opera **acima** dos tenants; isento de subdomínio):
`POST /super/auth/login` · `/2fa/setup` · `/2fa/verify` · `/refresh`; e (com token
Super) `GET·POST /super/empresas`, `/super/empresas/:id/{suspender,ativar,uso}`,
`GET·POST /super/planos`, `GET·POST /super/faturas`, `/super/faturas/:id/pagar`.

> **Isolamento no banco:** o Super Admin usa a role `repp_super` (`SUPER_DATABASE_URL`),
> **sem** privilégio nas tabelas operacionais; uso vem de função `SECURITY DEFINER`.
> Bootstrap do 1º super admin via `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_SENHA`.
> Hardening: `helmet` + rate limiting global.

## Auditoria (ADM 6)

RH Master / Auditoria (somente leitura): `GET /admin/auditoria` (trilha de ações,
filtrável/paginada), `GET /admin/auditoria/acessos` (login/2FA/logout),
`GET /admin/auditoria/aprovacoes` (exceções decididas com justificativas).
Autorização administrativa do **Gestor de Filial** é restrita às suas filiais
(`AdminFilialAcesso`).

## Configurações (ADM 7)

`/admin/configuracoes/jornadas` (CRUD) e `/admin/configuracoes/feriados` (CRUD).
A jornada (horário, tolerância, dias de escala) é atribuída ao funcionário e
avaliada no **registro de ponto**: fora do horário/escala (e não sendo feriado)
→ `PENDENTE_HORARIO`, no **fuso da filial**. Nunca bloqueia — apenas sinaliza.

## Férias/afastamentos (ADM 10) e contestação (ADM 11)

Funcionário: `POST/GET /ferias` (solicitar/consultar), `POST/GET /contestacoes`
(contestar marcação própria). RH: `/admin/ferias` (listar/`:id/decidir`/`calendario`)
e `/admin/contestacoes` (listar/`:id/responder`). **Férias/afastamento aprovado
abona o dia** (não gera `PENDENTE_HORARIO`). Contestações e respostas ficam na
trilha de auditoria. Escopo por filial aplicado ao Gestor.

## Dashboard, banco de horas, comunicados, integrações (ADM 5/8/9)

- **ADM 5** `GET /admin/dashboard` (KPIs, alertas >48h, presença 7 dias).
- **Banco de horas** `GET /admin/pontos/banco-horas?funcionarioId&inicio&fim`
  (trabalhado/dia + saldo vs. carga da jornada, no fuso da filial).
- **ADM 8** `/admin/comunicados` (criar/histórico + taxa de leitura) e
  `/comunicados` (funcionário lê + marca lido); público-alvo todos/filial/cargo/func.
- **ADM 9** `/admin/integracoes/chaves` (gerar/revogar; token exibido 1x) e
  `/admin/integracoes/config/:tipo` (folha/eSocial). Transmissão externa é infra.

## Testes

```bash
export NODE_OPTIONS=--max-old-space-size=2048   # máquinas com pouca RAM
npm test                       # unidade, todos os workspaces (79 testes)
npm run test:e2e -w @repp/api  # e2e: RLS + NSR + imutabilidade + boundary super (18)
```

> **Postgres para testes/dev sem Docker:** os e2e sobem um **PostgreSQL real
> embarcado** (`embedded-postgres`, binário portátil). Para (re)gerar migrations
> localmente: `node apps/api/scripts/gen-migration.mjs <nome>`.

## Documentos de especificação

A fonte da verdade de requisitos são os três documentos de especificação
(escopo técnico/legal, detalhamento de telas, front-end). Onde este código
divergir, ver as decisões registradas no [`RELATORIO.md`](./RELATORIO.md).
