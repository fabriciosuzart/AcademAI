import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Cadastro.css';

const Cadastro: React.FC = () => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        ra: '',
        password: '',
        confirmPassword: '',
        role: 'ALUNO'
    });
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({...formData, [e.target.id]: e.target.value});
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            return alert('As senhas não conferem.');
        }

        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: formData.fullName,
                    email: formData.email,
                    ra: formData.ra,
                    password: formData.password,
                    role: formData.role
                })
            });
            const data = await response.json();

            if (response.ok) {
                alert('Cadastro realizado! Faça login.');
                navigate('/login');
            } else {
                alert('Erro: ' + data.error);
            }
        } catch (error) {
            alert('Erro de conexão com o servidor.');
        }
    };

    return (
        <div className="signup-page">
            <div className="signup-card">
                
                {/* Lado Esquerdo: Formulário com Glassmorphism */}
                <div className="signup-content">
                    <div className="signup-header">
                        <h1 className="signup-title">Criar Conta</h1>
                        <p>Junte-se a nós e comece a inovar hoje mesmo.</p>
                    </div>

                    <form className="signup-form" onSubmit={handleRegister} aria-label="Formulário de cadastro">
                        <div className="signup-field">
                            <label htmlFor="fullName">Nome Completo</label>
                            <input type="text" id="fullName" placeholder="Ex: Juliana Santos" value={formData.fullName} onChange={handleChange} required aria-required="true" aria-label="Digite seu nome completo" />
                        </div>
                        
                        <div className="signup-row">
                            <div className="signup-field">
                                <label htmlFor="email">E-mail Institucional</label>
                                <input type="email" id="email" placeholder="nome@unisanta.br" value={formData.email} onChange={handleChange} required aria-required="true" aria-label="Digite seu e-mail institucional" />
                            </div>
                            <div className="signup-field">
                                <label htmlFor="ra">RA (Matrícula)</label>
                                <input type="text" id="ra" placeholder="Seu RA" value={formData.ra} onChange={handleChange} required aria-required="true" aria-label="Digite seu Registro Acadêmico ou matrícula" />
                            </div>
                        </div>

                        <div className="signup-row">
                            <div className="signup-field">
                                <label htmlFor="role">Perfil</label>
                                <select id="role" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} required aria-required="true" aria-label="Selecione seu perfil (estudante ou professor)" style={{ padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontFamily: 'inherit' }}>
                                    <option value="ALUNO">Estudante</option>
                                    <option value="PROFESSOR">Professor</option>
                                </select>
                            </div>
                        </div>

                        <div className="signup-row">
                            <div className="signup-field">
                                <label htmlFor="password">Criar Senha</label>
                                <input type="password" id="password" placeholder="Mínimo 6 caracteres" value={formData.password} onChange={handleChange} required aria-required="true" aria-label="Crie uma senha de no mínimo 6 caracteres" />
                            </div>
                            <div className="signup-field">
                                <label htmlFor="confirmPassword">Confirmar Senha</label>
                                <input type="password" id="confirmPassword" placeholder="Repita a senha" value={formData.confirmPassword} onChange={handleChange} required aria-required="true" aria-label="Confirme a senha criada" />
                            </div>
                        </div>

                        <button type="submit" className="signup-button" aria-label="Botão para confirmar e cadastrar agora">Cadastrar Agora</button>
                        
                        <div className="auth-link">
                            <p>Já tem uma conta? <Link to="/login" className="login-link" aria-label="Link para a página de login">Faça login</Link></p>
                        </div>
                    </form>
                </div>

                {/* Lado Direito: Imagem e Inspiração */}
                <div className="signup-image-panel">
                    <img src="/background2.png" alt="InovFabLab Background" />
                    <div className="image-overlay">
                        <h2>Construa o Futuro</h2>
                        <p>Acesse impressoras 3D, cortadoras a laser e a mentoria de nossa IA exclusiva.</p>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Cadastro;