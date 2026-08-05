# VISÃO ENTERPRISE — REP-P para contexto Petrobras

> Documento vivo. O que um **gerente de uma empresa dentro da Petrobras** espera de
> um sistema de ponto, e o que um **time de engenharia sênior (30+ anos)** entrega —
> não só ideias, mas **soluções** amarradas à stack real (NestJS 11 / Prisma /
> PostgreSQL+RLS / React PWA). Legenda: ✅ já existe · 🟡 parcial · 🆕 novo.
>
> Postura de honestidade: itens marcados 👤 dependem de contratação/ato externo
> (não há código que resolva). Segurança/conformidade **de verdade** exige
> validação externa (pentest, homologação gov.br, jurídico) — este plano prepara o
> terreno para ser auditável, não promete perfeição.

---

## A. Conformidade legal e trabalhista (o que trava contrato)

| #   | Expectativa do gerente                                                                    | Solução de engenharia                                                                                                                                                           | Estado                                  |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| A1  | Ponto com **validade legal** (Portaria MTP 671/2021, REP-P)                               | AFD/AEJ leiaute fixo, NSR sequencial por estabelecimento, comprovante **PAdES-B** com Ed25519; homologar no **verificador oficial gov.br** 👤                                   | 🟡 (código pronto; homologação externa) |
| A2  | **Registro imutável** (não dá pra "ajustar" ponto)                                        | `UPDATE/DELETE` revogados no banco + trigger; correção = `pontos_ajustes` vinculado (autor/motivo/valor anterior)                                                               | ✅                                      |
| A3  | **eSocial** (eventos S-1200/S-1210/jornada)                                               | `IntegracoesModule` hoje é config/stub → 🆕 conector real: fila de eventos + assinatura XML ICP-Brasil + retry/backoff + reconciliação de recibos                               | 🟡                                      |
| A4  | **CLT/CCT**: banco de horas, DSR, adicional noturno, intervalo intrajornada, horas extras | `banco-horas` calcula saldo/regime; 🆕 completar: adicional noturno (22h–5h), DSR, feriados por CCT, limites por acordo coletivo configuráveis                                  | 🟡                                      |
| A5  | **LGPD** (biometria = dado sensível)                                                      | Consentimento separado, AES-256-GCM em repouso, soft-delete/guarda 5 anos; 🆕 **portal do titular** (acesso/portabilidade/eliminação), **ROPA** e **DPIA** documentados, DPO 👤 | 🟡                                      |
| A6  | **Guarda de 5 anos + fiscalização**                                                       | Exportações imutáveis (append-only) + pacote de fiscalização (AFD+AEJ+trilha); 🆕 política de retenção automatizada + legal hold                                                | ✅/🟡                                   |
| A7  | **Acessibilidade** (setor público exige)                                                  | 🆕 conformidade **WCAG 2.1 AA** + **eMAG** (gov.br): auditar com axe-core no CI, leitor de tela, navegação por teclado (base de a11y já iniciada na Fase C)                     | 🟡                                      |

---

## B. Segurança e AppSec (o filtro da Petrobras)

| #   | Expectativa                                                | Solução                                                                                                                                       | Estado |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| B1  | **Isolamento entre empresas** garantido                    | Row Level Security no Postgres (`SET LOCAL` por transação) — falha de código não vaza dado                                                    | ✅     |
| B2  | **Autenticação corporativa (SSO)** — ninguém quer +1 senha | 🆕 **SAML 2.0 / OIDC** contra Azure AD/Keycloak; SCIM para provisionamento; manter CPF+senha só para funcionário de campo                     | 🆕     |
| B3  | **2FA/MFA** obrigatório para admin                         | TOTP já implementado (otplib), segredo cifrado; 🆕 opção WebAuthn/passkey                                                                     | ✅/🟡  |
| B4  | **Gestão de segredos** (não em `.env`)                     | 🆕 **Vault/AWS KMS/Azure Key Vault** + rotação; `chaveServidorId` já versiona a chave de assinatura                                           | 🟡     |
| B5  | **OWASP Top 10 coberto + pentest**                         | helmet, ValidationPipe whitelist, sem SQL injection, IDOR corrigido, rate-limit; 👤 **pentest profissional** + revisão anual                  | 🟡     |
| B6  | **SAST/DAST/SCA no pipeline**                              | 🆕 CI com **CodeQL/Semgrep** (SAST), **OWASP ZAP** (DAST), **`npm audit`/Dependabot/Renovate** (SCA), **gitleaks** (segredos) — gate de merge | 🆕     |
| B7  | **Criptografia forte**                                     | Argon2id (senha), AES-256-GCM (biometria/docs), Ed25519 (assinatura), TLS terminado no proxy (HSTS via helmet)                                | ✅     |
| B8  | **Trilha de auditoria à prova de adulteração**             | `LogAuditoria` append-only; 🆕 **hash-chain** (cada log referencia o hash do anterior) → detecta remoção; export assinado                     | 🟡     |
| B9  | **Hardening de infra**                                     | 🆕 imagens Docker distroless + non-root, read-only FS, scan Trivy, WAF, rate-limit no edge, fail2ban                                          | 🆕     |

