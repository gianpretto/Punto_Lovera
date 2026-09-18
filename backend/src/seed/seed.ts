import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, pool } from '../config/db';
import { auctions, lots, users } from '../db/schema';

async function main() {
  const adminPassword = await bcrypt.hash('admin1234', 10);
  const [admin] = await db
    .insert(users)
    .values({
      email: 'admin@puntolovera.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'Punto Lovera',
      role: 'ADMIN',
      emailVerified: true,
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  const userPassword = await bcrypt.hash('user1234', 10);
  await db
    .insert(users)
    .values({
      email: 'usuario@test.com',
      passwordHash: userPassword,
      firstName: 'Usuario',
      lastName: 'De Prueba',
      role: 'USER',
      emailVerified: true,
      creditBalance: '500000',
    })
    .onConflictDoNothing({ target: users.email });

  if (admin) {
    const [auction] = await db
      .insert(auctions)
      .values({
        title: 'Remate de heladería equipada en Castelar',
        description: 'Local comercial con freezers, vitrina y mobiliario completo.',
        location: 'Castelar, Buenos Aires',
        startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: 'PROXIMA',
        createdById: admin.id,
      })
      .returning();

    await db.insert(lots).values([
      {
        auctionId: auction.id,
        number: 1,
        title: 'Freezer horizontal 4 puertas',
        description: 'Freezer comercial en excelente estado, marca Inelro.',
        startingPrice: '150000',
        currentPrice: '150000',
        bidIncrement: '5000',
      },
      {
        auctionId: auction.id,
        number: 2,
        title: 'Vitrina exhibidora refrigerada',
        description: 'Vitrina de 2 metros con iluminación LED.',
        startingPrice: '90000',
        currentPrice: '90000',
        bidIncrement: '5000',
      },
    ]);

    console.log(`Subasta creada: ${auction.title} (${auction.id})`);
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
