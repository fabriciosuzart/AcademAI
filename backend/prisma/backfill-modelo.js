/**
 * Preenche Equipment.modelo nos registros que existiam antes do campo.
 *
 * Este arquivo é o único lugar do projeto onde a regex de agrupamento por nome
 * ainda roda — e ela roda uma vez só. Antes do campo `modelo`, essa mesma
 * expressão estava copiada em sete pontos (três telas do front e quatro
 * trechos do server.js), inclusive na rota que decide quais unidades apagar.
 * Ela é frágil por natureza: um "Arduino Uno R3" viraria "Arduino Uno R".
 *
 * O SQLite não tem REGEXP, por isso o preenchimento é aqui e não no .sql.
 *
 * Uso: node prisma/backfill-modelo.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Remove o sufixo de unidade: "Bambu Lab A1" -> "Bambu Lab". */
function nomeBase(nome) {
    return nome.replace(/\s*(0\d|A\d|\d+)$/i, '').trim();
}

async function backfill() {
    const equipamentos = await prisma.equipment.findMany({ orderBy: { id: 'asc' } });
    let preenchidos = 0;

    for (const eq of equipamentos) {
        if (eq.modelo) continue;
        const modelo = nomeBase(eq.name) || eq.name;
        await prisma.equipment.update({ where: { id: eq.id }, data: { modelo } });
        console.log(`  ${String(eq.id).padStart(3)}  ${eq.name.padEnd(28)} -> ${modelo}`);
        preenchidos++;
    }

    const pendentes = await prisma.equipment.count({ where: { modelo: null } });
    console.log(`\n${preenchidos} registro(s) preenchido(s). Sem modelo: ${pendentes}.`);
    if (pendentes > 0) {
        throw new Error('Restaram equipamentos sem modelo — a migration que torna a coluna obrigatória vai falhar.');
    }
}

backfill()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
