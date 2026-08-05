-- Quiosque: dispositivo (tablet) que registra ponto por CPF, autenticado por
-- token de dispositivo (so o hash e guardado). Escopo por filial.
CREATE TABLE IF NOT EXISTS dispositivos_kiosk (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES empresas(id),
  filial_id           UUID NOT NULL REFERENCES filiais(id),
  nome                TEXT NOT NULL,
  token_hash          TEXT NOT NULL,
  ativo               BOOLEAN NOT NULL DEFAULT true,
  criado_por_admin_id UUID NOT NULL REFERENCES usuarios_admin(id),
  ultimo_uso_em       TIMESTAMP(3),
  criado_em           TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dispositivos_kiosk_empresa_id_idx ON dispositivos_kiosk(empresa_id);
CREATE INDEX IF NOT EXISTS dispositivos_kiosk_token_hash_idx ON dispositivos_kiosk(token_hash);
