# .GRAMO / REP-P — Análise completa do sistema

> Documento de auditoria técnica e de produto. Base: leitura do código em
> `2026-08-14` (branch `fase-b-estabilizacao`, ~22.300 linhas de aplicação).
> Escrito para estudo conjunto (engenharia + gestão/RH). Números conferidos no
> código, não estimados de memória.

---

## 1. O que o sistema É (visão de 30 mil pés)

SaaS **multi-tenant** de **ponto eletrônico corporativo** aderente à **Portaria
MTP 671/2021** (REP-P: Registrador Eletrônico de Ponto via Programa). Monorepo
npm com três camadas:

- `packages/shared` — biblioteca de domínio pura (regras de negócio testáveis,
  compartilhadas entre back e front).
- `apps/api` — NestJS + Prisma + PostgreSQL com **RLS** (Row-Level Security) por
  empresa. ~134 endpoints, 24 controllers.
- `apps/web` — PWA React/Vite **offline-first** (instalável, funciona sem rede).

Em produção desde `2026-08-10` (VPS Hostinger, HTTPS, Docker Compose).

---

## 2. Inventário de telas (23)

### Colaborador (PWA no celular) — 6

| Tela        | Função                                                            |
| ----------- | ----------------------------------------------------------------- |
| TelaLogin   | Login do colaborador (CPF/senha)                                  |
| BaterPonto  | Registro de ponto com geolocalização (REGAP), foto, offline-first |
| Folha       | Espelho de ponto do colaborador                                   |
| Documentos  | Upload/visualização de documentos cifrados                        |
| Ferias      | Solicitar férias/afastamento, acompanhar                          |
| Comunicados | Ler comunicados, marcar leitura                                   |

### Administração / RH — 14

| Tela                | Função                                                       |
| ------------------- | ------------------------------------------------------------ |
| AdmLogin            | Login admin com **2FA (TOTP)**                               |
| PainelDashboard     | KPIs, alertas (>48h), presença 7 dias                        |
| GestaoPonto         | Gestão/ajuste de ponto, aprovação de exceções                |
| GestaoFuncionarios  | CRUD, CPF único, aprovar foto, docs, import CSV, soft delete |
| PainelAssinaturas   | Envio de documentos para assinatura (individual/lote)        |
| PainelAusencias     | Decidir férias/afastamentos, calendário                      |
| PainelComunicados   | Publicar comunicados, taxa de leitura                        |
| PainelRelatorios    | Relatórios operacionais                                      |
| PainelAuditoria     | Trilha de confiança (acessos, aprovações)                    |
| PainelConfiguracoes | Jornadas, feriados, tolerâncias                              |
| PainelIntegracoes   | Chaves de API, folha/eSocial                                 |
| PainelQuiosque      | Gestão de dispositivos de quiosque                           |
| TelaoPresenca       | "Telão" de presença (modo standalone)                        |
| MapaObras           | Edição da área REGAP no mapa (Leaflet)                       |

### Plataforma (operador do SaaS) — 2

| Tela       | Função                                                      |
| ---------- | ----------------------------------------------------------- |
| SuperLogin | Login do super admin (2FA) — oculto, só com `?plataforma=1` |
| SuperPanel | Gestão de empresas, planos, faturas, métricas               |

### Quiosque — 1

| Tela         | Função                                                      |
| ------------ | ----------------------------------------------------------- |
| TelaQuiosque | Ponto compartilhado por dispositivo (modo `?modo=quiosque`) |

---

## 3. Logins e controle de acesso (4 fluxos)

1. **Colaborador** — CPF + senha; sessão por device; offline.
2. **Admin/RH** — e-mail + senha + **2FA TOTP**; lockout progressivo; refresh
   tokens; RBAC por papel (RH_MASTER, GESTOR_FILIAL, AUDITORIA, etc.).
3. **Super admin (plataforma)** — role Postgres própria (`repp_super`) com
   REVOKE dos dados operacionais; JWT tipo SUPER_ADMIN sem tenant.
