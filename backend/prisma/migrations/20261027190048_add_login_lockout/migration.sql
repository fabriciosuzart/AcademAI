-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ra" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ALUNO',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTempPassword" INTEGER NOT NULL DEFAULT 0,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "trainings" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_User" ("email", "id", "isActive", "isTempPassword", "name", "password", "ra", "role", "trainings") SELECT "email", "id", "isActive", "isTempPassword", "name", "password", "ra", "role", "trainings" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_ra_key" ON "User"("ra");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
