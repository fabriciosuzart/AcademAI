import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'academai_dev_secret_mude_em_producao';

// 1. Middleware de Autenticação (verifica JWT — RNF05/RN08)
export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded.id;
            return next();
        } catch (err) {
            // Token inválido ou expirado
            return res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
        }
    }

    return res.status(401).json({ error: 'Acesso negado. Autenticação necessária.' });
};

// 2. Middleware de Permissões (verifica a Role no DB)
export const roleMiddleware = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            if (!req.userId) {
                return res.status(401).json({ error: 'Usuário não autenticado no middleware.' });
            }

            const user = await prisma.user.findUnique({
                where: { id: req.userId }
            });

            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado.' });
            }

            if (!user.isActive) {
                return res.status(403).json({ error: 'Conta desativada. Entre em contato com o administrador.' });
            }

            if (!allowedRoles.includes(user.role)) {
                return res.status(403).json({ error: `Acesso negado. Requer permissão: ${allowedRoles.join(' ou ')}` });
            }

            req.userRole = user.role;
            next();
        } catch (error) {
            console.error('Erro no roleMiddleware:', error);
            res.status(500).json({ error: 'Erro interno na validação de permissões.' });
        }
    };
};
