import { readFileSync } from 'node:fs';

/**
 * Converte um certificado ICP-Brasil A1 (.p12/.pfx) em base64 para o .env.
 * Uso: node scripts/preparar-certificado.mjs caminho/do/certificado.p12
 * Depois cole a saida em ASSINATURA_P12_BASE64 e defina ASSINATURA_P12_SENHA.
 */
const caminho = process.argv[2];
if (!caminho) {
  console.error('Uso: node scripts/preparar-certificado.mjs <arquivo.p12>');
  process.exit(1);
}
try {
  const base64 = readFileSync(caminho).toString('base64');
  console.log('ASSINATURA_P12_BASE64=' + base64);
  console.error(`\n>> ${base64.length} chars. Cole no .env e defina ASSINATURA_P12_SENHA (a senha do .p12).`);
} catch (e) {
  console.error('Falha ao ler o certificado:', e.message);
  process.exit(1);
}
