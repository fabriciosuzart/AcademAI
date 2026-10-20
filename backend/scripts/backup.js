/* Backup do AcademAI (TCC p.30 — RNF24).
 *
 * Uso (dentro de backend/):
 *   npm run backup
 *   npm run backup -- --destino D:\academai-backups --externo \\servidor\backups\academai
 *
 * O que é copiado:
 *   - banco SQLite (prisma/academai.db), com VACUUM INTO: cópia consistente
 *     mesmo com o servidor rodando, sem copiar o arquivo no meio de uma escrita;
 *   - vector_cache.json (índice do RAG) e a pasta documents/ (acervo).
 *
 * Política (pode ser mudada pelas variáveis abaixo):
 *   - uma cópia por dia em <destino>/diario, mantendo as 7 mais recentes;
 *   - uma cópia por semana em <destino>/semanal, mantendo as 4 mais recentes;
 *   - se houver destino externo (outro disco ou servidor), a cópia semanal
 *     também vai para lá, mantendo 4.
 * Cada cópia tem um manifest.json com tamanho, SHA-256 e o resultado do
 * PRAGMA integrity_check do banco copiado.
 *
 * Variáveis de ambiente: BACKUP_DIR, BACKUP_EXTERNO, BACKUP_DIARIOS (7), BACKUP_SEMANAIS (4).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import sqlite3 from 'sqlite3';
import { BACKEND_DIR, lerArgumentos } from './util.js';

const args = lerArgumentos({
    destino: process.env.BACKUP_DIR || path.join(os.homedir(), 'academai-backups'),
    externo: process.env.BACKUP_EXTERNO || '',
    diarios: process.env.BACKUP_DIARIOS || '7',
    semanais: process.env.BACKUP_SEMANAIS || '4',
});
const DESTINO = path.resolve(args.destino);
const EXTERNO = args.externo ? path.resolve(args.externo) : null;
const MANTER_DIARIOS = Math.max(1, parseInt(args.diarios, 10) || 7);
const MANTER_SEMANAIS = Math.max(1, parseInt(args.semanais, 10) || 4);

const BANCO = path.join(BACKEND_DIR, 'prisma', 'academai.db');
const CACHE = path.join(BACKEND_DIR, 'vector_cache.json');
const DOCUMENTOS = path.join(BACKEND_DIR, 'documents');

const doisDigitos = (n) => String(n).padStart(2, '0');

function carimboLocal(d = new Date()) {
    return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}_${doisDigitos(d.getHours())}${doisDigitos(d.getMinutes())}${doisDigitos(d.getSeconds())}`;
}

/** Semana ISO-8601, ex.: "2026-S43". */
function semanaIso(d = new Date()) {
    const data = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const diaSemana = data.getUTCDay() || 7;
    data.setUTCDate(data.getUTCDate() + 4 - diaSemana);
    const inicioAno = new Date(Date.UTC(data.getUTCFullYear(), 0, 1));
    const semana = Math.ceil(((data - inicioAno) / 86400000 + 1) / 7);
    return `${data.getUTCFullYear()}-S${doisDigitos(semana)}`;
}

function abrir(arquivo, modo) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(arquivo, modo, (erro) => (erro ? reject(erro) : resolve(db)));
    });
}
const executar = (db, sql, params = []) => new Promise((ok, falha) => db.run(sql, params, (e) => (e ? falha(e) : ok())));
const consultar = (db, sql) => new Promise((ok, falha) => db.all(sql, (e, linhas) => (e ? falha(e) : ok(linhas))));
const fechar = (db) => new Promise((ok) => db.close(() => ok()));

async function copiarBanco(destinoArquivo) {
    const db = await abrir(BANCO, sqlite3.OPEN_READONLY);
    try {
        db.configure('busyTimeout', 15000);
        await executar(db, 'VACUUM INTO ?', [destinoArquivo]);
    } finally {
        await fechar(db);
    }
    const copia = await abrir(destinoArquivo, sqlite3.OPEN_READONLY);
    try {
        const [linha] = await consultar(copia, 'PRAGMA integrity_check');
        return Object.values(linha)[0];
    } finally {
        await fechar(copia);
    }
}

