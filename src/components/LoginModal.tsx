import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './LoginModal.css';

const LoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal, login, pendingAction } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isLoginModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Usa a nova instância do axios
      const response = await api.post('/login', { email, password });
      
      if (response.data.auth) {
        // Salva os dados no contexto (que já faz o localStorage)
        login(response.data);
        
        // Fecha o modal
        closeLoginModal();
        
        // Retoma a ação pendente
        if (pendingAction) {
          pendingAction();
        }
      } else {
        setError(response.data.error || 'Erro ao realizar login.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro de conexão com o servidor.');
    }
  };

  return (
    <div className="login-modal-overlay">
      <div className="login-modal-content">
        <button className="close-btn" onClick={closeLoginModal}>×</button>
        
        <h2>Autenticação Necessária</h2>
        <p>Faça login para continuar com esta ação.</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>E-mail Institucional</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="seu.nome@unisanta.br"
              required 
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Sua senha"
              required 
            />
          </div>
          <button type="submit" className="login-btn">Entrar e Continuar</button>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