4. **Quiosque** — autenticação por **dispositivo** (KioskGuard + ChaveApi
   hasheada), não por pessoa.

Mecanismos de segurança de acesso encontrados no código: 2FA TOTP, lockout,
refresh tokens rotativos, log de acesso (`LogAcesso`), recuperação de senha por
e-mail com token, RBAC (`roles.guard`), escopo por filial (`escopo-filial`).

---

## 4. Modelo de dados (~37 modelos, 23 enums, 12 migrations)

Núcleo: `Empresa`, `Filial`, `UsuarioAdmin`, `Funcionario`, `Regap` (área
geográfica), `ContadorNsr` (NSR sequencial), `Ponto`, `PontoAjuste`,
`AprovacaoExcecao`. Compliance/legal: `ConsentimentoLgpd`, `LogAuditoria`,
`Documento`, `DocumentoAssinatura`, `AssinaturaVirtual`, `ExportacaoAfdAej`.
RH: `Jornada`, `Feriado`, `FeriasAfastamento`, `ContestacaoPonto`,
`AjusteBancoHoras`, `Comunicado`. Plataforma/SaaS: `SuperAdmin`, `Plano`,
`Fatura`, `LogSuperAdmin`. Integrações: `ChaveApi`, `DispositivoKiosk`,
`IntegracaoConfig`.

---

## 5. Segurança de dados — o que já existe

| Camada                          | Implementado                                                    |
| ------------------------------- | --------------------------------------------------------------- |
| Isolamento entre empresas       | **RLS no Postgres** (não só no código) + TenantMiddleware       |
| Senhas                          | Argon2 (@node-rs/argon2)                                        |
| Dado sensível (biometria/fotos) | **AES-256** cifrado em repouso                                  |
| 2FA                             | TOTP para admin e super                                         |
| Imutabilidade do ponto          | Correção = ajuste vinculado (append-only)                       |
| Integridade                     | SHA-256 do ponto; NSR atômico (INSERT ON CONFLICT)              |
| Assinatura digital              | Ed25519 (servidor) + **PAdES-B** no PDF (pdf-lib/@signpdf)      |
| Exportação fiscal               | AFD (fixed-width) + AEJ, cifrada + assinada + registro imutável |
| Hardening HTTP                  | Helmet + throttler global; JWT alg fixado HS256; body limit     |
| LGPD                            | Consentimento separado; soft delete; guarda 5 anos              |
| Auditoria                       | Trilha própria (LogAuditoria, LogSuperAdmin)                    |
| Segredos                        | Fora do git; mínimo 32 chars validado no boot                   |
| Rede (prod)                     | UFW 22/80/443; API/Postgres só no loopback; HTTPS auto (Caddy)  |

---

## 6. Qualidade / testes — estado real e o que falta

**O que HÁ hoje (automatizado, roda no CI):**

- **153 testes unitários** (shared 81, api 58, web 14) + **18 e2e** com
  **Postgres real** (provam RLS, concorrência do NSR 60×, imutabilidade).
- SAST (CodeQL), SCA (`npm audit` de produção = 0 vulnerabilidades), lint,
  format:check — todos verdes.

**O que FALTA para "verificação e testes completos de cada tela" (nível empresa):**

- **Testes E2E de interface** (Playwright/Cypress): hoje não há teste que
  _abre cada tela e clica_. O e2e existente é de API. Cada uma das 23 telas
  precisa de um roteiro automatizado (login, caminho feliz, erros, offline).
- **Testes de cada login** ponta-a-ponta (colaborador, admin+2FA, super+2FA,
  quiosque) — hoje cobertos parcialmente por unidade, não por E2E de UI.
- **Testes de carga/estresse** (k6/Locust): quantos pontos/segundo aguenta?
- **Teste de recuperação (restore drill)** periódico do backup — feito uma vez
  manualmente, ainda não automatizado.
- **Cobertura medida** (coverage %) — não há gate de cobertura hoje.
- **Testes de acessibilidade** (axe) e responsividade em dispositivos reais.
- **Pentest externo** — auditoria de segurança por terceiro (não interno).

