// Contenido de "Cómo participar" y "Preguntas frecuentes".
//
// BORRADOR armado a partir de cómo funciona el sistema hoy (registro,
// verificación, datos, crédito con reserva, pases de invitado). Validar los
// textos con el cliente; las respuestas de venta/comisiones son las que ya
// tenía el diseño original.

export interface Faq {
  pregunta: string;
  respuesta: string;
}

export const preguntasFrecuentes: Faq[] = [
  {
    pregunta: '¿Cómo participa uno en una subasta?',
    respuesta:
      'Registrate, verificá tu mail, completá tus datos personales y cargá crédito. Con eso ya podés ingresar al remate en vivo y ofertar.',
  },
  {
    pregunta: '¿Puedo vender mi local a través de la plataforma?',
    respuesta: 'Sí, podés crear un aviso de venta y coordinar la subasta con un asesor.',
  },
  {
    pregunta: '¿Qué comisiones aplica la plataforma?',
    respuesta: 'Las comisiones se detallan en los términos y condiciones.',
  },
  {
    pregunta: '¿Cómo cargo crédito para ofertar?',
    respuesta:
      'Transferí a la cuenta que figura en "Crédito disponible" y subí el comprobante indicando el monto. Lo revisamos, lo acreditamos y te avisamos por mail.',
  },
  {
    pregunta: '¿Qué pasa con mi crédito cuando oferto?',
    respuesta:
      'Mientras vas ganando un lote, el monto de tu oferta queda reservado como garantía. Si alguien te supera, se libera al instante. Si ganás, se descuenta de tu saldo y la compra aparece en "Mis compras".',
  },
  {
    pregunta: '¿Puedo mirar un remate sin tener cuenta?',
    respuesta:
      'Sí, si el martillero te comparte un link de invitado. Con ese link ves el video y el chat en vivo, pero para ofertar necesitás tu propia cuenta.',
  },
  {
    pregunta: '¿Por qué no puedo ofertar?',
    respuesta:
      'Para ofertar necesitás tener tus datos personales completos y crédito disponible suficiente. Además, solo se puede ofertar por el lote que el martillero tiene en remate en ese momento.',
  },
];

export interface Paso {
  titulo: string;
  desc: string;
}

export const pasosParticipar: Paso[] = [
  { titulo: 'Registrate', desc: 'Creá tu cuenta con tu nombre, mail y una contraseña.' },
  { titulo: 'Verificá tu mail', desc: 'Te mandamos un link para confirmar que el mail es tuyo.' },
  { titulo: 'Completá tus datos', desc: 'Cargá tus datos personales y de facturación desde tu perfil.' },
  {
    titulo: 'Cargá crédito',
    desc: 'Transferí a nuestra cuenta y subí el comprobante. Cuando lo aprobamos, el crédito queda disponible.',
  },
  {
    titulo: 'Ingresá al remate',
    desc: 'Cuando la subasta está en vivo, entrá a la sala: vas a ver la transmisión, el lote en remate y el chat.',
  },
  {
    titulo: 'Ofertá',
    desc: 'Elegí tu monto y ofertá. Mientras vas ganando, tu oferta queda reservada; si ganás, el lote es tuyo.',
  },
];
