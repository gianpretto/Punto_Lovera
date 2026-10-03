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

const pesos = (n: number) => `$${n.toLocaleString('es-AR')}`;

export async function sendVoucherApprovedEmail(to: string, amount: number) {
  const link = `${env.frontendUrl}/creditos`;
  await send(
    to,
    'Tu comprobante fue aprobado — Punto Lovera',
    `<p>Acreditamos ${pesos(amount)} en tu cuenta. Ya podés usarlos para pujar.</p><p><a href="${link}">Ver mi crédito</a></p>`
  );
}

export async function sendVoucherRejectedEmail(to: string, amount: number, reason: string) {
  const link = `${env.frontendUrl}/creditos`;
  await send(
    to,
    'Tu comprobante fue rechazado — Punto Lovera',
    `<p>No pudimos acreditar el comprobante por ${pesos(amount)}.</p><p>Motivo: ${reason
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</p><p>Podés volver a cargarlo en <a href="${link}">${link}</a>.</p>`
  );
}

// Texto que escribió un admin: se escapa antes de meterlo en el HTML del mail
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function sendWithdrawalApprovedEmail(to: string, amount: number) {
  const link = `${env.frontendUrl}/creditos`;
  await send(
    to,
    'Tu reintegro fue aprobado — Punto Lovera',
    `<p>Te transferimos ${pesos(amount)} a la cuenta que nos indicaste y lo descontamos de tu crédito.</p><p><a href="${link}">Ver mi crédito</a></p>`
  );
}

export async function sendWithdrawalRejectedEmail(to: string, amount: number, reason: string) {
  const link = `${env.frontendUrl}/creditos`;
  await send(
    to,
    'Tu reintegro fue rechazado — Punto Lovera',
    `<p>No pudimos procesar tu pedido de reintegro por ${pesos(amount)}. El monto vuelve a estar disponible en tu crédito.</p><p>Motivo: ${escapeHtml(reason)}</p><p>Podés volver a pedirlo en <a href="${link}">${link}</a>.</p>`
  );
}
