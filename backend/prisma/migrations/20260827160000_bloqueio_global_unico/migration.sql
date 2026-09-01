-- Impede dois bloqueios GLOBAIS na mesma data.
--
-- O indice @@unique([date, equipmentId]) do schema nunca valeu para eles: no
-- SQL padrao dois NULL nao sao "iguais", entao o SQLite aceita quantas linhas
-- (data, NULL) quiserem. Bloqueio de equipamento sempre foi protegido; so o
-- global ficava de fora, e o P2002 da rota nunca disparava para ele.
--
-- O Prisma nao modela indice parcial (@@unique nao tem clausula WHERE), entao
-- este indice vive aqui, na migration, e nao aparece no schema.prisma. Isso e
-- proposital e nao e drift: `prisma migrate diff` entre um banco com ele e o
-- schema devolve migration vazia, ou seja, `migrate dev` nao tenta remove-lo.

-- 1. Deduplicar antes de indexar. Sem isto, o CREATE UNIQUE INDEX falha com
--    "UNIQUE constraint failed" em qualquer banco que ja tenha repetidas, e a
--    migration trava no meio. Fica a mais antiga de cada data, que e a que o
--    codigo ja usava na pratica (a busca pega a primeira).
DELETE FROM "BlockedDate"
WHERE "equipmentId" IS NULL
  AND "id" NOT IN (
      SELECT MIN("id")
      FROM "BlockedDate"
      WHERE "equipmentId" IS NULL
      GROUP BY "date"
  );

-- 2. O indice parcial cobre exatamente a lacuna: so as linhas globais. Bloqueio
--    global e bloqueio de equipamento na mesma data continuam podendo conviver,
--    porque sao coisas diferentes.
CREATE UNIQUE INDEX "BlockedDate_date_global_key"
    ON "BlockedDate"("date")
    WHERE "equipmentId" IS NULL;