---

## C. Arquitetura, escala e resiliência

| #   | Expectativa                                                | Solução                                                                                                                                                                    | Estado        |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| C1  | **Alta disponibilidade** (99,9%)                           | 🆕 API stateless em ≥2 réplicas atrás de load balancer; Postgres com **réplica + failover** (Patroni/RDS Multi-AZ); health `/live`+`/ready` já existem para o orquestrador | ✅(health)/🆕 |
| C2  | **Escala horizontal**                                      | API sem estado (JWT); 🆕 mover sessão/refresh/rate-limit para **Redis**; storage de arquivo já abstrai **S3/R2**                                                           | 🟡            |
| C3  | **Processamento assíncrono** (folha, AFD, e-mail, eSocial) | 🆕 **fila (BullMQ/Redis ou SQS)** para jobs pesados; hoje é síncrono no request                                                                                            | 🆕            |
| C4  | **Cache** de leituras quentes (dashboard, REGAP)           | 🆕 Redis/`@nestjs/cache-manager` com invalidação por tenant                                                                                                                | 🆕            |
| C5  | **Sem downtime em deploy**                                 | 🆕 **blue-green/rolling** + migrations expand-contract (nunca quebra schema em uso); shutdown gracioso já implementado (Fase D)                                            | 🟡            |
| C6  | **Multi-região / data residency** (dado no Brasil)         | 👤 hospedagem BR; 🆕 desenho para sharding por tenant se crescer                                                                                                           | 🆕            |

---

## D. Qualidade de engenharia (o que sênior não abre mão)

| #   | Expectativa                         | Solução                                                                                                                                                                                  | Estado |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| D1  | **Pirâmide de testes**              | shared/api com unit + e2e (RLS/NSR/imutabilidade); 🆕 **testes de frontend = zero hoje** → cobrir bater ponto, sync offline, login/permissão (vitest + testing-library + fake-indexeddb) | 🟡     |
| D2  | **Testes de integração de negócio** | e2e contra Postgres real; 🆕 ampliar: fluxo ponto→exceção→aprovação, assinatura, fechamento                                                                                              | 🟡     |
| D3  | **CI/CD robusto**                   | CI já roda build/lint/format/unit/e2e; 🆕 add SAST/DAST/coverage gate, **CD** (deploy automático por tag), ambientes dev/staging/prod                                                    | 🟡     |
| D4  | **Infra como código**               | 🆕 **Terraform** (VPS/rede/DB) + **Ansible/compose** versionado; hoje deploy é manual documentado (DEPLOY.md)                                                                            | 🟡     |
| D5  | **Anti-drift de schema**            | 🆕 `prisma migrate diff` no CI (migrations são à mão → risco de divergência silenciosa)                                                                                                  | 🆕     |
| D6  | **Feature flags + rollback**        | 🆕 flags (Unleash/env) para ligar features por tenant sem redeploy                                                                                                                       | 🆕     |
| D7  | **Padrões e revisão**               | TypeScript strict, ESLint/Prettier/Husky já ativos; 🆕 **ADRs** (registro de decisões), CODEOWNERS, template de PR, revisão obrigatória                                                  | 🟡     |
| D8  | **Documentação de API**             | Swagger/OpenAPI (dev); 🆕 publicar spec versionada + SDK gerado para integradores                                                                                                        | 🟡     |

---

## E. Dados, confiabilidade e continuidade (DR)

| #   | Expectativa                     | Solução                                                                                                                                                           | Estado |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| E1  | **Backup + restore testado**    | 🟡 `pg_dump` diário documentado; 🆕 **PITR** (WAL archiving), retenção, **teste de restore automatizado** (backup que não restaura não existe)                    | 🟡     |
| E2  | **RTO/RPO definidos**           | 🆕 metas (ex.: RPO 15min, RTO 1h) + runbook de DR ensaiado                                                                                                        | 🆕     |
| E3  | **Retenção legal 5 anos**       | Soft-delete + append-only; 🆕 arquivamento frio (S3 Glacier) + legal hold                                                                                         | 🟡     |
| E4  | **Observabilidade**             | Logs estruturados (`LOG_JSON`) + requestId; 🆕 **métricas (Prometheus)** + **dashboards (Grafana)** + **tracing (OpenTelemetry)** + **alertas** + **status page** | 🟡     |
| E5  | **Detecção de fraude/anomalia** | 🆕 alertas: geo improvável, foto ausente recorrente, picos de exceção, banco de horas estourando                                                                  | 🆕     |

---

## F. Experiência do usuário (o que faz adotar)

