# RELATÓRIO TÉCNICO — REP-P

> Documento vivo. **Roadmap 0–6 completo + backlog da especificação 100% coberto**
> (Telas 1–4, ADM 0–11, compliance 671, plataforma SaaS, banco de horas) + revisão
> de segurança. Última atualização: 2026-08-01.

---

## 1. Resumo executivo

Plataforma **multi-tenant (SaaS)** de ponto eletrônico REP-P (Portaria MTP
671/2021), com o **roadmap de 6 fases concluído**. A **Fase 6** entregou a camada
de **plataforma (ADM 0 — Super Admin)**: cadastro/onboarding de empresas-cliente,
ativar/suspender (soft, reversível), **métricas de uso**, **planos** e
**faturamento** (faturas + gateway como ponto de integração), auth do Super Admin
com **2FA**, e **trilha de auditoria própria** do Super Admin. Fez-se também o
**hardening**: `helmet` (cabeçalhos de segurança) e **rate limiting** global
(fecha o débito de brute-force no login).

**A regra inegociável foi honrada no nível do banco:** o Super Admin **nunca
acessa dados operacionais** (biometria/ponto/documentos). Uma **terceira role**
Postgres (`repp_super`) tem acesso às tabelas de plataforma mas **privilégio
revogado** nas operacionais; as métricas vêm de uma **função SECURITY DEFINER**
que devolve só agregados. Isso é **provado no e2e** (super vê `empresas`, é negado
em `pontos/funcionarios/documentos/...`).

> **Fase 5 (mantida):** AFD/AEJ (cifrados, com SHA-256 + Ed25519, imutáveis),
> comprovante **PAdES-B** e pacote de fiscalização.

> **Honestidade técnica (senioridade):** os **leiautes AFD/AEJ** seguem a
> estrutura da Portaria 671 com layout centralizado e testável, mas **exigem
> homologação no validador oficial gov.br** antes do go-live. O **PAdES** é real
> (assinatura CMS embarcada no PDF); em dev usa certificado **autoassinado**, e
> em produção pluga o **A1/A3 ICP-Brasil** via `.p12` (sem validade jurídica até
> lá). O registro no **INPI** e o **Atestado Técnico** são atos externos — o
> sistema está preparado para atendê-los.

> **Infra (mantida):** PostgreSQL real embarcado (sem Docker), migrations
> versionadas (0–5) e e2e de RLS, concorrência do NSR e imutabilidade
> (`pontos`, `assinaturas_virtuais`).

> **Decisão (com o dono):** reconhecimento facial é **captura + storage seguro
> apenas**, sem matching/liveness. A identidade da marcação é a sessão
> autenticada; a foto é evidência. Liveness/matching ficam para fase dedicada.

## 2. Arquitetura

### Módulos e camadas

- **Monorepo (npm workspaces):** `packages/shared` (tipos/regra compartilhada),
  `apps/api` (backend), `apps/web` (frontend).
- **API (NestJS):** camadas Controller → Service → Repository(Prisma). Cross-cutting
  planejado: `TenantContext` (AsyncLocalStorage) + RLS no banco; interceptor de
  auditoria (Fase 1).
- **Isolamento multi-tenant:** `empresa_id` em toda tabela **+ RLS forçado** no
  Postgres. A API conecta como role sem superusuário (`repp_app`); cada transação
  seta `app.current_empresa_id` (via `PrismaService.forTenant`) e as policies
  filtram/checam por empresa. Defesa em profundidade: mesmo esquecendo um `WHERE`,
  o banco não vaza dados entre empresas.

### Schema do banco (Prisma) — Fase 0

`empresas`, `filiais`, `usuarios_admin`, `funcionarios`, `regap`,
`contadores_nsr`, `pontos`, `pontos_ajustes`, `consentimentos_lgpd`,
`logs_auditoria`. Destaques:

- **`pontos` é append-only.** `UPDATE`/`DELETE` revogados para `repp_app` e
  bloqueados por trigger. Correção → `pontos_ajustes` (autor, motivo, novo valor,
  timestamp), preservando o original.
- **NSR** em `pontos` é único por filial (`@@unique([filialId, nsr])`), atribuído
  pelo servidor via `contadores_nsr` (incremento transacional, sem furos).
- **Idempotência**: `@@unique([empresaId, uuidIdempotencia])` — reenvio de sync
  nunca duplica.
- **`hashIntegridade`** (SHA-256) por registro, base para o comprovante da Portaria.
- **LGPD**: `consentimentos_lgpd` separado; foto de referência guarda só o
  ponteiro para storage cifrado (nunca o binário no banco).
- **Soft delete** em `funcionarios` (`desativadoEm`) — guarda de 5 anos.

### Fluxos de acesso (Fase 1 — implementados)

- **Login admin (ADM 1):** subdomínio → `POST /auth/admin/login` (e-mail+senha,
  nunca emite token direto) → desafio de 2FA → `2fa/setup` (1º acesso, gera
  segredo TOTP cifrado + otpauth) → `2fa/verify` (valida código, emite par de
  tokens). Lockout 5/15min; toda etapa gera log de acesso.
- **Primeiro acesso funcionário (Tela 1):** `POST /auth/funcionario/primeiro-acesso`
  com código de convite + CPF + senha + aceite LGPD → define senha, registra
  `ConsentimentoLgpd` (biometria) e ativa o funcionário.
- **Login funcionário:** `POST /auth/funcionario/login` (CPF+senha, lockout).
- **Refresh/logout:** refresh token opaco rotacionado (hash no banco); reuso de
  token revogado é rejeitado.
- **Isolamento no login:** `TenantMiddleware` resolve a empresa pelo subdomínio
  via função `SECURITY DEFINER` (única leitura cross-tenant, só id/status). O
  `JwtAuthGuard` exige que o `empresaId` do token bata com o tenant (anti-replay).

### Fluxos de ponto (Fase 2 — implementados)

- **Marcação (`POST /pontos`):** foto→storage cifrado → tx: avalia REGAP
  (haversine) → `statusValidacao` (VALIDO dentro / PENDENTE_REGAP fora) → NSR
  atômico por filial → hash SHA-256 do conteúdo canônico → cria `pontos` → se
  pendente, cria `AprovacaoExcecao` → auditoria. **Nunca bloqueia.** Hora oficial
  do servidor.
- **Sync offline (`POST /pontos/sync`):** cada item em transação própria e
  idempotente (mesmo UUID nunca duplica → `ACEITO`/`ACEITO_DUPLICADO`); hora do
  dispositivo (`origemHora=DISPOSITIVO`). No client, fila Dexie + reenvio ao
  voltar a conectividade.
- **Anel de Presença (`GET /pontos/regap-status`):** avalia REGAP em tempo real
  no client (teal dentro / âmbar fora), sem registrar nada; o servidor reavalia
  de forma autoritativa no registro.
- **Aprovação de exceção (ADM 4):** o ponto é **imutável**, então a decisão do RH
  vive em `AprovacaoExcecao` (status + motivo obrigatório + auditoria); o
  `statusValidacao` do ponto permanece o do momento do registro. Status
  **efetivo** = registro + última decisão.
- **Ajuste manual (ADM 4):** cria `PontoAjuste` vinculado (autor/motivo/novo
  valor); nunca sobrescreve o original.

## 3. Decisões técnicas e trade-offs

