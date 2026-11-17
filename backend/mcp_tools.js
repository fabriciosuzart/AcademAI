// backend/mcp_tools.js
import { PrismaClient } from '@prisma/client';
import { ehManutencao } from './status.js';
import { DURACAO_PADRAO, clausulaDeConflito, horarioValido, somarMinutos } from './horarios.js';
import { buscarBloqueioQueImpede, motivoDoBloqueio } from './bloqueios.js';
import { validarRegrasTemporais, contarReservasAtivas, sujeitoAoLimite, REGRAS_RESERVA } from './config-reservas.js';
const prisma = new PrismaClient();

// Ações que o chat pode pedir ao backend. A IA só devolve a intenção e os dados do
// pedido (chat_intent.js); quem valida e grava é o código abaixo, com as mesmas
// regras das rotas REST. As funções devolvem DADOS, não frases: o texto mostrado ao
// usuário sai de chat_intent.js, e não é mais "recontado" pelo modelo.

// 1. Consultar equipamentos
export async function executarConsultaEquipamentos() {
    console.log("🛠️ MCP ACIONADO: Consultando equipamentos...");
    return prisma.equipment.findMany({
        select: { id: true, name: true, modelo: true, status: true },
        orderBy: { name: 'asc' },
    });
}

// 2. Solicitar reserva (com auto-aprovação por perfil)
//
// Devolve { ok: true, reserva } ou { ok: false, codigo, ... }. Códigos: SEM_LOGIN,
// FALTA_DADOS, NAO_ENCONTRADO, MANUTENCAO, DATA_BLOQUEADA, HORARIO_INVALIDO,
// REGRA_TEMPORAL, CONFLITO, LIMITE, ERRO (textos em chat_intent.js → textoReserva).
const falha = (codigo, extra = {}) => ({ ok: false, codigo, ...extra });

export async function executarSolicitacaoReserva(args, userId) {
    console.log("📦 Dados brutos recebidos da IA:", args);

    const uId = parseInt(userId);
    const nomeAlvo = args.equipmentName;

    if (!uId || isNaN(uId)) {
        return falha('SEM_LOGIN');
    }

    if (!nomeAlvo || !args.date || !args.time) {
        return falha('FALTA_DADOS', { equipamento: nomeAlvo || null, data: args.date || null, inicio: args.time || null });
    }

    try {
        // 1. Traduzir o NOME para o ID real, ignorando maiúsculas. O nome exato vem
        // primeiro: "Finder 01" não pode cair em "Finder 010" só por ser parte dele.
        const todosEquipamentos = await prisma.equipment.findMany();
        const alvo = nomeAlvo.toLowerCase();
        const equipamento = todosEquipamentos.find(e => e.name.toLowerCase() === alvo)
            ?? todosEquipamentos.find(e => e.name.toLowerCase().includes(alvo));
        if (!equipamento) {
            return falha('NAO_ENCONTRADO', { equipamento: nomeAlvo });
        }
        // Dados para o card de "escolha outro horário" nas falhas abaixo.
        const contexto = { equipamento: equipamento.name, equipmentId: equipamento.id, date: args.date, time: args.time };

        // 2. Verificar usuário
        const usuario = await prisma.user.findUnique({ where: { id: uId } });
        if (!usuario) {
            return falha('SEM_LOGIN');
        }

        // 2a. Equipamento em manutencao (mesma regra do POST /api/schedule).
        // A IA era um caminho paralelo sem nenhuma destas travas: dava para
        // reservar maquina parada e dia bloqueado so pedindo ao assistente.
        if (ehManutencao(equipamento.status)) {
            return falha('MANUTENCAO', contexto);
        }

        // 2b. Data bloqueada — global (equipmentId null) ou so deste equipamento
        const diaBloqueado = await buscarBloqueioQueImpede(prisma, args.date, equipamento.id);
        if (diaBloqueado) {
            return falha('DATA_BLOQUEADA', { ...contexto, detalhe: motivoDoBloqueio(diaBloqueado) });
        }

        // 3. Verificar conflito de horário (RF16)
        // Sem duracao informada a reserva vale DURACAO_PADRAO: gravar endTime
        // nulo deixaria a reserva sem intervalo e a tela mostraria "16:00 as 16:00".
        if (!horarioValido(args.time)) {
            return falha('HORARIO_INVALIDO', contexto);
        }
        const fim = horarioValido(args.endTime)
            ? args.endTime
            : somarMinutos(args.time, DURACAO_PADRAO);

        // RF08/RN04 - Antecedência mínima (barra o passado) e duração mín/máx.
        const regras = validarRegrasTemporais(args.date, args.time, fim);
        if (!regras.ok) {
            return falha('REGRA_TEMPORAL', { ...contexto, detalhe: regras.erro });
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
            return falha('CONFLITO', contexto);
        }

        // RF08 - Limite de reservas ativas simultâneas (só ALUNO; staff isento).
        if (sujeitoAoLimite(usuario.role)) {
            const hojeISO = new Date().toISOString().slice(0, 10);
            const ativas = await contarReservasAtivas(prisma, uId, hojeISO);
            if (ativas >= REGRAS_RESERVA.limiteReservasAtivas) {
                return falha('LIMITE', { ...contexto, detalhe: REGRAS_RESERVA.limiteReservasAtivas });
            }
        }

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

        return {
            ok: true,
            reserva: {
                id: novaReserva.id,
                equipamento: equipamento.name,
                equipmentId: equipamento.id,
                date: args.date,
                time: args.time,
                endTime: fim,
                status,
            },
        };
    } catch (error) {
        console.error("❌ ERRO NO PRISMA:", error);
        return falha('ERRO');
    }
}