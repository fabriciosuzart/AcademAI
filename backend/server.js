/* backend/server.js - FUSÃO: MCP + RAG + WHISPER */
import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware, roleMiddleware } from './middlewares/auth.js';
import { pipeline } from '@xenova/transformers';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import multer from 'multer';
import pkg from 'wavefile';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
    toolConsultarEquipamentos, executarConsultaEquipamentos,
    toolSolicitarReserva, executarSolicitacaoReserva
} from './mcp_tools.js';

const { WaveFile } = pkg;
const execPromise = promisify(exec);

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCUMENTS_PATH = path.join(__dirname, 'documents');
const VECTOR_CACHE_PATH = path.join(__dirname, 'vector_cache.json');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'sua_chave_secreta_super_segura';
const JWT_EXPIRATION = '8h'; // RNF04 simplificado

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
const upload = multer({ storage });
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

// --- BASE DE CONHECIMENTO (RAG) ---
let knowledgeBase = [];
let vectorStore = [];
let embedder = null;

async function loadDocuments() {
    if (!fs.existsSync(DOCUMENTS_PATH)) {
        fs.mkdirSync(DOCUMENTS_PATH);
        console.log("📂 Pasta 'documents' criada.");
        return;
    }
    const files = fs.readdirSync(DOCUMENTS_PATH);
    console.log(`📂 Lendo ${files.length} arquivos...`);

    for (const file of files) {
        const filePath = path.join(DOCUMENTS_PATH, file);
        const ext = path.extname(file).toLowerCase();
        let textContent = "";
        try {
            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdf(dataBuffer);
                textContent = data.text;
            } else if (ext === '.docx') {
                const result = await mammoth.extractRawText({ path: filePath });
                textContent = result.value;
            } else if (ext === '.md' || ext === '.txt') {
                textContent = fs.readFileSync(filePath, 'utf-8');
            }
            if (textContent) {
                const cleanText = textContent.replace(/\r/g, '').replace(/\n\s*\n/g, '\n').trim();
                const chunkSize = 2000;
                for (let i = 0; i < cleanText.length; i += chunkSize) {
                    knowledgeBase.push({
                        source: `Arquivo: ${file}`,
                        text: cleanText.substring(i, i + chunkSize)
                    });
                }
                console.log(`   ✅ Lido: ${file}`);
            }
        } catch (error) {
            console.error(`   ❌ Erro ao ler ${file}:`, error.message);
        }
    }
}

async function initAI() {
    await loadDocuments();
    console.log("\n🧠 Inicializando Motor de IA...");
    try {
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log("✅ Modelo de Embeddings carregado na memória.");
    } catch (e) {
        console.error("❌ Erro fatal ao carregar modelo Xenova:", e);
        return;
    }
    console.log(`🧐 Verificando base de conhecimento: ${knowledgeBase.length} itens.`);
    if (knowledgeBase.length === 0) {
        console.warn("⚠️ Base de conhecimento vazia! O RAG não usará arquivos.");
    }
    console.log(`📊 Iniciando vetorização de ${knowledgeBase.length} blocos...`);
    vectorStore = [];
    for (let i = 0; i < knowledgeBase.length; i++) {
        try {
            const output = await embedder(knowledgeBase[i].text, { pooling: 'mean', normalize: true });
            vectorStore.push({ id: i, text: knowledgeBase[i].text, source: knowledgeBase[i].source, vector: output.data });
            process.stdout.write(`.`);
        } catch (e) {
            console.error(`\n❌ Erro ao processar bloco ${i}:`, e);
        }
    }
    console.log(`\n✅ Vetorização concluída! Temos ${vectorStore.length} vetores prontos.`);
    try {
        fs.writeFileSync(VECTOR_CACHE_PATH, JSON.stringify(vectorStore));
        console.log("💾 Cache salvo no disco.");
    } catch (e) {
        console.error("Erro ao salvar cache:", e);
    }
    console.log("🚀 IA RAG Pronta para perguntas!\n");
}
initAI();

