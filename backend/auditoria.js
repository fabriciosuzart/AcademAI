// Trilha de auditoria (RF07, RF17, RNF17, RNF30).
//
// Um só lugar para gravar eventos, usado pelas rotas REST (server.js) e pelo chat
// (acoes_chat.js). Falhar ao registrar nunca derruba a operação principal: vira
// apenas um aviso no console.

/** Ações registradas. Servem de referência para o painel e para o TCC. */
export const ACOES = {
    SENHA_RESET: 'SENHA_RESET',
    SENHA_RESET_ADMIN: 'SENHA_RESET_ADMIN',
    SENHA_TROCADA: 'SENHA_TROCADA',
    INGESTAO_OK: 'INGESTAO_OK',
    INGESTAO_FALHA: 'INGESTAO_FALHA',
    DOCUMENTO_REMOVIDO: 'DOCUMENTO_REMOVIDO',
    DOCUMENTO_SUBSTITUIDO: 'DOCUMENTO_SUBSTITUIDO',
    RESERVA_CRIADA: 'RESERVA_CRIADA',
    RESERVA_APROVADA: 'RESERVA_APROVADA',
    RESERVA_REJEITADA: 'RESERVA_REJEITADA',
    RESERVA_CANCELADA: 'RESERVA_CANCELADA',
    CHAT_INTERACAO: 'CHAT_INTERACAO',
    USUARIO_ALTERADO: 'USUARIO_ALTERADO',
    USUARIO_ATIVADO: 'USUARIO_ATIVADO',
    USUARIO_DESATIVADO: 'USUARIO_DESATIVADO',
    USUARIO_EXCLUIDO: 'USUARIO_EXCLUIDO',
    USUARIO_ANONIMIZADO: 'USUARIO_ANONIMIZADO',
    DADOS_EXPORTADOS: 'DADOS_EXPORTADOS',
    EQUIPAMENTO_CRIADO: 'EQUIPAMENTO_CRIADO',
    EQUIPAMENTO_ALTERADO: 'EQUIPAMENTO_ALTERADO',
    EQUIPAMENTO_EXCLUIDO: 'EQUIPAMENTO_EXCLUIDO',
    REGRAS_ALTERADAS: 'REGRAS_ALTERADAS',
};

/** Monta o texto do detalhe a partir de pares chave=valor, ignorando vazios. */
export function detalhe(campos) {
    return Object.entries(campos)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
        .slice(0, 1000);
}

export async function registrarAuditoria(prisma, { action, actorUserId = null, targetUserId = null, detail = null, ip = null }) {
    try {
        await prisma.auditLog.create({
            data: {
                action,
                actorUserId: actorUserId ?? null,
                targetUserId: targetUserId ?? null,
                detail: detail ? String(detail).slice(0, 1000) : null,
                ip,
            },
        });
    } catch (e) {
        console.error('⚠️ Falha ao registrar auditoria:', e.message);
    }
}
