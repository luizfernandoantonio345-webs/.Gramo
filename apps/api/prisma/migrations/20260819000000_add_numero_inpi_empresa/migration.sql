-- Portaria 671 Art. 89: numero de registro do programa no INPI.
-- Obrigatorio para uso legal como REP-P. Preenchido apos obtencao do certificado INPI.
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS numero_inpi VARCHAR(7);
