// Escolha da voz da leitura em voz alta (TTS, RF27).
//
// A síntese usa a Web Speech API do navegador. Vozes marcadas como
// `localService` rodam no próprio computador; as outras (ex.: "Google
// português do Brasil" no Chrome) mandam o texto para um servidor. Para manter
// o sistema local, sem escolha explícita do usuário vale a melhor voz LOCAL
// em português. Uma voz online só é usada se o usuário a escolher no Perfil.

/** Voz preferida do Perfil; senão a primeira voz local em pt-BR, depois em pt; senão null (padrão do navegador). */
export function escolherVoz(): SpeechSynthesisVoice | null {
  if (!window.speechSynthesis) return null;
  const vozes = window.speechSynthesis.getVoices();

  const preferida = localStorage.getItem('preferredVoiceURI');
  if (preferida) {
    const escolhida = vozes.find((v) => v.voiceURI === preferida);
    if (escolhida) return escolhida;
  }

  const locais = vozes.filter((v) => v.localService);
  return (
    locais.find((v) => v.lang.toLowerCase() === 'pt-br') ??
    locais.find((v) => v.lang.toLowerCase().startsWith('pt')) ??
    null
  );
}

/** Rótulo de uma voz no seletor do Perfil, deixando claro quando ela usa a internet. */
export const rotuloDaVoz = (v: SpeechSynthesisVoice) =>
  `${v.name} (${v.lang})${v.localService ? '' : ' — online'}`;
