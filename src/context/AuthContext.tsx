import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { API_URL } from '../api/config';
import type { RespostaLogin } from '../types/api';
import { AuthContext, type UsuarioSessao } from './authContexto';



export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<UsuarioSessao | null>(null);
  
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    // Restaurar sessão do localStorage
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
      setUser({
        id: localStorage.getItem('userId') ?? '',
        name: localStorage.getItem('userName') ?? '',
        email: localStorage.getItem('userEmail') ?? '',
        role: localStorage.getItem('userRole') ?? '',
      });
    }
  }, []);

  const login = (data: RespostaLogin) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', String(data.id));
    localStorage.setItem('userName', data.name);
    localStorage.setItem('userEmail', data.email);
    localStorage.setItem('userRole', data.role);
    // Armazena refresh token (RNF04)
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    
    setIsLoggedIn(true);
    setUser({
      id: String(data.id),
      name: data.name,
      email: data.email,
      role: data.role,
    });
  };

  const logout = async () => {
    // Invalida refresh token no servidor
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
      } catch {
        // Silencioso - mesmo que falhe, limpa localmente
      }
    }
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
