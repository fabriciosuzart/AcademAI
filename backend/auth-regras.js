// Regras do bloqueio de login (5 senhas erradas seguidas bloqueiam a conta por 15 min).
//
// Ficam fora do server.js para poderem ser testadas sem banco nem servidor
// (RNF09). A rota POST /api/login só aplica o que estas funções decidem.

import crypto from 'crypto';

export const MAX_TENTATIVAS_LOGIN = 5;
export const BLOQUEIO_LOGIN_MS = 15 * 60 * 1000;

/** true enquanto a conta está bloqueada por excesso de tentativas. */
export function contaBloqueada(usuario, agora = new Date()) {
    return Boolean(usuario.lockedUntil && new Date(usuario.lockedUntil) > agora);
}

/** true se houve um bloqueio que já venceu (as tentativas recomeçam do zero). */
export function bloqueioVencido(usuario, agora = new Date()) {
    return Boolean(usuario.lockedUntil && new Date(usuario.lockedUntil) <= agora);
}

/**
 * Novo estado depois de uma senha errada: { failedLoginAttempts, lockedUntil }.
 *
 * Se o bloqueio anterior já venceu, a contagem recomeça do zero. Antes a rota
 * zerava o banco mas somava a partir do valor antigo, e uma única senha errada
 * logo depois de um bloqueio vencido bloqueava a conta de novo.
 */
export function aposSenhaErrada(usuario, agora = new Date()) {
    const anteriores = bloqueioVencido(usuario, agora) ? 0 : (usuario.failedLoginAttempts || 0);
    const failedLoginAttempts = anteriores + 1;
    const lockedUntil = failedLoginAttempts >= MAX_TENTATIVAS_LOGIN
        ? new Date(agora.getTime() + BLOQUEIO_LOGIN_MS)
        : null;
    return { failedLoginAttempts, lockedUntil };
}

// RF07 — a senha temporária (recuperação por e-mail ou reset pelo administrador)
// vale por 60 minutos e é de uso único: no primeiro login o usuário é obrigado a
// trocá-la, e a troca apaga a validade.
export const VALIDADE_SENHA_TEMPORARIA_MS = 60 * 60 * 1000;

/** true se o usuário entrou com senha temporária já vencida. */
export function senhaTemporariaExpirada(usuario, agora = new Date()) {
    if (usuario.isTempPassword !== 1) return false;
    if (!usuario.tempPasswordExpiresAt) return false; // senhas temporárias antigas, sem validade gravada
    return new Date(usuario.tempPasswordExpiresAt) <= agora;
}

/** Validade de uma senha temporária gerada agora. */
export const validadeSenhaTemporaria = (agora = new Date()) => new Date(agora.getTime() + VALIDADE_SENHA_TEMPORARIA_MS);

const LETRAS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITOS = '23456789';

/**
 * Senha temporária de 10 caracteres, com letras e números (atende o RF01), gerada
 * com crypto em vez de Math.random. Sem caracteres ambíguos (0/O, 1/l/I).
 */
export function gerarSenhaTemporaria(tamanho = 10) {
    const todos = LETRAS + DIGITOS;
    const escolher = (conjunto) => conjunto[crypto.randomInt(conjunto.length)];
    const chars = [escolher(LETRAS), escolher(DIGITOS)];
    while (chars.length < tamanho) chars.push(escolher(todos));
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}
