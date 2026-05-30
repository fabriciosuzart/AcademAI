import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isLoggedIn: boolean;
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    // Restaurar sessão do localStorage
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
      setUser({
        id: localStorage.getItem('userId'),
        name: localStorage.getItem('userName'),
        email: localStorage.getItem('userEmail'),
        role: localStorage.getItem('userRole'),
      });
    }
  }, []);

  const login = (data: any) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.id);
    localStorage.setItem('userName', data.name);
    localStorage.setItem('userEmail', data.email);
    localStorage.setItem('userRole', data.role);
    // Armazena refresh token (RNF04)
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    
    setIsLoggedIn(true);
    setUser({
      id: data.id,
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
        await fetch('http://localhost:3000/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
      } catch (e) {
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
