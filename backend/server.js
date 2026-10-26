/* backend/server.js - FUSÃO: MCP + RAG + WHISPER */
import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware, optionalAuthMiddleware, roleMiddleware } from './middlewares/auth.js';
import { STATUS, ehManutencao } from './status.js';
import { HORA_ABERTURA, HORA_FECHAMENTO, clausulaDeConflito, horarioValido, paraMinutos } from './horarios.js';
import { buscarBloqueioQueImpede, criarBloqueioSeNovo, motivoDoBloqueio, normalizarEquipmentId } from './bloqueios.js';
import { validarRegrasTemporais, contarReservasAtivas, sujeitoAoLimite, REGRAS_RESERVA } from './config-reservas.js';
import { JWT_SECRET } from './config-jwt.js';
import { validarEmailInstitucional, validarSenha } from './validacao-cadastro.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import {
    toolConsultarEquipamentos, executarConsultaEquipamentos,
    toolSolicitarReserva, validarSolicitacaoReserva, executarSolicitacaoReserva
} from './mcp_tools.js';
import {
    obterRascunho, salvarRascunho, encerrarEsperaDeConfirmacao, descartarRascunho,
    classificarResposta, perguntaDeConfirmacao, formatarDataBR, MENSAGEM_RECUSA
} from './confirmacao-reserva.js';
import {
    FORMATOS_ACEITOS, FORMATOS_DOCLING, MIN_CARACTERES_UTEIS, TOP_K,
    sourceDoArquivo, nomeDoSource, carregarDocumentos, caracteresUteis,
    criarEmbedder, embedding, vetorizar as vetorizarBlocos, buscar, converterComDocling
} from './rag.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCUMENTS_PATH = path.join(__dirname, 'documents');
const VECTOR_CACHE_PATH = path.join(__dirname, 'vector_cache.json');

const app = express();
const PORT = 3000;
const JWT_EXPIRATION = '15m'; // RNF04 — access token 15 min (política definitiva)

app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO DE UPLOAD DE IMAGENS/ÁUDIOS (MULTER) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB — conforme especificação (Seção 3.1)
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- BANCO DE DADOS (PRISMA) ---
const prisma = new PrismaClient();
console.log('✅ Prisma ORM conectado ao banco SQLite.');

// --- E-MAIL (OPCIONAL - nodemailer) ---
let emailTransporter = null;
try {
    const nodemailer = await import('nodemailer');
    if (process.env.SMTP_HOST) {
        emailTransporter = nodemailer.default.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        console.log('📧 Transporte de e-mail configurado.');
    } else {
        console.log('⚠️ SMTP não configurado. E-mails serão apenas logados no console.');
    }
} catch (e) {
    console.log('⚠️ nodemailer não instalado. Execute: npm install nodemailer');
}

async function sendEmailNotification(to, subject, message) {
    if (!emailTransporter) {
        console.log(`📧 [LOG] Email para ${to} | Assunto: ${subject} | ${message}`);
        return;
    }
    try {
        await emailTransporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@academai.local',
            to, subject,
            html: `<div style="font-family:sans-serif;padding:20px;"><h2>${subject}</h2><p>${message}</p><hr><small>AcademAI - Sistema de Reservas</small></div>`
        });
        console.log(`📧 Email enviado para ${to}`);
    } catch (e) {
        console.error('❌ Erro ao enviar e-mail:', e.message);
    }
}

// --- HELPER: CRIAR NOTIFICAÇÃO + E-MAIL ---
async function createNotification(userId, type, message, relatedId = null) {
    try {
        const notification = await prisma.notification.create({
            data: { userId: parseInt(userId), type, message, relatedId }
        });
        // Tenta enviar e-mail também
        const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
        if (user) {
            const subjectMap = {
                'RESERVA_APROVADA': '✅ Reserva Aprovada',
                'RESERVA_REJEITADA': '❌ Reserva Rejeitada',
                'NOVA_PENDENTE': '⏳ Nova Reserva Pendente',
                'RESERVA_CANCELADA': '🚫 Reserva Cancelada',
            };
            await sendEmailNotification(user.email, subjectMap[type] || type, message);
        }
        return notification;
    } catch (e) {
        console.error('❌ Erro ao criar notificação:', e.message);
    }
}

// Registro de auditoria (RF07). Nunca deve derrubar a operação principal:
// falha ao logar vira apenas um aviso no console.
async function registrarAuditoria({ action, actorUserId = null, targetUserId = null, detail = null, ip = null }) {
    try {
        await prisma.auditLog.create({
            data: { action, actorUserId, targetUserId, detail, ip },
        });
    } catch (e) {
        console.error('⚠️ Falha ao registrar auditoria:', e.message);
    }
}

/** IP da requisição, para a trilha de auditoria. */
function ipDaRequisicao(req) {
    return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim() || null;
}

// RF09 — reservas APROVADAS cujo horario de termino ja passou viram CONCLUIDA.
// O enum de status previa CONCLUIDA (schema + telas), mas nada nunca atribuia:
// uma reserva aprovada que ja aconteceu ficava eternamente "APROVADA".
// Nao ha job/cron no ambiente local (o projeto roda tudo na maquina), entao a
// transicao e preguicosa: acontece no backend ao servir as telas que exibem
// status. E idempotente e barata — poucas linhas de reserva — e persiste o
// novo status (importante para os relatorios do RF30).
async function concluirReservasVencidas() {
    try {
        const agora = new Date();
        const aprovadas = await prisma.appointment.findMany({ where: { status: 'APROVADA' } });
        const vencidas = aprovadas.filter((a) => {
            const fim = a.endTime || a.time; // sem endTime, usa o inicio como termino
            if (!a.date || !fim) return false;
            const dt = new Date(`${a.date}T${fim}:00`);
            return !isNaN(dt.getTime()) && dt < agora;
        }).map((a) => a.id);
        if (vencidas.length) {
            await prisma.appointment.updateMany({
                where: { id: { in: vencidas } },
                data: { status: 'CONCLUIDA' },
            });
        }
        return vencidas.length;
    } catch (e) {
        console.error('⚠️ Falha ao concluir reservas vencidas:', e.message);
        return 0;
    }
}

// --- BASE DE CONHECIMENTO (RAG) ---
let knowledgeBase = [];
let vectorStore = [];
let embedder = null;

// --- ROTEADOR DE INTENÇÃO (INTENT ROUTER) ---
function precisaDeFerramentas(mensagemUsuario) {
    const texto = mensagemUsuario.toLowerCase();

    // 1. Verbos e ações de agendamento
    const acoes = [
        'agendar', 'reservar', 'marcar', 'alugar', 'alocar', 'usar',
        'emprestar', 'utilizar', 'disponível', 'disponibilidade',
        'horário', 'cancelar', 'quais máquinas', 'equipamentos tem'
    ];

    // 2. Termos genéricos e específicos do AcademAI
    // Adicione aqui as categorias de tudo o que vocês pretendem ter no laboratório
    const equipamentos = [
        'equipamento', 'máquina', 'impressora', '3d', 'bambu',
        'laser', 'cnc', 'torno', 'solda', 'osciloscópio', 'câmera',
        'notebook', 'ferramenta', 'arduino', 'raspberry'
    ];

    // Verifica se a frase do usuário contém alguma palavra de ação OU nome de equipamento
    const temAcao = acoes.some(acao => texto.includes(acao));
    const temEquipamento = equipamentos.some(eq => texto.includes(eq));

    // Retorna TRUE se ele citou uma ação ou um equipamento. FALSE se for conversa geral (ex: "Judas")
    return temAcao || temEquipamento;
}

// --- REPASSA O STREAM DO OLLAMA PARA O CLIENTE ---
// Usado tanto pela resposta pós-ferramenta quanto pelo RAG direto.
//
// O Ollama responde em NDJSON: um objeto JSON por linha. Um chunk da rede NÃO
// corresponde a uma linha — pode trazer várias coladas ou cortar uma no meio.
// Por isso acumulamos num buffer e só processamos linhas completas, guardando o
// resto para o próximo chunk. Fazer JSON.parse direto no chunk estourava, o erro
// era engolido, e quando a linha perdida era a do 'done' o res.end() nunca
// acontecia: o cliente ficava preso esperando um fim que não vinha.
async function repassarStreamOllama(res, ollamaResponse) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    let buffer = '';

    const processarLinha = (linha) => {
        const texto = linha.trim();
        if (!texto) return;
        try {
            const json = JSON.parse(texto);
            if (json.message?.content) res.write(json.message.content);
        } catch (e) {
            console.warn('⚠️ Linha NDJSON ilegível descartada:', texto.slice(0, 120));
        }
    };

    try {
        for await (const chunk of ollamaResponse.body) {
            buffer += chunk.toString();

            let quebra;
            while ((quebra = buffer.indexOf('\n')) !== -1) {
                processarLinha(buffer.slice(0, quebra));
                buffer = buffer.slice(quebra + 1);
            }
        }
        // Resto sem quebra de linha ao final do stream
        processarLinha(buffer);
    } finally {
        // Encerra ao término do stream, tenha ou não chegado um 'done'.
        if (!res.writableEnded) res.end();
    }
}

// Resolve o nome vindo da URL para um caminho seguro dentro de documents/.
// Sem isso, um ".." no parametro viraria caminho para fora da pasta e o unlink
// apagaria outro arquivo do projeto. Devolve null quando o nome nao serve.
function caminhoSeguroDoDocumento(nomeBruto) {
    const nome = String(nomeBruto || '');
    if (!nome || nome === '.' || nome === '..') return null;

    // Recusa em vez de "consertar": um nome com barra ou ".." nunca e legitimo
    // aqui, e reduzi-lo silenciosamente ao basename devolveria 404 em vez de
    // dizer que o pedido estava errado.
    if (nome !== path.basename(nome)) return null;
    if (nome.includes('/') || nome.includes('\\') || nome.includes('\0')) return null;

    const raiz = path.resolve(DOCUMENTS_PATH);
    const destino = path.resolve(raiz, nome);
    if (destino !== path.join(raiz, nome)) return null;
    if (!destino.startsWith(raiz + path.sep)) return null;

    return { nome, caminho: destino };
}

