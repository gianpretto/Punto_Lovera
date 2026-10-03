import 'dotenv/config';
import { pool } from '../config/db';
import { seedDatabase } from './seed-data';

async function main() {
  const { createdAuction } = await seedDatabase();

  if (createdAuction) {
    console.log(`Subasta creada: ${createdAuction.title} (${createdAuction.id})`);
  } else {
    console.log('El admin ya existía, no se recrea la subasta de ejemplo.');
  }

  console.log('Seed listo:');
  console.log('  Admin: admin@puntolovera.com / admin1234');
  console.log('  Usuario de prueba: usuario@test.com / user1234 (saldo $500.000)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
