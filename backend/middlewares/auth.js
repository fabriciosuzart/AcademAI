import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = 'sua_chave_secreta_super_segura';

// 1. Middleware de Autenticação (verifica JWT ou fallback X-User-Id)
export const authMiddleware = (req, res, next) => {
    // Tenta verificar o token JWT primeiro
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

    // Fallback: X-User-Id (compatibilidade)
    const userId = req.headers['x-user-id'];
    if (userId) {
        req.userId = parseInt(userId);
        return next();
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
