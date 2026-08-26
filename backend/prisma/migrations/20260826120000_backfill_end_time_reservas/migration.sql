-- Reservas criadas antes do seletor de duracao ficaram com endTime nulo.
-- Sem hora de termino a tela repetia o inicio nos dois lados e mostrava
-- "16:00 as 16:00", e a checagem de conflito nao tinha intervalo para comparar.
--
-- Assume 1h, que e a duracao padrao do formulario. O time() do SQLite devolve
-- "HH:MM:SS"; o substr corta de volta para "HH:MM", o formato usado na coluna.
UPDATE "Appointment"
SET "endTime" = substr(time("time" || ':00', '+1 hour'), 1, 5)
WHERE "endTime" IS NULL
  AND "time" IS NOT NULL
  AND length("time") = 5;
