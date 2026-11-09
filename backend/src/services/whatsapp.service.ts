import { env } from '../config/env';

/**
 * Manda el código de verificación del celular por WhatsApp, con la API de
 * WhatsApp Cloud de Meta (graph.facebook.com). Usa una plantilla de categoría
 * "Autenticación" (las únicas que Meta deja mandar sin que el usuario haya
 * escrito antes): el cuerpo lleva el código y el botón "Copiar código" también.
 *
 * Sin WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID (desarrollo) el código solo
 * se escribe en los logs, igual que los mails sin SMTP.
 */

const hasConfig = Boolean(env.whatsapp.token && env.whatsapp.phoneNumberId);

/** numero: 10 dígitos (área sin 0 + número sin 15). WhatsApp en AR usa +54 9. */
export async function sendPhoneCode(areaYNumero: string, code: string) {
  const to = `549${areaYNumero}`;
  if (!hasConfig) {
    console.log(`\n📱 [WhatsApp simulado] Para: +${to} — código de verificación: ${code}\n`);
    return;
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${env.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.whatsapp.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: env.whatsapp.template,
        language: { code: env.whatsapp.templateLang },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error('WhatsApp respondió', res.status, await res.text().catch(() => ''));
    throw new Error('No se pudo enviar el código por WhatsApp');
  }
}
