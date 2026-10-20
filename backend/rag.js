/* backend/rag.js — pipeline de ingestão do RAG (leitura, fragmentação, embeddings, busca).
 *
 * Fica fora do server.js para que o servidor e os scripts de medição
 * (scripts/medir-ingestao.js, scripts/simular-chunk.js) usem exatamente o
 * mesmo código. Nada aqui guarda estado: quem chama decide onde manter os
 * vetores.
 */
import { pipeline } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execFile } from 'child_process';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tamanho fixo do fragmento, em caracteres, sem sobreposição.
// A justificativa está em docs/tcc/contribuicoes-mafe.md (tópico 4).
export const CHUNK_SIZE = 2000;

// Quantos fragmentos vão para o contexto do LLM (RF19/UC11).
export const TOP_K = 4;

export const MODELO_EMBEDDINGS = 'Xenova/all-MiniLM-L6-v2';

// Formatos aceitos no upload. PDF e DOCX passam pelo Docling; MD e TXT já
// são texto e vão direto para a indexação.
export const FORMATOS_DOCLING = ['.pdf', '.docx'];
export const FORMATOS_TEXTO = ['.md', '.txt'];
export const FORMATOS_ACEITOS = [...FORMATOS_DOCLING, ...FORMATOS_TEXTO];

// Abaixo disso o documento é tratado como "sem texto extraível" e recusado.
export const MIN_CARACTERES_UTEIS = 50;

// Cada bloco carrega a origem no formato "Arquivo: nome.md".
// Essas duas funções são o único lugar que conhece esse formato.
export const sourceDoArquivo = (nome) => `Arquivo: ${nome}`;
export const nomeDoSource = (source) => String(source || '').replace(/^Arquivo:\s*/, '');

/** Remove \r e linhas em branco repetidas — a mesma limpeza feita desde a versão original. */
export function limparTexto(texto) {
    return String(texto || '').replace(/\r/g, '').replace(/\n\s*\n/g, '\n').trim();
}

/** Corta o texto em fragmentos de `tamanho` caracteres, sem sobreposição. */
export function fragmentar(texto, tamanho = CHUNK_SIZE) {
    const fragmentos = [];
    for (let i = 0; i < texto.length; i += tamanho) {
        fragmentos.push(texto.substring(i, i + tamanho));
    }
    return fragmentos;
}

/** Conta caracteres que não são espaço — usado para recusar documento vazio. */
export function caracteresUteis(texto) {
    return String(texto || '').replace(/\s/g, '').length;
}

/** Lê o texto bruto de um arquivo já presente em documents/. */
export async function lerTexto(caminho) {
    const ext = path.extname(caminho).toLowerCase();
    if (ext === '.pdf') {
        const data = await pdf(fs.readFileSync(caminho));
        return data.text;
    }
    if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: caminho });
        return result.value;
    }
    if (ext === '.md' || ext === '.txt') {
        return fs.readFileSync(caminho, 'utf-8');
    }
    return '';
}

/**
 * Lê os documentos da pasta e devolve os blocos { source, text }.
 * Quando `apenas` é informado, lê só aquele arquivo — usado após um upload,
 * para não reprocessar o corpus inteiro a cada treino.
 */
export async function carregarDocumentos(pasta, { apenas = null, tamanho = CHUNK_SIZE, silencioso = false } = {}) {
    const blocos = [];
    const log = silencioso ? () => {} : console.log;

    if (!fs.existsSync(pasta)) {
        fs.mkdirSync(pasta, { recursive: true });
        log("📂 Pasta 'documents' criada.");
        return blocos;
    }
    const arquivos = apenas ? [apenas] : fs.readdirSync(pasta);
    log(`📂 Lendo ${arquivos.length} arquivo(s)...`);

    for (const arquivo of arquivos) {
        try {
            const texto = limparTexto(await lerTexto(path.join(pasta, arquivo)));
            if (!texto) continue;
            for (const trecho of fragmentar(texto, tamanho)) {
                blocos.push({ source: sourceDoArquivo(arquivo), text: trecho });
            }
            log(`   ✅ Lido: ${arquivo}`);
        } catch (error) {
            console.error(`   ❌ Erro ao ler ${arquivo}:`, error.message);
        }
    }
    return blocos;
}

/** Carrega o modelo de embeddings (all-MiniLM-L6-v2, 384 dimensões). */
export async function criarEmbedder() {
    return pipeline('feature-extraction', MODELO_EMBEDDINGS);
}

/** Gera o embedding normalizado de um texto. */
export async function embedding(embedder, texto) {
    const output = await embedder(texto, { pooling: 'mean', normalize: true });
    return output.data;
}

/** Vetoriza os blocos; um bloco que falha é registrado e pulado. */
export async function vetorizar(embedder, blocos, { progresso = true } = {}) {
    const vetores = [];
    for (const bloco of blocos) {
        try {
            const vector = await embedding(embedder, bloco.text);
            vetores.push({ text: bloco.text, source: bloco.source, vector });
            if (progresso) process.stdout.write('.');
        } catch (e) {
            console.error(`\n❌ Erro ao vetorizar bloco de ${bloco.source}:`, e.message);
        }
    }
    return vetores;
}

export function cosineSimilarity(vecA, vecB) {
    let dot = 0.0, normA = 0.0, normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Os `k` vetores mais parecidos com a consulta, do mais para o menos parecido. */
export function buscar(vetorConsulta, vetores, k = TOP_K) {
    return vetores
        .map(item => ({ item, score: cosineSimilarity(vetorConsulta, item.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
}

/**
 * Converte PDF/DOCX para Markdown com o Docling (converter.py).
 * Usa execFile, sem shell: o caminho do arquivo nunca vira parte de um comando.
 * Sempre resolve (não rejeita) com o JSON devolvido pelo converter.py:
 *   { status: 'SUCESSO' | 'ERRO', motivo?, paginas?, tabelas?, imagens?, ... }
 */
export function converterComDocling(entrada, saida, { timeoutMs = 10 * 60 * 1000 } = {}) {
    const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    const script = path.join(__dirname, 'converter.py');

    return new Promise((resolve) => {
        execFile(python, [script, entrada, saida], { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, windowsHide: true },
            (erro, stdout, stderr) => {
                const resultado = ultimoJson(stdout);
                if (resultado) return resolve(resultado);

                // Sem JSON: Python ausente, Docling não instalado, timeout etc.
                let motivo = 'Conversor não respondeu.';
                if (erro?.code === 'ENOENT') motivo = `Python não encontrado (${python}).`;
                else if (erro?.killed) motivo = `Conversão excedeu ${Math.round(timeoutMs / 1000)} s.`;
                else if (/No module named ['"]?docling/.test(stderr)) motivo = 'Docling não instalado (pip install docling).';
                else if (stderr) motivo = stderr.trim().split('\n').pop().slice(0, 300);
                resolve({ status: 'ERRO', motivo });
            });
    });
}

// O Docling pode escrever avisos no stdout; o resultado é a última linha JSON.
function ultimoJson(stdout) {
    const linhas = String(stdout || '').trim().split('\n').reverse();
    for (const linha of linhas) {
        const t = linha.trim();
        if (!t.startsWith('{')) continue;
        try {
            return JSON.parse(t);
        } catch {
            // continua procurando
        }
    }
    return null;
}
