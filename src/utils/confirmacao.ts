// Resposta a uma prévia de reserva do chat ("Confirma?"), por texto ou voz.
//
// Resolvida no navegador, sem IA. Regra e listas de palavras da Juliana
// (backend/confirmacao-reserva.js da branch feature/juliana/ajustesfinos),
// conservadoras de propósito: só confirma quando a mensagem INTEIRA é uma
// afirmação ("sim", "pode reservar", "ok, obrigado"). Qualquer coisa a mais
// ("sim, mas às 15h", "não, muda para as 15h") não confirma nem recusa: segue
// para o assistente, que trata como um pedido novo. Na dúvida, não grava.

// Palavras que, sozinhas, já afirmam.
const AFIRMACOES_FORTES = new Set([
  'sim', 's', 'ss', 'confirmo', 'confirma', 'confirmado', 'confirmada', 'confirmar',
  'ok', 'okay', 'okk', 'isso', 'certo', 'correto', 'correta', 'exato', 'exatamente',
  'claro', 'perfeito', 'positivo', 'fechado', 'beleza', 'blz', 'yes', 'pode', 'bora',
]);

// Palavras neutras que podem acompanhar uma afirmação.
const COMPLEMENTOS_AFIRMACAO = new Set([
  'a', 'o', 'e', 'de', 'da', 'do', 'eu', 'ja', 'entao', 'mesmo', 'tudo', 'por', 'favor',
  'pfv', 'pf', 'obrigado', 'obrigada', 'valeu', 'vlw', 'reserva', 'reservar', 'reserve',
  'fazer', 'faz', 'faca', 'agendar', 'agenda', 'pode', 'manda', 'ver', 'maquina', 'esta',
  'ta', 'sim', 'senhor', 'senhora', 'com', 'certeza', 'quero', 'confirmar',
]);

// Palavras que indicam recusa.
const NEGACOES = new Set([
  'nao', 'n', 'no', 'nope', 'negativo', 'cancela', 'cancelar', 'cancele', 'errado',
  'errada', 'incorreto', 'incorreta', 'espera', 'pera', 'calma',
]);

// Palavras que podem acompanhar uma recusa "pura" (sem dizer o que mudar).
const COMPLEMENTOS_RECUSA = new Set([
  'a', 'o', 'e', 'de', 'da', 'do', 'eu', 'isso', 'esta', 'ta', 'assim', 'certo', 'correto',
  'quero', 'mais', 'ainda', 'obrigado', 'obrigada', 'reserva', 'reservar', 'pode', 'por',
  'favor', 'mudar', 'alterar', 'trocar', 'corrigir', 'algo', 'coisa', 'uma', 'um', 'ai',
  'preciso', 'deixa', 'mesmo', 'nada', 'disso', 'confirmo', 'confirma', 'confirmar',
]);

/** Resposta à recusa: nada foi gravado, e o usuário diz o que quer mudar. */
export const MENSAGEM_RECUSA =
  'Tudo bem, a reserva NÃO foi feita. O que você deseja alterar: a máquina, a data ou o horário?';

const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Classifica a resposta à prévia de reserva.
 * - 'sim': confirmação explícita, pode gravar;
 * - 'nao': recusa sem dizer o que mudar;
 * - null: qualquer outra coisa (inclui "não, muda para 15h"): vai para o assistente.
 */
export function respostaDeConfirmacao(texto: string): 'sim' | 'nao' | null {
  const bruto = texto.trim();
  if (/^(👍|✅|👌)+$/u.test(bruto)) return 'sim';

  const tokens = normalizar(bruto).split(' ').filter(Boolean);
  if (tokens.length === 0) return null;

  if (tokens.some((t) => NEGACOES.has(t))) {
    const recusaPura = tokens.every((t) => NEGACOES.has(t) || COMPLEMENTOS_RECUSA.has(t));
    return recusaPura ? 'nao' : null;
  }

  const soAfirmacao = tokens.every((t) => AFIRMACOES_FORTES.has(t) || COMPLEMENTOS_AFIRMACAO.has(t));
  const temAfirmacaoForte = tokens.some((t) => AFIRMACOES_FORTES.has(t));
  return soAfirmacao && temAfirmacaoForte ? 'sim' : null;
}
