// Regras do bloqueio de login (5 senhas erradas seguidas bloqueiam a conta por 15 min).
//
// Ficam fora do server.js para poderem ser testadas sem banco nem servidor
// (RNF09). A rota POST /api/login só aplica o que estas funções decidem.

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
