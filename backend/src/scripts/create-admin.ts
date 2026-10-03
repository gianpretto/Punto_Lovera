import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from '../config/db';
import { users } from '../db/schema';

// Crea (o promueve) un usuario ADMIN en la base a la que apunta DATABASE_URL.
// Pensado para producción, donde no se corre el seed de prueba:
//
//   ADMIN_EMAIL=vos@mail.com ADMIN_PASSWORD='una-clave-larga' npm run create-admin
//
// Opcional: ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_ROLE=MARTILLERO.
// Si el mail ya existe, le cambia el rol (y la contraseña si se pasa una).

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const role = (process.env.ADMIN_ROLE ?? 'ADMIN') as 'ADMIN' | 'MARTILLERO';
  if (!email) throw new Error('Falta ADMIN_EMAIL');
  if (!['ADMIN', 'MARTILLERO'].includes(role)) throw new Error('ADMIN_ROLE tiene que ser ADMIN o MARTILLERO');

  const [existing] = await db.select().from(users).where(eq(users.email, email));

  if (existing) {
    if (password && password.length < 8) throw new Error('ADMIN_PASSWORD tiene que tener al menos 8 caracteres');
    await db
      .update(users)
      .set({
        role,
        emailVerified: true,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    console.log(`${email} ahora es ${role}${password ? ' (contraseña actualizada)' : ''}`);
  } else {
    if (!password || password.length < 8) throw new Error('ADMIN_PASSWORD es obligatoria (mínimo 8 caracteres)');
    await db.insert(users).values({
      email,
      passwordHash: await bcrypt.hash(password, 10),
      firstName: process.env.ADMIN_FIRST_NAME ?? 'Admin',
      lastName: process.env.ADMIN_LAST_NAME ?? 'Punto Lovera',
      role,
      emailVerified: true,
    });
    console.log(`Usuario ${role} creado: ${email}`);
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
