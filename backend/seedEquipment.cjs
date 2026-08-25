const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

// As imagens dos equipamentos são conteúdo de seed e ficam versionadas em
// seed-assets/. A pasta uploads/ é de runtime e está no .gitignore, então
// copiamos para lá no seed — assim as URLs /uploads/... continuam valendo.
const SEED_ASSETS = path.join(__dirname, 'seed-assets');
const UPLOADS = path.join(__dirname, 'uploads');

function copiarImagensDoSeed() {
  if (!fs.existsSync(SEED_ASSETS)) {
    console.warn('⚠️ Pasta seed-assets/ não encontrada — equipamentos ficarão sem imagem.');
    return;
  }
  fs.mkdirSync(UPLOADS, { recursive: true });
  let copiadas = 0;
  for (const arquivo of fs.readdirSync(SEED_ASSETS)) {
    fs.copyFileSync(path.join(SEED_ASSETS, arquivo), path.join(UPLOADS, arquivo));
    copiadas++;
  }
  console.log(`🖼️  ${copiadas} imagens copiadas para uploads/.`);
}

const equipamentosData = [
  { id: 1, name: 'Impressora 3D Finder 01', modelo: 'Impressora 3D Finder', status: 'DISPONIVEL', imagePath: '/uploads/impressora_3D_finder_01.jpg' },
  { id: 2, name: 'Impressora 3D Finder 02', modelo: 'Impressora 3D Finder', status: 'DISPONIVEL', imagePath: '/uploads/impressora_3D_finder_02.jpg' },
  { id: 3, name: 'Cortadora a Laser', modelo: 'Cortadora a Laser', status: 'EM_USO', imagePath: '/uploads/cortadora_a_laser.jpeg' },
  { id: 4, name: 'Prototipadora', modelo: 'Prototipadora', status: 'EM_USO', imagePath: '/uploads/prototipadora.png' },
  { id: 5, name: 'Bambu Lab A1', modelo: 'Bambu Lab', status: 'DISPONIVEL', imagePath: '/uploads/Bambu_LAB_01.png' },
  { id: 6, name: 'Bambu Lab A2', modelo: 'Bambu Lab', status: 'DISPONIVEL', imagePath: '/uploads/Bambu_LAB_02.png' },
  { id: 7, name: 'Micro Retífica', modelo: 'Micro Retífica', status: 'DISPONIVEL', imagePath: '/uploads/micro_retífica.jpg' },
  { id: 8, name: 'Plotter de Recorte', modelo: 'Plotter de Recorte', status: 'EM_USO', imagePath: '/uploads/plotter_de_recorte.jpg' },
  { id: 9, name: 'X1 Carbon Combo', modelo: 'X1 Carbon Combo', status: 'DISPONIVEL', imagePath: '/uploads/X1_CARBON_COMBO_IMPRESSORA_3D.jpg' },
  { id: 10, name: 'Estação de Solda 01', modelo: 'Estação de Solda', status: 'DISPONIVEL', imagePath: '/uploads/ESTACAO_DE_SOLDA.jpg' },
  { id: 11, name: 'Estação de Solda 02', modelo: 'Estação de Solda', status: 'DISPONIVEL', imagePath: '/uploads/ESTACAO_DE_SOLDA.jpg' },
  { id: 12, name: 'Furadeira de Bancada', modelo: 'Furadeira de Bancada', status: 'EM_USO', imagePath: '/uploads/furadeira_de_bancada.jpg' },
  { id: 13, name: 'Serra Tico-Tico', modelo: 'Serra Tico-Tico', status: 'EM_USO', imagePath: '/uploads/Serra_tico-tico_bosch.jpg' },
  { id: 14, name: 'Máquina de Costura', modelo: 'Máquina de Costura', status: 'DISPONIVEL', imagePath: '/uploads/maquina_de_costura.jpg' },
  { id: 15, name: 'Parafusadeira', modelo: 'Parafusadeira', status: 'DISPONIVEL', imagePath: '/uploads/Parafusadeira_e_Furadeira_Bateria.jpg' },
  { id: 16, name: 'Lixadeira Portátil', modelo: 'Lixadeira Portátil', status: 'DISPONIVEL', imagePath: '/uploads/Lixadeira_portátil_DEWALT.jpg' },
];

async function main() {
  copiarImagensDoSeed();
  await prisma.equipment.deleteMany();
  for (const eq of equipamentosData) {
    await prisma.equipment.create({
      data: {
        id: eq.id,
        name: eq.name,
        status: eq.status,
        imagePath: eq.imagePath,
      }
    });
  }
  console.log('Seed completed.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
