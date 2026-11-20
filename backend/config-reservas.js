// Regras de negocio da reserva que o RF08 declara "configuraveis pelo
// administrador": antecedencia minima, duracao minima/maxima, limite de
// reservas ativas simultaneas por usuario e antecedencia do cancelamento (RF15).
//
// Os valores padrao ficam aqui; o administrador os altera no painel
// (PUT /api/config/reservas), e a alteracao e gravada em regras-reservas.json,
// lido ao subir o servidor. As duas pontas que criam reserva — a rota REST
// (POST /api/schedule) e o chat (acoes_chat.js) — usam estas mesmas funcoes.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { paraMinutos } from './horarios.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ARQUIVO_REGRAS = process.env.REGRAS_RESERVA_ARQUIVO || path.join(__dirname, 'regras-reservas.json');

export const REGRAS_PADRAO = Object.freeze({
    // Quanto tempo, no minimo, a reserva precisa comecar no futuro.
    // 0 = basta nao estar no passado (barra "ontem" e horario ja vencido hoje).
    antecedenciaMinimaMinutos: 0,
    // Duracao permitida do intervalo [inicio, fim).
    duracaoMinimaMinutos: 30,
    duracaoMaximaMinutos: 120,
    // Quantas reservas ativas (PENDENTE ou APROVADA, ainda nao vencidas) um
    // ALUNO pode ter ao mesmo tempo. Professores e admins ficam isentos.
    limiteReservasAtivas: 3,
    // RF15: o usuario so cancela a propria reserva ate esta antecedencia do
    // inicio. Administradores ficam isentos.
    antecedenciaCancelamentoHoras: 2,
});

/** Faixa aceita para cada regra: [minimo, maximo], em numeros inteiros. */
export const FAIXAS_REGRAS = Object.freeze({
    antecedenciaMinimaMinutos: [0, 10080],
    duracaoMinimaMinutos: [15, 480],
    duracaoMaximaMinutos: [15, 660],
    limiteReservasAtivas: [1, 50],
    antecedenciaCancelamentoHoras: [0, 168],
});

/** Objeto vivo: quem importa enxerga a alteracao feita pelo administrador. */
export const REGRAS_RESERVA = { ...REGRAS_PADRAO };

/**
 * Confere um conjunto (completo ou parcial) de regras. Devolve
 * { ok: true, regras } com o resultado ja mesclado ao atual, ou { ok: false, erro }.
 */
export function validarNovasRegras(entrada, atuais = REGRAS_RESERVA) {
    if (!entrada || typeof entrada !== 'object') return { ok: false, erro: 'Envie as regras em JSON.' };
    const regras = { ...atuais };
    for (const [chave, valor] of Object.entries(entrada)) {
        if (!(chave in FAIXAS_REGRAS)) return { ok: false, erro: `Regra desconhecida: ${chave}.` };
        const n = Number(valor);
        const [min, max] = FAIXAS_REGRAS[chave];
        if (!Number.isInteger(n) || n < min || n > max) {
            return { ok: false, erro: `${chave} deve ser um número inteiro entre ${min} e ${max}.` };
        }
        regras[chave] = n;
    }
    if (regras.duracaoMinimaMinutos > regras.duracaoMaximaMinutos) {
        return { ok: false, erro: 'A duração mínima não pode ser maior que a máxima.' };
    }
    return { ok: true, regras };
}

/** Le o arquivo de regras (se existir) e aplica sobre os padroes. */
export function carregarRegras(arquivo = ARQUIVO_REGRAS) {
    Object.assign(REGRAS_RESERVA, REGRAS_PADRAO);
    try {
        if (!fs.existsSync(arquivo)) return REGRAS_RESERVA;
        const lido = JSON.parse(fs.readFileSync(arquivo, 'utf-8'));
        const v = validarNovasRegras(lido, REGRAS_PADRAO);
        if (v.ok) Object.assign(REGRAS_RESERVA, v.regras);
        else console.warn(`⚠️ ${path.basename(arquivo)} ignorado: ${v.erro}`);
    } catch (e) {
        console.warn(`⚠️ Não consegui ler ${arquivo}: ${e.message}. Usando as regras padrão.`);
    }
    return REGRAS_RESERVA;
}

