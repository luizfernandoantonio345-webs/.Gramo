-- Adiciona campo opcional de imagem (base64 data-URL) ao comunicado.
-- Permite ao RH anexar artes de DDS, banners ou qualquer imagem ao comunicado.
ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS imagem TEXT;
