// backend/mcp_tools.js
import { PrismaClient } from '@prisma/client';
import { ehManutencao } from './status.js';
import { DURACAO_PADRAO, clausulaDeConflito, horarioValido, somarMinutos } from './horarios.js';
import { buscarBloqueioQueImpede, motivoDoBloqueio } from './bloqueios.js';
import { validarRegrasTemporais, contarReservasAtivas, sujeitoAoLimite, REGRAS_RESERVA } from './config-reservas.js';
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
// Chamar a ferramenta NÃO grava nada: o servidor valida os dados, guarda um
// rascunho e pergunta ao usuário "Confirma a reserva...?". A gravação só
// acontece depois do "sim" (ver confirmacao-reserva.js e a rota /api/chat).
export const toolSolicitarReserva = {
    type: "function",
    function: {
        name: "solicitar_reserva",
        description: "Prepara um pedido de reserva de equipamento e pede a CONFIRMAÇÃO do usuário. NÃO grava a reserva: ela só é registrada depois que o usuário confirmar. SÓ CHAME SE TIVER O NOME DO EQUIPAMENTO, A DATA E A HORA. Professores e administradores são aprovados automaticamente; alunos ficam pendentes.",
        parameters: {
            type: "object",
            properties: {
                // Recebemos o NOME e não o ID: o modelo alucinava IDs que não existiam.
                // A tradução nome -> ID acontece no Node, logo abaixo.
                equipmentName: { type: "string", description: "O nome da máquina. Ex: Impressora 3D Finder 01" },
                date: { type: "string", description: "A data estritamente no formato YYYY-MM-DD." },
                time: { type: "string", description: "O horário de início estritamente no formato HH:MM." },
                endTime: { type: "string", description: "O horário de término no formato HH:MM. Se o usuário não disser a duração, omita e a reserva será de 1h." }
            },
            // Voltamos a obrigar os 3 para evitar o bug do campo vazio
            required: ["equipmentName", "date", "time"] 
        }
    }
};

