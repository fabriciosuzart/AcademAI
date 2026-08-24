import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { Bell, CheckCircle2, XCircle, HelpCircle, Volume2, Mic, Mail, Lock, Bot,
         ClipboardList, Zap, Map, KeyRound, Circle, AlertTriangle,
         type LucideIcon } from 'lucide-react';
import './VoiceNavigator.css';

// =====================================================
// Levenshtein distance — fuzzy matching leve
// Aceita comandos com até 2 erros de digitação/pronúncia
// =====================================================
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

function fuzzyIncludes(text: string, keyword: string): boolean {
    // 1. Verificação exata (para garantir que frases completas funcionem rápido)
    if (text.includes(keyword)) {
        // Evitar que "contato" seja pego pela palavra-chave "conta"
        if (keyword === 'conta' && text.includes('contato')) return false;
        return true;
    }
    
    if (keyword.length <= 4) return false; // Palavras muito curtas exigem match exato

    // 2. Tokenização: separa em palavras e avalia n-grams baseados no tamanho da keyword
    const textWords = text.split(/\s+/);
    const keyWordsCount = keyword.split(/\s+/).length;

    // Define o threshold proporcional ao tamanho da keyword (max 2)
    const threshold = keyword.length <= 5 ? 1 : 2;

    // Tenta casar n-grams (grupos de palavras do mesmo tamanho da keyword)
    for (let i = 0; i <= textWords.length - keyWordsCount; i++) {
        const slice = textWords.slice(i, i + keyWordsCount).join(' ');
        if (levenshtein(slice, keyword) <= threshold) {
            return true;
        }
    }

    return false;
}

// =====================================================
// Rotas com keywords para navegação por voz
// =====================================================
const ROUTES: { keywords: string[]; path: string; label: string }[] = [
    {
        keywords: ['inicio', 'home', 'pagina inicial', 'principal', 'comeco', 'beginning', 'start', 'main', 'rom', 'roume', 'houme', 'homi'],
        path: '/', label: 'início'
    },
    {
        keywords: ['equipamento', 'equipamentos', 'maquina', 'maquinas', 'equipment', 'machine', 'impressora', 'printer', 'laser', 'cortadora'],
        path: '/equipamentos', label: 'equipamentos'
    },
    {
        keywords: ['disponibilidade', 'calendario', 'horario', 'livre', 'ocupado', 'disponivel', 'vago'],
        path: '/disponibilidade', label: 'disponibilidade'
    },
    {
        keywords: ['assistente', 'assistencia', 'assistant', 'chat', 'ia', 'inteligencia', 'intelligence', 'ajuda', 'help', 'conversar', 'talk'],
        path: '/assistente', label: 'assistente virtual'
    },
    {
        keywords: ['perfil', 'profile', 'minha conta', 'account', 'meu perfil', 'my profile', 'dados'],
        path: '/perfil', label: 'seu perfil'
    },
    {
        keywords: ['agendamento', 'agendar', 'reservar', 'reserva', 'schedule', 'booking', 'book', 'marcar'],
        path: '/agendamento', label: 'agendamentos'
    },
    {
        keywords: ['documentacao', 'documento', 'manual', 'manuais', 'documentation', 'document', 'guia', 'guide', 'pdf'],
        path: '/documentacao', label: 'documentação'
    },
    {
        keywords: ['contato', 'contatos', 'contact', 'falar', 'mensagem', 'message', 'suporte', 'support'],
        path: '/contato', label: 'contato'
    },
    {
        keywords: ['fazer login', 'login', 'logar', 'sign in', 'signin', 'log in', 'acessar', 'loguin', 'entrar'],
        path: '/login', label: 'login'
    },
    {
        keywords: ['cadastro', 'cadastrar', 'registrar', 'register', 'sign up', 'signup', 'criar conta'],
        path: '/cadastro', label: 'cadastro'
    },
    {
        keywords: ['notificacao', 'notificacoes', 'avisos', 'alertas', 'notifications'],
        path: '/notificacoes', label: 'notificações'
    },
    {
        keywords: ['admin', 'administrador', 'administracao', 'painel', 'dashboard'],
        path: '/admin', label: 'painel do administrador'
    },
];