| Decisão | Por quê / trade-off |
| --- | --- |
| **npm workspaces** em vez de pnpm | pnpm via corepack é bloqueado no ambiente (EPERM em `Program Files`). npm workspaces dá o mesmo monorepo sem binário externo. Baixo custo de troca. |
| **RLS no Postgres** (não só na app) | Isolamento de tenant é requisito de segurança; app-level erra por omissão de `WHERE`. Custo: plumbing de `SET LOCAL` por transação + modelo de duas roles. |
| **Duas roles** (`repp_owner`/`repp_app`) | Superuser ignora RLS. A app precisa de role comum. Prisma `url`(app) + `directUrl`(migrations) separa naturalmente. |
| **NSR server-side** | Sequência sem furos é impossível de coordenar entre devices offline. O client usa só o UUID de idempotência; o NSR pertence ao REP (servidor). |
| **Falha facial nunca bloqueia** _(decidido com o dono)_ | Grava o ponto como `PENDENTE_IDENTIDADE` para o RH validar, em vez de travar (regra legal nº 1). |
| **CommonJS no `shared`** | A API (NestJS) é CommonJS; alinhar evita dor de interop ESM/CJS. O PWA importa o **source** do shared via alias do Vite (evita interop CJS no bundle). |
| **Sem stubs de fases futuras** | "Nada de código morto": módulos de auth/ponto/etc. entram quando forem implementados. |
| **`@node-rs/argon2` no lugar de `argon2`** (Fase 1) | Mesmo Argon2id, mas binários pré-compilados — sem `node-gyp`/toolchain nativo (essencial no ambiente Windows). |
| **Enums do `@prisma/client` no backend** (Fase 1) | O backend usa os enums gerados pelo Prisma (fonte da verdade no banco); o `shared` mantém enums só para o front e a lógica pura. Evita conflito de tipos nominais. |
| **2FA em duas etapas com desafio** (Fase 1) | Login nunca emite token sem 2FA; um `desafioToken` curto (5 min) liga a etapa de senha à de TOTP, cobrindo setup no 1º acesso e verificação nas próximas. |
| **Tokens guardados como hash** | Tokens (refresh, convite, recuperação) só como SHA-256 no banco; segredo TOTP cifrado com AES-256-GCM. |
| **NSR atômico via `INSERT … ON CONFLICT`** (Fase 2) | Um comando incrementa e retorna o NSR; o banco serializa no conflito de chave única → sem furos e sem corrida entre marcações concorrentes. |
| **Imutabilidade do status de exceção** (Fase 2) | O ponto é append-only; a decisão do RH não altera o ponto — vive em `AprovacaoExcecao`. Status "efetivo" = registro + última decisão. Preserva a prova legal. |
| **Foto como evidência, sem matching** (Fase 2, com o dono) | Captura + storage cifrado; identidade = sessão autenticada. Evita custo/risco LGPD de biometria de terceiro antes da hora. |
| **Enums do `shared` como const-object + union** (Fase 2) | Estruturalmente compatíveis com os enums do Prisma → elimina o atrito de tipos nominais entre back e a lógica pura compartilhada, sem casts. |
| **PostgreSQL embarcado para e2e** (Fase 3) | `embedded-postgres` (binário portátil) roda um Postgres real sem Docker/admin → e2e de RLS/NSR/imutabilidade local e no CI. O ambiente de dev não tinha Docker. |
| **Importação CSV tudo-ou-nada** (Fase 3) | Valida todas as linhas (CPF, duplicidade no arquivo e no banco) antes de gravar; qualquer erro aborta tudo e devolve relatório linha+campo. Evita base inconsistente (spec §4.3). |
| **Status de documento efetivo calculado** (Fase 3) | `VENCIDO` é derivado de `APROVADO` + `dataValidade < agora` na leitura, não persistido — evita job de expiração e mantém uma fonte de verdade. |
| **Assinatura Ed25519 do servidor** (Fase 4) | Além do hash+timestamp, o servidor assina o manifesto → não-repúdio + verificação pública do comprovante. Base evidencial que o PAdES (Fase 5) embarca no PDF. |
| **Re-autenticação para assinar** (Fase 4) | Assinar exige a senha do funcionário (não um checkbox) — prova de intenção/identidade no ato, alinhado a assinatura eletrônica avançada (Lei 14.063/2020). |
| **Chave de assinatura via HKDF** (Fase 4) | A chave Ed25519 é derivada por HKDF de `DATA_ENCRYPTION_KEY` com `info` próprio (separação de chave: assinar ≠ cifrar), ou de `ASSINATURA_SEED`. Determinística → chave pública estável/publicável. |
| **Decisão de exceção/assinatura fora do artefato imutável** (Fases 2/4) | `pontos` e `assinaturas_virtuais` são append-only (revoke + e2e); o workflow mutável (status) vive em tabela separada. Preserva a prova. |
| **Layout AFD/AEJ centralizado + honestidade de homologação** (Fase 5) | Toda a formatação fixed-width vive em `@repp/shared/afd` (uma fonte da verdade, testada). Marcado como "pendente de homologação gov.br" — não fingimos conformidade byte-perfect de memória. |
| **Exportações imutáveis, assinadas e verificáveis** (Fase 5) | Cada AFD/AEJ é cifrado, tem SHA-256 + assinatura Ed25519 e registro append-only; o download reconfere integridade (re-hash) e assinatura. |
| **PAdES-B real com certificado plugável** (Fase 5, com o dono) | Assinatura CMS embarcada no PDF (@signpdf + node-forge); dev usa cert autoassinado, produção pluga A1/A3 ICP-Brasil via `.p12`. Pipeline validado por teste. |
| **`useObjectStreams: false` no pdf-lib** (Fase 5) | O @signpdf exige xref clássico; forçamos isso ao salvar o PDF para o placeholder de assinatura funcionar. |
| **Terceira role `repp_super`** (Fase 6) | Super Admin isolado no banco: acesso a tabelas de plataforma, **REVOKE** nas operacionais, policy própria em `empresas`. Cumpre "isolamento no nível do banco" da spec — não só na app. |
| **Métricas de uso via SECURITY DEFINER** (Fase 6) | O super obtém agregados (funcionários ativos, marcações/mês) sem SELECT nas tabelas de dados — "apenas metadados de uso", como manda a spec. |
| **`PrismaSuperService` (conexão própria)** (Fase 6) | Requisições de plataforma conectam como `repp_super` (`SUPER_DATABASE_URL`); tenant nunca entra no contexto. Fallback p/ `DATABASE_URL` em dev. |
| **Migration escrita à mão** (Fase 6) | O `prisma migrate dev` deu OOM (máquina ~500MB livres). A migration foi escrita seguindo as convenções do Prisma e **validada contra Postgres real no e2e**. |
| **Hardening: helmet + rate limiting** (Fase 6) | Cabeçalhos de segurança e throttling global fecham o débito de brute-force. |

