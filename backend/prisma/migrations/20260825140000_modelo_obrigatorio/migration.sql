-- Torna Equipment.modelo obrigatorio, depois do backfill.
-- O SQLite nao tem ALTER COLUMN, entao a tabela e recriada. As reservas
-- apontam para Equipment.id, e os ids sao preservados na copia.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Equipment" (
    "id"          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name"        TEXT NOT NULL,
    "modelo"      TEXT NOT NULL,
    "description" TEXT,
    "imagePath"   TEXT,
    "status"      TEXT NOT NULL DEFAULT 'DISPONIVEL'
);

INSERT INTO "new_Equipment" ("id", "name", "modelo", "description", "imagePath", "status")
SELECT "id", "name", COALESCE("modelo", "name"), "description", "imagePath", "status" FROM "Equipment";

DROP TABLE "Equipment";
ALTER TABLE "new_Equipment" RENAME TO "Equipment";

PRAGMA foreign_keys=ON;