// Nomes das páginas para anúncio de rota
const PAGE_NAMES: Record<string, string> = {
    '/': 'Página inicial',
    '/equipamentos': 'Equipamentos',
    '/assistente': 'Assistente virtual',
    '/perfil': 'Meu perfil',
    '/agendamento': 'Agendamento',
    '/documentacao': 'Documentação',
    '/contato': 'Contato',
    '/login': 'Login',
    '/cadastro': 'Cadastro',
    '/admin': 'Painel de Controle',
    '/disponibilidade': 'Disponibilidade',
    '/notificacoes': 'Notificações',
    '/nova-senha': 'Nova senha',
};

// =====================================================
// Abas do painel admin/professor com keywords de voz
// =====================================================
const ADMIN_TABS: { keywords: string[]; tab: string; label: string; adminOnly?: boolean }[] = [
    { keywords: ['visao geral', 'visão geral', 'overview', 'geral', 'resumo', 'dashboard'], tab: 'overview', label: 'visão geral', adminOnly: true },
    { keywords: ['reservas', 'reservas pendentes', 'aprovacoes', 'aprovações', 'pendentes', 'aprovar reservas'], tab: 'reservations', label: 'reservas pendentes' },
    { keywords: ['calendario', 'calendário', 'calendario global', 'agenda', 'agenda global', 'semana'], tab: 'calendar', label: 'calendário global', adminOnly: true },
    { keywords: ['usuarios', 'usuários', 'gestao', 'gestão', 'pessoas', 'membros'], tab: 'users', label: 'gestão de usuários', adminOnly: true },
    { keywords: ['equipamentos', 'inventario', 'inventário', 'maquinas', 'máquinas'], tab: 'equipment', label: 'equipamentos', adminOnly: true },
    { keywords: ['ia', 'inteligencia', 'inteligência', 'treinar', 'treinamento', 'treino'], tab: 'ai', label: 'treinamento de IA', adminOnly: true },
];

// =====================================================
// Painel de ajuda — seções contextuais por página
// =====================================================
function getHelpSections(pathname: string) {
    if (pathname === '/admin') {
        return [
            {
                Icone: ClipboardList, title: 'Abrir aba',
                tags: ['visão geral', 'reservas', 'calendário', 'usuários', 'equipamentos', 'treinar IA'],
            },
            {
                Icone: Zap, title: 'Ações rápidas',
                tags: ['aprovar', 'rejeitar'],
            },
            {
                Icone: Map, title: 'Sair do painel',
                tags: ['início', 'equipamentos', 'assistente', 'perfil'],
            },
        ];
    }
    return [
        {
            Icone: Map, title: 'Navegar para',
            tags: ['início', 'equipamentos', 'disponibilidade', 'assistente', 'perfil', 'agendamento', 'documentação', 'contato', 'notificações', 'login', 'cadastro'],
        },
        {
            Icone: Bot, title: 'Pedir à IA',
            tags: ['reservar [equipamento]', 'agendar [horário]', 'quais equipamentos', 'cancelar reserva'],
        },
        {
            Icone: KeyRound, title: 'No login',
            tags: ['email', 'senha', 'entrar'],
        },
    ];
}

// =====================================================
// Componente principal
// =====================================================
// Bipe curto de ativação via Web Audio API (sem bloquear o microfone)
function playActivationBeep() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
    } catch (_) { /* silencia erros em contextos sem áudio */ }
}

