import axios from 'axios';
import { API_URL } from './config';
import { getAccessToken, setAccessToken } from './session';
import type { RespostaSessao } from '../types/api';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  // O refresh token vai num cookie HttpOnly: o navegador precisa enviá-lo.
  withCredentials: true,
});

const ehRotaDeAutenticacao = (url?: string) =>
  Boolean(url && (url.includes('/auth/refresh') || url.includes('/auth/logout') || url.includes('/login')));

// Renovação da sessão (RNF04), uma de cada vez para o app inteiro.
//
// O refresh token é rotacionado a cada uso. Se duas renovações saem juntas (a
// restauração ao abrir a página e um 401 de uma tela que já buscou dados), a
// segunda chega com o token já gasto, falha e manda o usuário ao login mesmo
// logado. Por isso todos esperam a mesma promessa.
let renovacao: Promise<RespostaSessao> | null = null;

export function renovarSessao(): Promise<RespostaSessao> {
  renovacao ??= api
    .post<RespostaSessao>('/auth/refresh') // sem corpo: o token vem do cookie
    .then(({ data }) => {
      setAccessToken(data.token);
      return data;
    })
    .finally(() => {
      renovacao = null;
    });
  return renovacao;
}

// Interceptor de REQUEST: injeta headers de autenticação
api.interceptors.request.use(
  async (config) => {
    // O token só existe em memória: logo depois de abrir a página ele ainda não
    // chegou. Quem pedir dados nesse intervalo espera a restauração terminar.
    if (!getAccessToken() && renovacao && !ehRotaDeAutenticacao(config.url)) {
      await renovacao.catch(() => undefined);
    }

    const token = getAccessToken();
    const userId = localStorage.getItem('userId');

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    if (userId) {
      config.headers['X-User-Id'] = userId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de RESPONSE: renovação silenciosa quando o token expira (RNF04)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Se recebeu 401 e ainda não tentou renovar (rotas de autenticação não renovam)
    if (error.response?.status === 401 && !originalRequest._retry && !ehRotaDeAutenticacao(originalRequest.url)) {
      originalRequest._retry = true;
      try {
        const { token } = await renovarSessao();
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Renovação falhou: limpa a sessão e manda ao login
        setAccessToken(null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
