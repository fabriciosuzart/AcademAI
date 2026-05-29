import React, { useState, useRef, useEffect } from 'react';
import './Assistente.css';

interface Message {
  id: string | number;
  sender: 'user' | 'ai';
  text: string;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

const Assistente: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'ai', text: 'Olá! 👋 Sou o assistente do Laboratório Inteligente. Como posso ajudar?' }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // --- TEXT TO SPEECH (IA Fala) ---
  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Para falas anteriores
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.2;
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
      text: "🛑 Geração interrompida pelo usuário."
    }]);
  };

  // --- NOVA FUNÇÃO DE ENVIO COM STREAMING ---
  const handleSend = async (textOverride?: string) => {
    const textToSend = typeof textOverride === 'string' ? textOverride : input;

    if (!textToSend || !textToSend.trim()) return;

    const timestamp = Date.now();
    const userMsgId = `user-${timestamp}`;
    const aiMsgId = `ai-${timestamp}`;

    setMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: textToSend }]);
    setMessages(prev => [...prev, { id: aiMsgId, sender: 'ai', text: '' }]);

    setInput('');
    setIsLoading(true);

    try {
      abortControllerRef.current = new AbortController();

      // Pegando o ID do usuário logado do cache do navegador 
      const idLogado = localStorage.getItem('userId');

      console.log("ID enviado:", idLogado);
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 👇 Agora enviamos a mensagem E o userId 👇
        body: JSON.stringify({
          message: textToSend,
          userId: idLogado ? parseInt(idLogado) : null
        }),
        signal: abortControllerRef.current.signal,
      });

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

    } catch (error: any) {
      if (error.name === "AbortError") return;

      console.error(error);
      setMessages(prev => prev.map(msg =>
        msg.id === aiMsgId ? { ...msg, text: "Erro na conexão." } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // --- SPEECH TO TEXT ---
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Use o Google Chrome para reconhecimento de voz.");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);

    // Garante que o estado visual do microfone desligue
    recognition.onend = () => setIsListening(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);

      if (event.results[0].isFinal) {
        recognition.stop(); // <--- FORÇA O MICROFONE A PARAR
        setIsListening(false);
        handleSend(transcript);
      }
    };
    recognition.start();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="assistente-container">
      <div className="chat-interface">
        <div className="chat-history">
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.sender}`}>
              <div className="avatar">{msg.sender === 'ai' ? '🤖' : '👤'}</div>
              <div className="message-content">
                {/* Se for IA e o texto estiver vazio, mostra o indicador, senão mostra o texto */}
                <p>
                  {msg.sender === 'ai' && msg.text === '' ? (
                    <span className="blinking-cursor">Pensando... 🧠</span>
                  ) : (
                    msg.text
                  )}
                </p>

                {msg.sender === 'ai' && msg.text !== '' && (
                  <button type="button" className="speak-btn" onClick={() => speak(msg.text)} title="Ouvir">🔊</button>
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
                title={isSpeechEnabled ? "Desativar fala" : "Ativar fala"}
              >
                {isSpeechEnabled ? '🔊' : '🔇'}
              </button>

              <button
                type="button"
                className={`icon-button mic-button ${isListening ? 'listening' : ''}`}
                onClick={startListening}
                disabled={isLoading}
                title="Falar"
              >
                {isListening ? '🛑' : '🎙️'}
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua dúvida ou use o microfone..."
                rows={1}
                disabled={isLoading}
              />

              {isLoading ? (
                <button
                  type="button"
                  className="send-btn stop-btn"
                  onClick={handleStop}
                  title="Parar resposta"
                >
                  ⏹️
                </button>
              ) : (
                <button
                  type="button"
                  className="send-btn"
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                >
                  ➤
                </button>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assistente;