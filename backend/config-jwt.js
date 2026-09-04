// backend/config-jwt.js — origem unica do segredo do JWT (RN08/RNF05).
//
// Antes server.js e middlewares/auth.js declaravam, cada um, um fallback fixo
// e publico ('academai_dev_secret_mude_em_producao'). Sem a env var qualquer
// um que lesse o codigo forjava tokens de admin. Alem disso, dois modulos com
// o mesmo literal so "por sorte" batiam — mudar um quebraria a verificacao.
//
// Resolucao unica, importada pelos dois lados:
//   1. process.env.JWT_SECRET, se definido (producao);
//   2. senao, um segredo aleatorio persistido em backend/.jwt-secret
//      (gitignored, exclusivo da maquina) — preserva o "roda local sem config"
//      sem nunca cair num valor conhecido.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolverSegredoJWT() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    const caminho = path.join(__dirname, '.jwt-secret');
    try {
        const existente = fs.readFileSync(caminho, 'utf8').trim();
        if (existente) return existente;
    } catch { /* arquivo ainda nao existe: gera abaixo */ }
    const novo = crypto.randomBytes(48).toString('hex');
    try {
        fs.writeFileSync(caminho, novo, { mode: 0o600 });
        console.warn('🔐 JWT_SECRET nao definido: segredo aleatorio gerado em backend/.jwt-secret (defina JWT_SECRET em producao).');
    } catch {
        console.warn('🔐 JWT_SECRET nao definido e nao foi possivel persistir o segredo; usando um efemero (sessoes caem no restart).');
    }
    return novo;
}

export const JWT_SECRET = resolverSegredoJWT();