## 4. Estado por fase

| Fase | Escopo | Estado |
| --- | --- | --- |
| **0 — Fundação** | Monorepo, schema+RLS, scaffold API/PWA, lint/test/CI/Docker | ✅ Concluída |
| **1 — Cadastro/login/acesso** | auth admin+2FA, auth funcionário+convite, lockout, refresh, log de acesso, Tela 1 + ADM 1 | ✅ Concluída |
| **2 — Ponto** | registro+REGAP+NSR+hash, imutabilidade, offline-first (fila+sync), Tela 3 + ADM 4 | ✅ Concluída |
| **3 — Funcionário/documentos** | ADM 2 (cadastro, foto, docs, vencimento, CSV, soft delete) + Tela 4; e2e + migrations | ✅ Concluída |
| **4 — Folha/assinatura** | ADM 3 (envio lote, fila, comprovante) + Tela 2 (assinar/recusar); Ed25519 + hash + timestamp | ✅ Concluída |
| **5 — Compliance 671** | AFD/AEJ (hash+assinatura+imutável), comprovante PAdES-B, pacote de fiscalização, ADM 6 | ✅ Concluída |
| **6 — Plataforma/SaaS** | ADM 0 (Super Admin, empresas, uso, planos, faturas) + isolamento `repp_super` + hardening | ✅ **Concluída** (aguardando aprovação) |

