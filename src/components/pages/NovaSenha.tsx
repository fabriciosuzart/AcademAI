import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import api from '../../api/axios';
import { mensagemDeErro } from '../../utils/erros';
import { useAuth } from '../../context/useAuth';
import { erroDeSenha } from '../../utils/senha';

const NovaSenha: React.FC = () => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const navigate = useNavigate();
    const { logout } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== confirm) return alert("As senhas não coincidem.");
        const erroSenha = erroDeSenha(password); // RF07: mesma política do cadastro (RF01)
        if (erroSenha) return alert(erroSenha);

        try {
            // Troca forcada de senha temporaria: o backend dispensa a senha atual
            // quando isTempPassword=1, mas continua exigindo o token (api o injeta).
            await api.post('/change-password', { newPassword: password });
            // A troca de senha encerra todas as sessões (sessionVersion): entra de novo.
            await logout();
            alert("Senha atualizada com sucesso! Faça login novamente.");
            navigate('/login');
        } catch (error) {
            alert("Erro: " + mensagemDeErro(error, "falha ao salvar senha."));
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                
                {/* Lado Esquerdo: Imagem */}
                <div className="login-image-panel">
                    <img src="/background2.png" alt="AcademAI Background" />
                    <div className="image-overlay">
                        <h2>Segurança em Primeiro Lugar</h2>
                        <p>Mantenha sua conta protegida com uma senha forte.</p>
                    </div>
                </div>

                {/* Lado Direito: Formulário */}
                <div className="login-content">
                    <h1 className="login-title" style={{color: '#e11d48'}}>Troca Obrigatória</h1>
                    <p className="subtitle">Você entrou com uma senha temporária. Defina uma nova senha para continuar.</p>
                    
                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="login-field">
                            <label>Nova Senha</label>
                            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
                        </div>
                        <div className="login-field">
                            <label>Confirmar Senha</label>
                            <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
                        </div>
                        <button type="submit" className="login-button" style={{background: 'linear-gradient(135deg, #e11d48, #be123c)'}}>
                            Salvar e Entrar
                        </button>
                    </form>
                </div>
                
            </div>
        </div>
    );
};

export default NovaSenha;