---

## 7. Quanto está pronto (%)

Estimativa ponderada por dimensão (visão senior, honesta):

| Dimensão                                | Peso | Pronto   | Observação                                          |
| --------------------------------------- | ---- | -------- | --------------------------------------------------- |
| Funcionalidade núcleo (ponto + RH)      | 25%  | **90%**  | Backlog da spec 100% coberto                        |
| Segurança técnica                       | 20%  | **85%**  | Falta pentest externo, gestão de segredos madura    |
| Testes/qualidade                        | 15%  | **55%**  | Backend forte; UI/E2E e carga são lacunas           |
| Compliance legal (671) — técnico        | 10%  | **80%**  | AFD/AEJ/PAdES prontos no código                     |
| Compliance legal — **homologação real** | 10%  | **~10%** | gov.br + ICP-Brasil são externos e bloqueadores     |
| Operação / infra                        | 12%  | **65%**  | Falta offsite, monitoring, staging, CI/CD de deploy |
| Produto / UX / acessibilidade           | 8%   | **70%**  | Bom, mas sem QA de acessibilidade                   |

**Veredito:**

- Como **produto técnico funcional**: **~75% pronto**.
- Como **produto de empresa "pronto para vender com compliance legal pleno"**:
  **~55–60%** — porque homologação gov.br e certificado ICP-Brasil (externos)
  são pré-requisitos legais e ainda não foram feitos.

---

## 8. O que falta (backlog priorizado)

### Bloqueadores legais (externos — dependem de você, não de código)

1. **Homologação dos leiautes AFD/AEJ no gov.br**.
2. **Certificado ICP-Brasil (A1/A3)** para assinatura com validade jurídica.
3. **Registro INPI** do software / marca; revisão jurídica dos termos e LGPD.

### Operação / confiabilidade (engenharia)

4. **Backup offsite** cifrado (hoje só local na VPS). — _já mapeado_
5. **Monitoramento + alertas** (uptime, erro, disco, expiração de cert) —
   Uptime Kobme/Grafana/healthchecks.
6. **Observabilidade**: logs estruturados centralizados + métricas (já há
   `json-logger`; falta agregação).
7. **Ambiente de staging** espelhando produção (hoje deploy vai direto).
8. **CI/CD de deploy** (hoje o deploy é manual por SSH).
9. **Restore-test automatizado** mensal.

### Qualidade

10. **Testes E2E de UI** (as 23 telas) + **testes de carga** + **coverage gate**.
11. **Acessibilidade** (WCAG AA) e testes em dispositivos reais.

### Produto / RH (valor de negócio)

12. **eSocial real** (hoje é config/stub; transmissão é infra externa).
13. **Banco de horas** com regras completas de compensação e alertas.
14. **Escala de turnos / plantão** e jornada 12×36.
15. **Relatórios gerenciais avançados** (absenteísmo, horas extras, custo).
16. **App nativo** (hoje PWA) para push/biometria nativa, se necessário.
17. **Integração com folha de pagamento** (exportação para sistemas de RH).

---

## 9. Valor estimado do sistema

> Faixas com premissas explícitas — não são promessas, são cenários para
> discussão. Mercado brasileiro, 2026.

### (a) Valor de reposição (custo para reconstruir do zero)

~22.300 linhas de sistema complexo (multi-tenant, RLS, compliance, PWA
offline, assinatura digital). Um time senior (2–3 devs) levaria ~8–12 meses.

- Estimativa de custo de reconstrução: **R$ 450 mil – R$ 900 mil**.

### (b) Como produto vendido (licença/projeto fechado)

Venda como sistema white-label para uma construtora/empresa de médio porte,
com implantação: **R$ 80 mil – R$ 250 mil** por cliente (dependendo de
customização e suporte).

### (c) Como SaaS (recorrência) — onde está o valor real

