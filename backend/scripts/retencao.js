/* Política de retenção de dados (RF17, RNF27, RNF29).
 *
 * Uso (dentro de backend/):
 *   npm run retencao                      -> só mostra o que seria feito
 *   npm run retencao -- --aplicar         -> aplica
 *   npm run retencao -- --dias 365 --aplicar
 *
 * Passado o prazo (padrão: 365 dias, ou RETENCAO_DIAS):
 *   - trilha de auditoria (inclui as interações com o assistente) e notificações
 *     mais antigas são apagadas;
 *   - refresh tokens vencidos são apagados;
 *   - reservas encerradas (CONCLUIDA, CANCELADA ou REJEITADA) mais antigas são
 *     anonimizadas: a linha fica para as estatísticas, mas a finalidade e o
 *     motivo de rejeição, que são texto livre e podem ter dados pessoais, são
 *     apagados.
 *
 * Rode antes do backup ou agende junto com ele (veja INICIA_PROJETO.md).
 */
import { PrismaClient } from '@prisma/client';
import { lerArgumentos } from './util.js';

const args = lerArgumentos({ dias: process.env.RETENCAO_DIAS || '365', aplicar: false });
const DIAS = Math.max(30, parseInt(args.dias, 10) || 365);
const APLICAR = args.aplicar === true;

/** Data de corte: objetos anteriores a ela saem da retenção. */
function dataDeCorte(dias, agora = new Date()) {
    return new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);
}

const prisma = new PrismaClient();
const corte = dataDeCorte(DIAS);
const corteISO = corte.toISOString().slice(0, 10);

const filtros = {
    auditoria: { createdAt: { lt: corte } },
    notificacoes: { createdAt: { lt: corte } },
    refreshTokens: { expiresAt: { lt: new Date() } },
    reservas: {
        date: { lt: corteISO },
        status: { in: ['CONCLUIDA', 'CANCELADA', 'REJEITADA'] },
        OR: [{ justification: { not: null } }, { rejectionReason: { not: null } }],
    },
};

try {
    const contagem = {
        auditoria: await prisma.auditLog.count({ where: filtros.auditoria }),
        notificacoes: await prisma.notification.count({ where: filtros.notificacoes }),
        refreshTokens: await prisma.refreshToken.count({ where: filtros.refreshTokens }),
        reservas: await prisma.appointment.count({ where: filtros.reservas }),
    };
    console.log(`Retenção de ${DIAS} dias — corte em ${corteISO}.`);
    console.log(`  Registros de auditoria a apagar:   ${contagem.auditoria}`);
    console.log(`  Notificações a apagar:             ${contagem.notificacoes}`);
    console.log(`  Refresh tokens vencidos a apagar:  ${contagem.refreshTokens}`);
    console.log(`  Reservas encerradas a anonimizar:  ${contagem.reservas}`);

    if (!APLICAR) {
        console.log('\nNada foi alterado. Para aplicar, rode: npm run retencao -- --aplicar');
    } else {
        await prisma.$transaction([
            prisma.auditLog.deleteMany({ where: filtros.auditoria }),
            prisma.notification.deleteMany({ where: filtros.notificacoes }),
            prisma.refreshToken.deleteMany({ where: filtros.refreshTokens }),
            prisma.appointment.updateMany({ where: filtros.reservas, data: { justification: null, rejectionReason: null } }),
        ]);
        await prisma.auditLog.create({
            data: { action: 'RETENCAO_APLICADA', detail: `dias=${DIAS}; corte=${corteISO}; ${Object.entries(contagem).map(([k, v]) => `${k}=${v}`).join('; ')}` },
        });
        console.log('\nRetenção aplicada.');
    }
} finally {
    await prisma.$disconnect();
}
