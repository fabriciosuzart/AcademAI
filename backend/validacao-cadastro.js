// backend/validacao-cadastro.js — validacao de cadastro (RF01), lado servidor.
//
// O frontend (Cadastro.tsx) ja avisa o usuario, mas a checagem do cliente e
// so conveniencia: uma chamada direta a POST /api/register a ignora por
// completo. A regra que vale mora aqui.
//
// RF01: "e-mail institucional (com validacao de formato e verificacao de
// dominio institucional) e senha (minimo 8 caracteres, letras e numeros)".
//
// O dominio institucional e parametrizavel (o documento enfatiza configuracao
// sem tocar no codigo): defina INSTITUTIONAL_EMAIL_DOMAINS (lista separada por
// virgula) em producao. O padrao 'academai.com' cobre as contas do seed e a
// demo local sem configuracao extra. Subdominios (ex.: aluno.academai.com)
// sao aceitos.

export const DOMINIOS_INSTITUCIONAIS = (process.env.INSTITUTIONAL_EMAIL_DOMAINS || 'academai.com')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Retorna uma mensagem de erro (string) se invalido, ou null se valido.
export function validarEmailInstitucional(email) {
    if (typeof email !== 'string' || !RE_EMAIL.test(email)) {
        return 'Informe um e-mail válido.';
    }
    const dominio = email.split('@')[1].toLowerCase();
    const permitido = DOMINIOS_INSTITUCIONAIS.some(
        (d) => dominio === d || dominio.endsWith('.' + d)
    );
    if (!permitido) {
        return `Use um e-mail institucional (${DOMINIOS_INSTITUCIONAIS.join(', ')}).`;
    }
    return null;
}

export function validarSenha(senha) {
    if (typeof senha !== 'string' || senha.length < 8) {
        return 'A senha deve ter no mínimo 8 caracteres.';
    }
    if (!/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) {
        return 'A senha deve conter letras e números.';
    }
    return null;
}
