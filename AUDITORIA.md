# AUDITORIA — REP-P (Sistema de Ponto Eletrônico)

> **Fase A — diagnóstico (somente leitura).** Nenhum arquivo de código foi
> alterado nesta fase. Data: 2026-08-04. Autor: revisão técnica ao assumir o
> projeto já existente.
>
> **Postura de honestidade:** este relatório separa o que eu **verifiquei** do
> que apenas **li/inferi**. Não afirmo que o sistema está "seguro" ou "pronto".
> Aponto o que está sólido, o que está em risco e o que **não consegui validar**
> nesta máquina (ver seção "Limites desta auditoria").

---

## Resumo executivo

Você **não** herdou um esqueleto. Herdou um sistema **maduro e coeso**: monorepo
bem organizado, backend NestJS com separação de módulos limpa, isolamento
multi-tenant por **Row Level Security** no Postgres, criptografia adequada
(Argon2id, AES-256-GCM, Ed25519), imutabilidade de ponto imposta **no banco**, e
uma auditoria de segurança anterior (`SECURITY-REVIEW.md`) séria e bem-feita.
Isso é raro e é o ativo mais valioso aqui. **A recomendação central é evoluir por
refatoração incremental, não reescrever.**

Os riscos reais não estão na arquitetura — estão em **três frentes concretas**:

1. **Dependências com vulnerabilidade conhecida** (`npm audit`: 13 achados, sendo
   5 altos em `nodemailer` e moderados em `express`/`qs`). — verificado.
2. **Cobertura de teste desequilibrada**: backend e regras de negócio bem
   testados; **frontend com zero testes**; e a feature em andamento
   (homologação do RH) **sem teste e com uma possível brecha de autorização por
   filial**. — verificado.
3. **Validação externa ainda não feita** (pentest, homologação gov.br AFD/AEJ,
   revisão LGPD por jurídico, cert ICP-Brasil) — corretamente documentada como
   pendência do dono, mas **é o que separa "parece pronto" de "auditável"**.

---

## A1 — Inventário do que existe

### Estrutura (monorepo npm workspaces)

| Pasta                           | Papel                                                                                                                                                   | Estado                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `packages/shared`               | Regras puras compartilhadas (CPF, geo, horário, hash de ponto, AFD, banco de horas, dinheiro, lockout, contrato de sync). 14 módulos, **13 com teste**. | **Sólido e testado**            |
| `apps/api`                      | Backend NestJS + Prisma. **119 arquivos `.ts`**, ~25 módulos de domínio. REST versionada `/api/v1`, OpenAPI.                                            | **Completo**                    |
| `apps/web`                      | PWA React/Vite offline-first (Dexie). App do funcionário (5 telas) + painel admin (11 telas) + super admin.                                             | **Completo (visual), 0 testes** |
| `docker/`, `docker-compose.yml` | Postgres + API + web (nginx proxy).                                                                                                                     | Presente                        |
| `scripts/`                      | Dev local (Postgres embarcado), geração de migration à mão.                                                                                             | Presente                        |
| `.github/workflows/ci.yml`      | CI: build → lint → format:check → testes unit → `prisma validate` → **e2e com Postgres real**.                                                          | **Bem montado**                 |

### Stack real (confirmada em `package.json`)

- **Backend:** NestJS 10, Prisma 5.22, `@node-rs/argon2`, `otplib` (TOTP),
  `helmet`, `@nestjs/throttler`, `zod` (validação de env), `pdf-lib` +
  `@signpdf` + `node-forge` (PAdES), `nodemailer`.
- **Frontend:** React 18, Vite 5, `dexie` (fila offline), `vite-plugin-pwa`.
- **Banco:** PostgreSQL, RLS por `empresa_id`, 3 roles (`repp_app`,
  `repp_super`, migração). **11 migrations** versionadas.
- **TypeScript `strict: true`** em toda a base. Node ≥ 20.

### Módulos de domínio implementados (backend)

auth (admin+2FA / funcionário+convite), pontos (registro imutável + NSR + gestão
de exceções), funcionários + documentos, assinaturas (envio + assinatura +
comprovante PAdES), compliance (AFD/AEJ/fiscalização), fechamento mensal, banco
de horas, férias/afastamentos + contestação, auditoria, configurações
(jornada/feriado), comunicados, integrações (chave de API/eSocial stub),
dashboard, plataforma/super-admin (SaaS), notificações (SMTP + fallback log),
storage (local/S3), health.