// Lê os documentos da pasta e devolve os blocos (rag.js faz a leitura e o corte).
// Quando `apenas` é informado, lê só aquele arquivo — usado após um upload,
// para não reprocessar o corpus inteiro a cada treino.
function loadDocuments(apenas = null) {
    return carregarDocumentos(DOCUMENTS_PATH, { apenas });
}

// Carrega o modelo de embeddings uma única vez por processo.
// Antes cada upload chamava initAI(), que recriava o pipeline do zero.
async function garantirEmbedder() {
    if (embedder) return true;
    console.log("\n🧠 Inicializando Motor de IA...");
    try {
        embedder = await criarEmbedder();
        console.log("✅ Modelo de Embeddings carregado na memória.");
        return true;
    } catch (e) {
        console.error("❌ Erro fatal ao carregar modelo Xenova:", e);
        return false;
    }
}

function vetorizar(blocos) {
    return vetorizarBlocos(embedder, blocos);
}

function salvarCache() {
    try {
        fs.writeFileSync(VECTOR_CACHE_PATH, JSON.stringify(vectorStore));
        console.log("💾 Cache salvo no disco.");
    } catch (e) {
        console.error("Erro ao salvar cache:", e);
    }
}

// O cache só vale se for mais novo que todos os documentos indexados.
function cacheEstaAtualizado() {
    if (!fs.existsSync(VECTOR_CACHE_PATH)) return false;
    if (!fs.existsSync(DOCUMENTS_PATH)) return false;

    const cacheMtime = fs.statSync(VECTOR_CACHE_PATH).mtimeMs;
    const arquivos = fs.readdirSync(DOCUMENTS_PATH);
    if (arquivos.length === 0) return false;

    const todosMaisVelhos = arquivos.every(f =>
        fs.statSync(path.join(DOCUMENTS_PATH, f)).mtimeMs <= cacheMtime
    );
    if (!todosMaisVelhos) return false;

    // Comparar so as datas nao detecta REMOCAO: apagado um documento, os que
    // sobram continuam mais velhos que o cache, e os vetores do arquivo que
    // sumiu seguiriam vivos — a IA citaria um documento inexistente. Por isso
    // o conjunto de arquivos tambem precisa bater com o que o cache indexou.
    try {
        const bruto = JSON.parse(fs.readFileSync(VECTOR_CACHE_PATH, 'utf-8'));
        if (!Array.isArray(bruto)) return false;
        const noCache = new Set(bruto.map(v => nomeDoSource(v.source)));
        const emDisco = new Set(arquivos);
        if (noCache.size !== emDisco.size) return false;
        for (const nome of noCache) {
            if (!emDisco.has(nome)) return false;
        }
    } catch (e) {
        console.warn('⚠️ Cache ilegível ao comparar documentos:', e.message);
        return false;
    }

    return true;
}

async function initAI() {
    if (!(await garantirEmbedder())) return;

    // Reaproveita o cache no boot em vez de revetorizar tudo. O arquivo era
    // gravado a cada vetorização mas nunca lido de volta.
    if (cacheEstaAtualizado()) {
        try {
            const bruto = JSON.parse(fs.readFileSync(VECTOR_CACHE_PATH, 'utf-8'));
            if (Array.isArray(bruto) && bruto.length > 0) {
                vectorStore = bruto;
                knowledgeBase = bruto.map(v => ({ text: v.text, source: v.source }));
                console.log(`♻️ Cache reaproveitado: ${vectorStore.length} vetores, sem revetorizar.`);
                console.log("🚀 IA RAG Pronta para perguntas!\n");
                return;
            }
        } catch (e) {
            console.warn("⚠️ Cache ilegível, refazendo a vetorização:", e.message);
        }
    }

    knowledgeBase = await loadDocuments();
    if (knowledgeBase.length === 0) {
        console.warn("⚠️ Base de conhecimento vazia! O RAG não usará arquivos.");
    }
    console.log(`📊 Iniciando vetorização de ${knowledgeBase.length} blocos...`);
    vectorStore = await vetorizar(knowledgeBase);
    console.log(`\n✅ Vetorização concluída! Temos ${vectorStore.length} vetores prontos.`);
    salvarCache();
    console.log("🚀 IA RAG Pronta para perguntas!\n");
}

// Indexa UM documento recém-enviado, somando ao que já está em memória.
// Antes o /api/train zerava tudo e reprocessava o corpus inteiro a cada upload.
async function indexarDocumento(nomeArquivo) {
    if (!(await garantirEmbedder())) {
        throw new Error("Modelo de embeddings indisponível.");
    }
    const blocos = await loadDocuments(nomeArquivo);
    if (blocos.length === 0) {
        console.warn(`⚠️ Nenhum conteúdo extraído de ${nomeArquivo}.`);
        return 0;
    }
    console.log(`📊 Vetorizando ${blocos.length} blocos novos de ${nomeArquivo}...`);
    const novosVetores = await vetorizar(blocos);
    knowledgeBase = knowledgeBase.concat(blocos);
    vectorStore = vectorStore.concat(novosVetores);
    console.log(`\n✅ +${novosVetores.length} vetores. Total: ${vectorStore.length}.`);
    salvarCache();
    return novosVetores.length;
}

initAI();

// ============================================================
// ======================== ROTAS =============================
// ============================================================

// --- AUTENTICAÇÃO ---

// POST /api/register (RF01 - com seleção de perfil)
app.post('/api/register', async (req, res) => {
    try {
        const { fullName, email, ra, password, role } = req.body;
        if (!fullName || !email || !password) {
            return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
        }
        // RF01 — validacao autoritativa no servidor (o cliente so avisa).
        const erroEmail = validarEmailInstitucional(email);
        if (erroEmail) return res.status(400).json({ error: erroEmail });
        const erroSenha = validarSenha(password);
        if (erroSenha) return res.status(400).json({ error: erroSenha });

        const hashedPassword = await bcrypt.hash(password, 12); // RNF03 — fator mínimo 12
        // RF01/RN08 — apenas ALUNO pode se auto-registrar; Professor/Admin são atribuídos por administrador
        const allowedRoles = ['ALUNO'];
        const userRole = allowedRoles.includes(role) ? role : 'ALUNO';

        await prisma.user.create({
            data: { name: fullName, email, ra: ra || null, password: hashedPassword, role: userRole }
        });
        res.json({ message: "Cadastro realizado com sucesso!" });
    } catch (error) {
        console.error("Erro no cadastro:", error);
        res.status(400).json({ error: "Erro ao cadastrar. E-mail ou RA já existem." });
    }
});

// POST /api/login (RF02 - JWT 8h + Refresh Token RNF04)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
        if (!user.isActive) return res.status(403).json({ error: "Conta desativada. Contate o administrador." });
        if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Senha inválida." });

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });

        // Gera Refresh Token (RNF04)
        const refreshToken = crypto.randomUUID();
        const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
        await prisma.refreshToken.create({
            data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiresAt }
        });

        res.json({
            auth: true, token, refreshToken,
            name: user.name, id: user.id, role: user.role,
            email: user.email, ra: user.ra,
            isTempPassword: user.isTempPassword
        });
    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ error: "Erro interno no login." });
    }
});

// POST /api/auth/refresh (RNF04 - Renovação silenciosa)
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ error: "Refresh token é obrigatório." });

        const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
        if (!stored) return res.status(401).json({ error: "Refresh token inválido." });
        if (new Date() > stored.expiresAt) {
            await prisma.refreshToken.delete({ where: { id: stored.id } });
            return res.status(401).json({ error: "Refresh token expirado. Faça login novamente." });
        }

        const user = await prisma.user.findUnique({ where: { id: stored.userId } });
        if (!user || !user.isActive) {
            await prisma.refreshToken.delete({ where: { id: stored.id } });
            return res.status(401).json({ error: "Usuário não encontrado ou desativado." });
        }

        // Gera novos tokens (rotação)
        const newAccessToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
        const newRefreshToken = crypto.randomUUID();
        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Invalida o antigo e cria o novo
        await prisma.refreshToken.delete({ where: { id: stored.id } });
        await prisma.refreshToken.create({
            data: { token: newRefreshToken, userId: user.id, expiresAt: newExpiresAt }
        });

        res.json({ token: newAccessToken, refreshToken: newRefreshToken });
    } catch (error) {
        console.error("Erro no refresh:", error);
        res.status(500).json({ error: "Erro interno na renovação." });
    }
});

// POST /api/auth/logout (Invalida refresh token)
app.post('/api/auth/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
        }
        res.json({ message: "Logout realizado com sucesso." });
    } catch (error) {
        res.status(500).json({ error: "Erro no logout." });
    }
});

