// Endereço do backend, num lugar só.
//
// Antes "http://localhost:3000" estava escrito em cada tela. Para rodar o front
// apontando para outra máquina (ex.: o servidor do laboratório), defina
// VITE_API_URL no .env da raiz (veja .env.example). Sem ela, vale o localhost.

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** URL absoluta de um arquivo servido pelo backend (ex.: "/uploads/foto.jpg"). */
export const urlDoArquivo = (caminho: string) => `${API_URL}${caminho}`;