// --- VALIDAÇÃO (SOMENTE LEITURA) ---
// Aplica todas as travas da reserva SEM gravar nada. Usada em dois momentos:
// antes de perguntar "Confirma...?" (para não pedir confirmação de algo que
// vai falhar) e de novo no instante da gravação (o horário pode ter sido
// ocupado enquanto o usuário pensava).
// Devolve { ok:false, mensagem } ou { ok:true, dados }.
export async function validarSolicitacaoReserva(argsBrutos, userId) {
    // O Ollama costuma mandar os argumentos como objeto, mas aceitamos string JSON.
    let args = argsBrutos || {};
    if (typeof args === 'string') {
        try { args = JSON.parse(args); } catch { args = {}; }
    }
    console.log("📦 Dados brutos recebidos da IA:", args);

    const uId = parseInt(userId);
    const nomeAlvo = typeof args.equipmentName === 'string' ? args.equipmentName.trim() : '';
    const falha = (mensagem) => ({ ok: false, mensagem });

    if (!uId || isNaN(uId)) {
        return falha("O agendamento FALHOU. Usuário não está logado. Peça para o usuário fazer login no sistema.");
    }

    if (!nomeAlvo) {
        return falha(`Aviso à IA: A reserva NÃO foi concluída porque o nome do equipamento está vazio. Pergunte ao usuário qual equipamento ele deseja.`);
    }

    if (!args.date || !args.time) {
        return falha(`Aviso à IA: A reserva NÃO foi concluída. Faltam a data ou o horário. Pergunte educadamente ao usuário para qual dia e horário ele deseja reservar o equipamento '${nomeAlvo}'.`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
        return falha(`Data inválida: "${args.date}". Peça ao usuário a data da reserva (converta para AAAA-MM-DD).`);
    }

    try {
        // 1. Traduzir o NOME informado pela IA para o ID real, ignorando maiúsculas.
        // Nome exato primeiro: com só o "includes", "Bambu Lab 01" poderia casar
        // com outra unidade cujo nome o contém.
        const todosEquipamentos = await prisma.equipment.findMany();
        const alvo = nomeAlvo.toLowerCase();
        const equipamento =
            todosEquipamentos.find(e => e.name.toLowerCase() === alvo) ||
            todosEquipamentos.find(e => e.name.toLowerCase().includes(alvo));
        if (!equipamento) {
            return falha(`O equipamento chamado '${nomeAlvo}' não foi encontrado. Avise o usuário e sugira que ele peça a lista de equipamentos.`);
        }

        // 2. Verificar usuário
        const usuario = await prisma.user.findUnique({ where: { id: uId } });
        if (!usuario) {
            return falha(`Usuário não encontrado. Peça para deslogar e logar novamente.`);
        }

        // 2a. Equipamento em manutencao (mesma regra do POST /api/schedule).
        // A IA era um caminho paralelo sem nenhuma destas travas: dava para
        // reservar maquina parada e dia bloqueado so pedindo ao assistente.
        if (ehManutencao(equipamento.status)) {
            return falha(`O equipamento ${equipamento.name} está em manutenção e não aceita reservas. Avise o usuário e sugira outro equipamento.`);
        }

        // 2b. Data bloqueada — global (equipmentId null) ou so deste equipamento
        const diaBloqueado = await buscarBloqueioQueImpede(prisma, args.date, equipamento.id);
        if (diaBloqueado) {
            return falha(`A data ${args.date} está bloqueada para reservas. Motivo: ${motivoDoBloqueio(diaBloqueado)}. Avise o usuário e peça que escolha outra data.`);
        }

        // 3. Verificar conflito de horário (RF16)
        // Sem duracao informada a reserva vale DURACAO_PADRAO: gravar endTime
        // nulo deixaria a reserva sem intervalo e a tela mostraria "16:00 as 16:00".
        if (!horarioValido(args.time)) {
            return falha(`Horário inválido: "${args.time}". Peça ao usuário o horário no formato HH:MM.`);
        }
        const fim = horarioValido(args.endTime)
            ? args.endTime
            : somarMinutos(args.time, DURACAO_PADRAO);

        // RF08/RN04 - Antecedência mínima (barra o passado) e duração mín/máx.
        const regras = validarRegrasTemporais(args.date, args.time, fim);
        if (!regras.ok) {
            return falha(`A reserva NÃO foi concluída: ${regras.erro} Avise o usuário e peça outra data ou horário.`);
        }

        const conflicting = await prisma.appointment.findFirst({
            where: {
                equipmentId: equipamento.id,
                date: args.date,
                // "APROVADA" no feminino: e o valor que as rotas REST gravam.
                // Com "APROVADO" aqui, reservas aprovadas pelo painel nao contavam
                // como conflito e o mesmo horario podia ser reservado duas vezes.
                status: { in: ['PENDENTE', 'APROVADA'] },
                OR: clausulaDeConflito(args.time, fim)
            }
        });
        if (conflicting) {
            return falha(`Conflito de horário! O equipamento ${equipamento.name} já possui uma reserva em ${args.date} nesse horário. Sugira ao usuário escolher outro horário.`);
        }

        // RF08 - Limite de reservas ativas simultâneas (só ALUNO; staff isento).
        if (sujeitoAoLimite(usuario.role)) {
            const hojeISO = new Date().toISOString().slice(0, 10);
            const ativas = await contarReservasAtivas(prisma, uId, hojeISO);
            if (ativas >= REGRAS_RESERVA.limiteReservasAtivas) {
                return falha(`A reserva NÃO foi concluída: o usuário já tem ${REGRAS_RESERVA.limiteReservasAtivas} reservas ativas, que é o limite. Peça que ele cancele uma antes de solicitar outra.`);
            }
        }

        return {
            ok: true,
            dados: { uId, usuario, equipamento, date: args.date, time: args.time, fim }
        };
    } catch (error) {
        console.error("❌ ERRO NO PRISMA:", error);
        return falha("Erro ao validar a reserva. Tente novamente.");
    }
}

// --- AÇÃO: SALVAR NO BANCO ---
// SÓ deve ser chamada depois da confirmação explícita do usuário (Regra 3).
// Revalida tudo antes de gravar. Devolve { ok, mensagem }.
export async function executarSolicitacaoReserva(args, userId) {
    const validacao = await validarSolicitacaoReserva(args, userId);
    if (!validacao.ok) return validacao;

    const { uId, usuario, equipamento, fim } = validacao.dados;
    args = { date: validacao.dados.date, time: validacao.dados.time };

    try {
        // 4. Determinar aprovação automática (RF11)
        const autoApprove = usuario.role === 'PROFESSOR' || usuario.role === 'ADMIN';
        const status = autoApprove ? 'APROVADA' : 'PENDENTE';

        // 5. Criar reserva
        const novaReserva = await prisma.appointment.create({
            data: {
                date: args.date,
                time: args.time,
                endTime: fim,
                status: status,
                userId: uId,
                equipmentId: equipamento.id,
                approvedById: autoApprove ? uId : null
            }
        });

        // 6. Criar notificações
        if (autoApprove) {
            await prisma.notification.create({
                data: {
                    userId: uId,
                    type: 'RESERVA_APROVADA',
                    message: `Reserva do ${equipamento.name} para ${args.date}, das ${args.time} às ${fim} aprovada automaticamente.`,
                    relatedId: novaReserva.id
                }
            });
        } else {
            await prisma.notification.create({
                data: {
                    userId: uId,
                    type: 'NOVA_PENDENTE',
                    message: `Reserva do ${equipamento.name} para ${args.date}, das ${args.time} às ${fim} enviada. Aguardando aprovação.`,
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
                        message: `${usuario.name} solicitou reserva do ${equipamento.name} para ${args.date}, das ${args.time} às ${fim}.`,
                        relatedId: novaReserva.id
                    }
                });
            }
        }

        const statusMsg = autoApprove ? 'APROVADA automaticamente' : 'PENDENTE (aguardando aprovação)';
        return {
            ok: true,
            mensagem: `Reserva criada com sucesso! Status: ${statusMsg}. Equipamento: ${equipamento.name}, Data: ${args.date}, Horário: das ${args.time} às ${fim}.`
        };
    } catch (error) {
        console.error("❌ ERRO NO PRISMA:", error);
        return { ok: false, mensagem: "Erro ao registrar a reserva. Tente novamente." };
    }
}