// POST /api/change-password
app.post('/api/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        // O ALVO e sempre o dono do token — nunca um id vindo do corpo. Antes a
        // rota era publica e aceitava { userId, newPassword }: qualquer um trocava
        // a senha de qualquer conta (inclusive admin) sem estar logado.
        const userId = req.userId;
        if (!newPassword) return res.status(400).json({ error: "Informe a nova senha." });
        if (newPassword.length < 8) return res.status(400).json({ error: "A nova senha deve ter no mínimo 8 caracteres." });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

        // Senha atual e obrigatoria — a unica isencao e a troca forcada de senha
        // temporaria (o usuario acabou de entrar com a senha do e-mail e ainda
        // nao tem uma senha "propria" para reconferir).
        if (user.isTempPassword !== 1) {
            if (!currentPassword) return res.status(400).json({ error: "Informe a senha atual." });
            const valid = await bcrypt.compare(currentPassword, user.password);
            if (!valid) return res.status(401).json({ error: "Senha atual incorreta." });
        }

        const hashedNew = await bcrypt.hash(newPassword, 12); // RNF03
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedNew, isTempPassword: 0 }
        });

        // RF07 - trilha de auditoria: o próprio usuário trocou a senha.
        await registrarAuditoria({
            action: 'SENHA_TROCADA',
            actorUserId: userId,
            targetUserId: userId,
            detail: user.isTempPassword === 1 ? 'Troca de senha temporária' : 'Troca de senha pelo usuário',
            ip: ipDaRequisicao(req),
        });

        res.json({ message: "Senha atualizada com sucesso!" });
    } catch (error) {
        console.error("Erro ao trocar senha:", error);
        res.status(500).json({ error: "Erro interno ao trocar senha." });
    }
});

// POST /api/reset-password (RF07)
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email } = req.body;
        // Resposta SEMPRE generica: nao revela se o e-mail existe (evita
        // enumeracao de contas) e NUNCA devolve a senha no corpo — antes
        // qualquer um com um e-mail assumia a conta lendo a resposta.
        const mensagemGenerica = "Se existir uma conta com esse e-mail, enviamos as instruções de recuperação. Em ambiente sem e-mail, procure um administrador.";

        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
            const tempPassword = Math.random().toString(36).slice(-8);
            const hashedTemp = await bcrypt.hash(tempPassword, 12); // RNF03
            await prisma.user.update({
                where: { id: user.id },
                data: { password: hashedTemp, isTempPassword: 1 }
            });
            await registrarAuditoria({
                action: 'SENHA_RESET',
                targetUserId: user.id,
                detail: `Recuperação de senha solicitada para ${email}`,
                ip: ipDaRequisicao(req),
            });
            // Entrega SO por e-mail. Sem SMTP, a senha fica apenas no log do
            // servidor; a recuperacao offline e feita pelo admin (rota abaixo).
            await sendEmailNotification(
                email,
                'AcademAI - Recuperação de Senha',
                `Sua senha temporária é: <strong>${tempPassword}</strong><br>Ao fazer login, você será solicitado a criar uma nova senha.`
            );
        }
        res.json({ message: mensagemGenerica });
    } catch (error) {
        console.error("Erro ao resetar senha:", error);
        res.status(500).json({ error: "Erro interno ao resetar senha." });
    }
});

// POST /api/users/:id/reset-password (RF07 - reset offline pelo administrador)
// Gera uma senha temporaria e a devolve AO ADMIN autenticado, que a repassa ao
// usuario. Registrado em auditoria. E o unico caminho que revela a senha, e so
// para quem tem papel de admin.
app.post('/api/users/:id/reset-password', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        const alvoId = parseInt(req.params.id);
        const alvo = await prisma.user.findUnique({ where: { id: alvoId } });
        if (!alvo) return res.status(404).json({ error: "Usuário não encontrado." });

        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedTemp = await bcrypt.hash(tempPassword, 12); // RNF03
        await prisma.user.update({
            where: { id: alvoId },
            data: { password: hashedTemp, isTempPassword: 1 }
        });
        await registrarAuditoria({
            action: 'SENHA_RESET_ADMIN',
            actorUserId: req.userId,
            targetUserId: alvoId,
            detail: `Reset offline de senha de ${alvo.email}`,
            ip: ipDaRequisicao(req),
        });
        res.json({
            message: `Senha temporária de ${alvo.name} gerada. Repasse ao usuário: ele trocará no próximo login.`,
            tempPassword,
        });
    } catch (error) {
        console.error("Erro no reset de senha pelo admin:", error);
        res.status(500).json({ error: "Erro ao resetar senha." });
    }
});

// --- GESTÃO DE USUÁRIOS (RF04) ---

// GET /api/users (RNF05 - protegido)
app.get('/api/users', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, ra: true, role: true, trainings: true, isActive: true }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar usuários." });
    }
});

// PUT /api/users/:id (RF04 - protegido, permite alterar perfil)
app.put('/api/users/:id', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { name, email, ra, trainings, role } = req.body;
        const existingUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!existingUser) return res.status(404).json({ error: "Usuário não encontrado." });

        // Validações de segurança ao alterar perfil (RN08)
        if (role && role !== existingUser.role) {
            const allowedRoles = ['ALUNO', 'PROFESSOR', 'ADMIN'];
            if (!allowedRoles.includes(role)) {
                return res.status(400).json({ error: "Perfil inválido." });
            }
            // Proteger rebaixamento do último admin ativo (RN05)
            if (existingUser.role === 'ADMIN' && role !== 'ADMIN') {
                const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
                if (activeAdmins <= 1) {
                    return res.status(400).json({ error: "Não é possível alterar o perfil do único administrador ativo." });
                }
            }
        }

        const updateData = {
            name, email,
            ra: ra || null,
            trainings: trainings !== undefined ? trainings : existingUser.trainings
        };
        if (role) updateData.role = role; // RF04 — admin pode alterar perfil do usuário

        const updatedUser = await prisma.user.update({ where: { id: userId }, data: updateData });
        res.json({ message: "Usuário atualizado com sucesso!", user: updatedUser });
    } catch (error) {
        res.status(500).json({ error: "Erro ao atualizar usuário." });
    }
});


// DELETE /api/users/:id (RNF05 - protegido)
app.delete('/api/users/:id', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const existingUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!existingUser) return res.status(404).json({ error: "Usuário não encontrado." });
        if (existingUser.role === 'ADMIN') return res.status(403).json({ error: "Perfis de administrador não podem ser excluídos." });

        await prisma.notification.deleteMany({ where: { userId } });
        await prisma.appointment.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });
        res.json({ message: "Usuário excluído com sucesso!" });
    } catch (error) {
        res.status(500).json({ error: "Erro ao excluir usuário." });
    }
});

// PUT /api/users/:id/toggle-active (RF04 - ativar/desativar)
app.put('/api/users/:id/toggle-active', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

        // Não permitir desativar o próprio admin
        if (user.role === 'ADMIN') {
            const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
            if (activeAdmins <= 1 && user.isActive) {
                return res.status(400).json({ error: "Não é possível desativar o único administrador ativo." });
            }
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: { isActive: !user.isActive }
        });
        res.json({ message: `Conta ${updated.isActive ? 'ativada' : 'desativada'} com sucesso!`, user: updated });
    } catch (error) {
        res.status(500).json({ error: "Erro ao alterar status da conta." });
    }
});

// GET /api/users/:id/stats — Estatísticas dinâmicas do perfil (RF17)
app.get('/api/users/:id/stats', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Semestre atual: Jan-Jun ou Jul-Dez
        const now = new Date();
        const semesterStartMonth = now.getMonth() < 6 ? 0 : 6;
        const semesterStart = new Date(now.getFullYear(), semesterStartMonth, 1).toISOString().split('T')[0];
        const semesterEnd = now.toISOString().split('T')[0];

        const semesterAppointments = await prisma.appointment.findMany({
            where: {
                userId,
                date: { gte: semesterStart, lte: semesterEnd },
                status: { in: ['APROVADA', 'CONCLUIDA'] }
            },
            select: { time: true, endTime: true, equipmentId: true }
        });

        // Calcula horas totais somando duração de cada reserva
        let totalMinutes = 0;
        for (const appt of semesterAppointments) {
            if (appt.time && appt.endTime) {
                const [sh, sm] = appt.time.split(':').map(Number);
                const [eh, em] = appt.endTime.split(':').map(Number);
                totalMinutes += Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
            } else {
                totalMinutes += 60; // fallback: assume 1h por reserva sem endTime
            }
        }

        // Conta equipamentos distintos (como "projetos")
        const distinctEquipments = new Set(semesterAppointments.map(a => a.equipmentId));

        // Treinamentos concluídos a partir do campo trainings do usuário
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { trainings: true }
        });

        res.json({
            semesterHours: parseFloat((totalMinutes / 60).toFixed(1)),
            projectCount: distinctEquipments.size,
            completedTrainings: user?.trainings || ''
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro interno ao calcular estatísticas.' });
    }
});

// --- EQUIPAMENTOS (RF05) ---

app.get('/api/equipment', async (req, res) => {
    try {
        const equipment = await prisma.equipment.findMany();
        res.json(equipment);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar equipamentos." });
    }
});

app.get('/api/equipment/:id', async (req, res) => {
    try {
        const equipment = await prisma.equipment.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!equipment) return res.status(404).json({ error: "Equipamento não encontrado." });
        res.json(equipment);
    } catch (error) {
        res.status(500).json({ error: "Erro interno." });
    }
});

// Nome de uma unidade dentro do modelo: unidade unica fica com o nome do
// modelo; a partir de duas, ganha sufixo numerado ("Bambu Lab 01").
function nomeDaUnidade(modelo, indice, total) {
    if (total === 1) return modelo;
    return `${modelo} ${String(indice + 1).padStart(2, '0')}`;
}

