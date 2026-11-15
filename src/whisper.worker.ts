import { pipeline, env } from '@huggingface/transformers';

// Configuração 100% OFFLINE (RNF11)
env.allowRemoteModels = false; 
env.allowLocalModels = true; 

// Usa a URL absoluta do servidor para o Vite não tentar "empacotar" a pasta public
env.localModelPath = self.location.origin + '/models/'; 

// Força o tipo any para evitar o erro ts(18048) e define as opções do ONNX
(env.backends.onnx as any).wasm = {
    wasmPaths: self.location.origin + '/wasm/',
    numThreads: 1
};

class PipelineFactory {
    static task: any = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-base';
    static instance: any = null;

    static async getInstance(progress_callback?: (progressInfo: any) => void) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, {
                progress_callback,
            });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event: MessageEvent) => {
    const { type, audio } = event.data;

    if (type === 'load') {
        try {
            await PipelineFactory.getInstance((x: any) => {
                self.postMessage({ status: 'progress', data: x });
            });
            self.postMessage({ status: 'ready' });
        } catch (err: any) {
            self.postMessage({ status: 'error', data: err.message });
        }
    } else if (type === 'transcribe') {
        try {
            const transcriber = await PipelineFactory.getInstance();
            const output = await transcriber(audio, {
                language: 'portuguese',
                task: 'transcribe',
            });
            self.postMessage({ status: 'complete', text: output.text });
        } catch (err: any) {
            self.postMessage({ status: 'error', data: err.message });
        }
    }
});