| #   | Expectativa                                     | Solução                                                                                                  | Estado |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| F1  | **Funcionário de campo** (sol, luva, sem sinal) | Uma ação dominante, offline-first, toque ≥44px, feedback claro (Fase C)                                  | ✅     |
| F2  | **Onboarding sem fricção**                      | Hoje: código+CPF+senha; 🆕 **link mágico/QR** + deep-link, reduzir passos                                | 🟡     |
| F3  | **Notificação onde a pessoa está**              | Hoje e-mail (stub); 🆕 **push PWA + WhatsApp Business API + SMS** (aprovação, contestação, doc vencendo) | 🆕     |
| F4  | **RH orientado a decisão**                      | Painel denso, filas de exceção, Kpi (Fase C); 🆕 **exportação Excel** e relatório gerencial amigável     | 🟡     |
| F5  | **Acessibilidade + i18n**                       | a11y iniciada; 🆕 WCAG AA auditado + PT/EN (multinacional)                                               | 🟡     |
| F6  | **White-label** (logo/cor do cliente)           | 🆕 tema por tenant (tokens CSS já centralizados → baixo custo)                                           | 🆕     |

---

## G. Operação, suporte e governança

| #   | Expectativa                              | Solução                                                                                   | Estado |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| G1  | **SLA + suporte**                        | 🆕 SLA contratual, on-call, runbooks, base de conhecimento                                | 🆕     |
| G2  | **Gestão de incidentes**                 | 🆕 processo (sev1–4), post-mortem sem culpa, status page pública                          | 🆕     |
| G3  | **Painel do Super Admin** (SaaS)         | Empresas/planos/faturas/uso/auditoria própria já existem                                  | ✅     |
| G4  | **Faturamento real**                     | `gatewayRef` stub; 🆕 integrar gateway (Stripe/PagSeguro/boleto) + régua de inadimplência | 🟡     |
| G5  | **Contratos e compliance de fornecedor** | 👤 DPA (LGPD), ISO 27001/SOC2 (roadmap), due diligence de fornecedor Petrobras            | 🆕     |

---

## H. Integrações corporativas (o que "prende" o cliente grande)

| #   | Expectativa                             | Solução                                                                    |
| --- | --------------------------------------- | -------------------------------------------------------------------------- |
| H1  | **SSO Azure AD / Keycloak (SAML/OIDC)** | 🆕 `passport-saml`/OIDC, SCIM p/ provisionar/desprovisionar automático     |
| H2  | **Folha (Senior, TOTVS, SAP)**          | 🆕 exportador de horas/eventos + API de integração (chave já existe)       |
| H3  | **eSocial**                             | 🆕 conector com fila, assinatura e reconciliação                           |
| H4  | **BI corporativo (Power BI)**           | 🆕 endpoint/dataset read-only por tenant, sem tocar dado operacional bruto |
| H5  | **Catraca/relógio físico / crachá NFC** | 🆕 API de ingestão de marcações de dispositivos homologados                |

---

## I. Features de produto para "surpreender" (base já existe)

1. 🆕 **Painel de presença em tempo real** — "quem está trabalhando agora", por filial, no telão do RH (WebSocket/SSE; dado já existe no dashboard).
2. 🆕 **Modo Quiosque** — tablet na portaria; ponto por CPF+foto para quem não tem celular (captura já existe).
3. 🆕 **Push PWA** — exceção aprovada, contestação respondida, documento vencendo (base PWA pronta).
4. 🆕 **Reconhecimento facial com liveness** — hoje é captura+storage; ativar _matching_ vira identificação real (com DPA/LGPD e opt-in).
5. 🆕 **Alerta proativo de horas extras / banco estourando** — antes de virar passivo trabalhista (cálculo já existe).
6. 🆕 **Geofence inteligente** — lembrete de bater ponto ao entrar/sair da REGAP.
7. 🆕 **Assistente do RH** — resumo diário: pendências, faltas, aniversários de admissão, docs vencendo.

---

## Plano de implementação (ondas — impacto × esforço × risco)

**Onda 1 — "uau" barato e visível (2–4 semanas):**
`I1 painel presença em tempo real` + `I3 push PWA` + `I2 quiosque` + `F4 exportação Excel`.
Base já existe; alto impacto de demonstração; risco baixo.

**Onda 2 — confiabilidade de produção (paralelo):**
`E4 observabilidade` + `E1 backup PITR/restore testado` + `D1 testes de frontend` +
`B6 SAST/DAST/Renovate no CI` + `D5 anti-drift`. É o que sustenta operar de verdade.

**Onda 3 — corporativo/venda grande:**
`B2 SSO SAML/OIDC` + `H2 folha` + `A3/H3 eSocial real` + `C2/C3 Redis+fila` +
`B4 KMS`. É o que abre a conta Petrobras.

**Onda 4 — conformidade legal (👤 + engenharia):**
`A1 homologação gov.br` + ICP-Brasil + `B5 pentest` + `A5 portal do titular LGPD` +
`A7 WCAG/eMAG`. É o que dá validade e blinda juridicamente.

**Onda 5 — diferenciação:**
`I4 facial liveness` + `A4 CLT completa (adic. noturno/DSR)` + `F6 white-label` +
`H4 Power BI`.

---

## O que **não** é código (não vendo ilusão)

Pentest profissional, homologação AFD/AEJ no gov.br, certificado ICP-Brasil,
revisão LGPD por jurídico + DPO, ISO 27001/SOC2, contratos/DPA, e a decisão de
negócio sobre facial com biometria (impacto LGPD). Preparo o terreno; a validação
é externa e contínua — segurança é processo, não estado final.