app.post('/api/equipment', authMiddleware, roleMiddleware(['ADMIN']), upload.single('image'), async (req, res) => {
    try {
        const { name, description, status, specs, quantity, requiresTraining } = req.body;
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
        const fullDescription = JSON.stringify({
            specs: specs || '', description: description || '',
            requiresTraining: requiresTraining === true || requiresTraining === 'true'
        });
        const newQuantity = parseInt(quantity) || 1;
        // O nome digitado pelo admin JA e o modelo. As unidades derivam dele,
        // entao nao ha nada para adivinhar por regex.
        const modelo = (name || '').trim();
        if (!modelo) return res.status(400).json({ error: "O nome do equipamento é obrigatório." });

        const created = [];
        for (let i = 0; i < newQuantity; i++) {
            const unit = await prisma.equipment.create({
                data: {
                    name: nomeDaUnidade(modelo, i, newQuantity),
                    modelo,
                    description: fullDescription,
                    imagePath,
                    status: status || STATUS.DISPONIVEL
                }
            });
            created.push(unit);
        }
        res.status(201).json({ message: "Equipamento(s) salvo(s)!", equipment: created });
    } catch (error) {
        console.error("Erro ao criar equipamento:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});

app.put('/api/equipment/:id', authMiddleware, roleMiddleware(['ADMIN']), upload.single('image'), async (req, res) => {
    try {
        const equipmentId = parseInt(req.params.id);
        const { name, description, status, specs, quantity, requiresTraining } = req.body;
        const target = await prisma.equipment.findUnique({ where: { id: equipmentId } });
        if (!target) return res.status(404).json({ error: "Equipamento não encontrado." });

        // O grupo vem do campo 'modelo', nao de adivinhacao sobre o nome. Isso
        // importa aqui em especial: mais abaixo esta rota apaga unidades, e
        // antes ela decidia quais apagar por casamento de regex.
        const groupItems = await prisma.equipment.findMany({
            where: { modelo: target.modelo },
            orderBy: { id: 'asc' }
        });

        const fullDescription = JSON.stringify({
            specs: specs || '', description: description || '',
            requiresTraining: requiresTraining === true || requiresTraining === 'true'
        });
        let newImagePath = target.imagePath;
        if (req.file) newImagePath = `/uploads/${req.file.filename}`;
        const newQuantity = parseInt(quantity) || groupItems.length || 1;
        // Renomear o grupo e renomear o modelo: as unidades derivam dele.
        const novoModelo = name ? name.trim() : target.modelo;

        if (newQuantity >= groupItems.length) {
            for (let i = 0; i < groupItems.length; i++) {
                await prisma.equipment.update({
                    where: { id: groupItems[i].id },
                    data: { name: nomeDaUnidade(novoModelo, i, newQuantity), modelo: novoModelo, description: fullDescription, status: status || groupItems[i].status, imagePath: newImagePath }
                });
            }
            for (let i = groupItems.length; i < newQuantity; i++) {
                await prisma.equipment.create({
                    data: { name: nomeDaUnidade(novoModelo, i, newQuantity), modelo: novoModelo, description: fullDescription, status: status || STATUS.DISPONIVEL, imagePath: newImagePath }
                });
            }
        } else {
            // RN06 - Verificar se unidades a remover possuem reservas ativas
            const idsToDelete = groupItems.slice(newQuantity).map(item => item.id);
            const activeReservations = await prisma.appointment.count({
                where: { equipmentId: { in: idsToDelete }, status: { in: ['PENDENTE', 'APROVADA'] } }
            });
            if (activeReservations > 0) {
                return res.status(400).json({ error: `Não é possível reduzir a quantidade. ${activeReservations} unidade(s) possuem reservas ativas (pendentes ou aprovadas).` });
            }

            for (let i = 0; i < newQuantity; i++) {
                await prisma.equipment.update({
                    where: { id: groupItems[i].id },
                    data: { name: nomeDaUnidade(novoModelo, i, newQuantity), modelo: novoModelo, description: fullDescription, status: status || groupItems[i].status, imagePath: newImagePath }
                });
            }
            await prisma.appointment.deleteMany({ where: { equipmentId: { in: idsToDelete } } });
            await prisma.equipment.deleteMany({ where: { id: { in: idsToDelete } } });
        }
        res.json({ message: "Equipamento atualizado com sucesso!" });
    } catch (error) {
        console.error("Erro ao atualizar equipamento:", error);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

app.delete('/api/equipment/:id', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        const equipmentId = parseInt(req.params.id);
        const target = await prisma.equipment.findUnique({ where: { id: equipmentId } });
        if (!target) return res.status(404).json({ error: "Equipamento não encontrado." });
        
        const activeReservations = await prisma.appointment.count({
            where: { equipmentId, status: { in: ['PENDENTE', 'APROVADA'] } }
        });
        
        if (activeReservations > 0) {
            return res.status(400).json({ error: `Não é possível excluir. Existem ${activeReservations} reserva(s) ativa(s) para este equipamento.` });
        }
        
        await prisma.appointment.deleteMany({ where: { equipmentId } });
        await prisma.equipment.delete({ where: { id: equipmentId } });
        
        res.json({ message: "Equipamento excluído com sucesso!" });
    } catch (error) {
        console.error("Erro ao excluir equipamento:", error);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

// --- RESERVAS / AGENDAMENTOS (RF08-RF16) ---

// POST /api/schedule (RF08, RF11, RF16 - com auto-aprovação e verificação de conflito)
app.post('/api/schedule', authMiddleware, async (req, res) => {
    try {
        const { equipmentId, date, time, endTime, justification } = req.body;
        const userId = req.userId;
        if (!userId) return res.status(401).json({ error: "Usuário não autenticado." });
        if (!equipmentId || !date || !time) {
            return res.status(400).json({ error: "Equipamento, data e horário são obrigatórios." });
        }

        const eqId = parseInt(equipmentId);
        const uId = parseInt(userId);

        const equipment = await prisma.equipment.findUnique({ where: { id: eqId } });
        if (!equipment) return res.status(404).json({ error: "Equipamento não encontrado." });
        if (ehManutencao(equipment.status)) {
            return res.status(403).json({ error: "Este equipamento está bloqueado para uso no momento e não aceita reservas." });
        }

        const blockedDate = await buscarBloqueioQueImpede(prisma, date, eqId);
        if (blockedDate) {
            return res.status(403).json({ error: `A data selecionada está bloqueada. Motivo: ${motivoDoBloqueio(blockedDate)}` });
        }

        // Sem hora de término não existe reserva com duração: a tela mostrava
        // "16:00 às 16:00" e o teste de conflito não tinha intervalo para comparar.
        if (!horarioValido(time) || !horarioValido(endTime)) {
            return res.status(400).json({ error: "Horário de início e de término devem estar no formato HH:MM." });
        }
        if (paraMinutos(endTime) <= paraMinutos(time)) {
            return res.status(400).json({ error: "O horário de término deve ser posterior ao de início." });
        }
        if (paraMinutos(time) < paraMinutos(HORA_ABERTURA) || paraMinutos(endTime) > paraMinutos(HORA_FECHAMENTO)) {
            return res.status(400).json({ error: `As reservas só podem ocorrer entre ${HORA_ABERTURA} e ${HORA_FECHAMENTO}.` });
        }

        // RF08/RN04 - Antecedência mínima (barra o passado) e duração mín/máx.
        const regras = validarRegrasTemporais(date, time, endTime);
        if (!regras.ok) {
            return res.status(400).json({ error: regras.erro });
        }

        // RF16 - Verificar conflito de horário
        const conflicting = await prisma.appointment.findFirst({
            where: {
                equipmentId: eqId,
                date: date,
                status: { in: ['PENDENTE', 'APROVADA'] },
                OR: clausulaDeConflito(time, endTime)
            }
        });
        if (conflicting) {
            return res.status(409).json({ error: "Conflito de horário! Já existe uma reserva para este equipamento neste período." });
        }

        // RF11 - Aprovação automática para PROFESSOR e ADMIN
        const user = await prisma.user.findUnique({ where: { id: uId } });

        // RF08 - Limite de reservas ativas simultâneas (só ALUNO; staff isento).
        if (user && sujeitoAoLimite(user.role)) {
            const hojeISO = new Date().toISOString().slice(0, 10);
            const ativas = await contarReservasAtivas(prisma, uId, hojeISO);
            if (ativas >= REGRAS_RESERVA.limiteReservasAtivas) {
                return res.status(409).json({
                    error: `Você atingiu o limite de ${REGRAS_RESERVA.limiteReservasAtivas} reservas ativas. Cancele ou aguarde a conclusão de uma antes de solicitar outra.`,
                });
            }
        }

        const autoApprove = user && (user.role === 'PROFESSOR' || user.role === 'ADMIN');
        const reservaStatus = autoApprove ? 'APROVADA' : 'PENDENTE';

        const newAppointment = await prisma.appointment.create({
            data: {
                date, time,
                endTime,
                justification: justification || null,
                status: reservaStatus,
                userId: uId,
                equipmentId: eqId,
                approvedById: autoApprove ? uId : null
            }
        });

        // RF12 - Notificar o próprio usuário
        if (autoApprove) {
            await createNotification(uId, 'RESERVA_APROVADA',
                `Sua reserva foi aprovada automaticamente para ${date} às ${time}.`, newAppointment.id);
        } else {
            await createNotification(uId, 'NOVA_PENDENTE',
                `Sua reserva para ${date} às ${time} foi enviada e aguarda aprovação.`, newAppointment.id);

            // RF13 - Notificar professores e admins sobre nova pendente
            const approvers = await prisma.user.findMany({
                where: { role: { in: ['PROFESSOR', 'ADMIN'] }, isActive: true }
            });
            for (const approver of approvers) {
                await createNotification(approver.id, 'NOVA_PENDENTE',
                    `${user.name} solicitou reserva de equipamento para ${date} às ${time}. Aguarda sua aprovação.`,
                    newAppointment.id);
            }
        }

        const msg = autoApprove
            ? "Reserva aprovada automaticamente!"
            : "Reserva solicitada com sucesso! Aguarde aprovação.";
        res.status(201).json({ message: msg, appointment: newAppointment });
    } catch (error) {
        console.error("❌ Erro ao criar agendamento:", error);
        res.status(500).json({ error: "Erro interno ao agendar." });
    }
});

// GET /api/appointments/equipment/:equipmentId (Busca reservas ocupadas do equipamento)
app.get('/api/appointments/equipment/:equipmentId', async (req, res) => {
    try {
        const equipmentId = parseInt(req.params.equipmentId);
        const appointments = await prisma.appointment.findMany({
            where: { 
                equipmentId,
                status: { in: ['PENDENTE', 'APROVADA'] }
            },
            select: { date: true, time: true, endTime: true, status: true }
        });
        res.json(appointments);
    } catch (error) {
        console.error("❌ Erro ao buscar reservas do equipamento:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});

// GET /api/appointments/pending (professor e admin veem pendentes)
app.get('/api/appointments/pending', authMiddleware, roleMiddleware(['ADMIN', 'PROFESSOR']), async (req, res) => {
    try {
        const pendingAppointments = await prisma.appointment.findMany({
            where: { status: "PENDENTE" },
            include: {
                user: { select: { name: true, ra: true, email: true } },
                equipment: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(pendingAppointments);
    } catch (error) {
        console.error("❌ Erro ao buscar pendentes:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});

// PUT /api/appointments/:id/status (RF14 - com justificativa de rejeição + RN02)
app.put('/api/appointments/:id/status', authMiddleware, roleMiddleware(['ADMIN', 'PROFESSOR']), async (req, res) => {
    try {
        const { status, rejectionReason } = req.body;
        const appointmentId = parseInt(req.params.id);

        // RF14 — justificativa OBRIGATORIA para rejeicao, opcional para aprovacao.
        // Antes o motivo era guardado so "se viesse"; uma rejeicao sem motivo
        // passava direto e o aluno nao sabia o porque.
        const motivoRejeicao = typeof rejectionReason === 'string' ? rejectionReason.trim() : '';
        if (status === 'REJEITADA' && !motivoRejeicao) {
            return res.status(400).json({ error: "Informe a justificativa da rejeição." });
        }

        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { user: { select: { role: true } } }
        });
        if (!appointment) return res.status(404).json({ error: "Reserva não encontrada." });
        if (appointment.status !== 'PENDENTE') {
            return res.status(400).json({ error: "Esta reserva já foi processada." });
        }

        // RN02 - Professor só aprova reservas de ALUNOS
        if (req.userRole === 'PROFESSOR' && appointment.user.role !== 'ALUNO') {
            return res.status(403).json({ error: "Professores só podem aprovar ou rejeitar reservas de estudantes." });
        }

        // Aprovar so e permitido se o dia continuar livre. O bloqueio e checado
        // na criacao, mas a reserva fica pendente por um tempo: se o dia for
        // bloqueado no meio (feriado decretado, manutencao programada), aprovar
        // sem reconferir confirmaria uma reserva num dia fechado.
        // Rejeitar segue permitido — a data bloqueada e ate um motivo para isso.
        if (status === 'APROVADA') {
            const diaBloqueado = await buscarBloqueioQueImpede(prisma, appointment.date, appointment.equipmentId);
            if (diaBloqueado) {
                return res.status(409).json({
                    error: `Não é possível aprovar: a data ${appointment.date} foi bloqueada depois do pedido. Motivo: ${motivoDoBloqueio(diaBloqueado)}. Rejeite a reserva ou remova o bloqueio.`
                });
            }

            const equipamento = await prisma.equipment.findUnique({ where: { id: appointment.equipmentId } });
            if (equipamento && ehManutencao(equipamento.status)) {
                return res.status(409).json({
                    error: `Não é possível aprovar: ${equipamento.name} entrou em manutenção depois do pedido. Rejeite a reserva ou libere o equipamento.`
                });
            }
        }

        const updateData = {
            status,
            approvedById: req.userId
        };
        if (status === 'REJEITADA') {
            updateData.rejectionReason = motivoRejeicao;
        }

        const updated = await prisma.appointment.update({
            where: { id: appointmentId },
            data: updateData
        });

        // RF12 - Notificar o solicitante
        if (status === 'APROVADA') {
            await createNotification(appointment.userId, 'RESERVA_APROVADA',
                `Sua reserva para ${appointment.date} às ${appointment.time} foi aprovada!`, appointmentId);
        } else if (status === 'REJEITADA') {
            const reason = motivoRejeicao ? ` Motivo: ${motivoRejeicao}` : '';
            await createNotification(appointment.userId, 'RESERVA_REJEITADA',
                `Sua reserva para ${appointment.date} às ${appointment.time} foi rejeitada.${reason}`, appointmentId);
        }

        res.json({ message: `Reserva ${status.toLowerCase()}!`, appointment: updated });
    } catch (error) {
        console.error("❌ Erro ao atualizar status:", error);
        res.status(500).json({ error: "Erro interno ao atualizar reserva." });
    }
});

// NOTA: GET /api/appointments/overview está definida mais abaixo com implementação completa (semana segunda-domingo)


// GET /api/appointments/all-history (Histórico Global - ADMIN)
app.get('/api/appointments/all-history', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        await concluirReservasVencidas(); // RF09
        const appointments = await prisma.appointment.findMany({
            include: { user: { select: { name: true, role: true } }, equipment: { select: { name: true } } },
            orderBy: { id: 'desc' }
        });
        
        const formatted = appointments.map(appt => ({
            id: appt.id, 
            equipment: appt.equipment.name,
            date: appt.date, 
            startTime: appt.time, 
            endTime: appt.endTime,
            status: appt.status, 
            justification: appt.justification,
            rejectionReason: appt.rejectionReason,
            user: appt.user.name,
            userRole: appt.user.role
        }));
        
        res.json(formatted);
    } catch (error) {
        console.error("❌ Erro ao buscar histórico global:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});

// GET /api/appointments/:userId (RNF05 - protegido)
// ATENCAO: rotas literais de /api/appointments precisam vir ANTES da rota
// parametrica :userId abaixo. O Express casa na ordem de declaracao, entao
// com :userId antes a palavra 'overview' era lida como id de usuario,
// parseInt dava NaN e a resposta era 400.
app.get('/api/appointments/overview', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        await concluirReservasVencidas(); // RF09
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Calcula início e fim da semana (segunda a domingo)
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const mondayStr = monday.toISOString().split('T')[0];
        const sundayStr = sunday.toISOString().split('T')[0];

        // Reservas do dia
        const todayAppointments = await prisma.appointment.findMany({
            where: { date: todayStr },
            include: {
                user: { select: { name: true, role: true } },
                equipment: { select: { name: true } }
            },
            orderBy: { time: 'asc' }
        });

        // Reservas da semana
        const weekAppointments = await prisma.appointment.findMany({
            where: { date: { gte: mondayStr, lte: sundayStr } },
            include: {
                user: { select: { name: true, role: true } },
                equipment: { select: { name: true } }
            },
            orderBy: [{ date: 'asc' }, { time: 'asc' }]
        });

        // Pendentes
        const pendingCount = await prisma.appointment.count({
            where: { status: 'PENDENTE' }
        });

        res.json({
            today: todayStr,
            weekStart: mondayStr,
            weekEnd: sundayStr,
            todayAppointments,
            weekAppointments,
            pendingCount
        });
    } catch (error) {
        console.error("❌ Erro no overview:", error);
        res.status(500).json({ error: "Erro ao carregar visão geral." });
    }
});

app.get('/api/appointments/calendar', authMiddleware, roleMiddleware(['ADMIN', 'PROFESSOR']), async (req, res) => {
    try {
        await concluirReservasVencidas(); // RF09
        const { start, end } = req.query;
        const where = {};
        if (start && end) {
            where.date = { gte: start, lte: end };
        }

        const appointments = await prisma.appointment.findMany({
            where,
            include: {
                user: { select: { name: true, role: true, email: true } },
                equipment: { select: { name: true } }
            },
            orderBy: [{ date: 'asc' }, { time: 'asc' }]
        });
        res.json(appointments);
    } catch (error) {
        console.error("❌ Erro no calendário:", error);
        res.status(500).json({ error: "Erro ao carregar calendário." });
    }
});

app.get('/api/appointments/:userId', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: "ID inválido" });

        // So o dono ou um ADMIN veem as reservas de um usuario. Antes, qualquer
        // pessoa logada lia as reservas de qualquer id (IDOR).
        const solicitante = await prisma.user.findUnique({ where: { id: req.userId } });
        if (userId !== req.userId && solicitante?.role !== 'ADMIN') {
            return res.status(403).json({ error: "Você só pode ver as suas próprias reservas." });
        }

        await concluirReservasVencidas(); // RF09
        const appointments = await prisma.appointment.findMany({
            where: { userId },
            include: { equipment: { select: { name: true } } },
            orderBy: { id: 'desc' }
        });

        const formatted = appointments.map(appt => ({
            id: appt.id, equipment: appt.equipment.name,
            date: appt.date, startTime: appt.time, endTime: appt.endTime,
            status: appt.status, justification: appt.justification,
            rejectionReason: appt.rejectionReason
        }));
        res.json(formatted);
    } catch (error) {
        console.error("❌ Erro ao buscar reservas:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});

// PUT /api/appointments/:id/cancel (RF15/RN04 - cancelar reserva com antecedência mínima)
app.put('/api/appointments/:id/cancel', authMiddleware, async (req, res) => {
    try {
        const appointmentId = parseInt(req.params.id);
        const userId = req.userId;
        if (!userId) return res.status(401).json({ error: "Não autenticado." });

        const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
        if (!appointment) return res.status(404).json({ error: "Reserva não encontrada." });
        if (appointment.userId !== userId) {
            return res.status(403).json({ error: "Você só pode cancelar suas próprias reservas." });
        }
        if (!['PENDENTE', 'APROVADA'].includes(appointment.status)) {
            return res.status(400).json({ error: "Apenas reservas pendentes ou aprovadas podem ser canceladas." });
        }

        // RF15/RN04 — verificar antecedência mínima (padrão 2h; admin isento)
        const requester = await prisma.user.findUnique({ where: { id: userId } });
        if (requester && requester.role !== 'ADMIN') {
            const MIN_ADVANCE_HOURS = 2; // configurável pelo administrador no futuro
            const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}:00`);
            const hoursUntil = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
            if (hoursUntil >= 0 && hoursUntil < MIN_ADVANCE_HOURS) {
                return res.status(400).json({
                    error: `Cancelamento não permitido. A reserva começa em menos de ${MIN_ADVANCE_HOURS}h. Contate o administrador para cancelar.`
                });
            }
        }

        const updated = await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: 'CANCELADA' }
        });

        // Notifica admins/professores sobre o cancelamento
        const approvers = await prisma.user.findMany({
            where: { role: { in: ['PROFESSOR', 'ADMIN'] }, isActive: true }
        });
        const user = await prisma.user.findUnique({ where: { id: userId } });
        for (const approver of approvers) {
            await createNotification(approver.id, 'RESERVA_CANCELADA',
                `${user?.name || 'Usuário'} cancelou a reserva para ${appointment.date} às ${appointment.time}.`,
                appointmentId);
        }

        res.json({ message: "Reserva cancelada com sucesso!", appointment: updated });
    } catch (error) {
        console.error("Erro ao cancelar reserva:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});


// --- NOTIFICAÇÕES (RF12/RF13) ---

// GET /api/notifications/:userId (RNF05 - protegido)
app.get('/api/notifications/:userId', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        // Notificacao e pessoal: so o dono le a sua. Antes vazava para qualquer
        // logado — inclusive mensagens com nome e horario de outras pessoas.
        if (userId !== req.userId) {
            return res.status(403).json({ error: "Acesso negado." });
        }
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        const unreadCount = await prisma.notification.count({
            where: { userId, isRead: false }
        });
        res.json({ notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar notificações." });
    }
});

// PUT /api/notifications/:id/read (RNF05 - protegido)
app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
    try {
        // Marcar como lida so vale para uma notificacao do proprio usuario.
        const notif = await prisma.notification.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!notif) return res.status(404).json({ error: "Notificação não encontrada." });
        if (notif.userId !== req.userId) return res.status(403).json({ error: "Acesso negado." });

        await prisma.notification.update({
            where: { id: notif.id },
            data: { isRead: true }
        });
        res.json({ message: "Notificação marcada como lida." });
    } catch (error) {
        res.status(500).json({ error: "Erro ao marcar notificação." });
    }
});

// PUT /api/notifications/read-all/:userId (RNF05 - protegido)
app.put('/api/notifications/read-all/:userId', authMiddleware, async (req, res) => {
    try {
        // So o dono marca as proprias como lidas.
        if (parseInt(req.params.userId) !== req.userId) {
            return res.status(403).json({ error: "Acesso negado." });
        }
        await prisma.notification.updateMany({
            where: { userId: req.userId, isRead: false },
            data: { isRead: true }
        });
        res.json({ message: "Todas as notificações marcadas como lidas." });
    } catch (error) {
        res.status(500).json({ error: "Erro ao marcar notificações." });
    }
});

// --- TREINAMENTO IA (ADMIN, RNF05 - protegido) ---
// Upload próprio para documentos: só aceita os formatos do acervo e guarda o
// original em uploads/ apenas até o fim da conversão.
const uploadDocumento = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB (Seção 1.6.1)
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (FORMATOS_ACEITOS.includes(ext)) return cb(null, true);
        req.formatoRecusado = ext || '(sem extensão)';
        cb(null, false);
    }
});

// Registra a ingestão na trilha de auditoria (aba de logs, RF30).
function logIngestao(req, ok, arquivo, info) {
    const partes = [`arquivo=${arquivo}`, ...Object.entries(info)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}=${v}`)];
    return registrarAuditoria({
        action: ok ? 'INGESTAO_OK' : 'INGESTAO_FALHA',
        actorUserId: req.userId || null,
        detail: partes.join('; ').slice(0, 1000),
        ip: ipDaRequisicao(req),
    });
}

function apagarSeExiste(caminho) {
    try {
        if (caminho && fs.existsSync(caminho)) fs.unlinkSync(caminho);
    } catch (e) {
        console.warn(`⚠️ Não consegui apagar ${caminho}:`, e.message);
    }
}

// Recebe o arquivo tratando os erros do multer (ex.: arquivo > 50 MB), que
// antes caíam no handler padrão do Express e voltavam como HTML 500.
function receberDocumento(req, res, next) {
    uploadDocumento.single('file')(req, res, async (erro) => {
        if (!erro) return next();
        const motivo = erro.code === 'LIMIT_FILE_SIZE' ? 'Arquivo maior que 50 MB.' : `Upload inválido: ${erro.message}`;
        await logIngestao(req, false, '(não recebido)', { motivo });
        res.status(erro.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: motivo });
    });
}

app.post('/api/train', authMiddleware, roleMiddleware(['ADMIN']), receberDocumento, async (req, res) => {
    if (req.formatoRecusado) {
        await logIngestao(req, false, '(não recebido)', { formato: req.formatoRecusado, motivo: 'formato não aceito' });
        return res.status(400).json({ error: `Formato ${req.formatoRecusado} não aceito. Envie PDF, DOCX, MD ou TXT.` });
    }
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    const original = req.file.originalname;
    const inputPath = req.file.path;
    const ext = path.extname(original).toLowerCase();
    const formato = ext.slice(1).toUpperCase();
    // PDF/DOCX viram "<nome>.pdf.md"; MD/TXT são guardados como vieram.
    const nomeFinal = FORMATOS_DOCLING.includes(ext) ? `${req.file.filename}.md` : req.file.filename;
    const outputPath = path.join(DOCUMENTS_PATH, nomeFinal);
    const inicio = Date.now();
    let conversao = {};

    // RN14: documento com falha não é indexado e não fica nem em uploads/ nem em documents/.
    const recusar = async (status, motivo) => {
        apagarSeExiste(outputPath);
        await logIngestao(req, false, original, { formato, motivo, tempo_docling_s: conversao.tempo_s });
        return res.status(status).json({ error: `Documento recusado: ${motivo}` });
    };

    try {
        if (!fs.existsSync(DOCUMENTS_PATH)) fs.mkdirSync(DOCUMENTS_PATH, { recursive: true });

        if (FORMATOS_DOCLING.includes(ext)) {
            console.log(`\n🔄 Iniciando conversão: ${original} -> Markdown`);
            conversao = await converterComDocling(inputPath, outputPath);
            if (conversao.status !== 'SUCESSO') {
                console.warn(`❌ Docling recusou ${original}: ${conversao.motivo}`);
                return await recusar(422, conversao.motivo || 'falha na conversão.');
            }
            console.log(`✅ Conversão concluída pelo Docling em ${conversao.tempo_s}s.`);
        } else {
            const texto = fs.readFileSync(inputPath, 'utf-8');
            if (caracteresUteis(texto) < MIN_CARACTERES_UTEIS) {
                return await recusar(422, 'nenhum texto aproveitável no arquivo.');
            }
            fs.writeFileSync(outputPath, texto, 'utf-8');
        }

        // Indexa só o arquivo novo, somando ao que já está em memória.
        const novos = await indexarDocumento(nomeFinal);
        if (novos === 0) {
            return await recusar(422, 'nenhum fragmento pôde ser indexado.');
        }

        await logIngestao(req, true, original, {
            salvo_como: nomeFinal,
            formato,
            paginas: conversao.paginas,
            tabelas: conversao.tabelas,
            imagens: conversao.imagens,
            ocr: conversao.ocr,
            hash: conversao.hash,
            fragmentos: novos,
            tempo_docling_s: conversao.tempo_s,
            tempo_total_s: ((Date.now() - inicio) / 1000).toFixed(2),
        });
        res.json({
            message: "IA Treinada com sucesso!",
            file: nomeFinal,
            blocosIndexados: novos,
            totalVetores: vectorStore.length
        });
    } catch (error) {
        console.error("❌ Erro no treinamento:", error);
        apagarSeExiste(outputPath);
        await logIngestao(req, false, original, { formato, motivo: error.message });
        res.status(500).json({ error: "Falha ao processar documento." });
    } finally {
        // O original só serve para a conversão; não fica guardado.
        apagarSeExiste(inputPath);
    }
});

// Lista o que a IA ja leu. Ate aqui a tela de treinamento era uma via de mao
// unica: subia-se um arquivo e nunca mais se sabia o que estava indexado.
app.get('/api/train/documents', authMiddleware, roleMiddleware(['ADMIN']), (req, res) => {
    try {
        if (!fs.existsSync(DOCUMENTS_PATH)) {
            return res.json({ documentos: [], totalVetores: 0 });
        }

        // Quantos blocos cada arquivo gerou, contados pela origem dos blocos.
        const blocosPorArquivo = {};
        for (const bloco of knowledgeBase) {
            const nome = nomeDoSource(bloco.source);
            blocosPorArquivo[nome] = (blocosPorArquivo[nome] || 0) + 1;
        }

        const documentos = fs.readdirSync(DOCUMENTS_PATH)
            .filter(nome => {
                const alvo = caminhoSeguroDoDocumento(nome);
                return alvo && fs.statSync(alvo.caminho).isFile();
            })
            .map(nome => {
                const info = fs.statSync(path.join(DOCUMENTS_PATH, nome));
                return {
                    nome,
                    tamanho: info.size,
                    modificadoEm: info.mtime,
                    blocos: blocosPorArquivo[nome] || 0
                };
            })
            .sort((a, b) => a.nome.localeCompare(b.nome));

        res.json({ documentos, totalVetores: vectorStore.length });
    } catch (error) {
        console.error('❌ Erro ao listar documentos:', error);
        res.status(500).json({ error: 'Erro ao listar documentos.' });
    }
});

// Remove um documento da base. Precisa tirar das TRES pontas: do disco, da
// memoria (knowledgeBase e vectorStore) e do cache em disco — senao o
// documento volta a valer no proximo restart.
app.delete('/api/train/documents/:nome', authMiddleware, roleMiddleware(['ADMIN']), (req, res) => {
    try {
        const alvo = caminhoSeguroDoDocumento(req.params.nome);
        if (!alvo) {
            return res.status(400).json({ error: 'Nome de arquivo inválido.' });
        }
        if (!fs.existsSync(alvo.caminho)) {
            return res.status(404).json({ error: 'Documento não encontrado.' });
        }

        fs.unlinkSync(alvo.caminho);

        const source = sourceDoArquivo(alvo.nome);
        const antes = vectorStore.length;
        knowledgeBase = knowledgeBase.filter(b => b.source !== source);
        vectorStore = vectorStore.filter(v => v.source !== source);
        const removidos = antes - vectorStore.length;
        salvarCache();

        console.log(`🗑️ Documento removido: ${alvo.nome} (-${removidos} vetores)`);
        res.json({
            message: 'Documento removido com sucesso!',
            arquivo: alvo.nome,
            vetoresRemovidos: removidos,
            totalVetores: vectorStore.length
        });
    } catch (error) {
        console.error('❌ Erro ao remover documento:', error);
        res.status(500).json({ error: 'Erro ao remover documento.' });
    }
});

// --- CHAT (MCP + RAG + RESERVAS) ---

// Resposta fixa (sem passar pelo modelo), no mesmo formato text/plain do
// stream. Usada nas falas do protocolo de confirmação, que precisam sair
// exatamente como especificado — o modelo poderia parafrasear ou omitir.
function responderTexto(res, texto) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(texto);
}

// --- SEGUNDA CHAMADA (injeção do resultado) ---
// Pede ao modelo que relate ao usuário, em linguagem natural, o resultado de
// uma ação do sistema (consulta, reserva gravada, erro de validação).
async function relatarResultadoAoUsuario(res, messagesBase, resultado, userInfo) {
    const promptInjetado = `Você consultou o sistema e obteve:
            ${resultado}

            Responda ao usuário de forma natural. NUNCA mencione "banco de dados", "SQLite" ou "ferramentas".
            ${userInfo ? `Lembre: ${userInfo}` : ''}`;

    const finalResponse = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "llama3.2",
            messages: [...messagesBase, { role: "user", content: promptInjetado }],
            stream: true,
            options: {
                temperature: 0.1 // Tira a "criatividade" ao relatar o resultado
            }
        })
    });

    // Repassa a resposta e ENCERRA a requisição.
    await repassarStreamOllama(res, finalResponse);
}

app.post('/api/chat', optionalAuthMiddleware, async (req, res) => {
    const { message, history = [] } = req.body;
    // A identidade vem do TOKEN, nunca do corpo. A rota segue aberta a visitante
    // (req.userId indefinido), mas quem esta logado nao pode mais ser
    // personificado: antes bastava mandar o userId de outra pessoa no JSON para
    // a IA criar reserva em nome dela.
    const userId = req.userId || null;
    console.log(`💬 Pergunta do Usuário (ID: ${userId || 'Visitante'}):`, message);

    try {
        // Informação sobre o perfil do usuário para RF23
        let userInfo = '';
        let statusLogin = '';
        if (userId) {
            const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
            if (user) {
                const autoApprove = user.role === 'PROFESSOR' || user.role === 'ADMIN';
                userInfo = autoApprove
                    ? `O usuário é ${user.role}. Reservas dele são APROVADAS AUTOMATICAMENTE.`
                    : `O usuário é ALUNO. Reservas dele ficam PENDENTES aguardando aprovação de professor ou administrador.`;
                statusLogin = `Você está falando com ${user.name} (${user.role}, ID: ${userId}). ${userInfo}`;
            }
        } else {
            statusLogin = `Você está falando com um VISITANTE NÃO LOGADO. Se o usuário falar em agendar, reservar ou perguntar sobre a disponibilidade de equipamentos para reservar, RECUSE IMEDIATAMENTE informando que ele precisa fazer login na plataforma. NÃO CHAME nenhuma ferramenta (nem consultar_equipamentos, nem solicitar_reserva). Encerre o assunto ali mesmo.`;
        }

        // --- 1. RESPOSTA À PERGUNTA DE CONFIRMAÇÃO (Regras 2 e 3) ---
        // Se a última fala do assistente foi "Confirma a reserva...?", esta
        // mensagem é a resposta. Este é o ÚNICO ponto do chat que grava reserva,
        // e só diante de uma confirmação explícita.
        const rascunhoPendente = userId ? obterRascunho(userId) : null;
        if (rascunhoPendente?.aguardandoConfirmacao) {
            const intencao = classificarResposta(message);
            console.log(`📝 Resposta à confirmação: ${intencao}`);

            if (intencao === 'CONFIRMA') {
                const resultado = await executarSolicitacaoReserva(rascunhoPendente.args, userId);
                console.log("📦 RETORNO:", resultado.mensagem);
                if (resultado.ok) {
                    descartarRascunho(userId);
                } else {
                    // Falhou na revalidação (ex.: horário ocupado nesse meio tempo).
                    // Mantém os dados para o usuário trocar só o que precisa.
                    encerrarEsperaDeConfirmacao(userId);
                }
                const messagesBase = [
                    { role: "system", content: `Você é o assistente virtual do AcademAI.\n\nINFORMAÇÃO DO USUÁRIO ATUAL: ${statusLogin}\n\nSeja direto e educado.` },
                    ...history,
                    { role: "user", content: message }
                ];
                await relatarResultadoAoUsuario(res, messagesBase, resultado.mensagem, userInfo);
                return;
            }

            // Qualquer coisa diferente de um "sim" explícito: nada é gravado e a
            // espera acaba (um "sim" solto depois não grava sem nova pergunta).
            encerrarEsperaDeConfirmacao(userId);
            if (intencao === 'RECUSA') {
                return responderTexto(res, MENSAGEM_RECUSA);
            }
            // OUTRO (ex.: "não, muda para as 15h"): segue para a IA, que vê o
            // rascunho no prompt e chama 'solicitar_reserva' com o dado alterado,
            // o que gera uma NOVA pergunta de confirmação.
        }
        const rascunhoAtual = userId ? obterRascunho(userId) : null;

        // --- 2. RAG (Busca nos PDFs) — RF19: top-4 fragmentos com fonte obrigatória ---
        let contextText = "";
        let ragSources = [];
        if (vectorStore.length > 0) {
            const queryVector = await embedding(embedder, message);
            const topResults = buscar(queryVector, vectorStore, TOP_K); // RF19/UC11: top-4
            ragSources = [...new Set(topResults.map(r => r.item.source))]; // fontes únicas
            // Inclui fonte no contexto para o LLM poder citá-la (RF19 obrigatório)
            contextText = topResults.map(r => `[Fonte: ${r.item.source}]\n${r.item.text}`).join("\n\n");
        }

        // Data de hoje, para o modelo converter "amanhã", "sexta" etc.
        const agora = new Date();
        const hojeISO = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
        const diaDaSemana = agora.toLocaleDateString('pt-BR', { weekday: 'long' });

        const blocoRascunho = rascunhoAtual
            ? `7. RESERVA EM ANDAMENTO (AINDA NÃO GRAVADA): máquina "${rascunhoAtual.args.equipmentName}", dia ${formatarDataBR(rascunhoAtual.args.date)} (${rascunhoAtual.args.date}), às ${rascunhoAtual.args.time}. Se o usuário quiser alterar algo, chame 'solicitar_reserva' de novo com os TRÊS dados, trocando só o que ele pediu.`
            : '';

        const systemPromptBase = `Você é o assistente virtual do AcademAI.

        INFORMAÇÃO DO USUÁRIO ATUAL: ${statusLogin}

        REGRA DE ROTEAMENTO (MUITO IMPORTANTE):
        1. PERGUNTAS GERAIS: Se o usuário perguntar sobre conceitos, história ou informações gerais do laboratório, responda APENAS com base no contexto documental. NÃO chame ferramentas de agendamento.
        2. AÇÕES DO SISTEMA: SÓ use 'consultar_equipamentos' ou 'solicitar_reserva' quando houver intenção clara de reserva (ex: "quero agendar", "reservar", "quais máquinas disponíveis").

        PROTOCOLO DE RESERVA (SIGA RIGOROSAMENTE):
        1. Seu objetivo é coletar TRÊS dados: a MÁQUINA (nome do equipamento), a DATA e o HORÁRIO de início. 'solicitar_reserva' aceita o NOME — você NÃO precisa de ID nem de chamar 'consultar_equipamentos' antes.
        2. Se faltar algum dado, pergunte APENAS o que falta, numa frase curta. Nunca invente máquina, data ou horário.
        3. Hoje é ${diaDaSemana}, ${formatarDataBR(hojeISO)} (${hojeISO}). Converta datas como "amanhã" ou "sexta" para AAAA-MM-DD; a hora vai em HH:MM.
        4. Assim que tiver os três dados, chame 'solicitar_reserva'. Ela NÃO grava a reserva: o sistema pergunta ao usuário "Confirma a reserva da máquina [X] para o dia [Y] às [Z]?" e só grava depois que ele confirmar.
        5. NUNCA diga que a reserva foi feita, registrada ou aprovada antes da confirmação do usuário. Não faça você mesmo a pergunta de confirmação — chame a função.
        6. Depois de gravada, informe se a reserva foi aprovada automaticamente ou ficou pendente.
        ${blocoRascunho}

        REGRAS DE CITAÇÃO DE FONTE (RF19 — OBRIGATÓRIO):
        - Se a sua resposta for baseada em algum trecho do contexto documental abaixo, cite obrigatoriamente a fonte ao final, no formato: "📄 Fonte: [nome do arquivo]"
        - Se não houver documentos recuperados ou a pergunta não puder ser respondida com base neles, declare explicitamente: "Não encontrei essa informação nos documentos institucionais disponíveis."
        - Nunca invente informações sobre o laboratório.

        REGRAS DE FORMATAÇÃO:
        - Seja direto e educado.
        - Não mencione termos técnicos como "banco de dados", "SQLite", "ferramentas".
        ${contextText ? `- Contexto dos documentos do lab:\n${contextText}` : '- Não há documentos institucionais indexados no momento.'}`;

        const messagesArray = [
            { role: "system", content: systemPromptBase },
            ...history,
            { role: "user", content: message }
        ];

        // --- 2. PRIMEIRA CHAMADA (A IA pensa e o roteador decide) ---

        // Filtro ultrarrápido por palavra-chave, antes de gastar uma chamada com ferramentas.
        // Também liga quando há reserva em andamento ou se o usuário acabou de
        // falar em reservar: respostas como "amanhã às 14h" não têm palavra-chave,
        // mas completam a coleta de máquina/data/horário.
        const ultimasFalasDoUsuario = (Array.isArray(history) ? history : [])
            .filter(m => m?.role === 'user')
            .slice(-2)
            .map(m => String(m.content || ''));
        const usarMCP = precisaDeFerramentas(message)
            || !!rascunhoAtual
            || ultimasFalasDoUsuario.some(precisaDeFerramentas);
        console.log(usarMCP ? "🔌 MODO MCP ATIVADO (Ferramentas ligadas)" : "💬 MODO CHAT/RAG (Ferramentas desligadas)");

        const requestBody = {
            model: "llama3.2",
            messages: messagesArray,
            stream: false,
            options: {
                temperature: 0.1 // Mantém a IA focada e evita alucinações
            }
        };

        // INJEÇÃO DINÂMICA: só entrega as ferramentas se o roteador autorizar.
        // Sem isso a IA tentava agendar até em pergunta conceitual.
        if (usarMCP) {
            requestBody.tools = [toolConsultarEquipamentos, toolSolicitarReserva];
        }

        const response1 = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data1 = await response1.json();
        const messageResponse = data1.message;

        // 3. MCP (IA usou ferramenta)
        if (messageResponse.tool_calls) {
            const toolCall = messageResponse.tool_calls[0];
            console.log("⚙️ Ferramenta solicitada:", toolCall.function.name);
            let resultadoBanco = "";

            // O ROTEADOR DE FERRAMENTAS
            if (toolCall.function.name === "consultar_equipamentos") {
                resultadoBanco = await executarConsultaEquipamentos();
            } else if (toolCall.function.name === "solicitar_reserva") {
                // Regra 2: a IA NÃO grava. Validamos (somente leitura), guardamos
                // um rascunho e PAUSAMOS com a pergunta fixa da Regra 1.
                const validacao = await validarSolicitacaoReserva(toolCall.function.arguments, userId);
                if (validacao.ok) {
                    const { equipamento, date, time, fim } = validacao.dados;
                    const dadosReserva = { equipmentName: equipamento.name, date, time, endTime: fim };
                    salvarRascunho(userId, dadosReserva);
                    console.log("⏸️ Reserva aguardando confirmação do usuário:", dadosReserva);
                    return responderTexto(res, perguntaDeConfirmacao(dadosReserva));
                }
                // Dado faltando/inválido, conflito etc.: a IA explica e pede correção.
                resultadoBanco = validacao.mensagem;
            }

            console.log("📦 RETORNO:", resultadoBanco);

            // --- 4. SEGUNDA CHAMADA (injeção do resultado) ---
            await relatarResultadoAoUsuario(res, messagesArray, resultadoBanco, userInfo);
            return;
        }

        // --- 5. RAG DIRETO (Continua dentro do TRY) ---
        const responseDirect = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama3.2",
                messages: messagesArray,
                stream: true
            })
        });

        await repassarStreamOllama(res, responseDirect);

    } catch (error) {
        console.error("❌ Erro na Rota Chat:", error);
        res.status(500).end("Erro ao processar consulta.");
    }
});



// --- PAINEL ADMINISTRATIVO (RF30 / UC14) ---

// GET /api/appointments/overview (Visão geral do dia/semana para admin)

// GET /api/appointments/calendar (Todas as reservas para calendário - admin/professor)

// --- HISTÓRICO COMPLETO (UC10 fluxo alt. 2a) ---

// GET /api/appointments/all-history (Admin vê histórico de todos)
// --- DATAS BLOQUEADAS (Feriados / Recessos) ---
app.get('/api/blocked-dates', async (req, res) => {
    try {
        const blocks = await prisma.blockedDate.findMany({ include: { equipment: true } });
        res.json(blocks);
    } catch (e) {
        res.status(500).json({ error: "Erro ao buscar datas bloqueadas." });
    }
});

app.post('/api/blocked-dates', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        const { date, reason, equipmentId } = req.body;
        if (!date) return res.status(400).json({ error: "Data é obrigatória." });

        const eqId = normalizarEquipmentId(equipmentId);
        if (eqId !== null) {
            const equipamento = await prisma.equipment.findUnique({ where: { id: eqId } });
            // Sem esta conferencia o id inexistente estourava a chave estrangeira
            // e virava 500, quando o problema e do pedido.
            if (!equipamento) return res.status(400).json({ error: "Equipamento não encontrado." });
        }

        const { bloqueio, criado } = await criarBloqueioSeNovo(prisma, { date, reason, equipmentId: eqId });
        if (!criado) {
            return res.status(400).json({ error: "Esta data já está bloqueada para esta configuração." });
        }
        res.status(201).json({ message: "Data bloqueada com sucesso!", block: bloqueio });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erro ao bloquear data." });
    }
});

app.delete('/api/blocked-dates/:id', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        await prisma.blockedDate.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "Bloqueio removido com sucesso." });
    } catch (e) {
        res.status(500).json({ error: "Erro ao remover bloqueio." });
    }
});

// --- LOGS E RELATÓRIOS (RF30) ---
// O painel admin ja tinha visao geral, pendencias, calendario, usuarios,
// equipamentos e documentos; faltava o "acesso a logs e relatorios basicos".

// GET /api/audit-logs — trilha de auditoria (RF07), so ADMIN. Resolve os
// nomes de ator/alvo para exibicao.
app.get('/api/audit-logs', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        const limite = Math.min(parseInt(req.query.limit) || 100, 500);
        const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limite });
        const ids = [...new Set(logs.flatMap((l) => [l.actorUserId, l.targetUserId]).filter(Boolean))];
        const usuarios = ids.length
            ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
            : [];
        const porId = Object.fromEntries(usuarios.map((u) => [u.id, u.name]));
        const formatted = logs.map((l) => ({
            id: l.id,
            action: l.action,
            actor: l.actorUserId ? (porId[l.actorUserId] || `#${l.actorUserId}`) : 'Sistema/anônimo',
            target: l.targetUserId ? (porId[l.targetUserId] || `#${l.targetUserId}`) : null,
            detail: l.detail,
            ip: l.ip,
            createdAt: l.createdAt,
        }));
        res.json(formatted);
    } catch (error) {
        console.error("❌ Erro ao buscar logs de auditoria:", error);
        res.status(500).json({ error: "Erro ao carregar logs." });
    }
});

