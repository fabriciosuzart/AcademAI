// Extensões do Window usadas pelo app.
interface Window {
  /** Safari antigo expõe o AudioContext com prefixo. */
  webkitAudioContext?: typeof AudioContext;
}
