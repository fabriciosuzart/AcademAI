import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './VoiceNavigator.css';

const VoiceNavigator: React.FC = () => {
    const [isListening, setIsListening] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [showTtsWarning, setShowTtsWarning] = useState(false); // RNF07 — aviso privacidade TTS
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const isListeningRef = useRef(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Feedback por voz — RNF07: avisa na primeira utilização sobre TTS (Web Speech API)
    const speak = useCallback((text: string) => {
        // Verifica se é a primeira vez usando TTS e exibe aviso de privacidade
        const ttsWarningShown = localStorage.getItem('tts_privacy_warning_shown');
        if (!ttsWarningShown) {
            setShowTtsWarning(true);
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0;
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

    // Conversor WAV
    const convertToWav = async (blob: Blob): Promise<Blob> => {
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const wavBuffer = new ArrayBuffer(44 + channelData.length * 2);
        const view = new DataView(wavBuffer);
        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
        };
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + channelData.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, channelData.length * 2, true);
        let offset = 44;
        for (let i = 0; i < channelData.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, channelData[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return new Blob([view], { type: 'audio/wav' });
    };

    // Processa o comando transcrito de forma inteligente
    const processCommand = useCallback((text: string) => {
        const lower = text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .trim();

        console.log('🎤 Whisper ouviu:', lower);

        // === Se estiver na página de login, verifica comandos de preenchimento ===
        if (location.pathname === '/login') {
            if (lower.includes('email') || lower.includes('e-mail') || lower.includes('correio')) {
                // Dispara evento para Login.tsx preencher o e-mail
                speak('Microfone ativado. Diga seu e-mail agora.');
                setStatus('🎤 Agora diga seu e-mail...');
                setTimeout(() => startRecordingForField('email'), 1500);
                return;
            }
            if (lower.includes('senha') || lower.includes('password') || lower.includes('codigo')) {
                speak('Microfone ativado. Diga sua senha agora.');
                setStatus('🎤 Agora diga sua senha...');
                setTimeout(() => startRecordingForField('password'), 1500);
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

        // === Navegação entre páginas ===
        const routes: { keywords: string[]; path: string; label: string }[] = [
            { keywords: ['inicio', 'home', 'pagina inicial', 'principal', 'comeco', 'beginning', 'start', 'main'], path: '/', label: 'início' },
            { keywords: ['equipamento', 'equipamentos', 'maquina', 'maquinas', 'equipment', 'machine', 'impressora', 'printer', 'laser', 'cortadora'], path: '/equipamentos', label: 'equipamentos' },
            { keywords: ['disponibilidade', 'calendario', 'horario', 'livre', 'ocupado', 'disponivel', 'vago'], path: '/disponibilidade', label: 'disponibilidade' },
            { keywords: ['assistente', 'assistant', 'chat', 'ia', 'inteligencia', 'intelligence', 'ajuda', 'help', 'conversar', 'talk'], path: '/assistente', label: 'assistente virtual' },
            { keywords: ['perfil', 'profile', 'conta', 'account', 'meu perfil', 'my profile', 'dados', 'minha conta'], path: '/perfil', label: 'seu perfil' },
            { keywords: ['agendamento', 'agendar', 'reservar', 'reserva', 'schedule', 'booking', 'book', 'marcar', 'horario'], path: '/agendamento', label: 'agendamentos' },
            { keywords: ['documentacao', 'documento', 'manual', 'manuais', 'documentation', 'document', 'guia', 'guide', 'pdf'], path: '/documentacao', label: 'documentação' },
            { keywords: ['contato', 'contatos', 'contact', 'falar', 'mensagem', 'message', 'suporte', 'support'], path: '/contato', label: 'contato' },
            { keywords: ['fazer login', 'login', 'logar', 'sign in', 'signin', 'log in', 'acessar'], path: '/login', label: 'login' },
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

    // Gravação para preenchimento de campos (email/senha no login)
    const startRecordingForField = async (field: 'email' | 'password') => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                speak('Processando.');
                setStatus('🧠 Processando...');
                const webmBlob = new Blob(chunks);

                try {
                    const wavBlob = await convertToWav(webmBlob);
                    const formData = new FormData();
                    formData.append('audio', wavBlob, 'campo.wav');

                    const response = await fetch('http://localhost:3000/api/transcribe', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await response.json();

                    if (data.text) {
                        // Dispara evento customizado para Login.tsx capturar
                        window.dispatchEvent(new CustomEvent('voice-fill-field', {
                            detail: { field, text: data.text.trim() }
                        }));
                    } else {
                        speak('Não entendi. Pressione M e tente novamente.');
                    }
                } catch (error) {
                    speak('Falha de conexão.');
                    console.error(error);
                }

                stream.getTracks().forEach(t => t.stop());
                isListeningRef.current = false;
                setIsListening(false);
                setTimeout(() => setStatus(''), 5000);
            };

            recorder.start();
            isListeningRef.current = true;
            setIsListening(true);

            // Grava 10 segundos para e-mail, 5 para senha
            setTimeout(() => {
                if (recorder.state === 'recording') recorder.stop();
            }, field === 'email' ? 10000 : 5000);

        } catch (error) {
            speak('Não foi possível acessar o microfone.');
            isListeningRef.current = false;
            setIsListening(false);
        }
    };

    // Gravação principal (comando de navegação)
    const startRecording = useCallback(async () => {
        if (isListeningRef.current) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];

            mediaRecorder.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.current.push(e.data);
            };

            mediaRecorder.current.onstop = async () => {
                speak('Processando seu comando.');
                setStatus('🧠 Processando...');
                const webmBlob = new Blob(audioChunks.current);

                try {
                    const wavBlob = await convertToWav(webmBlob);
                    const formData = new FormData();
                    formData.append('audio', wavBlob, 'comando.wav');

                    const response = await fetch('http://localhost:3000/api/transcribe', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await response.json();

                    if (data.text) {
                        setStatus(`"${data.text}"`);
                        processCommand(data.text);
                    } else {
                        speak('Não consegui entender. Pressione M para tentar novamente.');
                        setStatus('❌ Não entendi.');
                    }
                } catch (error) {
                    speak('Falha de conexão com o servidor.');
                    setStatus('❌ Falha de conexão.');
                    console.error(error);
                }

                isListeningRef.current = false;
                setIsListening(false);
                stream.getTracks().forEach(t => t.stop());
                setTimeout(() => setStatus(''), 5000);
            };

            mediaRecorder.current.start();
            isListeningRef.current = true;
            setIsListening(true);
            speak('Microfone ativado. Fale seu comando.');
            setStatus('🎤 Ouvindo...');

            setTimeout(() => {
                if (mediaRecorder.current?.state === 'recording') {
                    mediaRecorder.current.stop();
                }
            }, 4000);

        } catch (error) {
            speak('Não foi possível acessar o microfone.');
            isListeningRef.current = false;
            setIsListening(false);
        }
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

