import { useState, useRef, useCallback, useEffect } from 'react';
import { convertBlobToFloat32 } from './audioUtils';

export function useWhisper(onResult: (text: string) => void) {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); // Útil para mostrar status "Processando..."
    const workerRef = useRef<Worker | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timeoutRef = useRef<number | null>(null);
    const t0Ref = useRef<number>(0); // NOVO: Guarda o tempo de início da transcrição

    // Inicializa o Worker em background
    useEffect(() => {
        workerRef.current = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current.postMessage({ type: 'load' });
        
        workerRef.current.onmessage = (e) => {
            if (e.data.status === 'complete') {
                setIsProcessing(false);
                
                // NOVO: Cálculo e formatação da métrica em CSV
                const t1 = performance.now();
                const latencyMs = Math.round(t1 - t0Ref.current);
                const maquina = navigator.userAgent.includes('Mac') ? 'Mac M1' : 'Ryzen 5';
                console.log(`[CSV_METRICA] maquina,modelo,tempo_transcricao_ms,texto_transcrito`);
                console.log(`[CSV_METRICA] ${maquina},Xenova/whisper-base,${latencyMs},"${e.data.text}"`);
                
                onResult(e.data.text);
            } else if (e.data.status === 'error') {
                setIsProcessing(false);
                console.error('Whisper erro:', e.data.data);
                onResult('');
            }
        };
        
        return () => workerRef.current?.terminate();
    }, [onResult]);

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
                // Envia para a IA transcrever
                workerRef.current?.postMessage({ type: 'transcribe', audio: audioFloat32 });
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);

            // Regra de segurança: encerra automaticamente após 10 segundos
            timeoutRef.current = window.setTimeout(() => {
                stopRecording();
            }, 5000);

        } catch (err) {
            console.error("Erro ao acessar microfone", err);
            onResult('');
        }
    }, [stopRecording, onResult]);

    return { startRecording, stopRecording, isRecording, isProcessing };
}