**Roadmap 0–6 completo.** Próximo é go-live (homologação + certificado), não novas fases.

**Incrementos pós-roadmap (seguindo os documentos de especificação):**

| Item | Escopo | Estado |
| --- | --- | --- |
| Revisão de segurança | Auditoria das 6 fases + correções (ver `SECURITY-REVIEW.md`) | ✅ |
| Authz por filial (R1) | `GESTOR_FILIAL` restrito às suas filiais (ADM 2/ADM 4) | ✅ |
| **ADM 6 — Auditoria** | Trilha de auditoria + log de acessos + relatório de aprovações (RH Master/Auditoria) | ✅ |
| **ADM 7 — Configurações** | Jornadas (horário/tolerância/dias) + feriados; **`PENDENTE_HORARIO`** avaliado no ponto (fuso da filial, feriado, escala) | ✅ |
| **ADM 10 — Férias/Afastamentos** | Solicitar (funcionário) + aprovar/recusar + calendário; **abono** (dia aprovado não gera `PENDENTE_HORARIO`) | ✅ |
| **ADM 11 — Contestação de ponto** | Funcionário contesta marcação própria; RH responde (obrigatório) + trilha de auditoria | ✅ |
| **ADM 5 — Dashboard Geral** | KPIs consolidados, alertas prioritários (>48h), presença 7 dias | ✅ |
| **ADM 8 — Comunicados** | Envio com público-alvo (todos/filial/cargo/funcionário) + taxa de visualização + leitura no app | ✅ |
| **ADM 9 — Integrações** | Chaves de API (token só uma vez, hash no banco, revogação) + config folha/eSocial | ✅ |
| **Banco de horas** | Horas trabalhadas/dia + saldo vs. carga da jornada (fuso da filial) | ✅ |

**Backlog da spec 100% coberto** (Telas 1–4 do funcionário; ADM 0–11; compliance
671; plataforma SaaS). Transmissão real ao eSocial/gateway de folha e homologação
gov.br/ICP-Brasil são atos de **infra/externos** — o sistema está preparado.

## 5. Cobertura de testes

**79 testes de unidade + 18 checagens e2e, todos verdes** (`@repp/shared`: 56,
`@repp/api`: 23, e2e: 18). Inclui `EscopoFilialService.restringe` (authz por
filial), `dentroDoHorario` (jornada/feriado/escala), `dataNoIntervalo` (ausência)
e `calcularHorasDia`/`saldoDia` (banco de horas).

> e2e agora inclui o **boundary do Super Admin**: `repp_super` vê `empresas` mas é
> **negado** em `pontos/funcionarios/documentos/assinaturas/consentimentos`, e as
> métricas vêm da função SECURITY DEFINER. Prova no banco a regra da spec.

- **`@repp/shared`:** CPF; senha; lockout; REGAP/haversine; sequência de
  marcação; hash canônico do ponto; vencimento de documentos; manifesto de
  assinatura; competência; **AFD** (formatadores fixed-width, datas UTC,
  `semAcento`, montagem cabeçalho/marcação/trailer).
- **`@repp/api` (unidade):** cripto — Argon2id, AES-256-GCM, TOTP, hash de token,
  Ed25519; **PAdES** (certificado autoassinado + assinatura CMS embarcada no PDF
  ponta a ponta); segurança — `RolesGuard`, `JwtAuthGuard`, `TenantContext`.
- **e2e (Postgres real embarcado):** RLS (isolamento + resolver de subdomínio);
  NSR (60 inserts concorrentes → 1..60 sem furos); imutabilidade de `pontos` e
  `assinaturas_virtuais`. `npm run test:e2e -w @repp/api` + CI.
- **A cobrir:** e2e dos fluxos de negócio ponta a ponta e testes de componente
  do frontend; homologação AFD/AEJ no validador gov.br.

