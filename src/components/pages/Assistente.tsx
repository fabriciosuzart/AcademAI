import React, { useState, useRef, useEffect } from 'react';
import { Bot, User, Brain, Volume2, VolumeX, Mic, Square, Send } from 'lucide-react';
import './Assistente.css';
import CardChat, { type CardChatDados, type EstadoConfirmacao } from '../chat/CardChat';
import api from '../../api/axios';
import { MENSAGEM_RECUSA, respostaDeConfirmacao } from '../../utils/confirmacao';
import { useWhisper } from '../../useWhisper';
import { API_URL } from '../../api/config';
import { getAccessToken } from '../../api/session';
import { escolherVoz } from '../../utils/voz';

interface Message {
  id: string | number;
  sender: 'user' | 'ai';
  text: string;
  // Respostas de ação (listar, reservar...) chegam em JSON com um card e uma linha
  // de resumo, que volta no histórico para a IA entender "e às 16h?".
  card?: CardChatDados;
  resumo?: string;
  // 'local': o backend não conseguiu falar com a IA e usou o analisador de palavras-chave.
  fonte?: 'ia' | 'local';
  // Card "Confirmar reserva" (UC12): pendente até o usuário confirmar ou desistir.
  confirmacao?: EstadoConfirmacao;
  // RF08: finalidade digitada no card de confirmação (obrigatória para gravar).
  finalidade?: string;
  // Esta mensagem pergunta a finalidade da prévia com este id: a próxima resposta é a finalidade.
  perguntaFinalidadePara?: string | number;
}

const PERGUNTA_FINALIDADE =
  'Qual a finalidade do uso? (ex.: "protótipo do projeto integrador") Também dá para escrever no campo do card.';

/** Corpo JSON das respostas de ação do backend (/api/chat e /api/chat/confirmar-reserva). */
interface RespostaAcao {
  texto?: string;
  error?: string;
  card?: CardChatDados | null;
  resumo?: string;
  fonte?: 'ia' | 'local';
  codigo?: string | null;
}

/** Campos da mensagem do assistente a partir de uma resposta JSON do backend. */
function camposDaResposta(data: RespostaAcao): Omit<Message, 'id' | 'sender'> {
  const card = data.card ?? undefined;
  return {
    text: data.texto ?? data.error ?? 'Erro na conexão.',
    card,
    resumo: data.resumo || undefined,
    fonte: data.fonte,
    confirmacao: card?.tipo === 'confirmar' ? 'pendente' : undefined,
  };
}

