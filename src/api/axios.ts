import axios from 'axios';
import { getAccessToken, setAccessToken } from './session';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  withCredentials: true,
});

// Flag para evitar múltiplas tentativas de refresh simultâneas
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Interceptor de REQUEST: injeta headers de autenticação
api.interceptors.request.use(
  (config) => {
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

// Interceptor de RESPONSE: renovação silenciosa via refresh token (RNF04)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Se recebeu 401 e ainda não tentou refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Não tenta refresh nas rotas de autenticação
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/logout') || originalRequest.url?.includes('/login')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Se já está fazendo refresh, enfileira a requisição
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await api.post('/auth/refresh');

        const { token: newToken } = response.data;

        setAccessToken(newToken);
        localStorage.removeItem('refreshToken');

        // Atualiza o header da requisição original
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;

        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Refresh falhou: limpa sessão e redireciona
        setAccessToken(null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
