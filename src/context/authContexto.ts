// Tipos e objeto do contexto de autenticação. Ficam fora do AuthContext.tsx porque o
// Fast Refresh do Vite só funciona quando um arquivo .tsx exporta apenas componentes;
// o hook está em ./useAuth.ts.
import { createContext } from 'react';
import type { RespostaLogin } from '../types/api';

export interface UsuarioSessao {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthContextType {
  isLoggedIn: boolean;
  user: UsuarioSessao | null;
  login: (userData: RespostaLogin) => void;
  logout: () => void;
  requireAuth: (action: () => void) => void;
  
  // Controle do Modal
  isLoginModalOpen: boolean;
  closeLoginModal: () => void;
  pendingAction: (() => void) | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
