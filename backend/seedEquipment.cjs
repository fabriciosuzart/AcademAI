const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const equipamentosData = [
  { id: 1, name: 'Impressora 3D Finder 01', status: 'available', imagePath: '/uploads/impressora_3D_finder_01.jpg' },
  { id: 2, name: 'Impressora 3D Finder 02', status: 'available', imagePath: '/uploads/impressora_3D_finder_02.jpg' },
  { id: 3, name: 'Cortadora a Laser', status: 'in-use', imagePath: '/uploads/cortadora_a_laser.jpeg' },
  { id: 4, name: 'Prototipadora', status: 'in-use', imagePath: '/uploads/prototipadora.png' },
  { id: 5, name: 'Bambu Lab A1', status: 'available', imagePath: '/uploads/Bambu_LAB_01.png' },
  { id: 6, name: 'Bambu Lab A2', status: 'available', imagePath: '/uploads/Bambu_LAB_02.png' },
  { id: 7, name: 'Micro Retífica', status: 'available', imagePath: '/uploads/micro_retífica.jpg' },
  { id: 8, name: 'Plotter de Recorte', status: 'in-use', imagePath: '/uploads/plotter_de_recorte.jpg' },
  { id: 9, name: 'X1 Carbon Combo', status: 'available', imagePath: '/uploads/X1_CARBON_COMBO_IMPRESSORA_3D.jpg' },
  { id: 10, name: 'Estação de Solda 01', status: 'available', imagePath: '/uploads/ESTACAO_DE_SOLDA.jpg' },
  { id: 11, name: 'Estação de Solda 02', status: 'available', imagePath: '/uploads/ESTACAO_DE_SOLDA.jpg' },
  { id: 12, name: 'Furadeira de Bancada', status: 'in-use', imagePath: '/uploads/furadeira_de_bancada.jpg' },
  { id: 13, name: 'Serra Tico-Tico', status: 'in-use', imagePath: '/uploads/Serra_tico-tico_bosch.jpg' },
  { id: 14, name: 'Máquina de Costura', status: 'available', imagePath: '/uploads/maquina_de_costura.jpg' },
  { id: 15, name: 'Parafusadeira', status: 'available', imagePath: '/uploads/Parafusadeira_e_Furadeira_Bateria.jpg' },
  { id: 16, name: 'Lixadeira Portátil', status: 'available', imagePath: '/uploads/Lixadeira_portátil_DEWALT.jpg' },
];

async function main() {
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
