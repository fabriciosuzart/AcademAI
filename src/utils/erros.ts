import axios from 'axios';

/**
 * Mensagem de erro para mostrar ao usuário: o campo "error" que o backend manda
 * no corpo da resposta, ou o texto padrão. Substitui o `catch (error: any)` com
 * `error.response?.data?.error` espalhado pelas telas.
 */
export function mensagemDeErro(erro: unknown, padrao: string): string {
  if (axios.isAxiosError(erro)) {
    const corpo = erro.response?.data as { error?: unknown } | undefined;
    if (typeof corpo?.error === 'string' && corpo.error) return corpo.error;
  }
  return padrao;
}