## 6. Segurança e LGPD

> **Auditoria dedicada:** ver [`SECURITY-REVIEW.md`](./SECURITY-REVIEW.md) —
> revisão de ponta a ponta das 6 fases (2 achados Altos + 6 Médios corrigidos;
> 3 riscos aceitos documentados).

- **Isolamento de tenant** por RLS forçado no banco + vínculo do JWT ao tenant.
- **Imutabilidade** de ponto/auditoria/log de acesso por permissão de banco + trigger.
- **Senhas** com Argon2id (parâmetros OWASP); **2FA TOTP obrigatório** para admin,
  com segredo cifrado em repouso (AES-256-GCM).
- **Lockout** 5 tentativas / 15 min (admin e funcionário); resposta genérica no
  login para não revelar existência de conta.
- **Tokens** (refresh, convite, recuperação) guardados só como SHA-256; refresh
  rotacionado e revogável (logout, troca de senha, revogação de acesso).
- **Consentimento LGPD** (biometria) registrado no primeiro acesso, append-only.
- **Fotos e documentos cifrados em repouso** (AES-256-GCM) no `StorageService`;
  o blob nunca fica em claro no disco nem no banco (só a referência opaca).
- **Assinatura Ed25519 do servidor** com chave derivada por HKDF (separação de
  chave); comprovante verifica autoria (assinatura) **e** integridade (re-hash do
  arquivo). `assinaturas_virtuais` é append-only (revoke + e2e).
- **Segredos** fora do repo (`.gitignore`), validados no boot (`env.ts`, fail-fast).
- **Super Admin isolado no banco** (`repp_super`): sem acesso a dados operacionais;
  métricas só por SECURITY DEFINER; auditoria própria (`logs_super_admin`).
- **Hardening (Fase 6):** `helmet` (CSP/HSTS/etc.) + **rate limiting global**
  (`@nestjs/throttler`) — fecha o débito de brute-force no login/2FA.
- **A endurecer (go-live):** entrega real de e-mail/SMS/push (hoje stub),
  rotação de `DATA_ENCRYPTION_KEY`/chaves em HSM/KMS, política de
  retenção/exclusão de fotos documentada, DPO; e, quando entrar matching facial,
  DPA/análise de privacidade do provedor.

### Mapa ISO 27001 (controles já cobertos por código)

- **A.9 Controle de acesso:** RBAC por papéis, 2FA obrigatório (admin/super),
  lockout, isolamento multi-tenant (RLS) + role de plataforma sem dados operacionais.
- **A.10 Criptografia:** senhas Argon2id; AES-256-GCM em repouso (biometria/docs);
  Ed25519 (assinatura/comprovantes); TLS a cargo do proxy (infra).
- **A.12 Operações:** trilha de auditoria append-only (ações, acessos, super);
  imutabilidade de ponto/assinatura/exportação garantida no banco.
- **A.18 Conformidade:** LGPD (consentimento separado, cifragem), Portaria 671
  (AFD/AEJ, PAdES, imutabilidade, NSR, guarda 5 anos).
- **Pendente (processo/infra):** gestão formal de riscos, continuidade/DR,
  hardening de rede, políticas assinadas — fora do escopo de código.

## 7. Checklist de conformidade — Portaria 671

