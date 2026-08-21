import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { semearCadastros } from './seed-cadastros.js';

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Iniciando o Seed do Banco de Dados...");

    const passwordHash = await bcrypt.hash("senha123", 8);

    const usersToCreate = [
        {
            name: "Administrador Geral",
            email: "admin@academai.com",
            ra: "ADMIN001",
            password: passwordHash,
            role: "ADMIN",
            isActive: true,
            isTempPassword: 0
        },
        {
            name: "Professor Responsável",
            email: "prof@academai.com",
            ra: "PROF001",
            password: passwordHash,
            role: "PROFESSOR",
            isActive: true,
            isTempPassword: 0
        },
        {
            name: "Aluno 1",
            email: "aluno1@academai.com",
            ra: "ALU001",
            password: passwordHash,
            role: "ALUNO",
            isActive: true,
            isTempPassword: 0
        },
        {
            name: "Aluno 2",
            email: "aluno2@academai.com",
            ra: "ALU002",
            password: passwordHash,
            role: "ALUNO",
            isActive: true,
            isTempPassword: 0
        }
    ];

    for (const u of usersToCreate) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: u,
        });
        console.log(`✅ Usuário ${u.role} (${u.email}) verificado/criado.`);
    }

    await semearCadastros();

    console.log("🎉 Seed concluído com sucesso!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
