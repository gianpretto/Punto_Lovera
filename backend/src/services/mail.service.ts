import nodemailer from 'nodemailer';
import { env } from '../config/env';

const hasSmtpConfig = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    })
  : null;

async function send(to: string, subject: string, html: string) {
  if (!transporter) {
    // Sin SMTP configurado (típico en desarrollo): logueamos el mail en
    // consola en vez de fallar, así el flujo se puede probar igual.
    console.log(`\n📧 [mail simulado] Para: ${to}\nAsunto: ${subject}\n${html}\n`);
    return;
  }
  await transporter.sendMail({ from: env.smtp.from, to, subject, html });
}

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${env.frontendUrl}/validar-mail?token=${token}`;
  await send(
    to,
    'Confirmá tu cuenta en Punto Lovera',
    `<p>Hacé click para confirmar tu cuenta:</p><p><a href="${link}">${link}</a></p>`
  );
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${env.frontendUrl}/forgot-password?token=${token}`;
  await send(
    to,
    'Recuperar contraseña — Punto Lovera',
    `<p>Hacé click para elegir una contraseña nueva (el link vence en 1 hora):</p><p><a href="${link}">${link}</a></p>`
  );
}