// GET /api/reports/summary — relatorios basicos (RF30), so ADMIN.
app.get('/api/reports/summary', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        await concluirReservasVencidas(); // RF09 — numeros refletem o status atual
        const [porStatus, porRole, totalEquipamentos, totalReservas, totalUsuarios] = await Promise.all([
            prisma.appointment.groupBy({ by: ['status'], _count: true }),
            prisma.user.groupBy({ by: ['role'], _count: true }),
            prisma.equipment.count(),
            prisma.appointment.count(),
            prisma.user.count(),
        ]);

        const porEquip = await prisma.appointment.groupBy({ by: ['equipmentId'], _count: true });
        const equipIds = porEquip.map((e) => e.equipmentId);
        const equips = equipIds.length
            ? await prisma.equipment.findMany({ where: { id: { in: equipIds } }, select: { id: true, name: true } })
            : [];
        const nomeEquip = Object.fromEntries(equips.map((e) => [e.id, e.name]));
        const topEquipamentos = porEquip
            .map((e) => ({ equipamento: nomeEquip[e.equipmentId] || `#${e.equipmentId}`, total: e._count }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        res.json({
            totalReservas,
            totalEquipamentos,
            totalUsuarios,
            reservasPorStatus: porStatus.map((s) => ({ status: s.status, total: s._count })),
            usuariosPorPapel: porRole.map((r) => ({ papel: r.role, total: r._count })),
            topEquipamentos,
        });
    } catch (error) {
        console.error("❌ Erro ao gerar relatório:", error);
        res.status(500).json({ error: "Erro ao gerar relatório." });
    }
});

app.listen(PORT, async () => {
    console.log(`🔥 Servidor AcademAI: http://localhost:${PORT}`);
    const concluidas = await concluirReservasVencidas(); // RF09 — regulariza ao subir
    if (concluidas) console.log(`✅ RF09: ${concluidas} reserva(s) vencida(s) marcada(s) como CONCLUIDA.`);
});