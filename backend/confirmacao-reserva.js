// backend/confirmacao-reserva.js
//
// Protocolo de confirmação da reserva feita pelo assistente (chat).
//
// Regra 1: com máquina, data e horário coletados, o assistente PAUSA e pergunta
//          "Confirma a reserva da máquina [X] para o dia [Y] às [Z]?".
// Regra 2: nada é gravado no banco antes da resposta do usuário.
// Regra 3: só um "sim" explícito grava; uma recusa faz perguntar o que alterar.
//
// Por que no servidor e não só no prompt: o modelo local (llama3.2) nem sempre
// obedece instruções. Se a trava ficasse só no texto do prompt, bastaria ele
// "esquecer" a regra para gravar uma reserva sem confirmação. Aqui a ferramenta
// 'solicitar_reserva' apenas cria um RASCUNHO; a gravação só acontece quando o
// backend reconhece a confirmação do usuário na mensagem seguinte.
//
// O rascunho vive em memória, por usuário, e expira sozinho. Reiniciar o
// servidor descarta rascunhos — aceitável: nada foi gravado ainda.

export const TTL_RASCUNHO_MS = 10 * 60 * 1000; // 10 min para o usuário responder

const rascunhos = new Map(); // userId -> { args, aguardandoConfirmacao, expiraEm }

function chave(userId) {
    return String(userId);
}

/** Rascunho vigente do usuário (ou null). Remove o que já expirou. */
export function obterRascunho(userId, agora = Date.now()) {
    if (userId === null || userId === undefined) return null;
    const r = rascunhos.get(chave(userId));
    if (!r) return null;
    if (r.expiraEm <= agora) {
        rascunhos.delete(chave(userId));
        return null;
    }
    return r;
}

/** Guarda (ou substitui) o rascunho e marca que estamos esperando o "sim". */
export function salvarRascunho(userId, args, agora = Date.now()) {
    const r = { args: { ...args }, aguardandoConfirmacao: true, expiraEm: agora + TTL_RASCUNHO_MS };
    rascunhos.set(chave(userId), r);
    return r;
}

/**
 * Mantém os dados (base para o usuário alterar só um campo), mas deixa de
 * esperar confirmação: um "sim" solto mais adiante NÃO grava nada sem que a
 * pergunta seja feita de novo.
 */
export function encerrarEsperaDeConfirmacao(userId) {
    const r = rascunhos.get(chave(userId));
    if (r) r.aguardandoConfirmacao = false;
}

export function descartarRascunho(userId) {
    rascunhos.delete(chave(userId));
}

/** "2026-10-25" -> "25/10/2026". Devolve o valor original se não for ISO. */
export function formatarDataBR(dataISO) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataISO || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(dataISO || '');
}

/** Regra 1 — texto exato da pergunta de confirmação. */
export function perguntaDeConfirmacao({ equipmentName, date, time }) {
    return `Confirma a reserva da máquina ${equipmentName} para o dia ${formatarDataBR(date)} às ${time}?`;
}

export const MENSAGEM_RECUSA =
    'Tudo bem, a reserva NÃO foi feita. O que você deseja alterar: a máquina, a data ou o horário?';

// --- Classificação da resposta do usuário -----------------------------------
//
// Conservadora de propósito: só é CONFIRMA quando a mensagem inteira é uma
// afirmação ("sim", "confirmo", "pode reservar", "ok, obrigado"). Qualquer coisa
// a mais ("sim, mas às 15h") vira OUTRO e volta para a IA tratar como alteração —
// na dúvida, não grava.

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

function normalizar(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Classifica a resposta à pergunta de confirmação.
 * @returns {'CONFIRMA' | 'RECUSA' | 'OUTRO'}
 *  - CONFIRMA: confirmação explícita — pode gravar.
 *  - RECUSA:   recusa sem dizer o que mudar — perguntar o que alterar.
 *  - OUTRO:    qualquer outra coisa (inclui "não, muda para 15h") — não grava;
 *              a IA trata, normalmente pedindo nova confirmação.
 */
export function classificarResposta(texto) {
    const bruto = String(texto || '').trim();
    if (/^(👍|✅|👌)+$/u.test(bruto)) return 'CONFIRMA';

    const tokens = normalizar(bruto).split(' ').filter(Boolean);
    if (tokens.length === 0) return 'OUTRO';

    if (tokens.some(t => NEGACOES.has(t))) {
        const recusaPura = tokens.every(t => NEGACOES.has(t) || COMPLEMENTOS_RECUSA.has(t));
        return recusaPura ? 'RECUSA' : 'OUTRO';
    }

    const soAfirmacao = tokens.every(t => AFIRMACOES_FORTES.has(t) || COMPLEMENTOS_AFIRMACAO.has(t));
    const temAfirmacaoForte = tokens.some(t => AFIRMACOES_FORTES.has(t));
    return soAfirmacao && temAfirmacaoForte ? 'CONFIRMA' : 'OUTRO';
}
