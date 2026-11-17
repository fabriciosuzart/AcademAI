import { useState, useRef, useCallback, useEffect } from 'react';
import { convertBlobToFloat32 } from './audioUtils';

// Transcrição local com o Whisper (whisper.worker.ts), sem enviar áudio para fora (RNF11).
//
// O worker é ÚNICO para o app inteiro: o VoiceNavigator (sempre montado) e o
// microfone do Assistente usam o mesmo modelo, carregado uma vez só. Antes cada
// hook criava o seu, e o efeito dependia do callback: como o VoiceNavigator passa
// uma função nova a cada render, o worker (e o modelo) era recriado o tempo todo.

type MensagemWorker = { status: 'progress' | 'ready' | 'complete' | 'error'; text?: string; data?: unknown };

let worker: Worker | null = null;
// Quem iniciou a transcrição atual recebe o resultado. Só uma gravação por vez.
let dono: ((msg: MensagemWorker) => void) | null = null;

function obterWorker(): Worker {
    if (!worker) {
        worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
        worker.postMessage({ type: 'load' });
        worker.onmessage = (e: MessageEvent<MensagemWorker>) => dono?.(e.data);
    }
    return worker;
}

/** Tempo máximo de uma gravação: encerra sozinha depois de 5 segundos. */
const DURACAO_MAXIMA_MS = 5000;

export function useWhisper(onResult: (text: string) => void) {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); // Útil para mostrar status "Transcrevendo..."
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timeoutRef = useRef<number | null>(null);
    const t0Ref = useRef<number>(0); // Guarda o tempo de início da transcrição

    // O callback mais recente, sem recriar nada quando ele muda.
    const onResultRef = useRef(onResult);
    useEffect(() => {
        onResultRef.current = onResult;
    });

    const tratarMensagem = useCallback((msg: MensagemWorker) => {
        if (msg.status === 'complete') {
            setIsProcessing(false);

            // Métrica em CSV para o TCC (tempo de transcrição)
            const latencyMs = Math.round(performance.now() - t0Ref.current);
            const maquina = navigator.userAgent.includes('Mac') ? 'Mac M1' : 'Ryzen 5';
            console.log(`[CSV_METRICA] maquina,modelo,tempo_transcricao_ms,texto_transcrito`);
            console.log(`[CSV_METRICA] ${maquina},Xenova/whisper-base,${latencyMs},"${msg.text}"`);

            onResultRef.current((msg.text ?? '').trim());
        } else if (msg.status === 'error') {
            setIsProcessing(false);
            console.error('Whisper erro:', msg.data);
            onResultRef.current('');
        }
    }, []);

    // Já começa a carregar o modelo, para a primeira gravação não esperar por ele.
    // O worker compartilhado não é encerrado ao desmontar: outro componente pode usá-lo.
    useEffect(() => {
        obterWorker();
        return () => {
            if (dono === tratarMensagem) dono = null;
        };
    }, [tratarMensagem]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
    }, []);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                setIsProcessing(true);
                // Libera o microfone (apaga a luz vermelha da aba)
                stream.getTracks().forEach(track => track.stop());

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFloat32 = await convertBlobToFloat32(audioBlob);

                t0Ref.current = performance.now();
                // Este hook passa a receber o resultado do worker compartilhado
                dono = tratarMensagem;
                obterWorker().postMessage({ type: 'transcribe', audio: audioFloat32 });
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);

            // Regra de segurança: encerra automaticamente após DURACAO_MAXIMA_MS
            timeoutRef.current = window.setTimeout(() => {
                stopRecording();
            }, DURACAO_MAXIMA_MS);

        } catch (err) {
            console.error("Erro ao acessar microfone", err);
            onResultRef.current('');
        }
    }, [stopRecording, tratarMensagem]);

    return { startRecording, stopRecording, isRecording, isProcessing };
}