const Assistente: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'ai', text: 'Olá! 👋 Sou o assistente do Laboratório Inteligente. Como posso ajudar?' }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // A versão mais recente do handleSend, para quem é chamado fora do render (comando de
  // voz global e microfone). Chamar o handleSend capturado na montagem mandava a
  // mensagem com o histórico vazio e o estado antigo da conversa.
  const handleSendRef = useRef<(texto?: string) => Promise<void>>(async () => {});
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  // Processa comandos de voz globais
  useEffect(() => {
    const checkPendingCommand = () => {
      const pendingCmd = sessionStorage.getItem('pending_voice_command');
      if (pendingCmd) {
        sessionStorage.removeItem('pending_voice_command');
        handleSendRef.current(pendingCmd);
      }
    };

    checkPendingCommand(); // Na montagem
    window.addEventListener('process-pending-voice', checkPendingCommand);
    return () => window.removeEventListener('process-pending-voice', checkPendingCommand);
  }, []);

  // --- TEXT TO SPEECH (IA Fala) ---
  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Para falas anteriores
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.2;
    // Mesma escolha do VoiceNavigator: a voz do Perfil ou uma voz local (antes ignorava a do Perfil).
    const voz = escolherVoz();
    if (voz) utterance.voice = voz;
    window.speechSynthesis.speak(utterance);
  };

  // --- PARAR TUDO (Rede e Áudio) ---
  const handleStop = () => {
    // 1. Para a fala imediatamente
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // 2. Cancela a requisição para o servidor
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 3. Atualiza a tela
    setIsLoading(false);
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'ai' && lastMessage?.text === '') {
      messages.pop();
    }
    setMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'ai',
      text: "Geração interrompida pelo usuário."
    }]);
  };

  const mudarConfirmacao = (msgId: Message['id'], confirmacao: EstadoConfirmacao) =>
    setMessages(prev => prev.map(msg => (msg.id === msgId ? { ...msg, confirmacao } : msg)));

  const mudarFinalidade = (msgId: Message['id'], finalidade: string) =>
    setMessages(prev => prev.map(msg => (msg.id === msgId ? { ...msg, finalidade } : msg)));

  const responder = (campos: Omit<Message, 'id' | 'sender'>) => {
    setMessages(prev => [...prev, { id: `ai-${Date.now()}`, sender: 'ai', ...campos }]);
    if (isSpeechEnabled) speak(campos.text);
  };

  // --- CONFIRMAÇÃO DA RESERVA (UC12) ---
  // A prévia já foi validada; o backend valida de novo ao gravar.
  const confirmarReserva = async (msgId: Message['id'], finalidadeInformada?: string) => {
    const alvo = messages.find(m => m.id === msgId);
    if (alvo?.card?.tipo !== 'confirmar' || alvo.confirmacao !== 'pendente') return;
    // RF08: sem finalidade não grava; pergunta (por texto ou voz) e espera a resposta.
    const finalidade = (finalidadeInformada ?? alvo.finalidade ?? '').trim();
    if (!finalidade) {
      responder({ text: PERGUNTA_FINALIDADE, perguntaFinalidadePara: msgId });
      return;
    }
    const { equipmentId, date, time, endTime } = alvo.card.previa;
    mudarConfirmacao(msgId, 'enviando');
    try {
      const { data } = await api.post<RespostaAcao>('/chat/confirmar-reserva', {
        equipmentId, date, time, endTime, justification: finalidade,
      });
      if (data.codigo === 'FALTA_FINALIDADE') {
        mudarConfirmacao(msgId, 'pendente');
        responder({ text: PERGUNTA_FINALIDADE, perguntaFinalidadePara: msgId });
        return;
      }
      mudarConfirmacao(msgId, 'feita');
      responder(camposDaResposta(data));
    } catch (error) {
      console.error(error);
      mudarConfirmacao(msgId, 'pendente');
      responder({ text: 'Não consegui confirmar a reserva agora. Tente de novo.' });
    }
  };

  const descartarReserva = (msgId: Message['id']) => {
    mudarConfirmacao(msgId, 'descartada');
    responder({ text: MENSAGEM_RECUSA });
  };

  // --- NOVA FUNÇÃO DE ENVIO COM STREAMING ---
  const handleSend = async (textOverride?: string) => {
    const textToSend = typeof textOverride === 'string' ? textOverride : input;

    if (!textToSend || !textToSend.trim()) return;

    const ultimaDoAssistente = [...messages].reverse().find(m => m.sender === 'ai' && m.text);

    // Resposta à pergunta da finalidade (RF08): a mensagem é a finalidade, e a
    // reserva é confirmada com ela. "não" desiste; um "sim" solto pergunta de novo.
    const previaDaPergunta = ultimaDoAssistente?.perguntaFinalidadePara !== undefined
      ? messages.find(m => m.id === ultimaDoAssistente.perguntaFinalidadePara)
      : undefined;
    if (previaDaPergunta?.confirmacao === 'pendente') {
      setMessages(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: textToSend }]);
      setInput('');
      const resposta = respostaDeConfirmacao(textToSend);
      if (resposta === 'nao') descartarReserva(previaDaPergunta.id);
      else if (resposta === 'sim') responder({ text: PERGUNTA_FINALIDADE, perguntaFinalidadePara: previaDaPergunta.id });
      else {
        mudarFinalidade(previaDaPergunta.id, textToSend.trim());
        await confirmarReserva(previaDaPergunta.id, textToSend.trim());
      }
      return;
    }

    // Com uma prévia de reserva aberta, "sim" confirma e "não" descarta, sem IA:
    // funciona igual digitando ou falando.
    const pendente = ultimaDoAssistente;
    const aguardando = pendente?.confirmacao === 'pendente';
    const resposta = aguardando ? respostaDeConfirmacao(textToSend) : null;
    if (pendente && resposta) {
      setMessages(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: textToSend }]);
      setInput('');
      if (resposta === 'sim') await confirmarReserva(pendente.id);
      else descartarReserva(pendente.id);
      return;
    }
    // Qualquer outra resposta ("não, muda para as 15h") segue para o assistente,
    // e a prévia deixa de valer: um "sim" solto mais tarde não confirma uma reserva
    // que já não é a que o usuário quer (regra do protocolo da Juliana).
    if (pendente && aguardando) mudarConfirmacao(pendente.id, 'descartada');

    const timestamp = Date.now();
    const userMsgId = `user-${timestamp}`;
    const aiMsgId = `ai-${timestamp}`;

    setMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: textToSend }]);
    setMessages(prev => [...prev, { id: aiMsgId, sender: 'ai', text: '' }]);

    setInput('');
    setIsLoading(true);

    try {
      abortControllerRef.current = new AbortController();

      const token = getAccessToken();

      // O backend aceita 'history' e monta o contexto da conversa com ele, mas
      // nada estava enviando — cada pergunta chegava sem memória do que veio
      // antes. Mandamos as últimas trocas, limitadas para não crescer sem fim.
      const HISTORICO_MAX = 10;
      const history = messages
        .filter(m => m.text.trim())
        .slice(-HISTORICO_MAX)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.resumo ? `${m.text} ${m.resumo}` : m.text
        }));

      // Continuamos com fetch em vez do cliente axios porque esta rota responde
      // em streaming, e o axios no navegador só entrega o corpo já completo.
      // A identidade vai só no token (o backend ignora userId no corpo).
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: textToSend,
          history
        }),
        signal: abortControllerRef.current.signal,
      });

      // Ações (listar, reservar, ajuda...) vêm prontas em JSON: frase fixa + card.
      // Dúvidas sobre os documentos continuam em texto, em streaming.
      if ((response.headers.get('content-type') ?? '').includes('application/json')) {
        const campos = camposDaResposta(await response.json());
        setMessages(prev => prev.map(msg => (msg.id === aiMsgId ? { ...msg, ...campos } : msg)));
        if (isSpeechEnabled) speak(campos.text);
        return;
      }

      if (!response.body) throw new Error("Sem corpo na resposta");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Atualiza APENAS o balão com o ID da IA
        setMessages(prev => prev.map(msg =>
          msg.id === aiMsgId ? { ...msg, text: fullText } : msg
        ));
      }

      if (isSpeechEnabled) {
        speak(fullText);
      }

    } catch (error) {
      // O abort do botão de parar chega como DOMException, que é um Error.
      if (error instanceof Error && error.name === "AbortError") return;

      console.error(error);
      setMessages(prev => prev.map(msg =>
        msg.id === aiMsgId ? { ...msg, text: "Erro na conexão." } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // --- SPEECH TO TEXT ---
  // Whisper local (useWhisper), o mesmo do VoiceNavigator: o áudio não sai do navegador.
  // Antes era o webkitSpeechRecognition do Chrome, que envia o áudio a servidores externos.
  const { startRecording, stopRecording, isRecording, isProcessing: isTranscribing, erro: erroVoz } = useWhisper((texto) => {
    if (!texto) return;
    setInput(texto);
    handleSendRef.current(texto);
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="assistente-container" role="main" aria-label="Assistente Virtual de Inteligência Artificial">
      <div className="chat-interface">
        <div className="chat-history" aria-live="polite" aria-label="Histórico de mensagens do chat">
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.sender}`}>
              <div className="avatar">
                {msg.sender === 'ai'
                  ? <Bot size={20} aria-hidden="true" />
                  : <User size={20} aria-hidden="true" />}
              </div>
              <div className="message-content">
                {/* Se for IA e o texto estiver vazio, mostra o indicador, senão mostra o texto */}
                <p>
                  {msg.sender === 'ai' && msg.text === '' ? (
                    <span className="blinking-cursor"><Brain size={16} aria-hidden="true" /> Pensando...</span>
                  ) : (
                    msg.text
                  )}
                </p>

                {msg.card && (
                  <CardChat
                    card={msg.card}
                    estado={msg.confirmacao}
                    finalidade={msg.finalidade ?? ''}
                    onFinalidade={(valor) => mudarFinalidade(msg.id, valor)}
                    onConfirmar={(finalidade) => confirmarReserva(msg.id, finalidade)}
                    onDescartar={() => descartarReserva(msg.id)}
                  />
                )}

                {msg.fonte === 'local' && (
                  <span className="msg-offline" title="Pedido interpretado sem IA, por palavras-chave">
                    modo offline · IA indisponível
                  </span>
                )}

                {msg.sender === 'ai' && msg.text !== '' && (
                  <button type="button" className="speak-btn" onClick={() => speak(msg.text)} title="Ouvir resposta" aria-label="Ouvir resposta da Inteligência Artificial em áudio"><Volume2 size={16} aria-hidden="true" /></button>
                )}
              </div>
            </div>
          ))}

          <div ref={chatEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="input-container-limit">
            <div className="input-wrapper">

              <button
                type="button"
                className={`icon-button speech-toggle ${isSpeechEnabled ? 'active' : ''}`}
                onClick={() => setIsSpeechEnabled(!isSpeechEnabled)}
                title={isSpeechEnabled ? "Desativar fala automática" : "Ativar fala automática"}
                aria-label={isSpeechEnabled ? "Desativar leitura em voz alta automática" : "Ativar leitura em voz alta automática das mensagens da Inteligência Artificial"}
              >
                {isSpeechEnabled ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
              </button>

              <button
                type="button"
                className={`icon-button mic-button ${isRecording ? 'listening' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading || isTranscribing}
                title={isRecording ? "Parar gravação" : "Falar no microfone"}
                aria-label={isRecording ? "Parar de gravar e transcrever" : "Gravar uma mensagem de voz (transcrita no próprio navegador)"}
              >
                {isRecording ? <Square size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isTranscribing ? 'Transcrevendo o áudio...' : 'Digite sua dúvida ou use o microfone...'}
                rows={1}
                disabled={isLoading}
                aria-label="Caixa de texto para digitar sua mensagem para o assistente"
              />

              {isLoading ? (
                <button
                  type="button"
                  className="send-btn stop-btn"
                  onClick={handleStop}
                  title="Interromper resposta"
                  aria-label="Interromper geração da resposta da Inteligência Artificial"
                >
                  ⏹️
                </button>
              ) : (
                <button
                  type="button"
                  className="send-btn"
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  aria-label="Enviar mensagem digitada"
                >
                  <Send size={20} aria-hidden="true" />
                </button>
              )}

            </div>
            {erroVoz && <p className="erro-voz" role="alert">{erroVoz}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assistente;