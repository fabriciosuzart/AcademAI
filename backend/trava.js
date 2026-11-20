// Trava em memória por chave (RF16/RN03).
//
// O backend roda em um único processo Node.js, e o SQLite aceita uma escrita por
// vez. Mesmo assim, "conferir conflito" e "gravar a reserva" são duas consultas:
// dois pedidos simultâneos podiam passar pela conferência antes de qualquer um
// gravar. A trava enfileira quem usa a mesma chave, de modo que a conferência e
// a gravação de um pedido terminam antes de o próximo começar. A transação do
// Prisma (reservas.js) garante o tudo-ou-nada dentro de cada pedido.
//
// Se um dia houver mais de um processo (ex.: PostgreSQL com várias instâncias),
// a trava precisa ir para o banco (SELECT ... FOR UPDATE ou restrição de exclusão).

const filas = new Map();

/** Executa `fn` com exclusividade para `chave`; devolve o que `fn` devolver. */
export async function comTrava(chave, fn) {
    const anterior = filas.get(chave) ?? Promise.resolve();
    let liberar;
    const minha = new Promise((resolve) => { liberar = resolve; });
    const cauda = anterior.then(() => minha);
    filas.set(chave, cauda);
    await anterior;
    try {
        return await fn();
    } finally {
        liberar();
        if (filas.get(chave) === cauda) filas.delete(chave);
    }
}

/** Quantas chaves têm fila ativa (usado nos testes). */
export const travasAtivas = () => filas.size;