| Item | Estado | Observação |
| --- | --- | --- |
| Imutabilidade dos registros | 🟢 Atende | `pontos` append-only (revoke + trigger); correção via `pontos_ajustes`; exceção via `AprovacaoExcecao`. A API de gravação respeita isso. |
| NSR sem furos por estabelecimento | 🟢 Atende | `NsrService` (INSERT … ON CONFLICT atômico). Falta o teste de concorrência com banco real. |
| Hash de integridade (SHA-256) | 🟢 Atende | Calculado no registro sobre o conteúdo canônico. Hash-chain (encadeado) previsto p/ Fase 5 (AFD). |
| Trilha de auditoria | 🟢 Atende | `logs_auditoria` cobre ponto/exceção/ajuste/REGAP + `logs_acesso`, append-only. |
| Registro nunca bloqueado | 🟢 Atende | Implementado: fora da REGAP/sem GPS → aceito como `PENDENTE_REGAP`. |
| Assinatura com hash + timestamp | 🟢 Atende | SHA-256 do documento + manifesto + **Ed25519 do servidor** + timestamp + IP; registro imutável; comprovante verificável (autoria + integridade). |
| Comprovante PDF PAdES | 🟡 Parcial | **PAdES-B implementado** (CMS embarcado no PDF, testado). Falta o certificado **ICP-Brasil** (hoje autoassinado em dev). |
| Geração AFD | 🟡 Parcial | **Implementada** (texto fixed-width, hash, assinatura, imutável). Falta **homologar o leiaute** no validador gov.br. |
| Geração AEJ | 🟡 Parcial | **Implementada** (estrutura JSON v1). Falta homologar o leiaute oficial. |
| Registro INPI | ⚪ Externo | Ato externo; sistema preparado (código versionado, hashes/assinaturas). |
| Pacote de fiscalização | 🟢 Atende | ADM 6 gera AFD + AEJ + contagem da trilha (auditoria/acesso), com hashes. |
| Guarda 5 anos / soft delete | 🟢 Atende | Desligamento = `status=DESLIGADO` + `desativadoEm` (ADM 2), sem hard delete; histórico preservado. |
| Acesso do colaborador aos registros | 🟡 Parcial | Espelho do dia (Tela 3) pronto; espelho por período/banco de horas pendente. |

Legenda: 🟢 atende · 🟡 parcial · 🔴 falta · ⚪ fora do escopo de código.

## 8. Débitos técnicos e riscos conhecidos

- **~~Migration base não gerada~~ / ~~sem e2e~~ — RESOLVIDO na Fase 3.** As
  migrations (`init` + `funcionarios_documentos`) estão versionadas e os e2e de
  RLS/NSR/imutabilidade rodam contra Postgres real (local + CI).
- **Docker não instalado no ambiente de dev** — usamos Postgres embarcado para
  dev/teste; o `docker-compose.yml` segue como caminho de produção, a validar em
  máquina com Docker.
- **Importação CSV é parser simples** (split por vírgula, sem aspas/escape) —
  suficiente para o piloto; trocar por parser robusto se os dados exigirem.
- **Leiautes AFD/AEJ pendentes de homologação** no validador oficial gov.br — a
  estrutura está implementada e centralizada (`@repp/shared/afd`); ajustar
  larguras/campos contra o validador antes do go-live.
- **Certificado ICP-Brasil ausente** — o PAdES-B está implementado e testado, mas
  usa cert **autoassinado** em dev; produção exige um A1/A3 real (`.p12`) sem
  validade jurídica até então. `ASSINATURA_P12_BASE64`/`ASSINATURA_P12_SENHA`.
- **Hash-chain do AFD e banco de horas/folha mensal** ainda não implementados
  (hash é por registro; encadeamento e cálculo de jornada ficam para incremento).
- **Gateway de pagamento real** não integrado — faturas são modeladas
  (`gatewayRef` reservado); falta plugar o provedor (Stripe/Pagar.me/etc.).
- **`nest build` pode dar OOM** nesta máquina (~500MB livres) — use
  `NODE_OPTIONS=--max-old-space-size=1536`; migrations geradas com Postgres
  embarcado exigem matar `postgres` órfãos antes. Sem impacto em CI (mais RAM).
- **Refresh do Super Admin** é rotacionado/revogado no uso, mas sem detecção de
  reuso explícita (como no tenant) — melhoria menor.
- **Notificações push/e-mail** (documento não visto em 5 dias, recusa, reenvio
  automático) são registradas em log mas **não disparam** — falta integrar
  provedor (infra), previsto junto de recuperação de senha/convite.
