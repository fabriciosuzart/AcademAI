/* Tempo de resposta do chat com perguntas simultâneas (TCC p.62 — Seção 5.6).
 *
 * Pré-requisito: backend (node server.js) e Ollama rodando, com o modelo baixado.
 * Uso (dentro de backend/):
 *   npm run carga-chat
 *   npm run carga-chat -- --simultaneos 1,2,4,8 --rodadas 3 --url http://localhost:3000
 *
 * Para cada nível de simultaneidade, dispara N perguntas ao mesmo tempo,
 * `rodadas` vezes, e mede o tempo até o primeiro trecho da resposta e o tempo
 * total. Como o Ollama atende poucas gerações em paralelo, o tempo cresce com
 * a fila — é esse crescimento que sustenta a estimativa de demanda.
 * Saída: docs/medicoes/carga-chat-<data>.json e .md
 */
import { lerArgumentos, ambiente, mediana, tabelaMd, tabelaAmbiente, salvarRelatorio } from './util.js';

const PERGUNTAS = [
    'Qual é a tolerância de atraso de uma reserva?',
    'Quais equipamentos exigem treinamento?',
    'Posso entrar no laboratório de bermuda?',
    'Quantas máquinas o laboratório tem?',
    'Como faço para cancelar uma reserva?',
    'Qual é o horário disponível para reservas?',
    'O que acontece depois que eu confirmo uma reserva?',
    'Quais são os perfis de acesso do sistema?',
];

const args = lerArgumentos({ url: 'http://localhost:3000', simultaneos: '1,2,4,8', rodadas: '3' });
const niveis = String(args.simultaneos).split(',').map(n => parseInt(n, 10)).filter(n => n > 0);
const rodadas = Math.max(1, parseInt(args.rodadas, 10) || 3);

async function perguntar(texto) {
    const inicio = performance.now();
    let primeiro = null;
    let caracteres = 0;
    const resp = await fetch(`${args.url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: texto, history: [] }),
    });
    for await (const pedaco of resp.body) {
        if (primeiro === null) primeiro = performance.now() - inicio;
        caracteres += Buffer.from(pedaco).toString('utf-8').length;
    }
    const total = performance.now() - inicio;
    return { ok: resp.ok, primeiro_s: (primeiro ?? total) / 1000, total_s: total / 1000, caracteres };
}

async function main() {
    const amb = await ambiente();
    if (amb.ollama === 'não detectado') throw new Error('Ollama não está respondendo em 127.0.0.1:11434.');

    console.log('Aquecendo o modelo (a primeira carga não entra na medição)...');
    await perguntar(PERGUNTAS[0]);

    const resultados = [];
    for (const n of niveis) {
        const medidas = [];
        for (let r = 0; r < rodadas; r++) {
            const lote = Array.from({ length: n }, (_, i) => perguntar(PERGUNTAS[(r * n + i) % PERGUNTAS.length]));
            medidas.push(...await Promise.all(lote));
        }
        const ok = medidas.filter(m => m.ok);
        const linha = {
            simultaneos: n,
            requisicoes: medidas.length,
            erros: medidas.length - ok.length,
            primeiro_trecho_mediana_s: +mediana(ok.map(m => m.primeiro_s)).toFixed(2),
            total_mediana_s: +mediana(ok.map(m => m.total_s)).toFixed(2),
            total_max_s: +Math.max(...ok.map(m => m.total_s)).toFixed(2),
            caracteres_mediana: mediana(ok.map(m => m.caracteres)),
        };
        resultados.push(linha);
        console.log(linha);
    }

    const md = [
        '# Carga no chat — perguntas simultâneas',
        '',
        `Rodadas por nível: ${rodadas}. Perguntas de consulta documental (RAG), sem histórico.`,
        '',
        tabelaMd(resultados, [
            { titulo: 'Perguntas simultâneas', campo: 'simultaneos' },
            { titulo: 'Requisições', campo: 'requisicoes' },
            { titulo: 'Erros', campo: 'erros' },
            { titulo: '1º trecho — mediana (s)', campo: 'primeiro_trecho_mediana_s' },
            { titulo: 'Resposta completa — mediana (s)', campo: 'total_mediana_s' },
            { titulo: 'Resposta completa — pior caso (s)', campo: 'total_max_s' },
        ]),
        '',
        '## Ambiente',
        tabelaAmbiente(amb),
        '',
        `> Gerado por \`backend/scripts/carga-chat.js\`. OLLAMA_NUM_PARALLEL=${process.env.OLLAMA_NUM_PARALLEL || 'padrão'} (variável lida deste terminal; confira a do serviço do Ollama).`,
        '',
    ].join('\n');
    const base = salvarRelatorio('carga-chat', { ambiente: amb, rodadas, resultados }, md);
    console.log(`\n${md}\n📄 Relatório salvo em ${base}.md e .json`);
}

main().catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
});
