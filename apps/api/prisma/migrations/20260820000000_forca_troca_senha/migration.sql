-- Protocolo de emergencia: flag de troca de senha obrigatoria no proximo login.
-- Acionado quando credenciais sao comprometidas ou compartilhadas com terceiros.
ALTER TABLE usuarios_admin ADD COLUMN IF NOT EXISTS forca_troca_senha BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE funcionarios   ADD COLUMN IF NOT EXISTS forca_troca_senha BOOLEAN NOT NULL DEFAULT false;
