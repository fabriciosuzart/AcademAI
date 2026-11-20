// Tipos e objeto do contexto de autenticação. Ficam fora do AuthContext.tsx porque o
// Fast Refresh do Vite só funciona quando um arquivo .tsx exporta apenas componentes;
// o hook está em ./useAuth.ts.
import { createContext } from 'react';
import type { RespostaSessao } from '../types/api';

export interface UsuarioSessao {
  id: string;
  name: string;
  email: string;
  ra: string | null;
  role: string;
}

export interface AuthContextType {
  isLoggedIn: boolean;
  /** true enquanto a sessão é restaurada pelo cookie, ao abrir ou recarregar a página. */
  isAuthLoading: boolean;
  user: UsuarioSessao | null;
  login: (userData: RespostaSessao) => void;
  logout: () => Promise<void>;
  requireAuth: (action: () => void) => void;
  
  // Controle do Modal
  isLoginModalOpen: boolean;
  closeLoginModal: () => void;
  pendingAction: (() => void) | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
