import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    CHUNK_SIZE, limparTexto, fragmentar, caracteresUteis, buscar, cosineSimilarity,
    sourceDoArquivo, nomeDoSource, converterComDocling,
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
