# Relatório de auditoria de segurança — .GRAMO (1ª passada interna)

> Auditoria **interna** (código + testes) feita pelo próprio time de
> desenvolvimento. **NÃO substitui um pentest externo formal** — que continua
> recomendado antes do go-live para um cliente enterprise. Data: fase-b.

## Método

- Baseline de testes (unitários + e2e de banco + e2e HTTP).
- Revisão de **autorização/IDOR/BOLA** e **isolamento de tenant/filial**.
- Revisão de **autenticação** (rate limit, lockout, 2FA, JWT).
- **Imutabilidade** e barreira do super admin (via e2e de banco).
- **LGPD** (consentimento de biometria).
- **Dependências** (`npm audit`).

## Baseline (tudo verde)

- Unitários: **58 (API) + 81 (shared)**.
- e2e de banco (`npm run test:e2e`): RLS (isolamento entre empresas), NSR
  sequencial sob concorrência, **imutabilidade do ponto** (UPDATE/DELETE negados
  a `repp_app`), barreira do super admin (não vê dados operacionais).
- e2e HTTP (`npm run test:e2e:http`): **8/8** (login, LGPD, batida, facial, AFD).

## Achados

| Sev.  | Área         | Achado                                                                                                                                                                                | Status                                              |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Médio | IDOR/BOLA    | `GET /admin/funcionarios/:id/documentos` não validava escopo de **filial** (RLS isola por empresa, não por filial) → gestor de uma obra lia documentos de outra obra da mesma empresa | **Corrigido** `c901fbd`                             |
| Médio | Auth         | Rotas de auth (login/2FA/refresh) só tinham o limite global (300/min, folgado p/ quiosque) → brute force / credential stuffing                                                        | **Corrigido** `c901fbd` (`@Throttle` 10/min por IP) |
| Médio | Upload/DoS   | Campos `fotoBase64` sem limite de tamanho próprio (só o global de 25 MB)                                                                                                              | **Corrigido** `108ea49` (`@MaxLength` ~2,5 MB)      |
| —     | Dependências | Produção: **0 vulnerabilidades**. Dev tooling: 6 (1 crítica/1 alta), **não expostas em produção**                                                                                     | Monitorar (`npm audit`)                             |

> Nota (revisão): o suposto "download de AFD sem escopo de filial" foi
> **descartado como falso positivo** — a controller de exportações é
> `@Roles(RH_MASTER, AUDITORIA)` (papéis de empresa; GESTOR_FILIAL nem alcança) e
> a exportação é um artefato de **empresa** (sem `filialId` por design). Isolada
> por tenant via RLS. Ver "Verificado como OK".

## Verificado como OK (com evidência)

- **Isolamento de tenant (RLS):** `repp_app` (NOSUPERUSER, NOBYPASSRLS) só vê a
  própria empresa; sem contexto de tenant → 0 linhas. Cross-tenant IDOR
  **mitigado pelo RLS** (findFirst por id de outra empresa retorna vazio).
- **Escopo de filial:** todas as demais rotas de funcionário/ponto/relatório
  aplicam `exigirFilial`/`filiaisPermitidas` (só `documentos` estava de fora — já
  corrigido).
- **Imutabilidade do ponto:** trigger no banco bloqueia UPDATE/DELETE (e2e).
- **Super admin:** não acessa pontos/funcionários/documentos/biometria (e2e).
- **Auth:** 2FA com fail-fast em produção (`DEV_BYPASS_2FA` proibido), lockout de
  conta (5/15min), JWT de vida curta + refresh com rotação; helmet nos headers.
- **LGPD:** biometria exige consentimento explícito (`ConsentimentoLgpd`,
  append-only) antes do cadastro do rosto; imagem cifrada em repouso.
- **Exportações (AFD/AEJ):** restritas a `RH_MASTER`/`AUDITORIA` (papéis de
  empresa); artefato de empresa (sem `filialId`); isoladas por tenant (RLS).
- **IDOR multi-filial:** teste de regressão no e2e HTTP prova que um
  GESTOR_FILIAL restrito à obra A recebe **403** ao ler documentos/foto de
  referência de um funcionário da obra B, e **200** dentro do seu escopo.

## Aberto / recomendações

1. **CSP no front (nginx/PWA):** helmet cobre a API (JSON); o HTML do PWA é
   servido pelo nginx — vale adicionar uma Content-Security-Policy lá.
2. **`npm audit fix`** no dev tooling e rotina de atualização de dependências.
3. **Pentest externo** antes do go-live (ver seção final).

## O que NÃO foi coberto (honestidade)

Esta é uma auto-auditoria de **primeira passada**. Não substitui:

- **Pentest externo** por empresa idônea (recomendado antes do go-live — e vira
  argumento de venda).
- **Homologação gov.br / laudo INMETRO** do REP-P; **assinatura ICP-Brasil** do
  AFD; **liveness facial** (anti "foto de foto").
- Fuzzing, análise dinâmica (DAST) e revisão aprofundada de XSS nos PDFs/mapa.
