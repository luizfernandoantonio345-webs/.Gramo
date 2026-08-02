-- B2: Banco de horas completo (regimes configuraveis + razao de ajustes).

-- Regimes de tratamento do saldo de horas.
DO $$ BEGIN
  CREATE TYPE "RegimeHoras" AS ENUM ('COMPENSACAO_MENSAL', 'BANCO_ANUAL', 'HORA_EXTRA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TipoAjusteBanco" AS ENUM ('COMPENSACAO', 'CREDITO_MANUAL', 'DEBITO_MANUAL', 'PAGAMENTO_EXTRA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Configuracao de regime por jornada.
ALTER TABLE jornadas
  ADD COLUMN IF NOT EXISTS regime_horas "RegimeHoras" NOT NULL DEFAULT 'COMPENSACAO_MENSAL',
  ADD COLUMN IF NOT EXISTS limite_extra_diaria_min INT NOT NULL DEFAULT 120;

-- Razao (ledger) de ajustes/compensacoes do banco de horas.
CREATE TABLE IF NOT EXISTS ajustes_banco_horas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL REFERENCES empresas(id),
  funcionario_id     UUID NOT NULL REFERENCES funcionarios(id),
  minutos            INT NOT NULL,
  tipo               "TipoAjusteBanco" NOT NULL,
  motivo             TEXT NOT NULL,
  competencia        VARCHAR(7),
  criado_por_admin_id UUID NOT NULL REFERENCES usuarios_admin(id),
  criado_em          TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ajustes_banco_horas_empresa_funcionario_idx
  ON ajustes_banco_horas (empresa_id, funcionario_id);
CREATE INDEX IF NOT EXISTS ajustes_banco_horas_empresa_competencia_idx
  ON ajustes_banco_horas (empresa_id, competencia);
