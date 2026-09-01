// Regras de negocio da reserva que o RF08 declara "configuraveis pelo
// administrador": antecedencia minima, duracao minima/maxima e limite de
// reservas ativas simultaneas por usuario.
//
// Nao ha painel de configuracao ainda, entao os valores vivem aqui, num so
// lugar, prontos para virar colunas/tela de admin no futuro. As duas pontas que
// criam reserva — a rota REST (POST /api/schedule) e a ferramenta da IA
// (mcp_tools) — usam estas mesmas funcoes, para nao divergirem.

import { paraMinutos } from './horarios.js';

export const REGRAS_RESERVA = {
    // Quanto tempo, no minimo, a reserva precisa comecar no futuro.
    // 0 = basta nao estar no passado (barra "ontem" e horario ja vencido hoje).
    antecedenciaMinimaMinutos: 0,
    // Duracao permitida do intervalo [inicio, fim). Espelha as opcoes do
    // formulario (30min a 2h).
    duracaoMinimaMinutos: 30,
    duracaoMaximaMinutos: 120,
    // Quantas reservas ativas (PENDENTE ou APROVADA, ainda nao vencidas) um
    // ALUNO pode ter ao mesmo tempo. Professores e admins gerenciam o
    // laboratorio e ficam isentos.
    limiteReservasAtivas: 3,
};

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
