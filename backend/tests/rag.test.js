import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    CHUNK_SIZE, limparTexto, fragmentar, caracteresUteis, buscar, cosineSimilarity,
    sourceDoArquivo, nomeDoSource, converterComDocling, lerTexto, carregarDocumentos, vetorizar,
    VERSAO_INDICE, MODELO_EMBEDDINGS,
} from '../rag.js';

describe('Fragmentação do acervo (rag.js)', () => {
    it('corta em pedaços de CHUNK_SIZE caracteres, sem sobreposição', () => {
        const texto = 'a'.repeat(CHUNK_SIZE * 2 + 10);
        const partes = fragmentar(texto);
        expect(partes.map(p => p.length)).toEqual([CHUNK_SIZE, CHUNK_SIZE, 10]);
        expect(partes.join('')).toBe(texto);
    });

    it('limpa \\r e linhas em branco repetidas', () => {
        expect(limparTexto('a\r\n\n\n  \nb\n')).toBe('a\nb');
    });

    it('conta só caracteres que não são espaço', () => {
        expect(caracteresUteis('  a b\n\tc  ')).toBe(3);
    });

    it('mantém o formato da origem do bloco', () => {
        expect(nomeDoSource(sourceDoArquivo('x.md'))).toBe('x.md');
    });
});

describe('Busca por similaridade (rag.js)', () => {
    const vetores = [
        { source: 'a', vector: [1, 0] },
        { source: 'b', vector: [0.7, 0.7] },
        { source: 'c', vector: [0, 1] },
    ];

    it('ordena do mais para o menos parecido e limita a k', () => {
        const top = buscar([1, 0.1], vetores, 2);
        expect(top.map(r => r.item.source)).toEqual(['a', 'b']);
    });

    it('cosseno de vetores iguais é 1', () => {
        expect(cosineSimilarity([3, 4], [3, 4])).toBeCloseTo(1);
    });
});

describe('Conversão pelo Docling (rag.js → converter.py)', () => {
    it('recusa formato que o Docling não converte, sem gravar saída', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'academai-teste-'));
        const entrada = path.join(dir, 'nota.txt');
        const saida = path.join(dir, 'nota.md');
        fs.writeFileSync(entrada, 'texto');
        const r = await converterComDocling(entrada, saida);
        expect(r.status).toBe('ERRO');
        expect(r.motivo).toBeTruthy();
        expect(fs.existsSync(saida)).toBe(false);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

describe('Leitura do acervo e índice (rag.js)', () => {
    let dir;
    beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'academai-acervo-')); });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('lê MD e TXT direto', async () => {
        fs.writeFileSync(path.join(dir, 'a.md'), '# Regras');
        fs.writeFileSync(path.join(dir, 'b.txt'), 'texto');
        expect(await lerTexto(path.join(dir, 'a.md'))).toBe('# Regras');
        expect(await lerTexto(path.join(dir, 'b.txt'))).toBe('texto');
    });

    it('PDF colocado à mão passa pelo Docling; sem ele, é pulado sem derrubar a carga', async () => {
        fs.writeFileSync(path.join(dir, 'a.md'), 'conteúdo válido do acervo');
        fs.writeFileSync(path.join(dir, 'manual.pdf'), '%PDF-1.4 falso');
        await expect(lerTexto(path.join(dir, 'manual.pdf'))).rejects.toThrow(/Docling/);
        const blocos = await carregarDocumentos(dir, { silencioso: true });
        expect(blocos.map((b) => nomeDoSource(b.source))).toEqual(['a.md']);
    });

    it('vetoriza com o embedder recebido e pula bloco que falha', async () => {
        const embedder = async (texto) => {
            if (texto === 'ruim') throw new Error('falhou');
            return { data: Float32Array.from([texto.length, 1]) };
        };
        const v = await vetorizar(embedder, [{ source: 's', text: 'abc' }, { source: 's', text: 'ruim' }], { progresso: false });
        expect(v).toHaveLength(1);
        expect(Array.from(v[0].vector)).toEqual([3, 1]);
    });

    it('identifica modelo, quantização e versão da biblioteca no índice', () => {
        expect(VERSAO_INDICE).toMatch(new RegExp(`^${MODELO_EMBEDDINGS}\\|q8\\|transformers@4\\.`));
    });
});
