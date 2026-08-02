-- =============================================================================
-- REP-P - Row Level Security (isolamento multi-tenant no NIVEL DO BANCO)
--
-- Modelo de duas roles (essencial para RLS funcionar):
--  * repp_owner : dona das tabelas. Roda `prisma migrate` e ESTE script (DDL).
--  * repp_app   : role NOSUPERUSER que a API usa. RLS e aplicado a ela.
--    Superuser/owner-sem-FORCE ignoram RLS -- por isso a app NUNCA conecta como
--    owner, e usamos FORCE abaixo.
--
-- Como funciona:
--  * A aplicacao, a cada transacao, executa:
--        SET LOCAL app.current_empresa_id = '<uuid-da-empresa>';
--    (feito pelo PrismaService/TenantMiddleware da API).
--  * Cada policy compara empresa_id com esse valor de sessao.
--
-- Pontos criticos (por isso este arquivo existe separado do schema.prisma):
--  1. FORCE ROW LEVEL SECURITY: sem isto, o DONO das tabelas ignora RLS.
--  2. repp_app NAO tem BYPASSRLS nem superuser (ver docker/postgres-init.sql).
--  3. IMUTABILIDADE: em `pontos`, `pontos_ajustes`, `logs_auditoria` e
--     `consentimentos_lgpd` revogamos UPDATE/DELETE de repp_app -- append-only
--     por contrato E por permissao de banco (defesa em profundidade).
--
-- Aplicar como repp_owner APOS `prisma migrate deploy` (tabelas devem existir).
-- Script: `npm run db:rls` (apps/api).
-- =============================================================================

-- Concede a role da app o acesso de dados (as tabelas ja existem apos migrate).
GRANT USAGE ON SCHEMA public TO repp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO repp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO repp_app;
-- Vale tambem para tabelas/sequences criadas em migrations futuras.
ALTER DEFAULT PRIVILEGES FOR ROLE repp_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO repp_app;
ALTER DEFAULT PRIVILEGES FOR ROLE repp_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO repp_app;

-- Helper: le a empresa corrente da sessao; NULL se nao setada.
CREATE OR REPLACE FUNCTION app_current_empresa_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_empresa_id', true), '')::uuid;
$$;

-- ---------------------------------------------------------------------------
-- Macro manual: para cada tabela com coluna empresa_id, habilita e forca RLS
-- e cria policy de isolamento. `empresas` usa a propria coluna `id`.
-- ---------------------------------------------------------------------------

-- Tabela raiz do tenant: filtra pelo proprio id.
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON empresas;
CREATE POLICY tenant_isolation ON empresas
  USING (id = app_current_empresa_id())
  WITH CHECK (id = app_current_empresa_id());

-- Demais tabelas: filtram por empresa_id.
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'filiais',
    'usuarios_admin',
    'admin_filial_acesso',
    'funcionarios',
    'regap',
    'contadores_nsr',
    'pontos',
    'pontos_ajustes',
    'justificativas_autorizacoes',
    'consentimentos_lgpd',
    'logs_auditoria',
    'convites',
    'refresh_tokens',
    'logs_acesso',
    'tokens_recuperacao',
    'documentos',
    'documentos_assinatura',
    'assinaturas_virtuais',
    'exportacoes_afd_aej',
    'jornadas',
    'feriados',
    'ferias_afastamentos',
    'contestacoes_ponto',
    'comunicados',
    'comunicados_leitura',
    'chaves_api',
    'integracoes_config',
    'ajustes_banco_horas'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (empresa_id = app_current_empresa_id())
         WITH CHECK (empresa_id = app_current_empresa_id());',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Imutabilidade (append-only) na role da aplicacao (repp_app).
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON pontos              FROM repp_app;
REVOKE UPDATE, DELETE ON pontos_ajustes      FROM repp_app;
REVOKE UPDATE, DELETE ON logs_auditoria      FROM repp_app;
REVOKE UPDATE, DELETE ON consentimentos_lgpd FROM repp_app;
REVOKE UPDATE, DELETE ON logs_acesso         FROM repp_app;
REVOKE UPDATE, DELETE ON assinaturas_virtuais FROM repp_app;
REVOKE UPDATE, DELETE ON exportacoes_afd_aej   FROM repp_app;
REVOKE UPDATE, DELETE ON ajustes_banco_horas   FROM repp_app;

-- Gatilho de defesa extra: bloqueia UPDATE/DELETE em `pontos` mesmo que a
-- permissao seja concedida por engano no futuro.
CREATE OR REPLACE FUNCTION bloqueia_mutacao_ponto() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Registro de ponto e imutavel (Portaria 671). Use pontos_ajustes.';
END $$;

