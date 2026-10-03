import bcrypt from 'bcryptjs';
import { db } from '../config/db';
import { auctions, lots, users } from '../db/schema';

/**
 * Datos de ejemplo: admin, usuario de prueba con saldo y datos completos, y
 * una subasta próxima con 2 lotes (solo si el admin no existía). Lo usan el
 * script `npm run seed` y los tests de integración (después de vaciar la base).
 */
export async function seedDatabase() {
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
      // Datos completos: sin esto no puede pujar
      phone: '1155550000',
      dni: '30111222',
      address: 'Av. Rivadavia 1234',
      city: 'Castelar',
      province: 'Buenos Aires',
      zipCode: '1712',
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

    return { createdAuction: auction };
  }

  return { createdAuction: null };
}