function sha256(arquivo) {
    return crypto.createHash('sha256').update(fs.readFileSync(arquivo)).digest('hex');
}

function listarArquivos(pasta, base = pasta) {
    return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
        const caminho = path.join(pasta, e.name);
        return e.isDirectory() ? listarArquivos(caminho, base) : [path.relative(base, caminho)];
    });
}

/** Apaga as cópias mais antigas, deixando só as `manter` mais recentes. */
function rotacionar(pasta, manter) {
    if (!fs.existsSync(pasta)) return [];
    const copias = fs.readdirSync(pasta).filter((n) => fs.statSync(path.join(pasta, n)).isDirectory()).sort();
    const remover = copias.slice(0, Math.max(0, copias.length - manter));
    remover.forEach((n) => fs.rmSync(path.join(pasta, n), { recursive: true, force: true }));
    return remover;
}

async function main() {
    if (!fs.existsSync(BANCO)) throw new Error(`Banco não encontrado em ${BANCO}`);

    const agora = new Date();
    const pastaDiaria = path.join(DESTINO, 'diario', carimboLocal(agora));
    fs.mkdirSync(pastaDiaria, { recursive: true });

    const integridade = await copiarBanco(path.join(pastaDiaria, 'academai.db'));
    if (integridade !== 'ok') throw new Error(`Cópia do banco falhou no integrity_check: ${integridade}`);
    if (fs.existsSync(CACHE)) fs.copyFileSync(CACHE, path.join(pastaDiaria, 'vector_cache.json'));
    if (fs.existsSync(DOCUMENTOS)) fs.cpSync(DOCUMENTOS, path.join(pastaDiaria, 'documents'), { recursive: true });

    const arquivos = listarArquivos(pastaDiaria).map((rel) => ({
        arquivo: rel.split(path.sep).join('/'),
        bytes: fs.statSync(path.join(pastaDiaria, rel)).size,
        sha256: sha256(path.join(pastaDiaria, rel)),
    }));
    fs.writeFileSync(path.join(pastaDiaria, 'manifest.json'), JSON.stringify({
        criado_em: agora.toISOString(),
        maquina: os.hostname(),
        integridade_banco: integridade,
        arquivos,
    }, null, 2));
    console.log(`✅ Cópia diária: ${pastaDiaria} (${arquivos.length} arquivos, banco: ${integridade})`);

    // Uma cópia por semana ISO: a primeira cópia da semana vira a semanal.
    const semana = semanaIso(agora);
    const pastaSemanal = path.join(DESTINO, 'semanal', semana);
    if (!fs.existsSync(pastaSemanal)) {
        fs.cpSync(pastaDiaria, pastaSemanal, { recursive: true });
        console.log(`✅ Cópia semanal: ${pastaSemanal}`);
        if (EXTERNO) {
            const pastaExterna = path.join(EXTERNO, semana);
            fs.cpSync(pastaDiaria, pastaExterna, { recursive: true });
            console.log(`✅ Cópia externa: ${pastaExterna}`);
            rotacionar(EXTERNO, MANTER_SEMANAIS).forEach((n) => console.log(`🗑️  Externa antiga removida: ${n}`));
        }
    }

    rotacionar(path.join(DESTINO, 'diario'), MANTER_DIARIOS).forEach((n) => console.log(`🗑️  Diária antiga removida: ${n}`));
    rotacionar(path.join(DESTINO, 'semanal'), MANTER_SEMANAIS).forEach((n) => console.log(`🗑️  Semanal antiga removida: ${n}`));
}

main().catch((e) => {
    console.error('❌ Backup falhou:', e.message);
    process.exit(1);
});