DROP TRIGGER IF EXISTS trg_pontos_imutavel ON pontos;
CREATE TRIGGER trg_pontos_imutavel
  BEFORE UPDATE OR DELETE ON pontos
  FOR EACH ROW EXECUTE FUNCTION bloqueia_mutacao_ponto();

-- ---------------------------------------------------------------------------
-- Resolucao de empresa por subdominio (unica leitura cross-tenant legitima).
-- No login, ainda nao ha tenant no contexto -- precisamos descobrir a empresa
-- a partir do subdominio ANTES de autenticar. SECURITY DEFINER roda como o
-- dono da funcao (repp_owner), que ignora RLS, e devolve APENAS metadados de
-- roteamento (id e status) -- nunca razao social, CNPJ ou dado operacional.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resolve_empresa_by_subdominio(p_subdominio text)
RETURNS TABLE(id uuid, status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.status::text
  FROM empresas e
  WHERE e.subdominio = p_subdominio;
$$;

REVOKE ALL ON FUNCTION resolve_empresa_by_subdominio(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_empresa_by_subdominio(text) TO repp_app;

-- ===========================================================================
-- SUPER ADMIN (ADM 0) - isolamento no NIVEL DO BANCO.
-- A role repp_super gerencia a PLATAFORMA (empresas, planos, faturas) mas tem
-- privilegio REVOGADO nas tabelas operacionais (biometria/ponto/documentos).
-- Metricas de uso vem so por funcao SECURITY DEFINER (agregados, nao os dados).
-- ===========================================================================
GRANT USAGE ON SCHEMA public TO repp_super;

-- Acesso as tabelas de PLATAFORMA.
GRANT SELECT, INSERT, UPDATE, DELETE ON super_admins        TO repp_super;
GRANT SELECT, INSERT, UPDATE, DELETE ON super_refresh_tokens TO repp_super;
GRANT SELECT, INSERT, UPDATE, DELETE ON planos              TO repp_super;
GRANT SELECT, INSERT, UPDATE, DELETE ON faturas             TO repp_super;
GRANT SELECT, INSERT, UPDATE, DELETE ON logs_super_admin    TO repp_super;
-- Super gerencia empresas (cadastrar/ativar/suspender), mas nao dados dentro delas.
GRANT SELECT, INSERT, UPDATE ON empresas TO repp_super;

-- As tabelas de plataforma NAO sao operacionais do tenant: a role da app (repp_app)
-- recebeu acesso pelo GRANT ON ALL TABLES acima -> revogamos explicitamente.
REVOKE ALL ON super_admins, super_refresh_tokens, planos, faturas, logs_super_admin FROM repp_app;

-- Barreira dura: repp_super NUNCA acessa dados operacionais (defesa em profundidade;
-- alem de nunca ter sido concedido, revogamos explicitamente).
REVOKE ALL ON funcionarios, pontos, pontos_ajustes, justificativas_autorizacoes,
  consentimentos_lgpd, documentos, documentos_assinatura, assinaturas_virtuais,
  regap, contadores_nsr, convites, refresh_tokens, tokens_recuperacao,
  logs_acesso, logs_auditoria, usuarios_admin, admin_filial_acesso,
  exportacoes_afd_aej, filiais, jornadas, feriados, ferias_afastamentos,
  contestacoes_ponto, comunicados, comunicados_leitura, chaves_api, integracoes_config
  FROM repp_super;

-- empresas tem FORCE RLS; a policy de tenant retornaria 0 linhas p/ o super (sem
-- tenant). Policy permissiva propria: o super ve TODAS as empresas.
DROP POLICY IF EXISTS super_ve_empresas ON empresas;
CREATE POLICY super_ve_empresas ON empresas TO repp_super USING (true) WITH CHECK (true);

-- logs_super_admin e append-only.
REVOKE UPDATE, DELETE ON logs_super_admin FROM repp_super;

-- Metricas de uso (agregados) sem expor dados operacionais ao super.
CREATE OR REPLACE FUNCTION metricas_uso_empresa(p_empresa uuid)
RETURNS TABLE(funcionarios_ativos int, marcacoes_mes int, documentos int)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM funcionarios f
       WHERE f.empresa_id = p_empresa AND f.status = 'ATIVO'::"StatusFuncionario"),
    (SELECT count(*)::int FROM pontos p
       WHERE p.empresa_id = p_empresa AND p.registrado_em >= date_trunc('month', now())),
    (SELECT count(*)::int FROM documentos d WHERE d.empresa_id = p_empresa);
$$;

REVOKE ALL ON FUNCTION metricas_uso_empresa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION metricas_uso_empresa(uuid) TO repp_super;
