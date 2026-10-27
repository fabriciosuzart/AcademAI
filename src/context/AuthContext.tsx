import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AxiosResponse } from 'axios';
import api from '../api/axios';
import { setAccessToken } from '../api/session';
interface AuthContextType {
  isLoggedIn: boolean;
  isAuthLoading: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  login: (userData: any) => void;
  logout: () => void;
  requireAuth: (action: () => void) => void;
  
  // Controle do Modal
  isLoginModalOpen: boolean;
  closeLoginModal: () => void;
  pendingAction: (() => void) | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
interface SessionData {
  token: string;
  id: string;
  name: string;
  email: string;
  role: string;
  ra?: string | null;
  isTempPassword?: number;
}

let sessionRestorePromise: Promise<AxiosResponse<SessionData>> | null = null;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    localStorage.removeItem('token');
    let active = true;
    sessionRestorePromise ??= api.post<SessionData>('/auth/refresh');
    sessionRestorePromise
      .then(({ data }) => {
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
  }, []);

  const login = (data: any) => {
    setAccessToken(data.token);
    localStorage.setItem('userId', data.id);
    localStorage.setItem('userName', data.name);
    localStorage.setItem('userEmail', data.email);
    localStorage.setItem('userRole', data.role);
    // O refresh token é mantido pelo navegador em cookie HttpOnly.
    localStorage.removeItem('refreshToken');
    
    setIsLoggedIn(true);
    setUser({
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
    });
  };

  const logout = async () => {
    // O cookie HttpOnly é enviado automaticamente; o token nunca fica acessível ao JavaScript.
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
