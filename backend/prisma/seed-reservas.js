import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Reservas reais do laboratorio, recuperadas do historico do git (blob 54f923a)
// junto com o resto dos cadastros. Ficaram de fora do seed original de
// proposito, por serem dado transacional — mas isso fazia toda maquina nova
// abrir a aba de Agendamentos vazia, sem ter como demonstrar as telas.
//
// ATENCAO ao userId: aqui guardamos E-MAIL, nao id.
//
// Os equipamentos podem ser referenciados por id com seguranca, porque o
// seed-cadastros.js os grava com upsert por id explicito. Os usuarios, nao: la
// o upsert e por e-mail e o id vem do autoincremento, entao ele varia de banco
// para banco. Gravar o id numerico aqui prenderia a reserva a pessoa errada num
// ambiente novo, ou falharia na chave estrangeira.
//
// As datas sao as originais (maio a julho de 2026) e ja venceram: elas enchem a
// lista e o historico, mas o card de "proximo agendamento" continua vazio, que
// e o comportamento correto para reservas passadas.
//
// O endTime nao vem do banco antigo — la ele era nulo em todas, porque o
// formulario ainda nao pedia duracao e a tela acabava mostrando "15:00 as
// 15:00". Aqui cada reserva ganha uma duracao plausivel (de 30min a 2h) para
// que as telas demonstrem intervalos de verdade.

const reservas = [
    {
        id: 1, date: '2026-05-29', time: '15:00', endTime: '16:00',
        justification: 'projeto', status: 'CANCELADA', rejectionReason: null,
        createdAt: '2026-05-30T00:44:47.583Z',
        email: 'admin@academai.com', emailAprovador: 'admin@academai.com', equipmentId: 4
    },
    {
        id: 3, date: '2026-06-11', time: '10:00', endTime: '10:30',
        justification: 'teste02', status: 'REJEITADA', rejectionReason: 'test 123',
        createdAt: '2026-06-10T00:12:41.087Z',
        email: 'aluno1@academai.com', emailAprovador: 'prof@academai.com', equipmentId: 4
    },
    {
        id: 4, date: '2026-06-10', time: '15:00', endTime: '16:00',
        justification: 'teste03', status: 'APROVADA', rejectionReason: null,
        createdAt: '2026-06-10T00:12:58.719Z',
        email: 'aluno1@academai.com', emailAprovador: 'prof@academai.com', equipmentId: 5
    },
    {
        id: 5, date: '2026-07-08', time: '11:00', endTime: '13:00',
        justification: 'teste04', status: 'CANCELADA', rejectionReason: null,
        createdAt: '2026-06-10T00:35:31.538Z',
        email: 'admin@academai.com', emailAprovador: 'admin@academai.com', equipmentId: 4
    },
    {
        id: 6, date: '2026-06-11', time: '15:00', endTime: '16:30',
        justification: 'dgfdgdgdghf', status: 'APROVADA', rejectionReason: null,
        createdAt: '2026-06-11T00:08:16.133Z',
        email: 'aluno1@academai.com', emailAprovador: 'prof@academai.com', equipmentId: 5
    },
    {
        id: 7, date: '2026-06-19', time: '16:00', endTime: '17:00',
        justification: 'ççççççç', status: 'APROVADA', rejectionReason: null,
        createdAt: '2026-06-11T00:09:41.699Z',
        email: 'prof@academai.com', emailAprovador: 'prof@academai.com', equipmentId: 4
    },
];

export async function semearReservas() {
    console.log('🌱 Semeando reservas do laboratorio...');

    // Resolve e-mail -> id uma vez so, em vez de consultar por reserva.
    const porEmail = {};
    for (const u of await prisma.user.findMany({ select: { id: true, email: true } })) {
        porEmail[u.email] = u.id;
    }

    const equipamentosExistentes = new Set(
        (await prisma.equipment.findMany({ select: { id: true } })).map(e => e.id)
    );

    let criadas = 0;
    let puladas = 0;

    for (const r of reservas) {
        const userId = porEmail[r.email];
        const approvedById = r.emailAprovador ? porEmail[r.emailAprovador] : null;

        // Pular com aviso e melhor do que estourar: um seed parcial ainda
        // deixa o ambiente utilizavel.
        if (!userId) {
            console.warn(`   ⚠️ Reserva ${r.id} pulada: usuario ${r.email} nao encontrado.`);
            puladas++;
            continue;
        }
        if (!equipamentosExistentes.has(r.equipmentId)) {
            console.warn(`   ⚠️ Reserva ${r.id} pulada: equipamento ${r.equipmentId} nao encontrado.`);
            puladas++;
            continue;
        }

        const dados = {
            date: r.date,
            time: r.time,
            endTime: r.endTime,
            justification: r.justification,
            status: r.status,
            rejectionReason: r.rejectionReason,
            createdAt: new Date(r.createdAt),
            userId,
            approvedById,
            equipmentId: r.equipmentId,
        };

        await prisma.appointment.upsert({
            where: { id: r.id },
            update: dados,
            create: { id: r.id, ...dados },
        });
        criadas++;
    }

    console.log(`   ${criadas} reservas${puladas ? ` (${puladas} puladas)` : ''}`);
}

// Permite rodar direto: node prisma/seed-reservas.js
const executadoDireto = process.argv[1] && process.argv[1].endsWith('seed-reservas.js');
if (executadoDireto) {
    semearReservas()
        .catch(e => { console.error('Erro no seed de reservas:', e); process.exit(1); })
        .finally(async () => { await prisma.$disconnect(); });
}
