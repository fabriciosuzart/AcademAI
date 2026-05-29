/* backend/server.js - FUSÃO: MCP + RAG + WHISPER */
import express from 'express';
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
import pkg from 'wavefile'; // ADICIONADO PELA JULIANA
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

app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO DE UPLOAD DE IMAGENS/ÁUDIOS (MULTER) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- BANCO DE DADOS (PRISMA) ---
const prisma = new PrismaClient();
console.log('✅ Prisma ORM conectado ao banco SQLite.');

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
                    const chunk = cleanText.substring(i, i + chunkSize);
                    knowledgeBase.push({
                        source: `Arquivo: ${file}`,
                        text: chunk
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
        const item = knowledgeBase[i];
        try {
            const output = await embedder(item.text, { pooling: 'mean', normalize: true });
            vectorStore.push({
                id: i,
                text: item.text,
                source: item.source,
                vector: output.data
            });
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

<<<<<<< HEAD
// --- ROTAS ---

// --- ROTA DE TREINAMENTO (ADMIN) ---
// Usamos o 'upload.single' do Multer que já configuramos
app.post('/api/train', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

        const inputPath = req.file.path; // Caminho do PDF/DOCX que chegou
        const mdFileName = `${req.file.filename}.md`;
        const outputPath = path.join(DOCUMENTS_PATH, mdFileName);

        console.log(`\n🔄 Iniciando conversão: ${req.file.originalname} -> Markdown`);

        // Comando para rodar o seu script Python
        // O '@' no caminho ajuda o Windows a não se perder com as barras
        const pythonCommand = `python converter.py "${inputPath}" "${outputPath}"`;

        const { stdout } = await execPromise(pythonCommand);

        if (stdout.includes("SUCESSO")) {
            console.log("✅ Conversão concluída pelo Docling.");

            // AGORA O PULO DO GATO: Mandar a IA ler os novos arquivos
            // Vamos resetar a base e rodar o initAI de novo
            knowledgeBase = [];
            await initAI();

            res.json({
                message: "IA Treinada com sucesso!",
                file: mdFileName
            });
        } else {
            throw new Error(stdout);
        }

    } catch (error) {
        console.error("❌ Erro no treinamento:", error);
        res.status(500).json({ error: "Falha ao processar documento." });
    }
});

// --- ROTAS DE LEITURA (GET) PARA EQUIPAMENTOS ---
app.get('/api/equipment', async (req, res) => {
    try {
        const equipments = await prisma.equipment.findMany();
        res.json(equipments);
    } catch (error) {
        console.error("❌ Erro ao buscar equipamentos:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});

app.get('/api/equipment/:id', async (req, res) => {
    try {
        const equipmentId = parseInt(req.params.id);
        const equipment = await prisma.equipment.findUnique({
            where: { id: equipmentId }
        });

        if (!equipment) return res.status(404).json({ error: "Equipamento não encontrado." });
        res.json(equipment);
    } catch (error) {
        console.error("❌ Erro ao buscar equipamento:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});
// --- ROTA: ADICIONAR EQUIPAMENTO COM IMAGEM ---
// O 'upload.single("image")' intercepta o arquivo enviado pelo front e salva na pasta uploads
app.post('/api/equipment', authMiddleware, roleMiddleware(['ADMIN', 'PROFESSOR']), upload.single('image'), async (req, res) => {
    try {
        const { name, description, status } = req.body;

        // Se o admin enviou uma foto, o Multer guarda o caminho dela aqui. Se não, fica nulo.
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

        const newEquipment = await prisma.equipment.create({
            data: {
                name: name,
                description: description,
                imagePath: imagePath,
                status: status || "DISPONIVEL"
            }
        });

        res.status(201).json({ message: "Equipamento salvo com imagem!", equipment: newEquipment });
    } catch (error) {
        console.error("❌ Erro ao adicionar equipamento:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});

// --- ROTA: ATUALIZAR EQUIPAMENTO E IMAGEM ---
app.put('/api/equipment/:id', upload.single('image'), async (req, res) => {
    try {
        const equipmentId = parseInt(req.params.id);
        const { name, description, status } = req.body;

        // Prepara os dados que vão ser atualizados
        let updateData = { name, description, status };

        // Se uma nova imagem foi enviada, atualiza o caminho dela também
        if (req.file) {
            updateData.imagePath = `/uploads/${req.file.filename}`;
        }

        const updatedEquipment = await prisma.equipment.update({
            where: { id: equipmentId },
            data: updateData
        });

        res.json({ message: "Equipamento atualizado!", equipment: updatedEquipment });
    } catch (error) {
        console.error("❌ Erro ao atualizar equipamento:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});
=======
// --- ROTAS TRANSCACIONAIS (PRISMA) ---
>>>>>>> c206ab6b1b265cbd6fadad52c5d4a6aab9d72963

app.post('/api/register', async (req, res) => {
    try {
        const { fullName, email, ra, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 8);
        await prisma.user.create({
            data: { name: fullName, email, ra, password: hashedPassword }
        });
        res.json({ message: "Sucesso!" });
    } catch (error) {
        res.status(400).json({ error: "Erro ao cadastrar. E-mail ou RA já existem." });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
        if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Senha inválida." });

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: 86400 });
        res.json({ auth: true, token, name: user.name, id: user.id, role: user.role, email: user.email, ra: user.ra });
    } catch (error) {
        res.status(500).json({ error: "Erro interno no login." });
    }
});

<<<<<<< HEAD
// --- ROTAS DE AGENDAMENTO (RESERVAS) ---

// 1. Criar Reserva (Aluno)
app.post('/api/schedule', async (req, res) => {
    try {
        const { equipmentId, date, time, justification } = req.body;
        const userId = req.headers['x-user-id'];

        if (!userId) return res.status(401).json({ error: "Usuário não autenticado." });
        if (!equipmentId || !date || !time || !justification) {
            return res.status(400).json({ error: "Preencha todos os campos, incluindo a justificativa." });
        }

        const newAppointment = await prisma.appointment.create({
            data: {
                date,
                time,
                justification,
                status: "PENDENTE",
                userId: parseInt(userId),
                equipmentId: parseInt(equipmentId)
            }
        });

        res.status(201).json({ message: "Reserva solicitada com sucesso! Aguarde aprovação.", appointment: newAppointment });
    } catch (error) {
        console.error("❌ Erro ao criar agendamento:", error);
        res.status(500).json({ error: "Erro interno ao agendar." });
    }
});

// 2. Listar Reservas Pendentes (Professor/Admin)
app.get('/api/appointments/pending', authMiddleware, roleMiddleware(['ADMIN', 'PROFESSOR']), async (req, res) => {
    try {
        const pendingAppointments = await prisma.appointment.findMany({
            where: { status: "PENDENTE" },
            include: {
                user: { select: { name: true, ra: true } },
                equipment: { select: { name: true } }
            }
        });
        res.json(pendingAppointments);
    } catch (error) {
        console.error("❌ Erro ao buscar pendentes:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});

// 3. Atualizar Status da Reserva (Professor/Admin)
app.put('/api/appointments/:id/status', authMiddleware, roleMiddleware(['ADMIN', 'PROFESSOR']), async (req, res) => {
    try {
        const { status } = req.body; // "APROVADO" ou "RECUSADO"
        const appointmentId = parseInt(req.params.id);

        const updated = await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status }
        });
        
        res.json({ message: `Reserva ${status.toLowerCase()}!`, appointment: updated });
    } catch (error) {
        console.error("❌ Erro ao atualizar status:", error);
        res.status(500).json({ error: "Erro interno ao atualizar reserva." });
    }
});

// 4. Listar Minhas Reservas (Aluno)
app.get('/api/appointments/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        // Verifica se userId é numérico (evitar colisão com '/pending' se a ordem estiver errada, embora a ordem que coloquei evite isso)
        if (isNaN(userId)) return res.status(400).json({error: "ID inválido"});

        const appointments = await prisma.appointment.findMany({
            where: { userId: userId },
            include: {
                equipment: { select: { name: true } }
            },
            orderBy: { id: 'desc' }
        });
        
        const formatted = appointments.map(appt => ({
            id: appt.id,
            equipment: appt.equipment.name,
            date: appt.date,
            startTime: appt.time,
            endTime: appt.time,
            status: appt.status,
            justification: appt.justification
        }));

        res.json(formatted);
    } catch (error) {
        console.error("❌ Erro ao buscar reservas do aluno:", error);
        res.status(500).json({ error: "Erro interno." });
    }
});

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    console.log("💬 Pergunta:", message);

    // --- TRAVA DE SEGURANÇA ---
    if (!vectorStore || vectorStore.length === 0) {
        console.error("❌ ERRO CRÍTICO: O VectorStore está vazio (0 itens).");
        console.error("   Motivo provável: A função initAI falhou ou não terminou.");
        return res.status(500).end("Erro interno: A IA está sem memória.");
    }

    /*res.on("close", () => {
        console.log("⚠️ Cancelando geração de resposta");
        ollama.abort();
    });*/

=======
app.get('/api/users', async (req, res) => {
>>>>>>> c206ab6b1b265cbd6fadad52c5d4a6aab9d72963
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                ra: true,
                role: true,
                trainings: true
            }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar usuários." });
    }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { name, email, ra, trainings } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!existingUser) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        if (existingUser.role === 'ADMIN') {
            return res.status(403).json({ error: "Perfis de administrador não podem ser editados." });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                email,
                ra: ra || null,
                trainings: trainings !== undefined ? trainings : existingUser.trainings
            }
        });
        res.json({ message: "Usuário atualizado com sucesso!", user: updatedUser });
    } catch (error) {
        res.status(500).json({ error: "Erro ao atualizar usuário." });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        const existingUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!existingUser) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        if (existingUser.role === 'ADMIN') {
            return res.status(403).json({ error: "Perfis de administrador não podem ser excluídos." });
        }

        // Excluir agendamentos relacionados se necessário (se o Prisma onDelete não for cascade)
        await prisma.appointment.deleteMany({ where: { userId } });
        
        await prisma.user.delete({ where: { id: userId } });
        
        res.json({ message: "Usuário excluído com sucesso!" });
    } catch (error) {
        res.status(500).json({ error: "Erro ao excluir usuário." });
    }
});

app.get('/api/equipment', async (req, res) => {
    try {
        const equipment = await prisma.equipment.findMany();
        res.json(equipment);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar equipamentos." });
    }
});

app.post('/api/equipment', upload.single('image'), async (req, res) => {
    try {
        const { name, description, status, specs, quantity, requiresTraining } = req.body;
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

        // Serialize to JSON like the PUT endpoint
        const fullDescription = JSON.stringify({
            specs: specs || '',
            description: description || '',
            requiresTraining: requiresTraining === true || requiresTraining === 'true'
        });

        const newQuantity = parseInt(quantity) || 1;
        const baseName = name ? name.replace(/\s*(0\d|A\d|\d+)$/i, '').trim() : name;

        const getUnitName = (base, index, total) => {
            if (total === 1) return base;
            const suffix = String(index + 1).padStart(2, '0');
            return `${base} ${suffix}`;
        };

        const created = [];
        for (let i = 0; i < newQuantity; i++) {
            const unit = await prisma.equipment.create({
                data: {
                    name: getUnitName(baseName, i, newQuantity),
                    description: fullDescription,
                    imagePath,
                    status: status || 'available'
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

app.put('/api/equipment/:id', upload.single('image'), async (req, res) => {
    try {
        const equipmentId = parseInt(req.params.id);
        const { name, description, status, specs, quantity, requiresTraining } = req.body;
        
        // 1. Encontrar o equipamento alvo para obter o nome original
        const target = await prisma.equipment.findUnique({ where: { id: equipmentId } });
        if (!target) {
            return res.status(404).json({ error: "Equipamento não encontrado." });
        }
        
        // 2. Identificar o nome base do grupo
        const originalBaseName = target.name.replace(/\s*(0\d|A\d|\d+)$/i, '').trim();
        
        // 3. Encontrar todos os equipamentos que pertencem a este grupo
        const allEquipment = await prisma.equipment.findMany();
        const groupItems = allEquipment.filter(item => {
            const itemBaseName = item.name.replace(/\s*(0\d|A\d|\d+)$/i, '').trim();
            return itemBaseName.toLowerCase() === originalBaseName.toLowerCase();
        });
        
        // Ordenar os itens por id para manter consistência
        groupItems.sort((a, b) => a.id - b.id);
        
        // 4. Construir o JSON de descrição para armazenamento estruturado
        const fullDescription = JSON.stringify({
            specs: specs || '',
            description: description || '',
            requiresTraining: requiresTraining === true || requiresTraining === 'true'
        });
        
        let newImagePath = target.imagePath;
        if (req.file) {
            newImagePath = `/uploads/${req.file.filename}`;
        }
        
        const newQuantity = parseInt(quantity) || groupItems.length || 1;
        const newBaseName = name ? name.replace(/\s*(0\d|A\d|\d+)$/i, '').trim() : originalBaseName;
        
        const getUnitName = (base, index, total) => {
            if (total === 1) return base;
            const suffix = String(index + 1).padStart(2, '0');
            return `${base} ${suffix}`;
        };
        
        // Atualizar, criar ou remover unidades de acordo com a quantidade informada
        if (newQuantity === groupItems.length) {
            // Apenas atualiza todos
            for (let i = 0; i < groupItems.length; i++) {
                await prisma.equipment.update({
                    where: { id: groupItems[i].id },
                    data: {
                        name: getUnitName(newBaseName, i, newQuantity),
                        description: fullDescription,
                        status: status || groupItems[i].status,
                        imagePath: newImagePath
                    }
                });
            }
        } else if (newQuantity > groupItems.length) {
            // Atualiza os existentes
            for (let i = 0; i < groupItems.length; i++) {
                await prisma.equipment.update({
                    where: { id: groupItems[i].id },
                    data: {
                        name: getUnitName(newBaseName, i, newQuantity),
                        description: fullDescription,
                        status: status || groupItems[i].status,
                        imagePath: newImagePath
                    }
                });
            }
            // Cria os adicionais
            for (let i = groupItems.length; i < newQuantity; i++) {
                await prisma.equipment.create({
                    data: {
                        name: getUnitName(newBaseName, i, newQuantity),
                        description: fullDescription,
                        status: status || 'available',
                        imagePath: newImagePath
                    }
                });
            }
        } else {
            // newQuantity < groupItems.length
            // Atualiza o subconjunto que continua existindo
            for (let i = 0; i < newQuantity; i++) {
                await prisma.equipment.update({
                    where: { id: groupItems[i].id },
                    data: {
                        name: getUnitName(newBaseName, i, newQuantity),
                        description: fullDescription,
                        status: status || groupItems[i].status,
                        imagePath: newImagePath
                    }
                });
            }
            // Remove o excedente (primeiro os agendamentos, depois os equipamentos para evitar violação de FK)
            const idsToDelete = groupItems.slice(newQuantity).map(item => item.id);
            await prisma.appointment.deleteMany({
                where: {
                    equipmentId: { in: idsToDelete }
                }
            });
            await prisma.equipment.deleteMany({
                where: {
                    id: { in: idsToDelete }
                }
            });
        }
        
        res.json({ message: "Equipamento atualizado com sucesso!" });
    } catch (error) {
        console.error("Erro ao atualizar equipamento:", error);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

// --- ROTA DE TREINAMENTO (ADMIN/DOCLING) ---
app.post('/api/train', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

        const inputPath = req.file.path;
        const mdFileName = `${req.file.filename}.md`;
        const outputPath = path.join(DOCUMENTS_PATH, mdFileName);

        console.log(`\n🔄 Iniciando conversão: ${req.file.originalname} -> Markdown`);
        // Descobre se está no Windows ('win32') ou no Mac/Linux e escolhe o comando certo
        const cmdPython = process.platform === 'win32' ? 'python' : 'python3';
        // Monta o comando usando a variável dinâmica
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


// --- ROTA DE CHAT (MCP + RAG + RESERVAS) ---
app.post('/api/chat', async (req, res) => {
    // 👇 AGORA RECEBEMOS O USER ID AQUI 👇
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

        // --- A NOVA MÁQUINHA DE ESTADOS (PROMPT) ---
        const statusLogin = userId
            ? `Você está falando com um usuário LOGADO no sistema (ID do usuário: ${userId}). Ele tem permissão para agendar.`
            : `Você está falando com um VISITANTE NÃO LOGADO. Se ele tentar agendar algo, você deve recusar educadamente e pedir para ele fazer login ou se cadastrar no site.`;

        const systemPromptBase = `Você é o assistente virtual do INOVFABLAB.

        INFORMAÇÃO DO USUÁRIO ATUAL: ${statusLogin}

        PROTOCOLO DE RESERVA (SIGA RIGOROSAMENTE):
        1. Se o usuário quiser reservar mas não disse qual equipamento ou você não sabe o ID, chame 'consultar_equipamentos' IMEDIATAMENTE.
        2. Ao receber a lista do banco, apresente-a assim:
        "Encontrei estes equipamentos:
        [ID] Nome do Equipamento - Status
        Qual destes você deseja reservar?"
        3. NUNCA tente adivinhar um ID. Só use IDs que você acabou de ler na ferramenta 'consultar_equipamentos'.
        4. Após o usuário escolher o número (ID), peça a Data (AAAA-MM-DD) e Hora (HH:MM) se ele ainda não informou.
        5. Somente com o ID confirmado e os dados de tempo, chame 'solicitar_reserva'.

        REGRAS DE FORMATAÇÃO:
        - Seja direto. Não explique que está acessando o banco de dados.
        - Não use termos técnicos como "ID 1 criado no SQLite". Diga apenas "Reserva solicitada com sucesso!".`;

        // --- 2. PRIMEIRA CHAMADA (A IA Pensa) ---
        const response1 = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama3.2",
                messages: [
                    { role: "system", content: systemPromptBase },
                    { role: "user", content: message }
                ],
                // 👇 ADICIONAMOS A NOVA FERRAMENTA AQUI 👇
                tools: [toolConsultarEquipamentos, toolSolicitarReserva],
                stream: false
            })
        });

        const data1 = await response1.json();
        const messageResponse = data1.message;

        // --- 3. MCP (A IA decidiu usar a ferramenta) ---
        if (messageResponse.tool_calls) {
            const toolCall = messageResponse.tool_calls[0];
            console.log("⚙️ Ferramenta solicitada pela IA:", toolCall.function.name);

            let resultadoBanco = "";

            // O ROTEADOR DE FERRAMENTAS
            if (toolCall.function.name === "consultar_equipamentos") {
                resultadoBanco = await executarConsultaEquipamentos();
            }
            else if (toolCall.function.name === "solicitar_reserva") {
                // Passamos os argumentos que a IA montou E o userId que veio do frontend
                resultadoBanco = await executarSolicitacaoReserva(toolCall.function.arguments, userId);
            }

            console.log("📦 RETORNO DA FERRAMENTA:");
            console.log(resultadoBanco);
            console.log("--------------------------------------------------");

            // --- 4. SEGUNDA CHAMADA (Injeção Forçada) ---
            const promptInjetado = `Você acabou de consultar o sistema interno silenciosamente e obteve esta resposta:
            ${resultadoBanco}
            
            Com base nesse resultado, responda ao usuário de forma natural, educada e direta. 
            REGRA ABSOLUTA: NUNCA mencione palavras técnicas como "banco de dados", "SQLite", "sistema interno" ou "ferramentas". Apenas repasse a informação ou confirme a ação.`;

            const finalResponse = await fetch('http://127.0.0.1:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "llama3.2",
                    messages: [
                        { role: "user", content: promptInjetado }
                    ],
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
            return; // Sai da função aqui se usou ferramenta
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

    } catch (error) { // <-- Agora o CATCH encontra o TRY corretamente
        console.error("❌ Erro na Rota Chat:", error);
        res.status(500).end("Erro ao processar consulta.");
    }
});

// --- ROTA DE TRANSCRIÇÃO (WHISPER) - ADICIONADA PELA JULIANA ---
let transcriber = null;

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Nenhum áudio enviado." });

        console.log(`🎙️ Novo áudio recebido para transcrição: ${req.file.filename}`);

        if (!transcriber) {
            console.log("⚙️ Carregando modelo Whisper-Base na memória (melhor custo-benefício para PT-BR)...");
            transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base');
            console.log("✅ Whisper-Base carregado!");
        }

        let buffer = fs.readFileSync(req.file.path);
        let wav = new WaveFile(buffer);
        wav.toBitDepth('32f');
        wav.toSampleRate(16000);

        let audioData = wav.getSamples();
        if (Array.isArray(audioData)) {
            audioData = audioData[0];
        }

        console.log("🧠 Transcrevendo em Português...");
        let output = await transcriber(audioData, {
            language: 'portuguese',
            task: 'transcribe',
        });

        console.log(`✅ Texto transcrito: "${output.text}"`);
        fs.unlinkSync(req.file.path);
        res.json({ text: output.text });

    } catch (error) {
        console.error("❌ Erro no Whisper:", error);
        res.status(500).json({ error: "Falha ao processar áudio." });
    }
});

app.listen(PORT, () => console.log(`🔥 Servidor: http://localhost:${PORT}`));