import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './VoiceNavigator.css';

const VoiceNavigator: React.FC = () => {
    const [isListening, setIsListening] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [showTtsWarning, setShowTtsWarning] = useState(false); // RNF07 — aviso privacidade TTS

    const isListeningRef = useRef(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Feedback por voz — RNF07: avisa na primeira utilização sobre TTS (Web Speech API)
    const speak = useCallback((text: string, onEnd?: () => void) => {
        // Verifica se é a primeira vez usando TTS e exibe aviso de privacidade
        const ttsWarningShown = localStorage.getItem('tts_privacy_warning_shown');
        if (!ttsWarningShown) {
            setShowTtsWarning(true);
        }
        window.speechSynthesis.cancel();
        if (!text) {
            if (onEnd) onEnd();
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0;
        if (onEnd) {
            utterance.onend = onEnd;
            utterance.onerror = onEnd; // Fallback se der erro
        }
        window.speechSynthesis.speak(utterance);
    }, []);

    // Anuncia a página atual ao mudar de rota
    useEffect(() => {
        const pageNames: Record<string, string> = {
            '/': 'Página inicial',
            '/equipamentos': 'Equipamentos',
            '/assistente': 'Assistente virtual',
            '/perfil': 'Meu perfil',
            '/agendamento': 'Agendamento',
            '/documentacao': 'Documentação',
            '/contato': 'Contato',
            '/login': 'Login',
            '/cadastro': 'Cadastro',
            '/admin': 'Painel do administrador',
        };
        const pageName = pageNames[location.pathname];
        if (pageName) {
            const extra = location.pathname === '/login'
                ? ' Pressione M e diga email para ditar seu e-mail, ou senha para ditar sua senha.'
                : '';
            speak(`Você está na página: ${pageName}. Pressione M para ativar o microfone.${extra}`);
        }
    }, [location.pathname, speak]);

    // Processa o comando transcrito de forma inteligente
    const processCommand = useCallback((text: string) => {
        const lower = text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .trim();

        console.log('🎤 Whisper ouviu:', lower);

        // === Se estiver na página de login, verifica comandos de preenchimento ===
        if (location.pathname === '/login') {
            if (lower.includes('email') || lower.includes('e-mail') || lower.includes('correio')) {
                setStatus('🎤 Preparando para ouvir e-mail...');
                speak('Diga seu e-mail agora.', () => {
                    startRecordingForField('email');
                });
                return;
            }
            if (lower.includes('senha') || lower.includes('password') || lower.includes('codigo')) {
                setStatus('🎤 Preparando para ouvir senha...');
                speak('Diga sua senha agora.', () => {
                    startRecordingForField('password');
                });
                return;
            }
            if (lower.includes('entrar') || lower.includes('login') || lower.includes('enviar')) {
                speak('Enviando login.');
                // Simula clique no botão de login
                const btn = document.querySelector('.login-button') as HTMLButtonElement;
                if (btn) btn.click();
                return;
            }
        }

        // === Comandos Globais de IA (Ex: Reservar, Agendar, Perguntar) ===
        const aiKeywords = ['reservar', 'agendar', 'marcar', 'cancelar reserva', 'quais equipamentos', 'quero reservar'];
        if (aiKeywords.some(kw => lower.startsWith(kw))) {
            setStatus('🤖 Encaminhando para IA...');
            speak('Encaminhando seu pedido para a Inteligência Artificial.');
            sessionStorage.setItem('pending_voice_command', text);
            if (location.pathname !== '/assistente') {
                navigate('/assistente');
            } else {
                window.dispatchEvent(new Event('process-pending-voice'));
            }
            setTimeout(() => setStatus(''), 3000);
            return;
        }

        // === Navegação entre páginas ===
        const routes: { keywords: string[]; path: string; label: string }[] = [
            { keywords: ['inicio', 'home', 'pagina inicial', 'principal', 'comeco', 'beginning', 'start', 'main', 'rom', 'roume', 'houme', 'homi'], path: '/', label: 'início' },
            { keywords: ['equipamento', 'equipamentos', 'maquina', 'maquinas', 'equipment', 'machine', 'impressora', 'printer', 'laser', 'cortadora'], path: '/equipamentos', label: 'equipamentos' },
            { keywords: ['disponibilidade', 'calendario', 'horario', 'livre', 'ocupado', 'disponivel', 'vago'], path: '/disponibilidade', label: 'disponibilidade' },
            { keywords: ['assistente', 'assistant', 'chat', 'ia', 'inteligencia', 'intelligence', 'ajuda', 'help', 'conversar', 'talk'], path: '/assistente', label: 'assistente virtual' },
            { keywords: ['perfil', 'profile', 'conta', 'account', 'meu perfil', 'my profile', 'dados', 'minha conta'], path: '/perfil', label: 'seu perfil' },
            { keywords: ['agendamento', 'agendar', 'reservar', 'reserva', 'schedule', 'booking', 'book', 'marcar', 'horario'], path: '/agendamento', label: 'agendamentos' },
            { keywords: ['documentacao', 'documento', 'manual', 'manuais', 'documentation', 'document', 'guia', 'guide', 'pdf'], path: '/documentacao', label: 'documentação' },
            { keywords: ['contato', 'contatos', 'contact', 'falar', 'mensagem', 'message', 'suporte', 'support'], path: '/contato', label: 'contato' },
            { keywords: ['fazer login', 'login', 'logar', 'sign in', 'signin', 'log in', 'acessar', 'loguin', 'entrar'], path: '/login', label: 'login' },
            { keywords: ['cadastro', 'cadastrar', 'registrar', 'register', 'sign up', 'signup', 'criar conta'], path: '/cadastro', label: 'cadastro' },
        ];

        for (const route of routes) {
            if (route.keywords.some(kw => lower.includes(kw))) {
                speak(`Navegando para ${route.label}`);
                setStatus(`✅ "${text}" → ${route.label}`);
                navigate(route.path);
                setTimeout(() => setStatus(''), 4000);
                return;
            }
        }

        // Nenhum comando encontrado
        const hint = location.pathname === '/login'
            ? 'Diga email, senha, ou o nome de uma página.'
            : 'Diga o nome de uma página como equipamentos, assistente ou contato.';
        speak(`Não entendi: ${text}. ${hint}`);
        setStatus(`❌ "${text}"`);
        setTimeout(() => setStatus(''), 6000);
    }, [navigate, speak, location.pathname]);


    // === Web Speech API Nativa ===
    const listenWithNativeSpeech = (onResult: (text: string) => void, startMessage: string, listeningStatus: string) => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            speak("Seu navegador não suporta reconhecimento de voz nativo.");
            setStatus('❌ Navegador não suportado');
            isListeningRef.current = false;
            setIsListening(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            isListeningRef.current = true;
            setIsListening(true);
            if (startMessage) {
                speak(startMessage);
            }
            setStatus(listeningStatus);
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            onResult(transcript);
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'no-speech') {
                speak('Não ouvi nada. Pressione M e tente novamente.');
                setStatus('❌ Nada ouvido');
            } else {
                speak('Erro no reconhecimento de voz.');
                setStatus('❌ Erro no microfone');
            }
        };

        recognition.onend = () => {
            isListeningRef.current = false;
            setIsListening(false);
            setTimeout(() => {
                setStatus(prev => prev.includes('❌') || prev.includes('✅') || prev.includes('🎤') ? '' : prev);
            }, 4000);
        };

        try {
            recognition.start();
        } catch (e) {
            console.error("Erro ao iniciar reconhecimento", e);
            isListeningRef.current = false;
            setIsListening(false);
        }
    };

    // Gravação para preenchimento de campos (email/senha no login)
    const startRecordingForField = (field: 'email' | 'password') => {
        listenWithNativeSpeech((text) => {
            if (text) {
                setStatus(`"${text}"`);
                window.dispatchEvent(new CustomEvent('voice-fill-field', {
                    detail: { field, text: text.trim() }
                }));
            } else {
                speak('Não entendi. Pressione M e tente novamente.');
            }
        }, '', field === 'email' ? '🎤 Diga seu e-mail...' : '🎤 Diga sua senha...');
    };

    // Gravação principal (comando de navegação)
    const startRecording = useCallback(() => {
        if (isListeningRef.current) return;
        listenWithNativeSpeech((text) => {
            if (text) {
                setStatus(`"${text}"`);
                processCommand(text);
            } else {
                speak('Não consegui entender. Pressione M para tentar novamente.');
                setStatus('❌ Não entendi.');
            }
        }, 'Microfone ativado. Fale seu comando.', '🎤 Ouvindo...');
    }, [processCommand, speak]);

    // === ATALHO GLOBAL: Tecla M ===
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if ((e.key === 'm' || e.key === 'M') && !isListeningRef.current) {
                e.preventDefault();
                startRecording();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [startRecording]);

    return (
        <div className="voice-navigator-container">
            {status && <div className="voice-status-bubble">{status}</div>}

            {/* RNF07 — Aviso de privacidade TTS na primeira utilização */}
            {showTtsWarning && (
                <div style={{
                    position: 'fixed', bottom: '90px', right: '20px', zIndex: 9999,
                    background: '#1e293b', border: '1px solid #f59e0b', borderRadius: '12px',
                    padding: '16px', maxWidth: '320px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                }}>
                    <p style={{ color: '#fbbf24', fontWeight: 'bold', margin: '0 0 8px 0', fontSize: '0.9rem' }}>
                        ⚠️ Aviso de Privacidade — Síntese de Voz
                    </p>
                    <p style={{ color: '#cbd5e1', fontSize: '0.8rem', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                        O feedback de voz usa a <strong>Web Speech API</strong> do navegador (Chrome), que pode enviar texto sintetizado a servidores externos. O áudio capturado é processado localmente via Whisper.
                    </p>
                    <button
                        onClick={() => {
                            localStorage.setItem('tts_privacy_warning_shown', '1');
                            setShowTtsWarning(false);
                        }}
                        style={{
                            background: '#f59e0b', color: '#1e293b', border: 'none',
                            borderRadius: '6px', padding: '6px 14px', cursor: 'pointer',
                            fontWeight: 'bold', fontSize: '0.8rem', width: '100%'
                        }}
                    >
                        Entendi, não mostrar novamente
                    </button>
                </div>
            )}

            <button
                className={`voice-fab ${isListening ? 'listening' : ''}`}
                onClick={isListening ? undefined : startRecording}
                title="Pressione M ou clique para comandos de voz"
                aria-label="Ativar comandos de voz. Atalho: tecla M"
            >
                {isListening ? '🔴' : '🎤'}
            </button>

            <div className="voice-shortcut-hint">
                Pressione <kbd>M</kbd>
            </div>
        </div>
    );
};

export default VoiceNavigator;

