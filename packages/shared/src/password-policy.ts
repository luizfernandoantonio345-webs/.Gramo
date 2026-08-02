/**
 * Politica de senha (Tela 1): minimo 8 caracteres, exige letra + numero.
 *
 * Regra compartilhada back+front para dar o MESMO feedback nos dois lados.
 * O backend e a autoridade final (valida de novo antes de gravar o hash).
 */

export const SENHA_TAMANHO_MINIMO = 8;

export interface ResultadoValidacaoSenha {
  valido: boolean;
  erros: string[];
}

export function validarSenha(senha: string): ResultadoValidacaoSenha {
  const erros: string[] = [];
  const valor = senha ?? '';

  if (valor.length < SENHA_TAMANHO_MINIMO) {
    erros.push(`A senha deve ter ao menos ${SENHA_TAMANHO_MINIMO} caracteres.`);
  }
  if (!/[a-zA-Z]/.test(valor)) {
    erros.push('A senha deve conter ao menos uma letra.');
  }
  if (!/[0-9]/.test(valor)) {
    erros.push('A senha deve conter ao menos um numero.');
  }

  return { valido: erros.length === 0, erros };
}
