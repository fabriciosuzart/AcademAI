import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [voiceStatus, setVoiceStatus] = useState('');

  const navigate = useNavigate();

  // Feedback por voz
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    window.speechSynthesis.speak(utterance);
  };

  // Formata e-mail ditado
  const formatSpokenEmail = (text: string): string => {
    let result = text.toLowerCase().trim();
    console.log('📧 Texto bruto do Whisper:', result);

    result = result.replace(/\b(arouba|aroba|arroba|a rouba|a roba|at sign)\b/gi, ' @ ');
    result = result.replace(/\b(ponto|pontos|dot)\b/gi, ' . ');
    result = result.replace(/\b(hífen|hifen|traço|traco|dash)\b/gi, ' - ');
    result = result.replace(/\b(underline|underscore)\b/gi, ' _ ');

    result = result.replace(/alunaos/gi, 'alunos');
    result = result.replace(/alunaus/gi, 'alunos');
    result = result.replace(/unissanta/gi, 'unisanta');
    result = result.replace(/uni santa/gi, 'unisanta');
    result = result.replace(/pontosde/gi, '. ');
    result = result.replace(/pontosd/gi, '. ');
    result = result.replace(/pontob/gi, '.b');
    result = result.replace(/pontou/gi, '.u');

    const letterMap: Record<string, string> = {
      'jota': 'j', 'agá': 'h', 'aga': 'h', 'erre': 'r', 'esse': 's', 'efe': 'f',
      'gê': 'g', 'ge': 'g', 'guê': 'g',
      'cê': 'c', 'ce': 'c', 'cé': 'c',
      'bê': 'b', 'be': 'b', 'bé': 'b',
      'dê': 'd', 'de': 'd', 'dé': 'd',
      'pê': 'p', 'pe': 'p', 'pé': 'p',
      'tê': 't', 'te': 't', 'té': 't',
      'vê': 'v', 've': 'v', 'vé': 'v',
      'zê': 'z', 'ze': 'z', 'zé': 'z',
      'éle': 'l', 'ele': 'l', 'eme': 'm', 'ene': 'n',
      'quê': 'q', 'que': 'q', 'xis': 'x',
      'ípsilon': 'y', 'ipsilon': 'y',
      'dáblio': 'w', 'dablio': 'w', 'dábliu': 'w', 'dabliu': 'w',
      'ká': 'k', 'ka': 'k', 'cá': 'k',
      'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
      'jay': 'j', 'aitch': 'h',
      'zero': '0', 'um': '1', 'uma': '1', 'dois': '2', 'duas': '2',
      'três': '3', 'tres': '3', 'quatro': '4', 'cinco': '5',
      'seis': '6', 'meia': '6', 'sete': '7', 'oito': '8', 'nove': '9',
    };

    const words = result.split(/\s+/);
    const processed = words.map(word => {
      const clean = word.replace(/[,;!?'"]/g, '');
      if (letterMap[clean]) return letterMap[clean];
      if (clean.length === 1) return clean;
      return clean;
    });

    let emailResult = processed.join('');
    emailResult = emailResult.replace(/(\d)\.(\d)/g, '$1$2');
    emailResult = emailResult.replace(/(\d)\.(\d)/g, '$1$2');
    emailResult = emailResult.replace(/\.{2,}/g, '.');
    emailResult = emailResult.replace(/^\./, '');
    emailResult = emailResult.replace(/\.@/, '@');
    emailResult = emailResult.replace(/\s+/g, '');

    const knownDomains = ['alunos.unisanta.br', 'unisanta.br'];
    if (emailResult.includes('@')) {
      const [user, domain] = emailResult.split('@');
      let bestDomain = domain;
      for (const known of knownDomains) {
        const similarity = known.split('').filter(c => domain.includes(c)).length / known.length;
        if (similarity > 0.6) { bestDomain = known; break; }
      }
      let cleanUser = user.replace(/([a-z])\1+/g, '$1');
      emailResult = cleanUser + '@' + bestDomain;
    }

    console.log('📧 E-mail formatado:', emailResult);
    return emailResult;
  };

  // === ESCUTA EVENTOS DO VoiceNavigator (tecla M) ===
  useEffect(() => {
    const handleVoiceFill = (e: Event) => {
      const { field, text } = (e as CustomEvent).detail;

      if (field === 'email') {
        const formatted = formatSpokenEmail(text);
        setEmail(formatted);
        speak(`E-mail preenchido: ${formatted}. Pressione M e diga senha para preencher a senha.`);
        setVoiceStatus(`✅ E-mail: ${formatted}`);
      } else if (field === 'password') {
        const cleanPwd = text.replace(/\s+/g, '');
        setPassword(cleanPwd);
        speak('Senha preenchida. Pressione M e diga entrar para fazer login.');
        setVoiceStatus('✅ Senha preenchida');
      }
      setTimeout(() => setVoiceStatus(''), 5000);
    };

    window.addEventListener('voice-fill-field', handleVoiceFill);
    return () => window.removeEventListener('voice-fill-field', handleVoiceFill);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken || '');
        localStorage.setItem('userName', data.name);
        localStorage.setItem('userId', data.id);
        localStorage.setItem('userEmail', data.email);
        localStorage.setItem('userRA', data.ra);
        localStorage.setItem('userRole', data.role);

        if (data.isTempPassword === 1) {
          setShowChangePasswordModal(true);
        } else {
          speak(`Bem-vindo, ${data.name}!`);
          alert('Bem-vindo, ' + data.name + '!');
          navigate('/');
        }
      } else {
        speak(`Erro: ${data.error}`);
        alert('Erro: ' + data.error);
      }
    } catch (error) {
      speak('Erro de conexão com o servidor.');
      alert('Erro de conexão com o servidor.');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) return alert("As senhas não coincidem.");
    if (newPassword.length < 6) return alert("A senha deve ter no mínimo 6 caracteres.");

    const userId = localStorage.getItem('userId');

    try {
      const res = await fetch('http://localhost:3000/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, currentPassword: password, newPassword })
      });

      if (res.ok) {
        alert("✅ Senha atualizada com sucesso! Entrando...");
        setShowChangePasswordModal(false);
        navigate('/');
      } else {
        alert("Erro ao atualizar senha.");
      }
    } catch (error) { alert("Erro de conexão."); }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const d = await res.json();
      if (res.ok) { alert(d.message); setIsRecovering(false); }
      else alert(d.error);
    } catch (e) { alert("Erro de conexão"); }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Lado Esquerdo: Formulário */}
        <div className="login-content">

          {/* Barra de status de voz */}
          {voiceStatus && (
            <div className="voice-login-status">{voiceStatus}</div>
          )}

          {!isRecovering ? (
            <>
              <h1 className="login-title">Acesse sua Conta</h1>
              <p className="subtitle">Gerencie seus projetos e agendamentos.</p>
              <form className="login-form" onSubmit={handleLogin} aria-label="Formulário de login">
                <div className="login-field">
                  <label htmlFor="login-email">E-mail Institucional</label>
                  <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu.nome@unisanta.br" required aria-required="true" aria-label="Digite seu e-mail institucional" />
                </div>
                <div className="login-field">
                  <label htmlFor="login-password">Senha</label>
                  <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" required aria-required="true" aria-label="Digite sua senha" />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5px' }}>
                    <button type="button" className="forgot-password-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }} onClick={() => setIsRecovering(true)} aria-label="Recuperar senha esquecida">Esqueceu a senha?</button>
                  </div>
                </div>
                <button type="submit" className="login-button" aria-label="Botão para entrar na conta">Entrar</button>
                <p style={{ textAlign: 'center', marginTop: '15px', color: '#64748b' }}>
                  Não tem cadastro? <Link to="/cadastro" className="signup-link" aria-label="Link para a página de cadastro">Criar conta</Link>
                </p>
              </form>
            </>
          ) : (
            <>
              <h1 className="login-title">Recuperação</h1>
              <p className="subtitle">Informe seu e-mail para receber uma senha temporária.</p>
              <form className="login-form" onSubmit={handleRecover} aria-label="Formulário de recuperação de senha">
                <div className="login-field">
                  <label htmlFor="recover-email">E-mail</label>
                  <input id="recover-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu.nome@unisanta.br" required aria-required="true" aria-label="Digite seu e-mail para recuperar a senha" />
                </div>
                <button type="submit" className="login-button" aria-label="Botão para enviar e-mail de recuperação">Enviar E-mail</button>
                <button type="button" style={{ width: '100%', padding: '16px', marginTop: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }} onClick={() => setIsRecovering(false)} aria-label="Cancelar recuperação e voltar ao login">Voltar ao Login</button>
              </form>
            </>
          )}
        </div>

        {/* Lado Direito: Imagem Imersiva */}
        <div className="login-image-panel">
          <img src="/background.png" alt="InovFabLab Background" onError={(e) => e.currentTarget.src = '/background2.png'} />
          <div className="image-overlay">
            <h2>Bem-vindo de Volta</h2>
            <p>Continue construindo o futuro no laboratório inteligente.</p>
          </div>
        </div>

      </div>

      {/* Modal de Troca Obrigatória */}
      {showChangePasswordModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '40px', borderRadius: '24px', maxWidth: '400px', width: '90%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <h2 style={{ color: '#e11d48', marginTop: 0, fontSize: '1.8rem' }}>⚠️ Nova Senha</h2>
            <p style={{ color: '#64748b' }}>Você acessou com uma senha temporária. Defina sua nova senha definitiva abaixo:</p>

            <div className="login-field" style={{ marginBottom: '15px' }}>
              <label htmlFor="new-password">Nova Senha</label>
              <input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" aria-label="Digite a nova senha definitiva" />
            </div>
            <div className="login-field" style={{ marginBottom: '25px' }}>
              <label htmlFor="confirm-password">Confirmar Nova Senha</label>
              <input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Digite novamente" aria-label="Confirme a nova senha definitiva" />
            </div>

            <button onClick={handleChangePassword} className="login-button" style={{ marginTop: 0, background: 'linear-gradient(135deg, #10b981, #059669)' }} aria-label="Salvar nova senha e entrar no sistema">
              Salvar e Entrar no Sistema
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;