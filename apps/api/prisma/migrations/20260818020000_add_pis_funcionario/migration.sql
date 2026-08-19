-- Portaria 671/2021: NIS (PIS/PASEP) e o identificador do empregado no AFD tipo 7.
-- Campo opcional para migracao progressiva (RH preenche conforme homologacao).
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS pis VARCHAR(11);
