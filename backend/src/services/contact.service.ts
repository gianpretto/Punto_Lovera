import { db } from '../config/db';
import { contactMessages } from '../db/schema';
import { env } from '../config/env';
import { sendContactNotification } from './mail.service';

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  message: string;
  source?: string;
}

/** Guarda la consulta y avisa por mail al equipo (si el mail falla, la consulta queda guardada). */
export async function createContactMessage(input: ContactInput) {
  const [row] = await db.insert(contactMessages).values(input).returning();
  try {
    await sendContactNotification(env.contactEmail, input);
  } catch (err) {
    console.error('No se pudo enviar el aviso de la consulta de contacto:', err);
  }
  return row;
}
