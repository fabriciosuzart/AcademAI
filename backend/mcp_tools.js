// backend/mcp_tools.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. Ferramenta: Consultar Equipamentos
export const toolConsultarEquipamentos = {
    type: "function",
    function: {
        name: "consultar_equipamentos",
        description: "Consulta o banco de dados para listar TODOS os equipamentos do laboratório e seus status.",
        parameters: {
            type: "object",
            properties: {}
        }
    }
};

export async function executarConsultaEquipamentos() {
    console.log("🛠️ MCP ACIONADO: Consultando equipamentos...");
    try {
        const equipamentos = await prisma.equipment.findMany();
        if (equipamentos.length === 0) {
            return "Nenhum equipamento encontrado no momento.";
        }
        const lista = equipamentos.map(e => `ID: ${e.id} | Nome: ${e.name} | Status: ${e.status}`).join('\n');
        return `Equipamentos disponíveis:\n${lista}`;
    } catch (error) {
        console.error("❌ Erro na ferramenta MCP:", error);
        return "Erro interno ao consultar equipamentos.";
    }
}

// 2. Ferramenta: Solicitar Reserva (com auto-aprovação por perfil)
export const toolSolicitarReserva = {
    type: "function",
    function: {
        name: "solicitar_reserva",
        description: "Envia um pedido de reserva de equipamento. Professores e administradores são aprovados automaticamente. Alunos ficam pendentes.",
        parameters: {
            type: "object",
            properties: {
                equipmentId: { type: "integer", description: "O ID numérico do equipamento." },
                date: { type: "string", description: "A data desejada no formato YYYY-MM-DD." },
                time: { type: "string", description: "O horário de início desejado no formato HH:MM." },
                endTime: { type: "string", description: "O horário de término desejado no formato HH:MM (opcional)." }
            },
            required: ["equipmentId", "date", "time"]
        }
    }
};

export async function executarSolicitacaoReserva(args, userId) {
    const eId = parseInt(args.equipmentId);
    const uId = parseInt(userId);

    console.log(`🛠️ MCP ACIONADO: Reservando Equipamento ${eId} para Usuário ${uId}...`);

    if (!uId) {
        return "O agendamento FALHOU. Usuário não está logado. Peça para o usuário fazer login no sistema.";
    }

    try {
        // 1. Verificar equipamento
        const equipamento = await prisma.equipment.findUnique({ where: { id: eId } });
        if (!equipamento) {
            return `Equipamento com ID ${eId} não encontrado.`;
        }

        // 2. Verificar usuário
        const usuario = await prisma.user.findUnique({ where: { id: uId } });
        if (!usuario) {
            return `Usuário não encontrado. Peça para deslogar e logar novamente.`;
        }

        // 3. Verificar conflito de horário (RF16)
        const conflicting = await prisma.appointment.findFirst({
            where: {
                equipmentId: eId,
                date: args.date,
                status: { in: ['PENDENTE', 'APROVADO'] },
                OR: [
                    { time: args.time },
                    ...(args.endTime ? [{ time: { lte: args.endTime }, endTime: { gte: args.time } }] : [])
                ]
            }
        });
        if (conflicting) {
            return `Conflito de horário! O equipamento ${equipamento.name} já possui uma reserva em ${args.date} nesse horário. Sugira ao usuário escolher outro horário.`;
        }

        // 4. Determinar aprovação automática (RF11)
        const autoApprove = usuario.role === 'PROFESSOR' || usuario.role === 'ADMIN';
        const status = autoApprove ? 'APROVADO' : 'PENDENTE';

        // 5. Criar reserva
        const novaReserva = await prisma.appointment.create({
            data: {
                date: args.date,
                time: args.time,
                endTime: args.endTime || null,
                status: status,
                userId: uId,
                equipmentId: eId,
                approvedById: autoApprove ? uId : null
            }
        });

        // 6. Criar notificações
        if (autoApprove) {
            await prisma.notification.create({
                data: {
                    userId: uId,
                    type: 'RESERVA_APROVADA',
                    message: `Reserva do ${equipamento.name} para ${args.date} às ${args.time} aprovada automaticamente.`,
                    relatedId: novaReserva.id
                }
            });
        } else {
            await prisma.notification.create({
                data: {
                    userId: uId,
                    type: 'NOVA_PENDENTE',
                    message: `Reserva do ${equipamento.name} para ${args.date} às ${args.time} enviada. Aguardando aprovação.`,
                    relatedId: novaReserva.id
                }
            });
            // Notificar professores e admins
            const approvers = await prisma.user.findMany({
                where: { role: { in: ['PROFESSOR', 'ADMIN'] }, isActive: true }
            });
            for (const approver of approvers) {
                await prisma.notification.create({
                    data: {
                        userId: approver.id,
                        type: 'NOVA_PENDENTE',
                        message: `${usuario.name} solicitou reserva do ${equipamento.name} para ${args.date} às ${args.time}.`,
                        relatedId: novaReserva.id
                    }
                });
            }
        }

        const statusMsg = autoApprove ? 'APROVADO automaticamente' : 'PENDENTE (aguardando aprovação)';
        return `Reserva criada com sucesso! Status: ${statusMsg}. Equipamento: ${equipamento.name}, Data: ${args.date}, Horário: ${args.time}.`;
    } catch (error) {
        console.error("❌ ERRO NO PRISMA:", error);
        return "Erro ao registrar a reserva. Tente novamente.";
    }
}