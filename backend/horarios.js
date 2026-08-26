// Aritmética de horários das reservas — espelho de src/utils/horarios.ts.
//
// Não há build compartilhado entre o Vite e o Node, então são dois arquivos:
// ao mexer em um, mexa no outro. A explicação completa está no arquivo do
// front; em resumo: uma reserva é o intervalo [time, endTime) e toda conta
// de duração ou sobreposição passa por minutos desde a meia-noite.

export const HORA_ABERTURA = '08:00';
export const HORA_FECHAMENTO = '19:00';

/** Duração assumida para reservas antigas, gravadas sem endTime. */
export const DURACAO_PADRAO = 60;

const FORMATO = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** true para texto no formato "HH:MM". */
export function horarioValido(horario) {
    return typeof horario === 'string' && FORMATO.test(horario);
}

/** "16:30" -> 990. NaN para texto inválido. */
export function paraMinutos(horario) {
    const [h, m] = String(horario || '').split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
    return h * 60 + m;
}

/** 990 -> "16:30". Nunca devolve horário negativo. */
export function paraHorario(minutos) {
    const total = Math.max(0, minutos);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** somarMinutos("16:30", 90) -> "18:00". */
export function somarMinutos(horario, minutos) {
    return paraHorario(paraMinutos(horario) + minutos);
}

/**
 * Cláusula Prisma que casa com as reservas que invadem [inicio, fim).
 *
 * Intervalos são meio-abertos: uma reserva que termina exatamente quando a
 * outra começa não conflita — sem isso, 15:00–16:00 impediria 16:00–17:00 e
 * o dia inteiro travaria depois da primeira reserva.
 *
 * Reservas antigas sem endTime entram pelo segundo ramo, tratadas como se
 * ocupassem DURACAO_PADRAO minutos.
 */
export function clausulaDeConflito(inicio, fim) {
    return [
        { time: { lt: fim }, endTime: { gt: inicio } },
        { endTime: null, time: { gt: somarMinutos(inicio, -DURACAO_PADRAO), lt: fim } },
    ];
}