function cosineSimilarity(vecA, vecB) {
    let dot = 0.0, normA = 0.0, normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

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
        const hashedPassword = await bcrypt.hash(password, 8);
        // Permite apenas ALUNO ou PROFESSOR no cadastro público
        const allowedRoles = ['ALUNO', 'PROFESSOR'];
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
app.post('/api/change-password', async (req, res) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;
        if (!userId || !newPassword) return res.status(400).json({ error: "Dados insuficientes." });

        const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
        if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

        // Se tem senha atual, verifica (não verifica se é troca obrigatória de senha temporária)
        if (currentPassword) {
            const valid = await bcrypt.compare(currentPassword, user.password);
            if (!valid) return res.status(401).json({ error: "Senha atual incorreta." });
        }

        const hashedNew = await bcrypt.hash(newPassword, 8);
        await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { password: hashedNew, isTempPassword: 0 }
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
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: "E-mail não encontrado no sistema." });

        // Gera senha temporária
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedTemp = await bcrypt.hash(tempPassword, 8);

        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedTemp, isTempPassword: 1 }
        });

        // Tenta enviar por e-mail
        await sendEmailNotification(
            email,
            'AcademAI - Recuperação de Senha',
            `Sua senha temporária é: <strong>${tempPassword}</strong><br>Ao fazer login, você será solicitado a criar uma nova senha.`
        );

        res.json({ message: `Senha temporária gerada: ${tempPassword} — Anote-a e faça login para redefinir.` });
    } catch (error) {
        console.error("Erro ao resetar senha:", error);
        res.status(500).json({ error: "Erro interno ao resetar senha." });
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

// PUT /api/users/:id (RNF05 - protegido)
app.put('/api/users/:id', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { name, email, ra, trainings } = req.body;
        const existingUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!existingUser) return res.status(404).json({ error: "Usuário não encontrado." });
        if (existingUser.role === 'ADMIN') return res.status(403).json({ error: "Perfis de administrador não podem ser editados." });

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                name, email,
                ra: ra || null,
                trainings: trainings !== undefined ? trainings : existingUser.trainings
            }
        });
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

