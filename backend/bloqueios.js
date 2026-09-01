// Datas bloqueadas: feriados, recesso, manutenção programada.
//
// A regra de leitura tem espelho no front, em src/utils/bloqueios.ts — as duas
// telas de calendário precisam concordar com o servidor sobre o que está
// trancado. A parte de escrita mora só aqui.
//
// São DUAS perguntas diferentes, e trocá-las é bug:
//
//   "este dia está trancado para este equipamento?"  -> clausulaDeBloqueio
//       Casa com o bloqueio global E com o do equipamento. É o que as três
//       checagens de reserva (REST, aprovação e IA) usam.
//
//   "esta linha exata já existe?"                    -> buscarBloqueioIdentico
//       Casa só com a mesma combinação (data, equipamento). Um bloqueio global
//       não é duplicata de um bloqueio de equipamento na mesma data: eles
//       convivem de propósito.

/** Normaliza o que vem do req.body: "" e undefined viram null (global). */
export function normalizarEquipmentId(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    const n = parseInt(valor);
    return Number.isNaN(n) ? null : n;
}

/**
 * Cláusula Prisma dos bloqueios que ATINGEM este equipamento numa data:
 * o global (equipmentId null) e o da própria máquina.
 */
export function clausulaDeBloqueio(equipmentId) {
    return [{ equipmentId: null }, { equipmentId: equipmentId }];
}

/** O bloqueio que impede reservar `date` neste equipamento, ou null. */
export function buscarBloqueioQueImpede(prisma, date, equipmentId) {
    return prisma.blockedDate.findFirst({
        where: { date, OR: clausulaDeBloqueio(equipmentId) },
    });
}

/** Motivo apresentável — o campo é opcional no banco. */
export function motivoDoBloqueio(bloqueio) {
    if (!bloqueio) return '';
    return bloqueio.reason || 'Feriado/Recesso';
}

/**
 * A linha exata (mesma data, mesmo equipamento), ou null.
 *
 * Existe porque `upsert` NÃO serve para bloqueio global: a chave composta
 * `date_equipmentId` recusa `equipmentId: null` com "Argument `equipmentId`
 * must not be null". Quem precisar de "criar se não existir" usa isto, não
 * upsert.
 */
export function buscarBloqueioIdentico(prisma, date, equipmentId) {
    return prisma.blockedDate.findFirst({ where: { date, equipmentId } });
}

/**
 * Cria o bloqueio, ou devolve o que já existia — o substituto do upsert.
 *
 * Devolve { bloqueio, criado }. A corrida entre duas requisições simultâneas
 * é fechada pelo banco, não por este findFirst: o índice único (date,
 * equipmentId) cobre os bloqueios de equipamento e o índice parcial
 * BlockedDate_date_global_key, criado na migration
 * 20260827160000_bloqueio_global_unico, cobre os globais. Se a corrida
 * acontecer, o P2002 cai aqui e relemos a linha que a outra requisição gravou.
 */
export async function criarBloqueioSeNovo(prisma, { date, reason, equipmentId }) {
    const eqId = normalizarEquipmentId(equipmentId);

    const existente = await buscarBloqueioIdentico(prisma, date, eqId);
    if (existente) return { bloqueio: existente, criado: false };

    try {
        const bloqueio = await prisma.blockedDate.create({
            data: { date, reason: reason || null, equipmentId: eqId },
        });
        return { bloqueio, criado: true };
    } catch (e) {
        if (e.code === 'P2002') {
            const concorrente = await buscarBloqueioIdentico(prisma, date, eqId);
            if (concorrente) return { bloqueio: concorrente, criado: false };
        }
        throw e;
    }
}
