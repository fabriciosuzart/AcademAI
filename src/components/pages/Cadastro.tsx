import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, GraduationCap, Tag, Lock, KeyRound, Sparkles } from 'lucide-react';
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

    // ── Preenchimento e Submissão por Voz ────────────────────
    useEffect(() => {
        const handleVoiceFill = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail) return;
            const { field, text } = detail;
            
            setFormData(prev => {
                const newData = { ...prev };
                if (field === 'name') newData.fullName = text;
                if (field === 'ra') newData.ra = text;
                if (field === 'email') newData.email = text.replace(/\s+/g, '').toLowerCase();
                if (field === 'password') {
                    newData.password = text;
                    newData.confirmPassword = text; // auto-preenche a confirmação para facilitar
                }
                return newData;
            });
        };

        const handleVoiceSubmit = () => {
            const form = document.querySelector('.signup-form') as HTMLFormElement;
            if (form && form.requestSubmit) form.requestSubmit();
        };

        window.addEventListener('voice-fill-field', handleVoiceFill);
        window.addEventListener('voice-submit-form', handleVoiceSubmit);
        return () => {
            window.removeEventListener('voice-fill-field', handleVoiceFill);
            window.removeEventListener('voice-submit-form', handleVoiceSubmit);
        };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({...formData, [e.target.id]: e.target.value});
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password.length < 8) {
            return alert('A senha deve ter no mínimo 8 caracteres.'); // RF01
        }
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

                {/* Lado Esquerdo: Formulário Premium */}
                <div className="signup-content">
                    <div className="signup-header">
                        <h1 className="signup-title">Criar Conta</h1>
                        <p>Junte-se a nós e comece a inovar hoje mesmo.</p>
                    </div>

                    <form className="signup-form" onSubmit={handleRegister} aria-label="Formulário de cadastro">

                        <div className="signup-field">
                            <label htmlFor="fullName">Nome Completo</label>
                            <div className="input-wrapper">
                                <span className="input-icon"><User size={18} aria-hidden="true" /></span>
                                <input
                                    type="text"
                                    id="fullName"
                                    placeholder="Ex: Juliana Santos"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    required
                                    aria-required="true"
                                    aria-label="Digite seu nome completo"
                                />
                            </div>
                        </div>

                        <div className="signup-row">
                            <div className="signup-field">
                                <label htmlFor="email">E-mail Institucional</label>
                                <div className="input-wrapper">
                                    <span className="input-icon"><Mail size={18} aria-hidden="true" /></span>
                                    <input
                                        type="email"
                                        id="email"
                                        placeholder="nome@unisanta.br"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        aria-required="true"
                                        aria-label="Digite seu e-mail institucional"
                                    />
                                </div>
                            </div>
                            <div className="signup-field">
                                <label htmlFor="ra">RA (Matrícula)</label>
                                <div className="input-wrapper">
                                    <span className="input-icon"><GraduationCap size={18} aria-hidden="true" /></span>
                                    <input
                                        type="text"
                                        id="ra"
                                        placeholder="Seu RA"
                                        value={formData.ra}
                                        onChange={handleChange}
                                        required
                                        aria-required="true"
                                        aria-label="Digite seu Registro Acadêmico ou matrícula"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="signup-row">
                            <div className="signup-field">
                                <label htmlFor="role">Perfil</label>
                                {/* RF01/RN08 — apenas Estudante no cadastro público; Professor e Admin são atribuídos pelo administrador */}
                                <div className="input-wrapper select-wrapper">
                                    <span className="input-icon"><Tag size={18} aria-hidden="true" /></span>
                                    <select
                                        id="role"
                                        value={formData.role}
                                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                                        required
                                        aria-required="true"
                                        aria-label="Perfil do usuário (somente Estudante disponível no cadastro público)"
                                    >
                                        <option value="ALUNO">Estudante</option>
                                    </select>
                                </div>
                                <small className="field-hint">
                                    Perfis Professor e Administrador são atribuídos pelo administrador do laboratório.
                                </small>
                            </div>
                        </div>

                        <div className="signup-row">
                            <div className="signup-field">
                                <label htmlFor="password">Criar Senha</label>
                                <div className="input-wrapper">
                                    <span className="input-icon"><Lock size={18} aria-hidden="true" /></span>
                                    <input
                                        type="password"
                                        id="password"
                                        placeholder="Mínimo 8 caracteres"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        aria-required="true"
                                        aria-label="Crie uma senha de no mínimo 8 caracteres com letras e números"
                                    />
                                </div>
                            </div>
                            <div className="signup-field">
                                <label htmlFor="confirmPassword">Confirmar Senha</label>
                                <div className="input-wrapper">
                                    <span className="input-icon"><KeyRound size={18} aria-hidden="true" /></span>
                                    <input
                                        type="password"
                                        id="confirmPassword"
                                        placeholder="Repita a senha"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        required
                                        aria-required="true"
                                        aria-label="Confirme a senha criada"
                                    />
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="signup-button" aria-label="Botão para confirmar e cadastrar agora">
                            <Sparkles size={18} aria-hidden="true" /> Cadastrar Agora
                        </button>

                        <div className="auth-link">
                            <p>Já tem uma conta? <Link to="/login" className="login-link" aria-label="Link para a página de login">Faça login</Link></p>
                        </div>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default Cadastro;