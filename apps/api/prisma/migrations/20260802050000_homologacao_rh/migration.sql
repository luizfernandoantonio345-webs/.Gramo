-- B1b: contra-assinatura (homologacao) do RH no fechamento mensal.
ALTER TABLE documentos_assinatura
  ADD COLUMN IF NOT EXISTS homologado_por_admin_id UUID REFERENCES usuarios_admin(id),
  ADD COLUMN IF NOT EXISTS homologado_em TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS assinatura_rh TEXT;
