// Notificações em tela + e-mail opcional (RF12/RF13).
//
// Antes, as reservas feitas pela tela passavam por createNotification (tela +
// e-mail) e as feitas pelo chat gravavam a notificação direto no banco, sem
// e-mail. Agora as duas pontas usam `notificar`.

import path from 'path';
import { fileURLToPath } from 'url';

// Carrega as variáveis SMTP de backend/.env (veja backend/.env.example).
// Sem isso o SMTP_HOST nunca chegava ao processo e nenhum e-mail saía.
// Nos testes (Jest define NODE_ENV=test) não carrega, para não enviar e-mail real.
if (process.env.NODE_ENV !== 'test') {
    try {
        process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'));
    } catch {
        // sem backend/.env: segue sem SMTP
    }
}

let transporte = null;

if (process.env.SMTP_HOST) {
    try {
        const nodemailer = await import('nodemailer');
        transporte = nodemailer.default.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        console.log('📧 Transporte de e-mail configurado.');
    } catch {
        console.log('⚠️ nodemailer não instalado. Execute: npm install nodemailer');
    }
} else {
    console.log('⚠️ SMTP não configurado. E-mails serão apenas logados no console.');
}

const ASSUNTOS = {
    RESERVA_APROVADA: '✅ Reserva Aprovada',
    RESERVA_REJEITADA: '❌ Reserva Rejeitada',
    NOVA_PENDENTE: '⏳ Nova Reserva Pendente',
    RESERVA_CANCELADA: '🚫 Reserva Cancelada',
};

/** Escapa texto para entrar no HTML do e-mail (nomes e motivos vêm de usuários). */
export function escaparHtml(texto) {
    return String(texto ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Envia e-mail; `corpoHtml` já deve estar escapado. Sem SMTP, só registra no console. */
export async function enviarEmail(para, assunto, corpoHtml) {
    if (!transporte) {
        console.log(`📧 [LOG] E-mail para ${para} | Assunto: ${assunto}`);
        return false;
    }
    try {
        await transporte.sendMail({
            from: process.env.SMTP_FROM || 'noreply@academai.local',
            to: para,
            subject: assunto,
            html: `<div style="font-family:sans-serif;padding:20px;"><h2>${escaparHtml(assunto)}</h2><p>${corpoHtml}</p><hr><small>AcademAI - Sistema de Reservas</small></div>`,
        });
        console.log(`📧 E-mail enviado para ${para}`);
        return true;
    } catch (e) {
        console.error('❌ Erro ao enviar e-mail:', e.message);
        return false;
    }
}

/** Cria a notificação em tela e tenta o e-mail. Nunca lança erro. */
export async function notificar(prisma, userId, tipo, mensagem, relatedId = null) {
    try {
        const notificacao = await prisma.notification.create({
            data: { userId: parseInt(userId), type: tipo, message: mensagem, relatedId },
        });
        const usuario = await prisma.user.findUnique({ where: { id: parseInt(userId) }, select: { email: true, isActive: true } });
        if (usuario?.isActive) await enviarEmail(usuario.email, ASSUNTOS[tipo] || tipo, escaparHtml(mensagem));
        return notificacao;
    } catch (e) {
        console.error('❌ Erro ao criar notificação:', e.message);
        return null;
    }
}
