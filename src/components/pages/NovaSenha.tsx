import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const NovaSenha: React.FC = () => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== confirm) return alert("As senhas não coincidem.");
        if (password.length < 6) return alert("A senha deve ter no mínimo 6 caracteres.");

        const userId = localStorage.getItem('userId');

        try {
            const res = await fetch('http://localhost:3000/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, newPassword: password })
            });
            
            if (res.ok) {
                alert("Senha atualizada com sucesso! Acesso liberado.");
                navigate('/');
            } else {
                alert("Erro ao salvar senha.");
            }
        } catch (error) { alert("Erro de conexão."); }
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