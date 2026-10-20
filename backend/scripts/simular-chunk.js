/* Compara tamanhos de fragmento (chunk) para o RAG (TCC p.17 — Seção 2.2).
 *
 * Uso (dentro de backend/):
 *   npm run simular-chunk
 *   npm run simular-chunk -- --tamanhos 500,1000,2000 --pasta C:\docs-lab --perguntas minhas.json
 *   npm run simular-chunk -- --sem-modelo   # só a parte que não precisa do modelo de embeddings
 *
 * Para cada tamanho, corta o acervo como o sistema faz (sem sobreposição),
 * vetoriza e faz as perguntas de scripts/perguntas-chunk.json. Cada pergunta
 * traz o trecho exato do documento que a responde; um fragmento é "relevante"
 * quando contém esse trecho (ou parte dele, se o corte o dividiu).
 *
 * Métricas:
 *   - acerto@1 / acerto@4: % de perguntas com fragmento relevante na 1ª / entre as 4 primeiras posições
 *   - MRR: média de 1/posição do primeiro fragmento relevante (0 se não veio)
 *   - trechos cortados: % de respostas divididas entre dois fragmentos pelo corte fixo
 *   - contexto ao LLM: caracteres enviados com os 4 fragmentos
 *   - tokens por fragmento e % acima de 256 tokens (limite usado no treino do all-MiniLM-L6-v2)
 * Saída: docs/medicoes/chunk-<data>.json e .md
 */
import fs from 'fs';
import path from 'path';
import {
    TOP_K, limparTexto, fragmentar, lerTexto, sourceDoArquivo, FORMATOS_ACEITOS, FORMATOS_DOCLING,
    criarEmbedder, embedding, vetorizar, buscar,
} from '../rag.js';
import { BACKEND_DIR, lerArgumentos, ambiente, ms, media, mediana, tabelaMd, tabelaAmbiente, salvarRelatorio } from './util.js';

const args = lerArgumentos({
    pasta: path.join(BACKEND_DIR, 'documents'),
    perguntas: path.join(BACKEND_DIR, 'scripts', 'perguntas-chunk.json'),
    tamanhos: '500,1000,1500,2000,3000',
});
const tamanhos = String(args.tamanhos).split(',').map(n => parseInt(n, 10)).filter(n => n > 0);
const semModelo = Boolean(args['sem-modelo']);

const normalizar = (t) => String(t).replace(/\s+/g, ' ').trim().toLowerCase();

// Relevância de um fragmento para uma pergunta.
// 'inteiro' = contém o trecho completo; 'parte' = contém o início ou o fim de um trecho cortado.
function relevancia(fragmento, trechos) {
    const f = normalizar(fragmento);
    let parte = false;
    for (const bruto of trechos) {
        const t = normalizar(bruto);
        if (f.includes(t)) return 'inteiro';
        const pedaco = Math.min(20, Math.floor(t.length / 2));
        if (f.includes(t.slice(0, pedaco)) || f.includes(t.slice(-pedaco))) parte = true;
    }
    return parte ? 'parte' : null;
}

async function lerAcervo(pasta) {
    const docs = [];
    for (const nome of fs.readdirSync(pasta).sort()) {
        const ext = path.extname(nome).toLowerCase();
        if (!FORMATOS_ACEITOS.includes(ext)) continue;
        if (FORMATOS_DOCLING.includes(ext)) {
            console.warn(`⚠️  ${nome}: PDF/DOCX é lido sem Docling aqui; para o resultado do sistema, envie-o pela tela e use a pasta documents/.`);
        }
        docs.push({ nome, texto: limparTexto(await lerTexto(path.join(pasta, nome))) });
    }
    return docs;
}

