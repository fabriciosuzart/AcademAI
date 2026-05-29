// backend/mcp_tools.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. A "Bula" simplificada (Sem filtros complexos)
export const toolConsultarEquipamentos = {
    type: "function",
    function: {
        name: "consultar_equipamentos",
        description: "Consulta o banco de dados SQL para listar TODOS os equipamentos do INOVFABLAB e seus status.",
        parameters: {
            type: "object",
            properties: {} // Removido o filtro de status para evitar erro de formatação
        }
    }
};

// 2. A "Ação" real
export async function executarConsultaEquipamentos() {
    console.log("🛠️ MCP ACIONADO: A IA foi no banco de dados consultar equipamentos...");
    
    try {
        // Traz absolutamente TUDO do banco sem tentar filtrar no SQL
        const equipamentos = await prisma.equipment.findMany();

        if (equipamentos.length === 0) {
            return "Aviso à IA: Nenhum equipamento encontrado no banco de dados no momento.";
        }

        // Formata os dados
        const lista = equipamentos.map(e => `ID: ${e.id} | Nome: ${e.name} | Status: ${e.status}`).join('\n');
        
        return `Dados recuperados do banco SQLite com sucesso:\n${lista}`;
    } catch (error) {
        console.error("❌ Erro na ferramenta MCP:", error);
        return "Erro interno ao tentar ler o banco de dados.";
    }
}

// --- NOVA FERRAMENTA: SOLICITAR RESERVA ---
export const toolSolicitarReserva = {
    type: "function",
    function: {
        name: "solicitar_reserva",
        description: "Envia um pedido de agendamento de equipamento para a aprovação do administrador.",
        parameters: {
            type: "object",
            properties: {
                equipmentId: { type: "integer", description: "O ID numérico do equipamento." },
                date: { type: "string", description: "A data desejada no formato YYYY-MM-DD." },
                time: { type: "string", description: "O horário de início desejado no formato HH:MM." }
            },
            required: ["equipmentId", "date", "time"]
        }
    }
};

// --- AÇÃO: SALVAR NO BANCO ---
// Note que agora recebemos o userId para garantir quem está logado
export async function executarSolicitacaoReserva(args, userId) {
    // 🔥 Forçamos a conversão para Inteiro para evitar erros do Prisma
    const eId = parseInt(args.equipmentId);
    const uId = parseInt(userId);

    console.log(`🛠️ MCP ACIONADO: Reservando Equipamento ${eId} para o Usuário ${uId}...`);
    
    if (!uId) {
        return "Aviso à IA: O agendamento FALHOU. Usuário não identificado como logado.";
    }

    try {
        // 1. Verifica se o equipamento existe
        const equipamento = await prisma.equipment.findUnique({ where: { id: eId } });
        if (!equipamento) {
            return `Aviso à IA: O equipamento com ID ${eId} não foi encontrado no banco.`;
        }

        // 2. Verifica se o usuário existe (Evita erro de chave estrangeira)
        const usuario = await prisma.user.findUnique({ where: { id: uId } });
        if (!usuario) {
            return `Aviso à IA: O Usuário ID ${uId} não existe no banco de dados. Peça para o usuário deslogar e logar novamente.`;
        }

        // 3. Tenta salvar
        const novaReserva = await prisma.appointment.create({
            data: {
                date: args.date,
                time: args.time,
                status: "PENDENTE",
                userId: uId,
                equipmentId: eId
            }
        });

        return `SUCESSO! Agendamento ID ${novaReserva.id} criado como PENDENTE.`;
    } catch (error) {
        // 👇 OLHE O TERMINAL DO NODE PARA VER O ERRO REAL AQUI 👇
        console.error("❌ ERRO REAL NO PRISMA:", error);
        return "Erro técnico ao acessar o banco de dados. Verifique os logs do servidor.";
    }
}