const VoiceNavigator: React.FC = () => {
    const [isListening, setIsListening] = useState(false);
    // O status carrega icone + texto. Antes o icone era um emoji embutido na
    // propria string, o que impedia troca-lo por SVG sem mudar o formato.
    const [status, setStatus] = useState<{ Icone: LucideIcon | null; texto: string }>({ Icone: null, texto: '' });

    // Atalho: mostrarStatus(Icone, 'texto') no lugar de mostrarStatus(null, 'emoji texto')
    const mostrarStatus = (Icone: LucideIcon | null, texto: string) => setStatus({ Icone, texto });
    const limparStatus = () => setStatus({ Icone: null, texto: '' });
    const [statusFading, setStatusFading] = useState(false);
    const [showTtsWarning, setShowTtsWarning] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);

    const isListeningRef = useRef(false);
    const recognitionRef = useRef<any>(null);
    const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Estado para confirmação de comandos com baixa confiança
    const [pendingConfirmation, setPendingConfirmation] = useState<{ text: string, action: () => void } | null>(null);
    const startRecordingRef = useRef<() => void>(() => {});

    // A escuta se re-arma sozinha quando não entende, e sem um teto ela repetia
    // "Não entendi" indefinidamente. Este contador zera a cada acerto.
    const MAX_TENTATIVAS_SEM_ENTENDER = 3;
    const tentativasSemEntenderRef = useRef(0);

    // Re-arma a escuta, desistindo depois de algumas falhas seguidas.
    const reescutar = (atraso: number) => {
        tentativasSemEntenderRef.current += 1;
        if (tentativasSemEntenderRef.current >= MAX_TENTATIVAS_SEM_ENTENDER) {
            tentativasSemEntenderRef.current = 0;
            mostrarStatus(XCircle, 'Não consegui entender. Pressione M para tentar de novo.');
            return;
        }
        setTimeout(() => startRecordingRef.current(), atraso);
    };

    // Chamado quando algo foi reconhecido com sucesso.
    const reiniciarTentativas = () => { tentativasSemEntenderRef.current = 0; };

    const navigate = useNavigate();
    const location = useLocation();

    // Ref sempre atualizado com o pathname — evita closure obsoleto em useCallback
    const locationRef = useRef(location.pathname);
    useEffect(() => {
        locationRef.current = location.pathname;
    }, [location.pathname]);

    // ── Utilitário: limpar status com fade-out ──────────────────
    const clearStatus = useCallback((delay = 4000) => {
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        statusTimerRef.current = setTimeout(() => {
            setStatusFading(true);
            setTimeout(() => {
                limparStatus();
                setStatusFading(false);
            }, 400);
        }, delay);
    }, []);

    // ── TTS — Síntese de voz ────────────────────────────────────
    const speak = useCallback((text: string, onEnd?: () => void) => {
        // RNF07 — aviso de privacidade na primeira utilização
        const ttsWarningShown = localStorage.getItem('tts_privacy_warning_shown');
        if (!ttsWarningShown) setShowTtsWarning(true);

        window.speechSynthesis.cancel();
        if (!text) { onEnd?.(); return; }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.3;  // mais rápido: menos tempo de espera antes de poder falar
        utterance.pitch = 1.0;
        
        // Aplica a voz preferida (Jarvis Mode)
        const preferredURI = localStorage.getItem('preferredVoiceURI');
        if (preferredURI) {
            const voices = window.speechSynthesis.getVoices();
            const selectedVoice = voices.find(v => v.voiceURI === preferredURI);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
        }

        if (onEnd) {
            utterance.onend = onEnd;
            utterance.onerror = onEnd; // fallback em caso de erro
        }
        window.speechSynthesis.speak(utterance);
    }, []);

    // ── Onboarding: exibe tooltip na primeira visita ────────────
    useEffect(() => {
        const onboarded = localStorage.getItem('voice_onboarded');
        if (!onboarded) {
            setTimeout(() => setShowOnboarding(true), 1200);
            setTimeout(() => {
                setShowOnboarding(false);
                localStorage.setItem('voice_onboarded', '1');
            }, 7000);
        }
    }, []);

    // ── Notificações sob Demanda (Jarvis Mode) ────────────────
    const checkNotifications = useCallback(async () => {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            speak("Você precisa estar logado para ver notificações.");
            return;
        }
        try {
            const res = await api.get(`/notifications/${userId}`);
            const notifications = res.data?.notifications || [];
            const unread = notifications.filter((n: any) => !n.isRead);
            
            if (unread.length > 0) {
                const latest = unread[unread.length - 1]; // Assume order by ID
                const typeLabel = latest.type.replace('_', ' ');
                speak(`Você tem ${unread.length} ${unread.length > 1 ? 'notificações não lidas' : 'notificação não lida'}. A mais recente é de ${typeLabel}. ${latest.message}`);
                mostrarStatus(Bell, `${unread.length} não lidas!`);
            } else {
                speak("Você não tem nenhuma notificação nova no momento.");
                mostrarStatus(CheckCircle2, "Nenhuma notificação");
            }
            clearStatus(5000);
        } catch (error) {
            speak("Não consegui acessar suas notificações agora.");
        }
    }, [speak, clearStatus]);

    // ── Anuncia a página ao mudar de rota (anuncio curto) ────────
    useEffect(() => {
        const pageName = PAGE_NAMES[location.pathname];
        if (!pageName) return;

        // Anuncio intencionalemente curto: menos tempo bloqueado antes de poder falar
        let msg = pageName;
        if (location.pathname === '/login') {
            msg += '. Diga email ou senha.';
        } else if (location.pathname === '/admin') {
            msg += '. Diga o nome de uma aba.';
        } else {
            msg += '.';
        }
        speak(msg);
    }, [location.pathname, speak]);

    // ── Função auxiliar de gravação com TTS integrado ─────────
    const listenWithNativeSpeech = useCallback((
        onResult: (text: string, confidence?: number) => void,
        listeningStatus = 'Ouvindo...',
        onStartSpeak = ''
    ) => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            speak('Seu navegador não suporta reconhecimento de voz nativo.');
            mostrarStatus(XCircle, 'Navegador não suportado');
            isListeningRef.current = false;
            setIsListening(false);
            return;
        }

        const doListen = () => {
            // Cancela qualquer TTS em andamento (ex: anúncio de página) para não interferir
            window.speechSynthesis.cancel();

            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            recognition.lang = 'pt-BR';
            recognition.interimResults = false;
            recognition.maxAlternatives = 3; // mais alternativas = mais chances de acerto

            recognition.onstart = () => {
                isListeningRef.current = true;
                setIsListening(true);
                mostrarStatus(Mic, listeningStatus);
            };

            recognition.onresult = (event: any) => {
                // Pega a melhor alternativa
                const transcript = event.results[0][0].transcript;
                const confidence = event.results[0][0].confidence;
                onResult(transcript, confidence);
            };

            recognition.onerror = (event: any) => {
                if (event.error === 'no-speech') {
                    speak('Não ouvi nada. Pressione M e tente novamente.');
                    mostrarStatus(XCircle, 'Nada ouvido');
                    clearStatus(4000);
                } else if (event.error === 'aborted') {
                    limparStatus();
                } else {
                    speak('Erro no microfone.');
                    mostrarStatus(XCircle, 'Erro no microfone');
                    clearStatus(3000);
                }
            };

            recognition.onend = () => {
                isListeningRef.current = false;
                recognitionRef.current = null;
                setIsListening(false);
            };

            try {
                recognition.start();
            } catch (e) {
                console.error('Erro ao iniciar reconhecimento', e);
                isListeningRef.current = false;
                setIsListening(false);
            }
        };

        // CRÍTICO: aguarda TTS terminar antes de abrir o microfone
        if (onStartSpeak) {
            speak(onStartSpeak, doListen);
        } else {
            doListen();
        }
    }, [speak, clearStatus]);

    // ── Processa comando transcrito ────────────────────────────
    const processCommand = useCallback((text: string, confidence?: number) => {
        const lower = text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .trim();

        console.log('Comando ouvido:', lower, 'Confiança:', confidence);

        // ── Tratar Confirmação Pendente ────────────────────────
        if (pendingConfirmation) {
            if (lower === 'sim' || lower.includes('sim') || lower === 'yes') {
                speak('Confirmado.');
                pendingConfirmation.action();
            } else {
                speak('Comando cancelado.');
            }
            setPendingConfirmation(null);
            clearStatus(3000);
            return;
        }

        // Função wrapper para checar confiança antes de executar ação
        const executeOrConfirm = (commandName: string, action: () => void) => {
            if (confidence !== undefined && confidence < 0.65) {
                speak(`Você disse ${commandName}? Diga sim ou não.`, () => setTimeout(() => startRecordingRef.current(), 350));
                mostrarStatus(HelpCircle, `Confirma "${commandName}"?`);
                setPendingConfirmation({ text: commandName, action });
            } else {
                action();
            }
        };

        // ── Leitura de Telas / Resumo / Notificações ───────────
        const notifKeywords = ['ler notificacoes', 'ler notificação', 'ler notificacao', 'minhas notificacoes', 'tenho notificacoes', 'tenho notificação'];
        if (notifKeywords.some(kw => lower.includes(kw))) {
            executeOrConfirm('ler notificações', () => {
                mostrarStatus(Volume2, 'Checando notificações...');
                checkNotifications();
            });
            return;
        }

        const readScreenKeywords = ['ler tela', 'resumo', 'o que tem aqui', 'informacoes', 'informacao', 'le a tela'];
        if (readScreenKeywords.some(kw => lower.includes(kw))) {
            executeOrConfirm('ler tela', () => {
                mostrarStatus(Volume2, 'Lendo tela...');
                window.dispatchEvent(new Event('voice-read-screen'));
            });
            return;
        }

        // ── Preenchimento Global (Regex) ────────────────────────
        // Cadastro: Nome
        let match = lower.match(/(?:meu nome e|chamo|nome) (.*)/);
        if (match) {
            const name = match[1].trim();
            window.dispatchEvent(new CustomEvent('voice-fill-field', { detail: { field: 'name', text: name } }));
            speak(`Nome preenchido: ${name}.`);
            return;
        }

        // Cadastro: RA
        match = lower.match(/(?:meu ra e|ra) ([\d\s]+)/);
        if (match) {
            const ra = match[1].replace(/\s/g, '').trim();
            window.dispatchEvent(new CustomEvent('voice-fill-field', { detail: { field: 'ra', text: ra } }));
            speak(`R.A. preenchido: ${ra}.`);
            return;
        }

        // Agendamento: Justificativa
        match = lower.match(/(?:justificativa|motivo|para) (.*)/);
        if (match && locationRef.current === '/agendamento') {
            const justificativa = match[1].trim();
            window.dispatchEvent(new CustomEvent('voice-fill-field', { detail: { field: 'justification', text: justificativa } }));
            speak('Justificativa preenchida.');
            return;
        }

        // Submissão Genérica (Cadastrar / Enviar Reserva)
        if (lower === 'cadastrar' || lower.includes('enviar reserva') || lower === 'enviar') {
            executeOrConfirm('enviar formulário', () => {
                speak('Enviando formulário.');
                window.dispatchEvent(new Event('voice-submit-form'));
                // Também tenta o botão de submit genérico se não houver listener
                const form = document.querySelector('form') as HTMLFormElement;
                if (form && form.requestSubmit) form.requestSubmit();
            });
            return;
        }

        // Detecta contexto de login: rota /login OU campo #login-email visível no DOM
        // (cobre tanto a página /login quanto o LoginModal aberto sobre outra rota)
        const isLoginContext = locationRef.current === '/login' ||
            !!document.getElementById('login-email');

        // ── Login: preenchimento de campos ──────────────────
        if (isLoginContext) {
            if (lower.includes('email') || lower.includes('e-mail') || lower.includes('correio')) {
                mostrarStatus(Mic, 'Preparando para ouvir e-mail...');
                listenWithNativeSpeech(
                    (emailText) => {
                        if (emailText) {
                            mostrarStatus(Mail, `E-mail: "${emailText}"`);
                            window.dispatchEvent(new CustomEvent('voice-fill-field', {
                                detail: {
                                    field: 'email',
                                    text: emailText.trim(),
                                    onFormatted: (formatted: string) => {
                                        speak(`E-mail ok: ${formatted}. Diga senha ou entrar.`, () => {
                                            reiniciarTentativas();
                                            setTimeout(() => startRecordingRef.current(), 350);
                                        });
                                    }
                                }
                            }));
                            clearStatus(5000);
                        } else {
                            speak('Não entendi.', () => reescutar(300));
                        }
                    },
                    'Diga seu e-mail...',
                    'Diga seu e-mail agora.',
                );
                return;
            }
            if (lower.includes('senha') || lower.includes('password') || lower.includes('codigo')) {
                mostrarStatus(Mic, 'Preparando para ouvir senha...');
                listenWithNativeSpeech(
                    (senhaText) => {
                        if (senhaText) {
                            mostrarStatus(Lock, 'Senha capturada');
                            window.dispatchEvent(new CustomEvent('voice-fill-field', {
                                detail: {
                                    field: 'password',
                                    text: senhaText.trim(),
                                    onFormatted: () => {
                                        speak('Senha ok. Diga entrar para fazer login.', () => {
                                            reiniciarTentativas();
                                            setTimeout(() => startRecordingRef.current(), 350);
                                        });
                                    }
                                }
                            }));
                            clearStatus(4000);
                        } else {
                            speak('Não entendi.', () => reescutar(300));
                        }
                    },
                    'Diga sua senha...',
                    'Diga sua senha agora.',
                );
                return;
            }
            if (lower.includes('entrar') || lower.includes('enviar') ||
                (lower.includes('login') && lower.length < 12)) {
                speak('Enviando login.');
                const form = document.querySelector('.login-form') as HTMLFormElement;
                if (form && form.requestSubmit) {
                    form.requestSubmit();
                } else {
                    const btn = document.querySelector('.login-button') as HTMLButtonElement;
                    if (btn) btn.click();
                }
                return;
            }
        }

        // ── Admin / Professor: navegação por abas e ações ────
        const isAdminContext = locationRef.current === '/admin';
        if (isAdminContext) {
            // Ação: aprovar primeira reserva pendente
            if (lower.includes('aprovar') || lower.includes('approve')) {
                speak('Aprovando a primeira reserva pendente.');
                mostrarStatus(CheckCircle2, 'Aprovando reserva...');
                window.dispatchEvent(new CustomEvent('voice-admin-action', { detail: { action: 'approve-first' } }));
                clearStatus(3000);
                return;
            }
            // Ação: rejeitar primeira reserva pendente
            if (lower.includes('rejeitar') || lower.includes('reject') || lower.includes('recusar')) {
                speak('Rejeitando a primeira reserva pendente.');
                mostrarStatus(XCircle, 'Rejeitando reserva...');
                window.dispatchEvent(new CustomEvent('voice-admin-action', { detail: { action: 'reject-first' } }));
                clearStatus(3000);
                return;
            }
            // Troca de aba
            for (const tabItem of ADMIN_TABS) {
                if (tabItem.keywords.some(kw => fuzzyIncludes(lower, kw))) {
                    speak(`Abrindo ${tabItem.label}.`);
                    mostrarStatus(CheckCircle2, `"${text}" → ${tabItem.label}`);
                    window.dispatchEvent(new CustomEvent('voice-admin-tab', { detail: { tab: tabItem.tab } }));
                    clearStatus(4000);
                    return;
                }
            }
            // Se não reconheceu aba, ainda permite navegação global abaixo
        }

        // ── Comandos de IA (reservar, agendar, etc.) ─────────
        const aiKeywords = ['reservar', 'agendar', 'marcar', 'cancelar reserva', 'quais equipamentos', 'quero reservar'];
        if (aiKeywords.some(kw => lower.startsWith(kw))) {
            mostrarStatus(Bot, 'Encaminhando para IA...');
            speak('Encaminhando seu pedido para a Inteligência Artificial.');
            sessionStorage.setItem('pending_voice_command', text);
            if (locationRef.current !== '/assistente') {
                navigate('/assistente');
            } else {
                window.dispatchEvent(new Event('process-pending-voice'));
            }
            clearStatus(3000);
            return;
        }

        // ── Navegação entre páginas (com fuzzy matching) ─────
        for (const route of ROUTES) {
            const matched = route.keywords.some(kw => fuzzyIncludes(lower, kw));
            if (matched) {
                executeOrConfirm(route.label, () => {
                    speak(`Navegando para ${route.label}.`);
                    mostrarStatus(CheckCircle2, `"${text}" → ${route.label}`);
                    navigate(route.path);
                    clearStatus(4000);
                });
                return;
            }
        }

        // ── Nenhum comando reconhecido ────────────────────────
        speak('Não reconheci o comando. Pressione M e tente novamente.');
        mostrarStatus(XCircle, `"${text}"`);
        clearStatus(5000);
    }, [navigate, speak, listenWithNativeSpeech, clearStatus, pendingConfirmation]);

    // ── Gravação principal ─────────────────────────────────────
    const startRecording = useCallback(() => {
        if (isListeningRef.current) return;
        playActivationBeep(); // bipe instantâneo — sem delay antes
        listenWithNativeSpeech(
            (text) => {
                if (text) {
                    mostrarStatus(null, `"${text}"`);
                    processCommand(text);
                } else {
                    speak('Não consegui entender. Pressione M e tente novamente.');
                    mostrarStatus(XCircle, 'Não entendi.');
                    clearStatus(5000);
                }
            },
            'Ouvindo...',
        );
    }, [listenWithNativeSpeech, processCommand, speak, clearStatus]);

    // Mantém a ref sempre sincronizada com a versão mais recente de startRecording
    useEffect(() => {
        startRecordingRef.current = startRecording;
    }, [startRecording]);

    // ── Atalhos de teclado: M (ativar) e Escape (cancelar) ────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if ((e.key === 'm' || e.key === 'M') && !isListeningRef.current) {
                e.preventDefault();
                startRecording();
                return;
            }

            if (e.key === 'Escape') {
                if (recognitionRef.current) {
                    recognitionRef.current.abort();
                    limparStatus();
                    setIsListening(false);
                    isListeningRef.current = false;
                }
                setShowHelp(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [startRecording]);

    // ── Fecha painel de ajuda ao clicar fora ──────────────────
    useEffect(() => {
        if (!showHelp) return;
        const handleOutsideClick = (e: MouseEvent) => {
            const panel = document.getElementById('voice-help-panel');
            const btn = document.getElementById('voice-help-btn');
            if (panel && !panel.contains(e.target as Node) && btn && !btn.contains(e.target as Node)) {
                setShowHelp(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [showHelp]);

    // ── Escuta eventos genéricos de fala de outros componentes ──
    useEffect(() => {
        const handleVoiceSpeak = (e: Event) => {
            const text = (e as CustomEvent).detail?.text;
            if (text) {
                speak(text);
                mostrarStatus(Volume2, `${text}`);
                clearStatus(4000);
            }
        };
        window.addEventListener('voice-speak', handleVoiceSpeak);
        return () => window.removeEventListener('voice-speak', handleVoiceSpeak);
    }, [speak, clearStatus]);

    // ── Render ───────────────────────────────────────────────
    return (
        <>
            {/* Siri-like Orb centralizado */}
            {isListening && (
                <div className="siri-orb-wrapper" aria-hidden="true" role="status" aria-live="assertive">
                    <div className="siri-orb-ring siri-orb-ring-1"></div>
                    <div className="siri-orb-ring siri-orb-ring-2"></div>
                    <div className="siri-orb-ring siri-orb-ring-3"></div>
                    <div className="siri-orb-core"></div>
                    <div className="siri-orb-text">Ouvindo... <br/><small>Esc para cancelar</small></div>
                </div>
            )}

            <div className="voice-navigator-container">

            {/* Status bubble com animação de saída */}
            {status.texto && !isListening && (
                <div className={`voice-status-bubble${statusFading ? ' fade-out' : ''}`}>
                    {status.Icone && <status.Icone size={16} aria-hidden="true" />}
                    <span>{status.texto}</span>
                </div>
            )}

            {/* Linha com botão de ajuda + FAB */}
            <div className="voice-controls-row" style={{ position: 'relative' }}>

                {/* Painel de ajuda — contextual por página */}
                {showHelp && (
                    <div id="voice-help-panel" className="voice-help-panel" role="dialog" aria-label="Comandos de voz disponíveis">
                        <h4><Mic size={18} aria-hidden="true" /> Comandos Disponíveis</h4>
                        {getHelpSections(locationRef.current).map((section) => (
                            <div key={section.title} className="voice-help-section">
                                <div className="voice-help-section-title">
                                    <section.Icone size={15} aria-hidden="true" />
                                    <span>{section.title}</span>
                                </div>
                                <div className="voice-help-tags">
                                    {section.tags.map(tag => (
                                        <span key={tag} className="voice-help-tag">"{tag}"</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <div className="voice-help-shortcut">
                            <kbd>M</kbd> para ativar &nbsp;·&nbsp; <kbd>Esc</kbd> para cancelar
                        </div>
                    </div>
                )}

                {/* Tooltip de onboarding (primeira visita) */}
                {showOnboarding && (
                    <div className="voice-onboarding-tooltip" role="tooltip">
                        <Mic size={16} aria-hidden="true" /> Pressione <strong>M</strong> para controlar por voz!
                    </div>
                )}

                {/* Botão de ajuda */}
                <button
                    id="voice-help-btn"
                    className={`voice-help-btn${showHelp ? ' active' : ''}`}
                    onClick={() => setShowHelp(v => !v)}
                    title="Ver comandos disponíveis"
                    aria-label="Abrir painel de ajuda de comandos de voz"
                    aria-expanded={showHelp}
                >
                    ?
                </button>

                {/* FAB principal */}
                <button
                    className={`voice-fab${isListening ? ' listening' : ''}`}
                    onClick={isListening ? undefined : startRecording}
                    title={isListening ? 'Ouvindo... (Esc para cancelar)' : 'Pressione M ou clique para comandos de voz'}
                    aria-label={isListening ? 'Microfone ativo. Pressione Escape para cancelar.' : 'Ativar comandos de voz. Atalho: tecla M'}
                    aria-pressed={isListening}
                >
                    {isListening ? <Circle size={20} fill="currentColor" aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
                </button>
            </div>

            {/* Dica de atalho */}
            <div className="voice-shortcut-hint" aria-hidden="true">
                Pressione <kbd>M</kbd>
            </div>

            {/* RNF07 — Aviso de privacidade TTS (primeira utilização) */}
            {showTtsWarning && (
                <div className="tts-warning-banner" role="alert">
                    <p className="tts-warning-banner__title">
                        <AlertTriangle size={16} aria-hidden="true" /> Aviso de Privacidade — Síntese de Voz
                    </p>
                    <p className="tts-warning-banner__text">
                        O reconhecimento e a síntese de voz usam a <strong>Web Speech API</strong> do
                        navegador (Chrome), que pode enviar o áudio e o texto a servidores externos.
                    </p>
                    <button
                        className="tts-warning-banner__btn"
                        onClick={() => {
                            localStorage.setItem('tts_privacy_warning_shown', '1');
                            setShowTtsWarning(false);
                        }}
                    >
                        Entendi, não mostrar novamente
                    </button>
                </div>
            )}
        </div>
        </>
    );
};

export default VoiceNavigator;