async function main() {
    const amb = await ambiente();
    const perguntas = JSON.parse(fs.readFileSync(path.resolve(args.perguntas), 'utf-8'));
    const acervo = await lerAcervo(path.resolve(args.pasta));
    const totalCaracteres = acervo.reduce((s, d) => s + d.texto.length, 0);

    // Confere se cada trecho de resposta existe no acervo.
    const corpus = normalizar(acervo.map(d => d.texto).join(' '));
    const semTrecho = perguntas.filter(p => !p.trechos.some(t => corpus.includes(normalizar(t))));
    if (semTrecho.length) {
        console.warn('⚠️  Perguntas cujo trecho não está no acervo (ficam fora do cálculo):');
        semTrecho.forEach(p => console.warn(`   - ${p.pergunta}`));
    }
    const validas = perguntas.filter(p => !semTrecho.includes(p));

    const embedder = semModelo ? null : await criarEmbedder();
    const vetoresPergunta = [];
    if (embedder) {
        for (const p of validas) vetoresPergunta.push(await embedding(embedder, p.pergunta));
    }

    const resultados = [];
    for (const tamanho of tamanhos) {
        const blocos = acervo.flatMap(d => fragmentar(d.texto, tamanho).map(text => ({ source: sourceDoArquivo(d.nome), text })));

        // Trechos de resposta divididos pelo corte (não depende do modelo).
        const cortados = validas.filter(p => !blocos.some(b => relevancia(b.text, p.trechos) === 'inteiro')).length;

        const linha = {
            tamanho,
            fragmentos: blocos.length,
            caracteres_medios: Math.round(media(blocos.map(b => b.text.length))),
            trechos_cortados_pct: +((100 * cortados) / validas.length).toFixed(1),
        };

        if (embedder) {
            const tokens = blocos.map(b => embedder.tokenizer(b.text).input_ids.size);
            linha.tokens_medios = Math.round(media(tokens));
            linha.tokens_max = Math.max(...tokens);
            linha.acima_256_tokens_pct = +((100 * tokens.filter(t => t > 256).length) / tokens.length).toFixed(1);

            const inicio = performance.now();
            const vetores = await vetorizar(embedder, blocos, { progresso: false });
            linha.indexacao_ms = ms(inicio);

            let acerto1 = 0, acerto4 = 0, rr = 0;
            const contexto = [];
            validas.forEach((p, i) => {
                const top = buscar(vetoresPergunta[i], vetores, TOP_K);
                contexto.push(top.reduce((s, r) => s + r.item.text.length, 0));
                const pos = top.findIndex(r => relevancia(r.item.text, p.trechos));
                if (pos === 0) acerto1++;
                if (pos >= 0) { acerto4++; rr += 1 / (pos + 1); }
            });
            linha.acerto1_pct = +((100 * acerto1) / validas.length).toFixed(1);
            linha.acerto4_pct = +((100 * acerto4) / validas.length).toFixed(1);
            linha.mrr = +(rr / validas.length).toFixed(3);
            linha.contexto_llm_caracteres = mediana(contexto);
        }
        resultados.push(linha);
        console.log(linha);
    }

    const colunas = [
        { titulo: 'Tamanho (caracteres)', campo: 'tamanho' },
        { titulo: 'Fragmentos', campo: 'fragmentos' },
        { titulo: 'Trechos de resposta cortados (%)', campo: 'trechos_cortados_pct' },
    ];
    if (!semModelo) {
        colunas.push(
            { titulo: 'Acerto@1 (%)', campo: 'acerto1_pct' },
            { titulo: 'Acerto@4 (%)', campo: 'acerto4_pct' },
            { titulo: 'MRR', campo: 'mrr' },
            { titulo: 'Contexto ao LLM (caracteres, mediana)', campo: 'contexto_llm_caracteres' },
            { titulo: 'Tokens por fragmento (média / máx.)', campo: 'tokens_txt' },
            { titulo: '> 256 tokens (%)', campo: 'acima_256_tokens_pct' },
            { titulo: 'Indexação (ms)', campo: 'indexacao_ms' },
        );
        resultados.forEach(r => { r.tokens_txt = `${r.tokens_medios} / ${r.tokens_max}`; });
    }

    const dados = {
        ambiente: amb,
        configuracao: {
            pasta: path.resolve(args.pasta), documentos: acervo.length, caracteres_acervo: totalCaracteres,
            perguntas: validas.length, perguntas_descartadas: semTrecho.length, top_k: TOP_K, sem_modelo: semModelo,
        },
        resultados,
    };
    const md = [
        '# Simulação do tamanho de fragmento (chunk)',
        '',
        `Acervo: ${acervo.length} documento(s), ${totalCaracteres} caracteres. Perguntas avaliadas: ${validas.length}. Recuperação: top-${TOP_K}, similaridade de cosseno.`,
        '',
        tabelaMd(resultados, colunas),
        '',
        '## Ambiente',
        tabelaAmbiente(amb),
        '',
        '> Gerado por `backend/scripts/simular-chunk.js`. "Trechos cortados" = respostas divididas entre dois fragmentos pelo corte de tamanho fixo.',
        '',
    ].join('\n');
    const base = salvarRelatorio(semModelo ? 'chunk-sem-modelo' : 'chunk', dados, md);
    console.log(`\n${md}\n📄 Relatório salvo em ${base}.md e .json`);
}

main().catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
});