> **Conclusão A1:** praticamente **nada é esqueleto**. O que é "stub por design"
> está documentado: transmissão real eSocial/folha (infra externa), entrega de
> e-mail/push (creds do dono), gateway de pagamento (`gatewayRef` stub). Isso é
> aceitável e está sinalizado.

### O projeto roda?

- **Builda / sobe:** sim, com caminho documentado (`RODAR-LOCAL.md`,
  `DEPLOY.md`, `GO-LIVE.md`). Nesta máquina (4GB RAM, sem Docker) o fluxo usa
  **SWC** em vez de `tsc`/`nest build` e **Postgres embarcado** — restrição de
  hardware, não do projeto.
- **CI valida o caminho "limpo"** (Docker/Ubuntu): build dos 3 workspaces, lint,
  formato, testes e e2e. — Li o workflow; **não executei o CI**.

---

## A2 — Saúde do código

| Item                              | Achado                                                                                                                                                                                                | Confiança                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Testes (backend/regras)**       | 13 arquivos de teste em `shared`, 8 unit em `api`, 2 suítes e2e (RLS, concorrência de NSR, imutabilidade). Fluxos críticos de negócio **têm** teste.                                                  | Verifiquei os arquivos; **não rodei a suíte** (ver Limites).                            |
| **Testes (frontend)**             | **Zero.** `apps/web` roda `vitest --passWithNoTests`. Nenhuma tela ou fluxo offline tem teste.                                                                                                        | Verificado                                                                              |
| **Lint/format**                   | ESLint + Prettier + **Husky/lint-staged** + `.editorconfig`. CI roda `lint` e `format:check`. Pré-commit configurado.                                                                                 | Verificado (config); não rodei o lint aqui                                              |
| **Vulnerabilidades de deps**      | `npm audit`: **13 (8 moderadas, 5 altas)**. `nodemailer` (5 altas: SSRF/leitura de arquivo/DoS), `express`→`qs` (DoS moderado). Correção exige upgrade major (`nodemailer@9`, `platform-express@11`). | **Verificado**                                                                          |
| **Migrations à mão**              | Migrations escritas manualmente (OOM no `prisma migrate` nesta máquina). Risco de **drift** entre `schema.prisma` e o banco não é pego automaticamente.                                               | Verificado (a migration em curso confere com o diff do schema, mas o processo é frágil) |
| **Duplicação / funções gigantes** | Não encontrei "deus-arquivo" óbvio; módulos coesos por domínio. Não fiz varredura de complexidade ciclomática.                                                                                        | Parcial                                                                                 |

---

## A3 — Segurança (AppSec)

Já existe `SECURITY-REVIEW.md` (2026-07-31) sério: corrigiu **2 Altos + 6
Médios/Hardening** (IDOR no comprovante, upload sem limite/MIME, body 100kb→25MB,
Swagger off em prod, JWT `alg` fixado HS256, bypass de tenant por substring,
segredos ≥32). **Confirmei por leitura** os controles principais:

**Controles bem implementados (confirmados por leitura):**

- **Multi-tenant:** RLS por `empresa_id`; `JwtAuthGuard` amarra `empresaId` do
  token ao tenant do subdomínio (anti-replay); `repp_super` **revogado** nas
  tabelas operacionais. e2e cobre o boundary (li a descrição/estrutura, não rodei).
- **Cripto:** Argon2id (senhas), AES-256-GCM (biometria/documentos, com
  detecção de adulteração), Ed25519 (assinatura via HKGF), TOTP cifrado, tokens
  guardados só como SHA-256.
- **Injeção:** nenhum `queryRawUnsafe/executeRawUnsafe`; SQL cru só em template
  parametrizado do Prisma.
- **Superfície:** helmet, CORS por env, ValidationPipe global com `whitelist` +
  `forbidNonWhitelisted`, Swagger só fora de produção, rate-limit global.
- **Segredos:** `.env` **não** versionado (só `.env.example`); `.gitignore`
  cobre `*.pem/*.key/storage/.devdb`; env validada com `zod` no boot (fail-fast).
  **Varri por segredos hardcoded — não encontrei.**

**Achados NOVOS / ainda abertos (nesta auditoria):**