Precificação típica de ponto: **R$ 8–20 por colaborador/mês**, ou planos por
empresa (R$ 300–2.000/mês). Cenários de ARR (receita recorrente anual):

| Clientes     | Colab. médios | ARR aprox.  | Valuation (3–6× ARR) |
| ------------ | ------------- | ----------- | -------------------- |
| 10 empresas  | 50            | ~R$ 90 mil  | R$ 270 mil – 540 mil |
| 50 empresas  | 80            | ~R$ 580 mil | R$ 1,7 mi – 3,5 mi   |
| 200 empresas | 100           | ~R$ 2,9 mi  | R$ 8,7 mi – 17 mi    |

**Leitura senior:** o ativo de código hoje vale, como reposição, algo em torno
de **R$ 450–900 mil**. O potencial real está no modelo SaaS: com compliance
homologado e 30–50 clientes, é um negócio de **R$ 1–3 milhões** de valuation.
O que separa o "código pronto" do "negócio valioso" é: homologação legal +
confiabilidade operacional (backup/monitoramento) + prova comercial (clientes
pagantes).

---

## 10. Sugestões nível "NASA" (senior eng + senior RH)

### Engenharia / confiabilidade

- **Backup offsite cifrado + restore-test automatizado** (RPO/RTO definidos).
- **Observabilidade real**: Grafana + Prometheus/Loki; alertas de SLA.
- **Staging + CI/CD de deploy** com aprovação; nunca mais deploy manual.
- **Feature flags** para ligar/desligar recursos por cliente sem redeploy.
- **Rate limiting por tenant** e **quotas** (evita abuso e mede uso p/ cobrança).
- **Chaos/DR drill trimestral** (simular queda do banco e recuperar).
- **Gestão de segredos** (Vault/Doppler) em vez de `.env` no servidor.
- **Assinatura em HSM** quando escalar (chave Ed25519 fora do disco).

### Segurança (nível empresa)

- **Pentest externo anual** + programa de bug bounty leve.
- **WAF** na frente (Cloudflare) + proteção DDoS.
- **MFA obrigatório** para todos os admins; trilha de auditoria imutável em
  storage WORM.
- **Revisão de acesso** periódica (quem pode o quê) e princípio do menor
  privilégio já aplicado (bom sinal: role `repp_super` sem dados operacionais).

### Produto / RH (onde o RH sênior agrega)

- **Motor de jornadas flexível**: 12×36, turnos, escala de obra, intervalo
  intrajornada, DSR — regras da CLT parametrizáveis por acordo coletivo.
- **Banco de horas com validade e compensação automática** + alertas de
  estouro do limite legal (2h/dia).
- **Gestão de horas extras** com aprovação e adicional noturno/insalubridade.
- **Absenteísmo e indicadores de RH**: turnover, atestados, taxa de atraso —
  dashboards que o RH usa para decisão.
- **Autoatendimento do colaborador**: contracheque, informe de rendimentos,
  solicitação de documentos — reduz carga do RH.
- **Fluxo de aprovação configurável** (gestor → RH) para ajustes e ausências.
- **Integração eSocial + folha** de ponta a ponta (o maior valor para o cliente).
- **Onboarding/offboarding** de colaborador com checklist e trilha.
- **Acessibilidade WCAG AA** (obra tem trabalhador de todo perfil).

---

## 11. Conclusão

O .GRAMO é um sistema **sério e real** — não é protótipo. A base técnica
(segurança, multi-tenant, compliance no código) está num patamar acima da média
de mercado. Os gaps para "nível empresa NASA" são conhecidos e **em sua maioria
não são de código, e sim de processo**: homologação legal, confiabilidade
operacional (backup/monitoramento), e prova em testes E2E/carga.

Ordem recomendada para chegar lá:

1. Confiabilidade (backup offsite + monitoramento) — barato, alto impacto.
2. Testes E2E de UI + carga — trava regressões antes de crescer.
3. Homologação legal (gov.br + ICP-Brasil) — destrava a venda.
4. Features de RH de alto valor (jornadas/eSocial/indicadores).