- **Gestão da chave de assinatura**: hoje derivada de `DATA_ENCRYPTION_KEY`
  (ou `ASSINATURA_SEED`). Em produção, migrar para HSM/KMS e política de rotação
  com versionamento de `chaveServidorId` (já gravado por assinatura).
- **~~`statusValidacao` por horário/jornada~~ e ~~banco de horas~~ — RESOLVIDOS
  (ADM 7 + banco de horas).** Jornada/tolerância/feriado/escala geram
  `PENDENTE_HORARIO` no fuso da filial; o banco de horas calcula trabalhado/saldo
  por dia (carga da jornada). Refinos possíveis: fechamento mensal e hora-extra
  com adicional/DSR (regras CLT específicas) — ficam para configuração fina.
- **Transmissão eSocial / gateway de folha** não fazem chamadas externas reais —
  há config + chaves de API; o envio é infra a integrar (documentado no ADM 9).
- **E-mail**: camada SMTP (nodemailer) implementada e ligada a recuperação/convite;
  sem `SMTP_*`, os e-mails são registrados no log (dev). **SMS/push** seguem pendentes.
- **CORS** configurável por `CORS_ORIGINS`; **PWA containerizado** (Nginx) com
  serviço `web` no compose. Deploy completo com `docker compose up -d`. Ver `GO-LIVE.md`.
- **Hash por registro (não encadeado)** — suficiente para integridade + auditoria;
  o hash-chain do AFD entra na Fase 5.
- **Entrega de recuperação de senha é stub** — o token é gerado/persistido, mas
  o envio por SMS/e-mail depende de provedor (Fase 3, junto do canal do RH).
- **Convite gera um "esqueleto" de funcionário** (nome+CPF) — o cadastro completo
  (cargo, salário, jornada, documentos) é a ADM 2, na Fase 3.
- **Docker não instalado no ambiente de dev atual** — `docker-compose.yml` é
  entregável mas não foi executado aqui; validar em máquina com Docker.
- **Ícones do PWA** (`icon-192/512.png`) são placeholders a fornecer.
- **Reconhecimento/liveness facial**: subsistema complexo adiado; Fase 2 começa
  com captura + armazenamento seguro. Opções (SDK vs. próprio) serão apresentadas
  com trade-offs antes de implementar.

## 9. Sugestões de melhoria priorizadas (impacto × esforço)

- **Curto prazo:** testes e2e da API com Testcontainers (Postgres real) para
  validar as policies de RLS automaticamente (alto impacto, baixo esforço).
- **Médio prazo:** interceptor de auditoria automático; helper de cifragem
  AES-256-GCM para biometria; rate limiting no login.
- **Longo prazo:** observabilidade (logs estruturados, métricas), assinatura
  PAdES, geração AFD/AEJ, hardening ISO 27001 (Fase 6).

## 10. Próximos passos recomendados

**Roadmap 0–6 concluído.** Daqui em diante é caminho de **go-live** (atos externos
+ infra), não novas fases de produto:

1. **Aprovar a Fase 6** (este entregável).
2. **Homologação legal:** validar AFD/AEJ no verificador oficial gov.br; instalar
   o **certificado ICP-Brasil** (A1/A3) para o PAdES; registrar o software no **INPI**.
3. **Infra de produção:** subir com Docker (Postgres + 3 roles), provisionar
   `SUPER_DATABASE_URL`, integrar gateway de pagamento e provedor de e-mail/SMS/push,
   mover chaves para HSM/KMS, configurar TLS/observabilidade.
4. **Incrementos de produto:** banco de horas/folha mensal em PDF, hash-chain do
   AFD, matching/liveness facial (com DPA), ADM 5–11 restantes (dashboards,
   férias/afastamentos, contestação, integrações eSocial).
5. **Jurídico:** revisão do fluxo da Tela 3/ADM 4 e da assinatura por advogado
   trabalhista antes do lançamento.