| ID     | Gravidade | Achado                                                                                                                                                                                                                                                                                            | Onde                                                                                                                                                                           |
| ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1** | **Alta**  | Deps vulneráveis: `nodemailer` (SSRF, leitura de arquivo, DoS) e `express/qs` (DoS). São exploráveis conforme uso.                                                                                                                                                                                | `apps/api/package.json`, deps transitivas                                                                                                                                      |
| **S2** | **Média** | **Feature em curso `homologar` não aplica escopo de filial.** `GESTOR_FILIAL` pode homologar (contra-assinar) documento de **qualquer** filial da empresa, não só das suas. Mesma classe do achado R1 já corrigido em outros módulos — mas `AssinaturaService` **não** usa `EscopoFilialService`. | [assinatura.service.ts:259](apps/api/src/assinaturas/assinatura.service.ts#L259), [adm-assinatura.controller.ts:66](apps/api/src/assinaturas/adm-assinatura.controller.ts#L66) |
| **S3** | **Baixa** | `R2` do review anterior segue aberto: MIME validado por whitelist, **não** por magic bytes. Mitigado (arquivos cifrados, nunca executados).                                                                                                                                                       | `assinatura.service.ts`, `storage.service.ts`                                                                                                                                  |
| **S4** | **Baixa** | `R3`: `SUPER_DATABASE_URL` cai para `DATABASE_URL` em dev; falta **fail-fast em produção**. Sem vazamento (role sem acesso), mas frágil.                                                                                                                                                          | `plataforma/prisma-super.service.ts`                                                                                                                                           |
| **S5** | **Info**  | Validação de segurança de verdade (pentest, LGPD por jurídico) **não foi feita** — corretamente listada como pendência externa. Não prometer "à prova de hacker".                                                                                                                                 | `SECURITY-REVIEW.md`                                                                                                                                                           |

> **Honestidade:** não executei ataques nem os testes e2e nesta máquina. As
> afirmações de S1 vêm do `npm audit` (verificado). S2–S4 vêm de leitura de
> código. O isolamento multi-tenant **parece correto no código**, mas "provado
> por e2e" é afirmação do histórico que **eu não re-executei**.

---

## A4 — Arquitetura

| Critério                   | Avaliação                                                                                                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Funcionário × Admin**    | Separação limpa: controllers/rotas distintos (`/funcionario*` vs `/admin*`), RBAC por `@Roles(PapelAdmin.*)`, front separado (`app-funcionario/` vs `painel-admin/`). **Vaza** apenas no ponto de S2 (escopo de filial não aplicado em assinaturas). |
| **Backend desacoplado**    | Sim. REST versionada `/api/v1`, DTOs com class-validator, filtro de exceção global padronizado, shared puro reaproveitado por API e PWA.                                                                                                             |
| **Imutabilidade do ponto** | Imposta **no banco** (UPDATE/DELETE revogados + trigger) **e** por contrato (ajuste = novo registro vinculado). Este é o ponto mais forte da arquitetura para compliance 671.                                                                        |
| **Offline-first**          | **Real**, não prometido: `offline/fila-ponto.ts` + `offline/sync.ts` com Dexie; contrato de sync em `shared/sync-contract.ts`. Não validei o comportamento sob conflito/reconexão (sem teste de front).                                              |
| **Tratamento de erro**     | `AllExceptionsFilter` global com `requestId`, mapeia erros do Prisma, não vaza stack em produção. Bom.                                                                                                                                               |
| **Trilha de auditoria**    | `LogAuditoria` append-only + `AuditoriaService`. A feature nova já registra `fechamento.homologar`. Consistente.                                                                                                                                     |

---

## A5 — Comparação com o mercado (Pontomais, Ahgora, Sólides, VR)

**Onde já está no nível:** registro por REGAP + geo, imutabilidade e NSR
sequencial, folha de ponto, assinatura virtual com comprovante, AFD/AEJ,
multi-tenant SaaS, trilha de auditoria, banco de horas, férias/afastamento,
contestação. Isso cobre o **núcleo regulatório** que os líderes entregam.

**Onde está atrás (realista):**

- **Homologação/certificação:** os líderes são REP-P homologados no gov.br e têm
  cert ICP-Brasil. Aqui é **auto-assinado em dev**; homologação é pendência
  externa (correto, mas é o diferencial de mercado que falta).
- **App mobile nativo:** concorrentes têm app nativo (push confiável, câmera,
  background). Aqui é PWA — bom, mas push/entrega de e-mail é stub.
- **Integrações de folha reais:** eSocial/folha estão como config/stub; líderes
  têm conectores prontos.
- **Maturidade de produto:** relatórios, dashboards de exceção e experiência de
  onboarding dos líderes são mais polidos (esperado — eles têm anos).

**Onde pode diferenciar:** o rigor de **imutabilidade no banco + trilha
append-only + assinatura Ed25519 versionada** é um argumento de compliance forte
e auditável — vale destacar comercialmente, desde que a homologação saia.

---

## Matriz de priorização (impacto × esforço)

### Atacar primeiro (alto impacto)

| #   | Ação                                                                                                                                             | Impacto                             | Esforço                      | Fase sugerida     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ---------------------------- | ----------------- |
| 1   | **S1 — atualizar `nodemailer`/`express`** (`npm audit fix --force` é major; testar SMTP e boot da API depois).                                   | Alto (5 vulns altas)                | **Médio** (breaking changes) | B (estabilização) |
| 2   | **S2 — aplicar `EscopoFilialService` em `AssinaturaService`** (homologar + demais rotas ADM de assinatura) e **adicionar teste** da homologação. | Alto (authz + é a feature em curso) | **Baixo**                    | B                 |
| 3   | **Rodar a suíte completa (unit + e2e) e registrar o resultado real** — hoje eu não sei se passa, só que existe.                                  | Alto (base de confiança)            | Baixo                        | B                 |

### Fazer em seguida (médio)

| #   | Ação                                                                                                 | Impacto     | Esforço |
| --- | ---------------------------------------------------------------------------------------------------- | ----------- | ------- |
| 4   | S4 — exigir `SUPER_DATABASE_URL` (fail-fast) em produção.                                            | Médio       | Baixo   |
| 5   | Testes de fluxo do **frontend** (bater ponto, sync offline, login/permissão). Hoje: zero.            | Médio-Alto  | Médio   |
| 6   | S3 — validar magic bytes no upload.                                                                  | Baixo-Médio | Baixo   |
| 7   | Formalizar processo de migration (reduzir risco de drift schema↔banco; `prisma migrate diff` no CI). | Médio       | Médio   |

### Depois (evolução — Fases C/D)

- Frontend nível corporativo (design system, estados, acessibilidade) — Fase C.
- Erro/observabilidade/OpenAPI em produção, integração de negócio — Fase D.
- **Externo ao código (dono):** pentest profissional, homologação AFD/AEJ gov.br,
  cert ICP-Brasil, revisão LGPD por jurídico, INPI, infra TLS/backup, creds SMTP.

---

## Fase B — progresso (estabilização) — 2026-08-04

> Incrementos pequenos e testados. Nenhuma feature nova. Baseline antes de mexer:
> **91 testes unit verdes** (shared 63 + api 28). O **e2e foi executado ao fim**
> (a seu pedido, com ~185MB de RAM livre) e passou: **RLS, concorrência do NSR,
> imutabilidade e boundary do Super Admin verdes** — minhas mudanças não
> quebraram as garantias de banco. Ressalva: o e2e **não** cobre o novo escopo de
> filial (S2) — isso é authz de aplicação, provado pelo teste unit dedicado.

| Item                                     | Status           | O que foi feito                                                                                                                                                                                                                                                                                                         | Verificação                                                                                                        |
| ---------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **S2 — escopo de filial em assinaturas** | ✅ **Resolvido** | `AssinaturaService` passou a injetar `EscopoFilialService`; helper `filtroFilial` aplica o filtro por filial do `GESTOR_FILIAL` em `fila`, `detalhe`, `comprovante` (path admin) e `homologar`. Controller passa o `user`. RH_MASTER/FINANCEIRO/AUDITORIA seguem com visão de empresa.                                  | **Teste novo** `assinatura.escopo.test.ts` (4 casos) + suíte unit verde                                            |
| **S4 — `SUPER_DATABASE_URL` fail-fast**  | ✅ **Resolvido** | `PrismaSuperService` agora **derruba o boot em produção** se a var faltar (dev mantém o fallback com aviso).                                                                                                                                                                                                            | Leitura + build SWC OK                                                                                             |
| **S1 — deps vulneráveis**                | 🟡 **Parcial**   | `nodemailer` **6 → 9.0.3** (elimina os 5 highs de SSRF/leitura de arquivo/DoS — o único que estava no nosso caminho de código, `sendMail`).                                                                                                                                                                             | `npm audit --omit=dev`: highs de nodemailer sumiram; unit verde; SWC compila 120 arquivos                          |
| **S1b — qs/express + NestJS 11**         | ✅ **Resolvido** | Migração **NestJS 10 → 11** (Express 4 → 5) concluída: `@nestjs/*` → 11.1.28, `express@5.2.1`. Override force de `@nestjs/core`/`common` (elimina duplicata que quebrava o `ThrottlerGuard`) + `crypto-js@4.2.0`/`js-yaml@4.3.1` (fecham criticals do `@signpdf`/`pdfkit` e o high do swagger). **Prod audit: 12 → 0.** | App **boota** no Nest 11 + Express 5 (health/ready `{db:up}`, tenant-mw/filtro OK); **33 unit verdes** incl. PAdES |
| **S3 — magic bytes no upload**           | ✅ **Resolvido** | Novo `@repp/shared/arquivo` (`detectarTipoArquivo`/`conteudoBateComMime`, puro) confere o conteúdo REAL contra o tipo aceito no envio de assinatura — rejeita `.exe` disfarçado de PDF e MIME mentido. Fecha o R2 do `SECURITY-REVIEW`.                                                                                 | **Teste novo** (4 casos, shared) + api unit verde                                                                  |

**S1b concluído (2026-08-04):** a migração **NestJS 10 → 11 / Express 5** foi
executada com rede de segurança (unit + boot). Resultado: **produção com 0
vulnerabilidades** (antes 12, com 5 highs). Restam vulns **apenas em dev-tooling**
(`vitest`/`vite`) — não vão para produção; tratar junto de futura atualização de
ferramentas de teste. Detalhe honesto: o `package-lock.json` foi **regenerado**
(esperado num major); a assinatura PAdES foi reverificada (pades.test) após o
bump de `crypto-js`.

**Vulnerabilidades dev-only** (vitest/vite/@nestjs/cli/tmp/glob etc.): são
**toolchain de teste/build**, não vão para produção. Prioridade menor; tratar
junto da atualização de ferramentas.

**Anti-drift de migration (CI):** avaliado e **não** adicionado. A detecção real
(`prisma migrate diff`) exige shadow database, que não consigo verificar com
segurança nesta máquina (RAM baixa) — não vou introduzir um passo de CI que possa
falhar espúrio. Mitigação já existente: o **e2e aplica todas as migrations** num
Postgres real e passou. Fica como recomendação para quando houver ambiente.

**Estado ao fim deste bloco:** **99 testes unit verdes** (shared 67 + api 32) **+
e2e verde** (RLS/NSR/imutabilidade/super boundary), lint limpo e Prettier OK nos
arquivos alterados, SWC compila.

---

## Limites desta auditoria (o que NÃO consegui verificar)

- **Não executei os testes** (unit/e2e) — a suíte de e2e sobe Postgres embarcado
  e esta máquina tem 4GB/`tsc` estoura memória; rodar sem cuidado pode derrubar o
  ambiente. Portanto "testes verdes" é **histórico não reconfirmado por mim**.
- **Não rodei lint/build** localmente — confio na config e no CI, não em execução.
- **Não fiz pentest** nem teste de carga — fora do alcance de leitura de código.
- Afirmações sobre RLS/imutabilidade vêm de **leitura**; são coerentes, mas a
  prova é o e2e, que eu não re-executei.

---

## Próximo passo

**Fase B em andamento** (ver seção de progresso acima): S2 e S4 resolvidos, S1
parcial (nodemailer corrigido; qs/NestJS 11 adiado com justificativa). Ainda em
aberto na Fase B, para sua decisão de prioridade:

- **Rodar o e2e** para confirmar que o escopo de filial (S2) e a imutabilidade
  seguem verdes contra Postgres real — eu evitei por risco de OOM; você decide se
  rodo aqui (com cautela) ou deixo para o CI.
- **Testes de fluxo do frontend** (bater ponto, sync offline, login/permissão) —
  hoje zero.
- **S3** (magic bytes) e **processo de migration** (anti-drift no CI).

**Não avanço para a Fase C (redesign do frontend) sem sua aprovação** — ela é
tela a tela e precisa do seu olho. Diga se sigo com o e2e/testes de front ou se
prefere revisar o diff da Fase B primeiro (`git diff`).
