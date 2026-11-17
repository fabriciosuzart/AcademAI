import React, { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import api, { renovarSessao } from '../api/axios';
import { setAccessToken } from '../api/session';
import type { RespostaSessao } from '../types/api';
import { AuthContext, type UsuarioSessao } from './authContexto';

// Sessão (RNF04): o token de acesso fica só em memória (src/api/session.ts) e o
// refresh token num cookie HttpOnly, que o JavaScript não lê. Ao abrir ou recarregar
// a página, a sessão é restaurada pedindo um token novo em /auth/refresh, pela
// mesma renovarSessao() que o interceptor usa (uma renovação por vez).

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState<UsuarioSessao | null>(null);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const login = useCallback((data: RespostaSessao) => {
    setAccessToken(data.token);
    localStorage.setItem('userId', String(data.id));
    localStorage.setItem('userName', data.name);
    localStorage.setItem('userEmail', data.email);
    localStorage.setItem('userRole', data.role);
    // Restos da versão antiga, que guardava os tokens no localStorage.
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');

    setIsLoggedIn(true);
    setUser({
      id: String(data.id),
      name: data.name,
      email: data.email,
      role: data.role,
    });
  }, []);

  useEffect(() => {
    localStorage.removeItem('token');
    let active = true;
    renovarSessao()
      .then((data) => {
        if (active) login(data);
      })
      .catch(() => {
        if (active) {
          setAccessToken(null);
          localStorage.removeItem('userId');
          localStorage.removeItem('userName');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('userRA');
          localStorage.removeItem('userRole');
          setIsLoggedIn(false);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setIsAuthLoading(false);
      });
    return () => { active = false; };
  }, [login]);

  const logout = async () => {
    // O cookie HttpOnly vai sozinho; o servidor apaga o refresh token e o cookie.
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error('Não foi possível invalidar a sessão no servidor.', e);
    }
    setAccessToken(null);
    localStorage.clear();
    setIsLoggedIn(false);
    setUser(null);
  };

  const requireAuth = (action: () => void) => {
    if (isLoggedIn) {
      action(); // Executa imediatamente se já estiver logado
    } else {
      setPendingAction(() => action); // Salva a ação pendente
      setIsLoginModalOpen(true); // Abre o modal
    }
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    setPendingAction(null); // Cancela a ação
  };

  return (
    <AuthContext.Provider value={{
      isLoggedIn,
      isAuthLoading,
      user,
      login,
      logout,
      requireAuth,
      isLoginModalOpen,
      closeLoginModal,
      pendingAction
    }}>
      {children}
    </AuthContext.Provider>
  );
};
