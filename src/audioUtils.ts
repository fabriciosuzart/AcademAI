export async function convertBlobToFloat32(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    
    // Inicia o contexto de áudio forçando a amostragem em 16.000 Hz (exigência do Whisper)
    const audioContext = new (window.AudioContext || window.webkitAudioContext!)({ sampleRate: 16000 });
    
    // Decodifica o áudio do formato do navegador (webm/ogg) para PCM bruto
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // O Whisper processa apenas áudio mono, então extraímos apenas o canal 0
    return audioBuffer.getChannelData(0);
}