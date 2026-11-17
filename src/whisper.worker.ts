import { pipeline, env, type AutomaticSpeechRecognitionPipeline, type ProgressCallback } from '@huggingface/transformers';

// Configuração 100% OFFLINE (RNF11)
env.allowRemoteModels = false; 
env.allowLocalModels = true; 

// Usa a URL absoluta do servidor para o Vite não tentar "empacotar" a pasta public
env.localModelPath = self.location.origin + '/models/'; 

// Opções do ONNX Runtime: binários servidos de public/wasm e uma thread só.
// O objeto `wasm` é do próprio runtime (somente leitura no tipo): ajusta os campos dele.
const wasmPaths = self.location.origin + '/wasm/';
const onnx = env.backends.onnx;
if (onnx.wasm) {
    onnx.wasm.wasmPaths = wasmPaths;
    onnx.wasm.numThreads = 1;
} else {
    Object.assign(onnx, { wasm: { wasmPaths, numThreads: 1 } });
}

class PipelineFactory {
    static task = 'automatic-speech-recognition' as const;
    static model = 'Xenova/whisper-base';
    static instance: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

    static getInstance(progress_callback?: ProgressCallback) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, {
                progress_callback,
            });
        }
        return this.instance;
    }
}

const mensagem = (err: unknown) => (err instanceof Error ? err.message : String(err));

self.addEventListener('message', async (event: MessageEvent) => {
    const { type, audio } = event.data;

    if (type === 'load') {
        try {
            await PipelineFactory.getInstance((x) => {
                self.postMessage({ status: 'progress', data: x });
            });
            self.postMessage({ status: 'ready' });
        } catch (err) {
            self.postMessage({ status: 'error', data: mensagem(err) });
        }
    } else if (type === 'transcribe') {
        try {
            const transcriber = await PipelineFactory.getInstance();
            const output = await transcriber(audio, {
                language: 'portuguese',
                task: 'transcribe',
            });
            // Um áudio só: o resultado é um objeto (lista só quando entram vários áudios).
            const text = Array.isArray(output) ? (output[0]?.text ?? '') : output.text;
            self.postMessage({ status: 'complete', text });
        } catch (err) {
            self.postMessage({ status: 'error', data: mensagem(err) });
        }
    }
});