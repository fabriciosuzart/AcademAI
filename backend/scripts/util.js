/* Funções comuns aos scripts de medição. */
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';

export const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PASTA_MEDICOES = path.resolve(BACKEND_DIR, '..', 'docs', 'medicoes');

/** Lê "--chave valor" e "--flag" da linha de comando. */
export function lerArgumentos(padroes = {}) {
    const args = { ...padroes };
    const lista = process.argv.slice(2);
    for (let i = 0; i < lista.length; i++) {
        if (!lista[i].startsWith('--')) continue;
        const chave = lista[i].slice(2);
        const proximo = lista[i + 1];
        if (proximo === undefined || proximo.startsWith('--')) {
            args[chave] = true;
        } else {
            args[chave] = proximo;
            i++;
        }
    }
    return args;
}

function rodar(cmd, argumentos) {
    return new Promise((resolve) => {
        execFile(cmd, argumentos, { timeout: 60000, windowsHide: true }, (erro, stdout) => {
            resolve(erro ? null : String(stdout).trim());
        });
    });
}

/** Descreve a máquina em que a medição foi feita. */
export async function ambiente() {
    const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    const docling = await rodar(python, ['-c', 'import importlib.metadata as m; print(m.version("docling"))']);
    let ollama = null;
    try {
        const r = await fetch('http://127.0.0.1:11434/api/version', { signal: AbortSignal.timeout(2000) });
        ollama = (await r.json()).version || null;
    } catch {
        // Ollama desligado: só não entra no relatório
    }
    const cpus = os.cpus();
    return {
        cpu: cpus[0]?.model?.trim() || 'desconhecida',
        nucleos_logicos: cpus.length,
        ram_total_gb: +(os.totalmem() / 1024 ** 3).toFixed(1),
        sistema: `${os.type()} ${os.release()} (${os.arch()})`,
        node: process.version,
        docling: docling || 'não instalado',
        ollama: ollama || 'não detectado',
        data: new Date().toISOString(),
    };
}

/** Memória do processo Node em MB. */
export function memoriaMb() {
    return +(process.memoryUsage().rss / 1024 ** 2).toFixed(1);
}

/** Acompanha o pico de memória enquanto uma tarefa roda. */
export function monitorarMemoria(intervaloMs = 50) {
    let pico = memoriaMb();
    const id = setInterval(() => { pico = Math.max(pico, memoriaMb()); }, intervaloMs);
    return {
        marcar() { pico = Math.max(pico, memoriaMb()); },
        parar() { clearInterval(id); pico = Math.max(pico, memoriaMb()); return pico; },
    };
}

export const ms = (inicio) => +(performance.now() - inicio).toFixed(1);

export function mediana(valores) {
    if (!valores.length) return null;
    const v = [...valores].sort((a, b) => a - b);
    const meio = Math.floor(v.length / 2);
    return v.length % 2 ? v[meio] : +((v[meio - 1] + v[meio]) / 2).toFixed(2);
}

export function media(valores) {
    if (!valores.length) return null;
    return +(valores.reduce((s, x) => s + x, 0) / valores.length).toFixed(2);
}

/** Tabela Markdown a partir de uma lista de objetos. */
export function tabelaMd(linhas, colunas) {
    const cab = `| ${colunas.map(c => c.titulo).join(' | ')} |`;
    const sep = `| ${colunas.map(() => '---').join(' | ')} |`;
    const corpo = linhas.map(l => `| ${colunas.map(c => l[c.campo] ?? '—').join(' | ')} |`);
    return [cab, sep, ...corpo].join('\n');
}

export function tabelaAmbiente(amb) {
    return tabelaMd(Object.entries(amb).map(([k, v]) => ({ k, v })), [
        { titulo: 'Item', campo: 'k' }, { titulo: 'Valor', campo: 'v' },
    ]);
}

/** Grava <prefixo>-<data>.json e .md em docs/medicoes (ou na pasta pedida). */
export function salvarRelatorio(prefixo, dados, markdown, pasta = PASTA_MEDICOES) {
    fs.mkdirSync(pasta, { recursive: true });
    const carimbo = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const base = path.join(pasta, `${prefixo}-${carimbo}`);
    fs.writeFileSync(`${base}.json`, JSON.stringify(dados, null, 2), 'utf-8');
    fs.writeFileSync(`${base}.md`, markdown, 'utf-8');
    return base;
}
