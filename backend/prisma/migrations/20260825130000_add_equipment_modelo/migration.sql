-- Campo 'modelo': o nome do grupo a que a unidade pertence.
-- Entra opcional para o backfill em Node poder preencher os registros
-- existentes; a migration seguinte o torna obrigatorio.
ALTER TABLE "Equipment" ADD COLUMN "modelo" TEXT;
