// Gravação de reservas e horários alternativos — um caminho só para a tela
// (POST /api/schedule) e para o chat (acoes_chat.js).
//
// RF16/RN03: a conferência de conflito, o limite de reservas ativas e a gravação
// acontecem dentro de uma transação do Prisma e sob uma trava em memória
// (trava.js). Antes eram consultas soltas: dois pedidos simultâneos podiam passar
// pela conferência antes de qualquer um gravar.
//
// RN07: em caso de conflito, os horários alternativos são calculados aqui, de
// forma determinística, a partir das reservas do banco; o modelo de linguagem só
// repassa o texto pronto.
import { comTrava } from './trava.js';
import { clausulaDeConflito, paraMinutos, somarMinutos, sugerirHorarios, DURACAO_PADRAO } from './horarios.js';
import { contarReservasAtivas, sujeitoAoLimite, validarRegrasTemporais, REGRAS_RESERVA } from './config-reservas.js';
import { buscarBloqueioQueImpede } from './bloqueios.js';
import { notificar } from './notificacoes.js';
import { registrarAuditoria, detalhe, ACOES } from './auditoria.js';
import { podeAvaliar } from './escopo.js';
import { hojeISO, somarDias } from './chat_intent.js';

export const STATUS_ATIVOS = ['PENDENTE', 'APROVADA'];

/** Status com que a reserva nasce, conforme o perfil (RN01). */
export const statusInicial = (papel) => (papel === 'PROFESSOR' || papel === 'ADMIN' ? 'APROVADA' : 'PENDENTE');

/**
 * Grava a reserva de forma atômica. `dados`: { usuario, equipamento, date, time,
 * endTime, justification, origem }. Devolve { ok: true, reserva } ou
 * { ok: false, codigo: 'CONFLITO' | 'LIMITE' }.
 */
export async function gravarReserva(prisma, { usuario, equipamento, date, time, endTime, justification, origem = 'formulario' }) {
    const status = statusInicial(usuario.role);
    const resultado = await comTrava('reservas', () => prisma.$transaction(async (tx) => {
        const conflito = await tx.appointment.findFirst({
            where: { equipmentId: equipamento.id, date, status: { in: STATUS_ATIVOS }, OR: clausulaDeConflito(time, endTime) },
            select: { id: true },
        });
        if (conflito) return { ok: false, codigo: 'CONFLITO' };

        if (sujeitoAoLimite(usuario.role)) {
            const ativas = await contarReservasAtivas(tx, usuario.id, hojeISO());
            if (ativas >= REGRAS_RESERVA.limiteReservasAtivas) {
                return { ok: false, codigo: 'LIMITE', detalhe: REGRAS_RESERVA.limiteReservasAtivas };
            }
        }

        const reserva = await tx.appointment.create({
            data: {
                date, time, endTime,
                justification: String(justification).trim().slice(0, 500),
                status,
                userId: usuario.id,
                equipmentId: equipamento.id,
                approvedById: status === 'APROVADA' ? usuario.id : null,
            },
        });
        return { ok: true, reserva };
    }));

    if (!resultado.ok) return resultado;
    const { reserva } = resultado;
    const quando = `${date}, das ${time} às ${endTime}`;

    await registrarAuditoria(prisma, {
        action: ACOES.RESERVA_CRIADA,
        actorUserId: usuario.id,
        targetUserId: usuario.id,
        detail: detalhe({ reserva: reserva.id, equipamento: equipamento.name, data: date, inicio: time, fim: endTime, status, origem }),
    });

    if (status === 'APROVADA') {
        await notificar(prisma, usuario.id, 'RESERVA_APROVADA',
            `Sua reserva de ${equipamento.name} para ${quando} foi aprovada automaticamente.`, reserva.id);
    } else {
        await notificar(prisma, usuario.id, 'NOVA_PENDENTE',
            `Sua reserva de ${equipamento.name} para ${quando} foi enviada e aguarda aprovação.`, reserva.id);
        await notificarAvaliadores(prisma, {
            papelSolicitante: usuario.role,
            modelo: equipamento.modelo,
            mensagem: `${usuario.name} solicitou reserva de ${equipamento.name} para ${quando}. Aguarda sua aprovação.`,
            relatedId: reserva.id,
        });
    }
    return resultado;
}

/** Notifica administradores e os professores cujo escopo cobre o equipamento (RF13/RN02). */
export async function notificarAvaliadores(prisma, { papelSolicitante, modelo, mensagem, relatedId, tipo = 'NOVA_PENDENTE' }) {
    const candidatos = await prisma.user.findMany({
        where: { role: { in: ['PROFESSOR', 'ADMIN'] }, isActive: true },
        select: { id: true, role: true, isActive: true, escopoAprovacao: true },
    });
    for (const avaliador of candidatos.filter((a) => podeAvaliar(a, { papelSolicitante, modelo }))) {
        await notificar(prisma, avaliador.id, tipo, mensagem, relatedId);
    }
}

/**
 * Até `max` horários livres para o mesmo equipamento e a mesma duração: primeiro
 * no dia pedido (os mais próximos do horário pedido), depois nos dias seguintes.
 * Respeita datas bloqueadas, horário de funcionamento e antecedência mínima.
 */
export async function horariosAlternativos(prisma, { equipmentId, date, time, endTime, max = 3, dias = 7, agora = new Date() }) {
    const duracao = (endTime ? paraMinutos(endTime) : paraMinutos(time) + DURACAO_PADRAO) - paraMinutos(time);
    if (!(duracao > 0)) return [];
    const achados = [];
    for (let d = 0; d < dias && achados.length < max; d++) {
        const data = somarDias(date, d);
        if (await buscarBloqueioQueImpede(prisma, data, equipmentId)) continue;
        const ocupadas = await prisma.appointment.findMany({
            where: { equipmentId, date: data, status: { in: STATUS_ATIVOS } },
            select: { time: true, endTime: true },
        });
        let inicios = sugerirHorarios(ocupadas, duracao)
            .filter((ini) => validarRegrasTemporais(data, ini, somarMinutos(ini, duracao), agora).ok);
        if (d === 0) {
            const pedido = paraMinutos(time);
            inicios = inicios.sort((a, b) => Math.abs(paraMinutos(a) - pedido) - Math.abs(paraMinutos(b) - pedido));
        }
        for (const ini of inicios.slice(0, max - achados.length)) {
            achados.push({ date: data, time: ini, endTime: somarMinutos(ini, duracao) });
        }
    }
    return achados;
}

/** "20/11 10:00–11:00, 20/11 14:00–15:00" — para mensagens da API e do chat. */
export function textoAlternativas(alternativas) {
    return alternativas
        .map(({ date, time, endTime }) => `${date.slice(8, 10)}/${date.slice(5, 7)} ${time}–${endTime}`)
        .join(', ');
}
