// Política de senha (RF01/RF07) — espelho de backend/validacao-cadastro.js.
//
// Não há build compartilhado entre o Vite e o Node, então são dois arquivos:
// ao mexer em um, mexa no outro. A checagem daqui é só para avisar o usuário
// antes do envio; a regra que vale é a do servidor.

/** Mensagem de erro se a senha não segue a política, ou null se segue. */
export function erroDeSenha(senha: string): string | null {
  if (senha.length < 8) return 'A senha deve ter no mínimo 8 caracteres.';
  if (!/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) return 'A senha deve conter letras e números.';
  return null;
}
