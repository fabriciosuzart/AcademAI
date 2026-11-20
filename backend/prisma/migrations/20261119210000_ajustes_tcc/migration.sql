-- RF07: validade da senha temporária
ALTER TABLE "User" ADD COLUMN "tempPasswordExpiresAt" DATETIME;

-- RN02: escopo de aprovação do professor ("" = todos os equipamentos)
ALTER TABLE "User" ADD COLUMN "escopoAprovacao" TEXT NOT NULL DEFAULT '';

-- RF16/RN03: índice explícito da consulta de conflito de horário
CREATE INDEX "Appointment_equipmentId_date_status_idx" ON "Appointment"("equipmentId", "date", "status");
