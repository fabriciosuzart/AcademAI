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
        description: "Envia um pedido de agendamento de equipamento. SÓ CHAME ESTA FERRAMENTA SE TIVER O NOME, DATA E HORA.",
        parameters: {
            type: "object",
            properties: {
                equipmentName: { type: "string", description: "O nome da máquina. Ex: Impressora 3D Teste" },
                date: { type: "string", description: "A data estritamente no formato DD/MM/AAAA." },
                time: { type: "string", description: "O horário estritamente no formato HH:MM." }
            },
            // Voltamos a obrigar os 3 para evitar o bug do campo vazio
            required: ["equipmentName", "date", "time"] 
        }
    }
};

// --- AÇÃO: SALVAR NO BANCO ---
export async function executarSolicitacaoReserva(args, userId) {
    console.log("📦 Dados brutos recebidos da IA:", args);

    const uId = parseInt(userId);
    const nomeAlvo = args.equipmentName;

    if (!uId || isNaN(uId)) {
        return "Aviso à IA: O agendamento FALHOU. Usuário não identificado como logado.";
    }

    if (!nomeAlvo) {
        return `Aviso à IA: A reserva NÃO foi concluída porque o nome do equipamento está vazio. Pergunte ao usuário qual equipamento ele deseja.`;
    }

    if (!args.date || !args.time) {
        return `Aviso à IA: A reserva NÃO foi concluída. Faltam a data ou o horário. Pergunte educadamente ao usuário para qual dia e horário ele deseja reservar o equipamento '${nomeAlvo}'.`;
    }

    try {
        // 🔥 A MÁGICA ACONTECE AQUI: O Node.js traduz o nome para o ID 🔥
        const todosEquipamentos = await prisma.equipment.findMany();
        
        // Procura ignorando maiúsculas e minúsculas
        const equipamento = todosEquipamentos.find(e => 
            e.name.toLowerCase().includes(nomeAlvo.toLowerCase())
        );

        if (!equipamento) {
            return `Aviso à IA: O equipamento chamado '${nomeAlvo}' não foi encontrado no banco de dados. Avise o usuário.`;
        }

        // Agora salvamos usando o ID real que o Node.js encontrou
        const novaReserva = await prisma.appointment.create({
            data: {
                date: args.date,
                time: args.time,
                status: "PENDENTE",
                userId: uId,
                equipmentId: equipamento.id 
            }
        });

        return `SUCESSO! Agendamento ID ${novaReserva.id} criado como PENDENTE. Avise o usuário com entusiasmo!`;
    } catch (error) {
        console.error("❌ ERRO REAL NO PRISMA:", error);
        return "Erro técnico ao acessar o banco de dados. Verifique os logs do servidor.";
    }
}