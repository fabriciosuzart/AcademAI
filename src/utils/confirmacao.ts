// Resposta curta a uma prévia de reserva do chat ("Confirma?"), por texto ou voz.
//
// Resolvida no navegador, sem IA: depois do card de confirmação, "sim" ou "pode"
// confirmam e "não" ou "deixa" descartam. Só frases curtas contam (até 4 palavras),
// para "cancelar minha reserva da cortadora" continuar indo para o assistente.

const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.!?,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const SIM = /^(sim|s|confirmo|confirmar|confirma|pode|ok|isso|claro|beleza|fechado|quero)\b/;
const NAO = /^(nao|n|cancela|cancelar|deixa|esquece|desisto)\b/;

export function respostaDeConfirmacao(texto: string): 'sim' | 'nao' | null {
  const t = normalizar(texto);
  if (!t || t.split(' ').length > 4) return null;
  if (NAO.test(t)) return 'nao';
  if (SIM.test(t)) return 'sim';
  return null;
}
