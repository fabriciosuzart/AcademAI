import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Cadastros reais do laboratorio, recuperados do historico do git depois que o
// .db saiu do versionamento. Existe para um clone novo nao nascer com o banco
// vazio, que era o que acontecia antes.
//
// As senhas NAO sao os hashes originais: todas as contas entram com a senha
// padrao de desenvolvimento, a mesma ja documentada em contas_teste.md. O hash
// bcrypt protege, mas nao e cofre — quem o tem pode testar senhas offline sem
// limite, e nao ha motivo para publicar no repositorio o hash de uma senha que
// alguem escolheu e pode reusar em outro lugar.
//
// Reservas ficam de fora de proposito: sao dado transacional e poluiriam um
// ambiente novo. O historico delas segue recuperavel pelo git.
//
// ATENCAO: o campo status dos equipamentos vem com tres grafias diferentes
// ("DISPONIVEL", "available", "in-use"), preservadas como estavam no banco. O
// filtro de /equipamentos compara por igualdade exata contra DISPONIVEL/EM USO/
// MANUTENCAO, entao hoje ele nao casa com boa parte dos registros. E um bug
// anterior a este arquivo; padronizar o vocabulario merece mudanca propria.

const SENHA_PADRAO = 'senha123';

const usuarios = [
    {"name":"Fabricio Suzart Andrade","email":"fa215446@alunos.unisanta.br","ra":"215446","role":"ADMIN","isActive":true,"trainings":""},
    {"name":"Juliana Pallin","email":"ja214707@alunos.unisanta.br","ra":"214707","role":"ALUNO","isActive":true,"trainings":"Cortadora a Laser,Prototipadora,Impressora 3D Bambu LAB"},
    {"name":"Administrador Geral","email":"admin@academai.com","ra":"ADMIN001","role":"ADMIN","isActive":true,"trainings":""},
    {"name":"Professor Responsável","email":"prof@academai.com","ra":"PROF001","role":"PROFESSOR","isActive":true,"trainings":""},
    {"name":"Aluno 1","email":"aluno1@academai.com","ra":"ALU001","role":"ALUNO","isActive":true,"trainings":""},
    {"name":"Aluno 2","email":"aluno2@academai.com","ra":"ALU002","role":"ALUNO","isActive":true,"trainings":""}
];

const equipamentos = [
    {"id":1,"name":"Impressora 3D Finder","description":"{\"specs\":\"\",\"description\":\"teste 123\",\"requiresTraining\":false}","imagePath":"/uploads/impressora_3D_finder_02.jpg","status":"DISPONÍVEL"},
    {"id":3,"name":"Cortadora a Laser","description":"{\"specs\":\"\",\"description\":\"\",\"requiresTraining\":false}","imagePath":"/uploads/cortadora_a_laser.jpeg","status":"DISPONÍVEL"},
    {"id":4,"name":"Prototipadora","description":null,"imagePath":"/uploads/prototipadora.png","status":"in-use"},
    {"id":5,"name":"Bambu Lab A1","description":null,"imagePath":"/uploads/Bambu_LAB_01.png","status":"available"},
    {"id":6,"name":"Bambu Lab A2","description":null,"imagePath":"/uploads/Bambu_LAB_02.png","status":"available"},
    {"id":7,"name":"Micro Retífica","description":"{\"specs\":\"\",\"description\":\"\",\"requiresTraining\":false}","imagePath":"/uploads/micro_retífica.jpg","status":"DISPONÍVEL"},
    {"id":8,"name":"Plotter de Recorte","description":null,"imagePath":"/uploads/plotter_de_recorte.jpg","status":"in-use"},
    {"id":9,"name":"X1 Carbon Combo","description":null,"imagePath":"/uploads/X1_CARBON_COMBO_IMPRESSORA_3D.jpg","status":"available"},
    {"id":10,"name":"Estação de Solda 01","description":null,"imagePath":"/uploads/ESTACAO_DE_SOLDA.jpg","status":"available"},
    {"id":11,"name":"Estação de Solda 02","description":null,"imagePath":"/uploads/ESTACAO_DE_SOLDA.jpg","status":"available"},
    {"id":12,"name":"Furadeira de Bancada","description":null,"imagePath":"/uploads/furadeira_de_bancada.jpg","status":"in-use"},
    {"id":13,"name":"Serra Tico-Tico","description":null,"imagePath":"/uploads/Serra_tico-tico_bosch.jpg","status":"in-use"},
    {"id":14,"name":"Máquina de Costura","description":null,"imagePath":"/uploads/maquina_de_costura.jpg","status":"available"},
    {"id":15,"name":"Parafusadeira","description":null,"imagePath":"/uploads/Parafusadeira_e_Furadeira_Bateria.jpg","status":"available"},
    {"id":16,"name":"Lixadeira Portátil","description":null,"imagePath":"/uploads/Lixadeira_portátil_DEWALT.jpg","status":"available"}
];

const horariosBloqueados = [];

export async function semearCadastros() {
    console.log('🌱 Semeando cadastros do laboratorio...');
    const senhaHash = await bcrypt.hash(SENHA_PADRAO, 8);

    // upsert por chave unica: rodar duas vezes nao duplica nada.
    for (const u of usuarios) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: { name: u.name, ra: u.ra, role: u.role, isActive: u.isActive, trainings: u.trainings },
            create: { ...u, password: senhaHash }
        });
    }
    console.log(`   ${usuarios.length} usuarios`);

    for (const e of equipamentos) {
        await prisma.equipment.upsert({ where: { id: e.id }, update: e, create: e });
    }
    console.log(`   ${equipamentos.length} equipamentos`);

    for (const b of horariosBloqueados) {
        const existe = await prisma.blockedDate.findFirst({
            where: { date: b.date, equipmentId: b.equipmentId }
        });
        if (!existe) await prisma.blockedDate.create({ data: b });
    }
    console.log(`   ${horariosBloqueados.length} horarios bloqueados`);

    console.log('🎉 Cadastros semeados. Senha de todas as contas: ' + SENHA_PADRAO);
}

// Permite rodar direto: node prisma/seed-cadastros.js
// O encadeamento com `&&` no package.json nao funciona — o executor de seed do
// Prisma nao passa o comando por um shell, entao so o primeiro script rodava.
const executadoDireto = process.argv[1] && process.argv[1].endsWith('seed-cadastros.js');
if (executadoDireto) {
    semearCadastros()
        .catch(e => { console.error('Erro no seed de cadastros:', e); process.exit(1); })
        .finally(async () => { await prisma.$disconnect(); });
}
