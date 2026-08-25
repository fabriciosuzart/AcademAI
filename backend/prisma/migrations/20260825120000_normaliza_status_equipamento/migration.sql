-- Vocabulário único de status de equipamento.
--
-- O banco tinha três grafias convivendo na mesma coluna ("DISPONÍVEL",
-- "available", "in-use"), escritas por caminhos diferentes do código. Como
-- boa parte do front comparava por igualdade exata, o filtro de /equipamentos
-- escondia máquinas disponíveis e /disponibilidade pintava de vermelho quem
-- estava livre.
--
-- As grafias são listadas explicitamente de propósito: UPPER() no SQLite não
-- trata caractere acentuado, então UPPER('DISPONÍVEL') não normalizaria o Í.

UPDATE "Equipment" SET "status" = 'DISPONIVEL'
 WHERE "status" IN ('DISPONÍVEL', 'Disponível', 'disponível', 'DISPONIVEL', 'disponivel', 'available', 'AVAILABLE', 'Available');

UPDATE "Equipment" SET "status" = 'EM_USO'
 WHERE "status" IN ('EM USO', 'Em Uso', 'em uso', 'EM_USO', 'in-use', 'IN-USE', 'In-Use', 'in use', 'IN USE', 'INUSE');

UPDATE "Equipment" SET "status" = 'MANUTENCAO'
 WHERE "status" IN ('MANUTENÇÃO', 'Manutenção', 'manutenção', 'MANUTENCAO', 'manutencao', 'maintenance', 'MAINTENANCE', 'Maintenance');
