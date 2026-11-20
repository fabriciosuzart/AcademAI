// Metadados do acervo documental: versão (RN11) e nível de acesso (RN12/RNF16).
//
// Os arquivos do acervo ficam em documents/ com nome gerado no upload. Este
// módulo guarda, em acervo.json (fora de documents/, para não virar documento),
// o nome original, a versão, quem enviou, o hash e quem pode ler cada arquivo.
// Arquivos sem entrada — como a base inicial versionada no git — valem para todos.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ARQUIVO_ACERVO = process.env.ACERVO_ARQUIVO || path.join(__dirname, 'acervo.json');

/** Níveis de acesso, do mais aberto ao mais restrito. */
export const NIVEIS_ACESSO = ['todos', 'professores', 'administradores'];

export const ROTULOS_ACESSO = {
    todos: 'Todos os usuários',
    professores: 'Professores e administradores',
    administradores: 'Somente administradores',
};

export function lerAcervo(arquivo = ARQUIVO_ACERVO) {
    try {
        if (!fs.existsSync(arquivo)) return {};
        const dados = JSON.parse(fs.readFileSync(arquivo, 'utf-8'));
        return dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
    } catch (e) {
        console.warn(`⚠️ Não consegui ler ${arquivo}: ${e.message}. Todos os documentos ficam abertos a todos.`);
        return {};
    }
}

export function salvarAcervo(meta, arquivo = ARQUIVO_ACERVO) {
    fs.writeFileSync(arquivo, JSON.stringify(meta, null, 2), 'utf-8');
}

/** Normaliza o nível vindo do formulário; desconhecido vira "todos". */
export const normalizarAcesso = (valor) => (NIVEIS_ACESSO.includes(valor) ? valor : 'todos');

/** true se um usuário com este papel (ou visitante, papel nulo) pode ler um documento com este nível. */
export function podeAcessar(acesso, papel) {
    const nivel = normalizarAcesso(acesso);
    if (nivel === 'todos') return true;
    if (nivel === 'professores') return papel === 'PROFESSOR' || papel === 'ADMIN';
    return papel === 'ADMIN';
}

/** Nível de acesso de um arquivo de documents/. */
export const acessoDoArquivo = (meta, nome) => normalizarAcesso(meta?.[nome]?.acesso);

/** Fragmentos que o papel pode usar no RAG; `nomeDoSource` extrai o arquivo da origem do bloco. */
export function filtrarPorAcesso(vetores, meta, papel, nomeDoSource) {
    return vetores.filter((v) => podeAcessar(acessoDoArquivo(meta, nomeDoSource(v.source)), papel));
}

/** Nome mostrado ao usuário na fonte: o original enviado, ou o próprio arquivo. */
export const rotuloDoArquivo = (meta, nome) => meta?.[nome]?.original || nome;

/**
 * Arquivo atual do acervo com o mesmo nome original (RN11: enviar de novo é
 * substituir). Devolve [nomeNoDisco, entrada] ou null.
 */
export function versaoVigente(meta, original) {
    const alvo = String(original ?? '').trim().toLowerCase();
    if (!alvo) return null;
    return Object.entries(meta).find(([, e]) => String(e.original ?? '').trim().toLowerCase() === alvo) ?? null;
}