/** Valida, grava no arquivo e aplica. Devolve o mesmo formato de validarNovasRegras. */
export function salvarRegras(entrada, arquivo = ARQUIVO_REGRAS) {
    const v = validarNovasRegras(entrada);
    if (!v.ok) return v;
    fs.writeFileSync(arquivo, JSON.stringify(v.regras, null, 2), 'utf-8');
    Object.assign(REGRAS_RESERVA, v.regras);
    return v;
}

carregarRegras();

/** Data/hora de inicio da reserva como Date local (mesmo padrao do /cancel). */
export function inicioDaReserva(date, time) {
    return new Date(`${date}T${time}:00`);
}

/**
 * Confere antecedencia minima e duracao. Devolve { ok } ou { ok:false, erro }.
 * `agora` e injetavel para teste.
 */
export function validarRegrasTemporais(date, time, endTime, agora = new Date()) {
    const inicio = inicioDaReserva(date, time);
    if (Number.isNaN(inicio.getTime())) {
        return { ok: false, erro: 'Data ou horário inválidos.' };
    }

    // Antecedencia minima (inclui barrar o passado).
    const limite = new Date(agora.getTime() + REGRAS_RESERVA.antecedenciaMinimaMinutos * 60000);
    if (inicio <= limite) {
        const min = REGRAS_RESERVA.antecedenciaMinimaMinutos;
        return {
            ok: false,
            erro: min > 0
                ? `A reserva deve ser solicitada com pelo menos ${min} min de antecedência.`
                : 'Não é possível reservar em uma data ou horário que já passou.',
        };
    }

    // Duracao min/max.
    const duracao = paraMinutos(endTime) - paraMinutos(time);
    if (duracao < REGRAS_RESERVA.duracaoMinimaMinutos) {
        return { ok: false, erro: `A reserva deve durar no mínimo ${REGRAS_RESERVA.duracaoMinimaMinutos} minutos.` };
    }
    if (duracao > REGRAS_RESERVA.duracaoMaximaMinutos) {
        const h = REGRAS_RESERVA.duracaoMaximaMinutos / 60;
        return { ok: false, erro: `A reserva pode durar no máximo ${h}h.` };
    }

    return { ok: true };
}

/**
 * RF15 — se o usuario ainda pode cancelar a reserva. Devolve { ok } ou
 * { ok:false, erro }. Admin e isento; reserva que ja comecou segue a regra
 * antiga da rota (so barra o intervalo entre agora e o inicio).
 */
export function podeCancelar({ date, time }, papel, agora = new Date()) {
    if (papel === 'ADMIN') return { ok: true };
    const horas = REGRAS_RESERVA.antecedenciaCancelamentoHoras;
    const faltam = (inicioDaReserva(date, time).getTime() - agora.getTime()) / 3600000;
    if (faltam >= 0 && faltam < horas) {
        return {
            ok: false,
            erro: `Cancelamento não permitido. A reserva começa em menos de ${horas}h. Contate o administrador para cancelar.`,
        };
    }
    return { ok: true };
}

/**
 * Reservas ativas de um usuario: PENDENTE ou APROVADA e ainda nao vencidas
 * (data >= hoje). E a base do limite do RF08.
 */
export function contarReservasAtivas(prisma, userId, hojeISO) {
    return prisma.appointment.count({
        where: {
            userId,
            status: { in: ['PENDENTE', 'APROVADA'] },
            date: { gte: hojeISO },
        },
    });
}

/** true quando o papel esta sujeito ao limite (so ALUNO). */
export function sujeitoAoLimite(role) {
    return role !== 'PROFESSOR' && role !== 'ADMIN';
}
