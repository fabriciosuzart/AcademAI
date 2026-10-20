/* Mede a ingestão do acervo do RAG (TCC p.65 — Seção 6.3 e Tabela 1).
 *
 * Uso (dentro de backend/):
 *   npm run medir                         # mede backend/documents
 *   npm run medir -- --pasta C:\docs-lab  # mede outra pasta (PDF, DOCX, MD, TXT)
 *
 * Não altera o acervo nem o vector_cache.json do sistema: converte em uma
 * pasta temporária e mantém os vetores só em memória.
 * Saída: docs/medicoes/ingestao-<data>.json e .md
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    CHUNK_SIZE, FORMATOS_ACEITOS, FORMATOS_DOCLING, MODELO_EMBEDDINGS, TOP_K,
    limparTexto, fragmentar, lerTexto, sourceDoArquivo,
    criarEmbedder, embedding, vetorizar, buscar, converterComDocling,
} from '../rag.js';
import {
    BACKEND_DIR, lerArgumentos, ambiente, monitorarMemoria, memoriaMb, ms, media, mediana,
    tabelaMd, tabelaAmbiente, salvarRelatorio,
} from './util.js';

const CONSULTAS = [
    'Como faço para reservar a cortadora a laser?',
    'Qual é a tolerância de atraso de uma reserva?',
    'Quais equipamentos exigem treinamento?',
    'Posso usar o laboratório de bermuda?',
    'Quantas impressoras 3D o laboratório tem?',
];

const args = lerArgumentos({ pasta: path.join(BACKEND_DIR, 'documents'), repeticoes: '10' });
const pasta = path.resolve(args.pasta);
const repeticoes = Math.max(1, parseInt(args.repeticoes, 10) || 10);

async function main() {
    const amb = await ambiente();
    console.log('🖥️  Ambiente:', amb);

    const arquivos = fs.readdirSync(pasta)
        .filter(n => FORMATOS_ACEITOS.includes(path.extname(n).toLowerCase()))
        .sort();
    if (!arquivos.length) throw new Error(`Nenhum PDF, DOCX, MD ou TXT em ${pasta}`);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'academai-medicao-'));
    const memoriaInicial = memoriaMb();
    const monitor = monitorarMemoria();

    // 1) Conversão (Docling para PDF/DOCX) e fragmentação.
    const porArquivo = [];
    const blocos = [];
    for (const nome of arquivos) {
        const caminho = path.join(pasta, nome);
        const ext = path.extname(nome).toLowerCase();
        const linha = { arquivo: nome, formato: ext.slice(1).toUpperCase(), kb: +(fs.statSync(caminho).size / 1024).toFixed(1) };
        let texto;

        if (FORMATOS_DOCLING.includes(ext)) {
            const saida = path.join(tmp, `${nome}.md`);
            const inicio = performance.now();
            const r = await converterComDocling(caminho, saida);
            linha.docling_s = +(ms(inicio) / 1000).toFixed(2);
            if (r.status !== 'SUCESSO') {
                linha.status = `recusado: ${r.motivo}`;
                porArquivo.push(linha);
                console.log(`   ❌ ${nome}: ${r.motivo}`);
                continue;
            }
            Object.assign(linha, {
                paginas: r.paginas, tabelas: r.tabelas, imagens: r.imagens, ocr: r.ocr,
                docling_memoria_mb: r.memoria_pico_mb,
            });
            texto = fs.readFileSync(saida, 'utf-8');
        } else {
            texto = await lerTexto(caminho);
        }

        const limpo = limparTexto(texto);
        const fragmentos = fragmentar(limpo, CHUNK_SIZE);
        fragmentos.forEach(t => blocos.push({ source: sourceDoArquivo(nome), text: t }));
        Object.assign(linha, { caracteres: limpo.length, fragmentos: fragmentos.length, status: 'ok' });
        porArquivo.push(linha);
        console.log(`   ✅ ${nome}: ${fragmentos.length} fragmento(s)`);
    }

    // 2) Modelo de embeddings e indexação.
    let inicio = performance.now();
    const embedder = await criarEmbedder();
    const carregamentoModeloMs = ms(inicio);
    monitor.marcar();

    inicio = performance.now();
    const vetores = await vetorizar(embedder, blocos, { progresso: false });
    const indexacaoMs = ms(inicio);
    monitor.marcar();

    const cacheBytes = Buffer.byteLength(JSON.stringify(vetores));
    const dimensoes = vetores[0]?.vector?.length || 0;

    // 3) Consulta: vetorização da pergunta e busca por similaridade (top-4).
    const tempoConsulta = [];
    const tempoBusca = [];
    await embedding(embedder, 'aquecimento');
    for (let i = 0; i < repeticoes; i++) {
        for (const q of CONSULTAS) {
            let t = performance.now();
            const v = await embedding(embedder, q);
            tempoConsulta.push(ms(t));
            t = performance.now();
            buscar(v, vetores, TOP_K);
            tempoBusca.push(+(performance.now() - t).toFixed(3));
        }
    }
    const memoriaPico = monitor.parar();
    fs.rmSync(tmp, { recursive: true, force: true });

    const aceitos = porArquivo.filter(a => a.status === 'ok');
    const dados = {
        ambiente: amb,
        configuracao: { pasta, chunk_caracteres: CHUNK_SIZE, top_k: TOP_K, modelo_embeddings: MODELO_EMBEDDINGS, repeticoes },
        arquivos: porArquivo,
        totais: {
            documentos: porArquivo.length,
            documentos_aceitos: aceitos.length,
            tamanho_total_kb: +porArquivo.reduce((s, a) => s + a.kb, 0).toFixed(1),
            paginas: aceitos.reduce((s, a) => s + (a.paginas || 0), 0) || null,
            fragmentos: blocos.length,
            vetores: vetores.length,
            dimensoes,
            vetores_float32_kb: +((vetores.length * dimensoes * 4) / 1024).toFixed(1),
            vector_cache_json_kb: +(cacheBytes / 1024).toFixed(1),
            docling_total_s: aceitos.some(a => a.docling_s != null)
                ? +aceitos.reduce((s, a) => s + (a.docling_s || 0), 0).toFixed(2)
                : null,
            carregamento_modelo_embeddings_ms: carregamentoModeloMs,
            indexacao_total_ms: indexacaoMs,
            indexacao_por_fragmento_ms: blocos.length ? +(indexacaoMs / blocos.length).toFixed(1) : null,
            embedding_consulta_media_ms: media(tempoConsulta),
            embedding_consulta_mediana_ms: mediana(tempoConsulta),
            busca_cosseno_media_ms: media(tempoBusca),
            memoria_node_inicial_mb: memoriaInicial,
            memoria_node_pico_mb: memoriaPico,
            memoria_docling_pico_mb: Math.max(0, ...aceitos.map(a => a.docling_memoria_mb || 0)) || null,
        },
    };

    const t = dados.totais;
    const md = [
        '# Medição da ingestão do acervo (RAG)',
        '',
        '## Ambiente',
        tabelaAmbiente(amb),
        '',
        '## Por arquivo',
        tabelaMd(porArquivo, [
            { titulo: 'Arquivo', campo: 'arquivo' }, { titulo: 'Formato', campo: 'formato' },
            { titulo: 'Tamanho (KB)', campo: 'kb' }, { titulo: 'Páginas', campo: 'paginas' },
            { titulo: 'Tabelas', campo: 'tabelas' }, { titulo: 'Imagens', campo: 'imagens' },
            { titulo: 'Docling (s)', campo: 'docling_s' }, { titulo: 'Caracteres', campo: 'caracteres' },
            { titulo: 'Fragmentos', campo: 'fragmentos' }, { titulo: 'Status', campo: 'status' },
        ]),
        '',
        '## Totais',
        tabelaMd([
            ['Documentos (aceitos / total)', `${t.documentos_aceitos} / ${t.documentos}`],
            ['Tamanho total dos arquivos', `${t.tamanho_total_kb} KB`],
            ['Páginas (PDF/DOCX)', t.paginas ?? '—'],
            [`Fragmentos de ${CHUNK_SIZE} caracteres`, t.fragmentos],
            ['Dimensões do embedding', t.dimensoes],
            ['Vetores em memória (float32)', `${t.vetores_float32_kb} KB`],
            ['Arquivo vector_cache.json', `${t.vector_cache_json_kb} KB`],
            ['Tempo de conversão pelo Docling (total)', t.docling_total_s != null ? `${t.docling_total_s} s` : '— (nenhum PDF/DOCX)'],
            ['Carregamento do modelo de embeddings', `${t.carregamento_modelo_embeddings_ms} ms`],
            ['Tempo total de indexação', `${t.indexacao_total_ms} ms`],
            ['Indexação por fragmento', `${t.indexacao_por_fragmento_ms} ms`],
            [`Embedding da consulta (média de ${tempoConsulta.length})`, `${t.embedding_consulta_media_ms} ms`],
            ['Busca por similaridade de cosseno (média)', `${t.busca_cosseno_media_ms} ms`],
            ['Memória do Node (início → pico)', `${t.memoria_node_inicial_mb} → ${t.memoria_node_pico_mb} MB`],
            ['Memória do Docling (pico)', t.memoria_docling_pico_mb ? `${t.memoria_docling_pico_mb} MB` : '—'],
        ].map(([k, v]) => ({ k, v })), [{ titulo: 'Métrica', campo: 'k' }, { titulo: 'Valor', campo: 'v' }]),
        '',
        `> Gerado por \`backend/scripts/medir-ingestao.js\`. O tempo de geração do LLM (tokens/s) é medido à parte (tarefas do Arthur).`,
        '',
    ].join('\n');

    const base = salvarRelatorio('ingestao', dados, md);
    console.log(`\n${md}\n📄 Relatório salvo em ${base}.md e .json`);
}

main().catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
});
