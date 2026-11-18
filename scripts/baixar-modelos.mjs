#!/usr/bin/env node
// Baixa, uma vez, os modelos que o AcademAI roda localmente (RF24, RNF11):
//   - Xenova/whisper-base      → public/models/   (reconhecimento de voz no navegador)
//   - Xenova/all-MiniLM-L6-v2  → backend/models/  (embeddings do RAG no servidor)
// Depois disso, nada precisa de internet: front e backend leem só essas pastas.
//
// Uso (na raiz do projeto):
//   npm run baixar-modelos            baixa o que falta ou está inválido
//   npm run baixar-modelos -- --forcar   baixa tudo de novo
//
// Os arquivos que estavam no repositório eram páginas de redirecionamento
// ("Temporary Redirect...") salvas no lugar do modelo. Por isso este script segue
// redirecionamentos e confere cada arquivo antes de gravar: JSON tem que ser
// JSON válido e .onnx tem que ter tamanho de modelo. Resposta errada não é salva.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Base dos downloads. Pode ser trocada por um espelho (ou um servidor local nos testes).
const BASE = (process.env.ACADEMAI_MODELOS_URL || 'https://huggingface.co').replace(/\/+$/, '');
const FORCAR = process.argv.includes('--forcar');

export const MODELOS = [
    {
        repo: 'Xenova/whisper-base',
        destino: path.join(RAIZ, 'public', 'models'),
        arquivos: [
            'config.json', 'generation_config.json', 'preprocessor_config.json',
            'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json',
            'added_tokens.json', 'vocab.json', 'merges.txt',
            'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx',
        ],
    },
    {
        repo: 'Xenova/all-MiniLM-L6-v2',
        destino: path.join(RAIZ, 'backend', 'models'),
        arquivos: [
            'config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json',
            'vocab.txt', 'onnx/model_quantized.onnx',
        ],
    },
];

// Menor tamanho aceito para um .onnx: os quantizados destes modelos têm de ~20 a ~50 MB.
const ONNX_MINIMO_BYTES = 1024 * 1024;

/** Motivo para recusar o conteúdo baixado, ou null se ele parece o arquivo certo. */
export function motivoParaRecusar(nome, bytes, tipo = '') {
    if (bytes.length === 0) return 'arquivo vazio';
    const inicio = Buffer.from(bytes.subarray(0, 200)).toString('utf8').trimStart();
    if (/^(<!doctype|<html)/i.test(inicio) || /text\/html/i.test(tipo)) return 'veio uma página HTML no lugar do arquivo';
    if (/^(Temporary Redirect|Found\. Redirecting|Moved Permanently)/i.test(inicio)) return 'veio uma página de redirecionamento';
    if (nome.endsWith('.json')) {
        try {
            JSON.parse(Buffer.from(bytes).toString('utf8'));
        } catch {
            return 'JSON inválido';
        }
    }
    if (nome.endsWith('.onnx') && bytes.length < ONNX_MINIMO_BYTES) {
        return `pequeno demais para um modelo (${bytes.length} bytes)`;
    }
    return null;
}

/** true se o arquivo já existe e passa na mesma conferência do download. */
function jaValido(caminho, nome) {
    if (!fs.existsSync(caminho)) return false;
    return motivoParaRecusar(nome, fs.readFileSync(caminho)) === null;
}

async function baixar(url) {
    // fetch segue os redirecionamentos (o HuggingFace manda para o CDN).
    const resposta = await fetch(url, { redirect: 'follow' });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return { bytes: new Uint8Array(await resposta.arrayBuffer()), tipo: resposta.headers.get('content-type') || '' };
}

const formatarMb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

export async function baixarModelos({ forcar = FORCAR, base = BASE, log = console.log } = {}) {
    const falhas = [];
    for (const modelo of MODELOS) {
        log(`\n📦 ${modelo.repo} → ${path.relative(RAIZ, modelo.destino)}/${modelo.repo}`);
        for (const nome of modelo.arquivos) {
            const caminho = path.join(modelo.destino, modelo.repo, nome);
            if (!forcar && jaValido(caminho, nome)) {
                log(`   ✓ ${nome} (já baixado)`);
                continue;
            }
            const url = `${base}/${modelo.repo}/resolve/main/${nome}`;
            try {
                const { bytes, tipo } = await baixar(url);
                const motivo = motivoParaRecusar(nome, bytes, tipo);
                if (motivo) throw new Error(motivo);
                fs.mkdirSync(path.dirname(caminho), { recursive: true });
                // Grava num temporário e renomeia: um download interrompido nunca vira arquivo "válido".
                fs.writeFileSync(`${caminho}.parcial`, bytes);
                fs.renameSync(`${caminho}.parcial`, caminho);
                log(`   ⬇ ${nome} (${formatarMb(bytes.length)})`);
            } catch (erro) {
                falhas.push(`${modelo.repo}/${nome}: ${erro.message}`);
                log(`   ✗ ${nome}: ${erro.message}`);
            }
        }
    }
    return falhas;
}

// Execução direta (npm run baixar-modelos)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const falhas = await baixarModelos();
    if (falhas.length) {
        console.error(`\n❌ ${falhas.length} arquivo(s) não baixado(s). Confira a conexão e rode de novo.`);
        process.exit(1);
    }
    console.log('\n✅ Modelos prontos. Front e backend agora rodam sem internet.');
}