app.post('/api/equipment', authMiddleware, roleMiddleware(['ADMIN']), upload.single('image'), async (req, res) => {
    try {
        const { name, description, status, specs, quantity, requiresTraining } = req.body;
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
        const fullDescription = JSON.stringify({
            specs: specs || '', description: description || '',
            requiresTraining: requiresTraining === true || requiresTraining === 'true'
        });
        const newQuantity = parseInt(quantity) || 1;
        const baseName = name ? name.replace(/\s*(0\d|A\d|\d+)$/i, '').trim() : name;
        const getUnitName = (base, index, total) => {
            if (total === 1) return base;
            return `${base} ${String(index + 1).padStart(2, '0')}`;
        };
        const created = [];
        for (let i = 0; i < newQuantity; i++) {
            const unit = await prisma.equipment.create({
                data: { name: getUnitName(baseName, i, newQuantity), description: fullDescription, imagePath, status: status || 'available' }
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

        const originalBaseName = target.name.replace(/\s*(0\d|A\d|\d+)$/i, '').trim();
        const allEquipment = await prisma.equipment.findMany();
        const groupItems = allEquipment.filter(item => {
            const itemBase = item.name.replace(/\s*(0\d|A\d|\d+)$/i, '').trim();
            return itemBase.toLowerCase() === originalBaseName.toLowerCase();
        }).sort((a, b) => a.id - b.id);

        const fullDescription = JSON.stringify({
            specs: specs || '', description: description || '',
            requiresTraining: requiresTraining === true || requiresTraining === 'true'
        });
        let newImagePath = target.imagePath;
        if (req.file) newImagePath = `/uploads/${req.file.filename}`;
        const newQuantity = parseInt(quantity) || groupItems.length || 1;
        const newBaseName = name ? name.replace(/\s*(0\d|A\d|\d+)$/i, '').trim() : originalBaseName;
        const getUnitName = (base, index, total) => total === 1 ? base : `${base} ${String(index + 1).padStart(2, '0')}`;

        if (newQuantity >= groupItems.length) {
            for (let i = 0; i < groupItems.length; i++) {
                await prisma.equipment.update({
                    where: { id: groupItems[i].id },
                    data: { name: getUnitName(newBaseName, i, newQuantity), description: fullDescription, status: status || groupItems[i].status, imagePath: newImagePath }
                });
            }
            for (let i = groupItems.length; i < newQuantity; i++) {
                await prisma.equipment.create({
                    data: { name: getUnitName(newBaseName, i, newQuantity), description: fullDescription, status: status || 'available', imagePath: newImagePath }
                });
            }
        } else {
            // RN06 - Verificar se unidades a remover possuem reservas ativas
            const idsToDelete = groupItems.slice(newQuantity).map(item => item.id);
            const activeReservations = await prisma.appointment.count({
                where: { equipmentId: { in: idsToDelete }, status: { in: ['PENDENTE', 'APROVADO'] } }
            });
            if (activeReservations > 0) {
                return res.status(400).json({ error: `Não é possível reduzir a quantidade. ${activeReservations} unidade(s) possuem reservas ativas (pendentes ou aprovadas).` });
            }

            for (let i = 0; i < newQuantity; i++) {
                await prisma.equipment.update({
                    where: { id: groupItems[i].id },
                    data: { name: getUnitName(newBaseName, i, newQuantity), description: fullDescription, status: status || groupItems[i].status, imagePath: newImagePath }
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
            where: { equipmentId, status: { in: ['PENDENTE', 'APROVADO'] } }
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
        if (equipment.status === 'MANUTENÇÃO') {
            return res.status(403).json({ error: "Este equipamento está bloqueado para uso no momento e não aceita reservas." });
        }

        const blockedDate = await prisma.blockedDate.findFirst({
            where: {
                date: date,
                OR: [ { equipmentId: null }, { equipmentId: eqId } ]
            }
        });
        if (blockedDate) {
            return res.status(403).json({ error: `A data selecionada está bloqueada. Motivo: ${blockedDate.reason || 'Feriado/Recesso'}` });
        }

        // RF16 - Verificar conflito de horário
        const reqStart = time;
        const reqEnd = endTime || time;
        const conflicting = await prisma.appointment.findFirst({
            where: {
                equipmentId: eqId,
                date: date,
                status: { in: ['PENDENTE', 'APROVADO'] },
                OR: [
                    { time: { lte: reqEnd }, endTime: { gte: reqStart } },
                    { time: { gte: reqStart, lte: reqEnd } },
                    // Reservas sem endTime: considera conflito se mesmo horário
                    { time: reqStart, endTime: null },
                ]
            }
        });
        if (conflicting) {
            return res.status(409).json({ error: "Conflito de horário! Já existe uma reserva para este equipamento neste período." });
        }

        // RF11 - Aprovação automática para PROFESSOR e ADMIN
        const user = await prisma.user.findUnique({ where: { id: uId } });
        const autoApprove = user && (user.role === 'PROFESSOR' || user.role === 'ADMIN');
        const reservaStatus = autoApprove ? 'APROVADO' : 'PENDENTE';

        const newAppointment = await prisma.appointment.create({
            data: {
                date, time,
                endTime: endTime || null,
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
                status: { in: ['PENDENTE', 'APROVADO'] }
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

        const updateData = {
            status,
            approvedById: req.userId
        };
        if (status === 'RECUSADO' && rejectionReason) {
            updateData.rejectionReason = rejectionReason;
        }

        const updated = await prisma.appointment.update({
            where: { id: appointmentId },
            data: updateData
        });

        // RF12 - Notificar o solicitante
        if (status === 'APROVADO') {
            await createNotification(appointment.userId, 'RESERVA_APROVADA',
                `Sua reserva para ${appointment.date} às ${appointment.time} foi aprovada!`, appointmentId);
        } else if (status === 'RECUSADO') {
            const reason = rejectionReason ? ` Motivo: ${rejectionReason}` : '';
            await createNotification(appointment.userId, 'RESERVA_REJEITADA',
                `Sua reserva para ${appointment.date} às ${appointment.time} foi rejeitada.${reason}`, appointmentId);
        }

        res.json({ message: `Reserva ${status.toLowerCase()}!`, appointment: updated });
    } catch (error) {
        console.error("❌ Erro ao atualizar status:", error);
        res.status(500).json({ error: "Erro interno ao atualizar reserva." });
    }
});

// GET /api/appointments/overview (Visão Geral - ADMIN)
app.get('/api/appointments/overview', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Obtém data de 7 dias atrás e de 7 dias no futuro para a semana (ou ajusta conforme a regra)
        const dateNow = new Date();
        const startOfWeek = new Date(dateNow.setDate(dateNow.getDate() - dateNow.getDay())).toISOString().split('T')[0];
        const endOfWeek = new Date(dateNow.setDate(dateNow.getDate() + 6)).toISOString().split('T')[0];

        const todayAppointments = await prisma.appointment.findMany({
            where: { 
                date: today,
                status: { notIn: ['CANCELADA', 'RECUSADO'] }
            },
            include: { user: { select: { name: true, role: true } }, equipment: { select: { name: true } } },
            orderBy: { time: 'asc' }
        });

        const weekAppointments = await prisma.appointment.findMany({
            where: { 
                date: { gte: startOfWeek, lte: endOfWeek },
                status: { notIn: ['CANCELADA', 'RECUSADO'] }
            }
        });

        const pendingCount = await prisma.appointment.count({
            where: { status: 'PENDENTE' }
        });

        res.json({
            todayAppointments,
            weekAppointments,
            pendingCount
        });
    } catch (error) {
        console.error("❌ Erro ao buscar visão geral:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});

// GET /api/appointments/all-history (Histórico Global - ADMIN)
app.get('/api/appointments/all-history', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        const appointments = await prisma.appointment.findMany({
            include: { user: { select: { name: true, role: true } }, equipment: { select: { name: true } } },
            orderBy: { id: 'desc' }
        });
        
        const formatted = appointments.map(appt => ({
            id: appt.id, 
            equipment: appt.equipment.name,
            date: appt.date, 
            startTime: appt.time, 
            endTime: appt.endTime || appt.time,
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
app.get('/api/appointments/:userId', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: "ID inválido" });

        const appointments = await prisma.appointment.findMany({
            where: { userId },
            include: { equipment: { select: { name: true } } },
            orderBy: { id: 'desc' }
        });

        const formatted = appointments.map(appt => ({
            id: appt.id, equipment: appt.equipment.name,
            date: appt.date, startTime: appt.time, endTime: appt.endTime || appt.time,
            status: appt.status, justification: appt.justification,
            rejectionReason: appt.rejectionReason
        }));
        res.json(formatted);
    } catch (error) {
        console.error("❌ Erro ao buscar reservas:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});

// PUT /api/appointments/:id/cancel (RF15 - cancelar reserva, RNF05 protegido)
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
        if (!['PENDENTE', 'APROVADO'].includes(appointment.status)) {
            return res.status(400).json({ error: "Apenas reservas pendentes ou aprovadas podem ser canceladas." });
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
        console.error("❌ Erro ao cancelar reserva:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});

// --- NOTIFICAÇÕES (RF12/RF13) ---

// GET /api/notifications/:userId (RNF05 - protegido)
app.get('/api/notifications/:userId', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
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
        await prisma.notification.update({
            where: { id: parseInt(req.params.id) },
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
        await prisma.notification.updateMany({
            where: { userId: parseInt(req.params.userId), isRead: false },
            data: { isRead: true }
        });
        res.json({ message: "Todas as notificações marcadas como lidas." });
    } catch (error) {
        res.status(500).json({ error: "Erro ao marcar notificações." });
    }
});

// --- TREINAMENTO IA (ADMIN, RNF05 - protegido) ---
app.post('/api/train', authMiddleware, roleMiddleware(['ADMIN']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
        const inputPath = req.file.path;
        const mdFileName = `${req.file.filename}.md`;
        const outputPath = path.join(DOCUMENTS_PATH, mdFileName);
        console.log(`\n🔄 Iniciando conversão: ${req.file.originalname} -> Markdown`);
        const cmdPython = process.platform === 'win32' ? 'python' : 'python3';
        const pythonCommand = `${cmdPython} converter.py "${inputPath}" "${outputPath}"`;
        const { stdout } = await execPromise(pythonCommand);

        if (stdout.includes("SUCESSO")) {
            console.log("✅ Conversão concluída pelo Docling.");
            knowledgeBase = [];
            await initAI();
            res.json({ message: "IA Treinada com sucesso!", file: mdFileName });
        } else {
            throw new Error(stdout);
        }
    } catch (error) {
        console.error("❌ Erro no treinamento:", error);
        res.status(500).json({ error: "Falha ao processar documento." });
    }
});

// --- CHAT (MCP + RAG + RESERVAS) ---
app.post('/api/chat', async (req, res) => {
    const { message, userId } = req.body;
    console.log(`💬 Pergunta do Usuário (ID: ${userId || 'Visitante'}):`, message);

    try {
        // --- 1. RAG (Busca nos PDFs) ---
        let contextText = "";
        if (vectorStore.length > 0) {
            const output = await embedder(message, { pooling: 'mean', normalize: true });
            const queryVector = output.data;
            const results = vectorStore.map(item => ({ item, score: cosineSimilarity(queryVector, item.vector) }));
            const topResults = results.sort((a, b) => b.score - a.score).slice(0, 3);
            contextText = topResults.map(r => r.item.text).join("\n\n");
        }

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
            statusLogin = `Você está falando com um VISITANTE NÃO LOGADO. Se ele tentar agendar, recuse e peça para fazer login.`;
        }

        const systemPromptBase = `Você é o assistente virtual do AcademAI.

        INFORMAÇÃO DO USUÁRIO ATUAL: ${statusLogin}

        PROTOCOLO DE RESERVA (SIGA RIGOROSAMENTE):
        1. Se o usuário quiser reservar mas não disse qual equipamento, chame 'consultar_equipamentos' IMEDIATAMENTE.
        2. Ao receber a lista, apresente assim:
        "Encontrei estes equipamentos:
        [ID] Nome do Equipamento - Status
        Qual destes você deseja reservar?"
        3. NUNCA adivinhe um ID. Só use IDs da ferramenta 'consultar_equipamentos'.
        4. Após o usuário escolher, peça Data (AAAA-MM-DD) e Hora (HH:MM) se não informou.
        5. ANTES de chamar 'solicitar_reserva', CONFIRME os dados com o usuário.
        6. Informe ao usuário se a reserva será aprovada automaticamente ou ficará pendente.
        7. Somente após confirmação, chame 'solicitar_reserva'.

        REGRAS DE FORMATAÇÃO:
        - Seja direto e educado.
        - Não mencione termos técnicos como "banco de dados", "SQLite", "ferramentas".
        - Contexto dos documentos do lab: ${contextText}`;

        // 2. Primeira chamada (IA Pensa)
        const response1 = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama3.2",
                messages: [
                    { role: "system", content: systemPromptBase },
                    { role: "user", content: message }
                ],
                tools: [toolConsultarEquipamentos, toolSolicitarReserva],
                stream: false
            })
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
                resultadoBanco = await executarSolicitacaoReserva(toolCall.function.arguments, userId);
            }

            console.log("📦 RETORNO:", resultadoBanco);

            const promptInjetado = `Você consultou o sistema e obteve:
            ${resultadoBanco}
            
            Responda ao usuário de forma natural. NUNCA mencione "banco de dados", "SQLite" ou "ferramentas".
            ${userInfo ? `Lembre: ${userInfo}` : ''}`;

            const finalResponse = await fetch('http://127.0.0.1:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "llama3.2",
                    messages: [{ role: "user", content: promptInjetado }],
                    stream: true
                })
            });

            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            for await (const chunk of finalResponse.body) {
                const line = chunk.toString();
                try {
                    const json = JSON.parse(line);
                    if (json.message?.content) res.write(json.message.content);
                    if (json.done) res.end();
                } catch (e) { }
            }
            return;
        }

        // --- 5. RAG DIRETO (Continua dentro do TRY) ---
        const responseDirect = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama3.2",
                messages: [
                    { role: "system", content: systemPromptBase },
                    { role: "user", content: message }
                ],
                stream: true
            })
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        for await (const chunk of responseDirect.body) {
            const line = chunk.toString();
            try {
                const json = JSON.parse(line);
                if (json.message?.content) res.write(json.message.content);
                if (json.done) res.end();
            } catch (e) { }
        }

    } catch (error) {
        console.error("❌ Erro na Rota Chat:", error);
        res.status(500).end("Erro ao processar consulta.");
    }
});

// --- TRANSCRIÇÃO (WHISPER) ---
let transcriber = null;

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Nenhum áudio enviado." });
        console.log(`🎙️ Novo áudio recebido: ${req.file.filename}`);

        if (!transcriber) {
            console.log("⚙️ Carregando modelo Whisper-Base...");
            transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base');
            console.log("✅ Whisper-Base carregado!");
        }

        let buffer = fs.readFileSync(req.file.path);
        let wav = new WaveFile(buffer);
        wav.toBitDepth('32f');
        wav.toSampleRate(16000);
        let audioData = wav.getSamples();
        if (Array.isArray(audioData)) audioData = audioData[0];

        console.log("🧠 Transcrevendo em Português...");
        let output = await transcriber(audioData, { language: 'portuguese', task: 'transcribe' });
        console.log(`✅ Texto transcrito: "${output.text}"`);

        fs.unlinkSync(req.file.path);
        res.json({ text: output.text });
    } catch (error) {
        console.error("❌ Erro no Whisper:", error);
        res.status(500).json({ error: "Falha ao processar áudio." });
    }
});

// --- PAINEL ADMINISTRATIVO (RF30 / UC14) ---

// GET /api/appointments/overview (Visão geral do dia/semana para admin)
app.get('/api/appointments/overview', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
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

// GET /api/appointments/calendar (Todas as reservas para calendário - admin/professor)
app.get('/api/appointments/calendar', authMiddleware, roleMiddleware(['ADMIN', 'PROFESSOR']), async (req, res) => {
    try {
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

// --- HISTÓRICO COMPLETO (UC10 fluxo alt. 2a) ---

// GET /api/appointments/all-history (Admin vê histórico de todos)
app.get('/api/appointments/all-history', authMiddleware, roleMiddleware(['ADMIN']), async (req, res) => {
    try {
        const { status, date, equipmentId } = req.query;
        const where = {};
        if (status) where.status = status;
        if (date) where.date = date;
        if (equipmentId) where.equipmentId = parseInt(equipmentId);

        const appointments = await prisma.appointment.findMany({
            where,
            include: {
                user: { select: { name: true, email: true, ra: true, role: true } },
                equipment: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 200
        });

        const formatted = appointments.map(appt => ({
            id: appt.id, equipment: appt.equipment.name,
            user: appt.user.name, userEmail: appt.user.email,
            userRole: appt.user.role,
            date: appt.date, startTime: appt.time, endTime: appt.endTime || appt.time,
            status: appt.status, justification: appt.justification,
            rejectionReason: appt.rejectionReason,
            createdAt: appt.createdAt
        }));
        res.json(formatted);
    } catch (error) {
        console.error("❌ Erro no histórico completo:", error);
        res.status(500).json({ error: "Erro ao buscar histórico." });
    }
});
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
        
        const newBlock = await prisma.blockedDate.create({
            data: { date, reason, equipmentId: equipmentId ? parseInt(equipmentId) : null }
        });
        res.status(201).json({ message: "Data bloqueada com sucesso!", block: newBlock });
    } catch (e) {
        if (e.code === 'P2002') return res.status(400).json({ error: "Esta data já está bloqueada para esta configuração." });
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

app.listen(PORT, () => console.log(`🔥 Servidor AcademAI: http://localhost:${PORT}`));