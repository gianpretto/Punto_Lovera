// Medición de visitas:
// - Google Analytics 4 (VITE_GA_ID, "G-XXXXXXX"): visitas, de dónde llegan,
//   páginas vistas y eventos (registro, login, consultas, ofertas).
// - Microsoft Clarity (VITE_CLARITY_ID): mapas de calor de clics y
//   grabaciones de sesión (enmascara lo que se escribe en los formularios).
// Se cargan solo si la variable está definida en Vercel (en desarrollo, sin
// variables, no se carga nada). Nunca se mandan datos personales (mail,
// nombre, DNI): solo la ruta y eventos genéricos.

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
  }
}

const GA_ID = (import.meta.env.VITE_GA_ID as string | undefined)?.trim();
const CLARITY_ID = (import.meta.env.VITE_CLARITY_ID as string | undefined)?.trim();

let iniciado = false;

// Solo origen + ruta: la query puede traer secretos (?token= de recuperar
// contraseña o validar mail, ?pase= del invitado) y no tienen que llegar a
// ningún servicio de terceros
const urlLimpia = (ruta = window.location.pathname) => window.location.origin + ruta;

function cargarScript(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/** Carga GA4 y Clarity (una sola vez). */
export function iniciarMedicion() {
  if (iniciado) return;
  iniciado = true;

  if (GA_ID && /^G-[A-Z0-9]+$/i.test(GA_ID)) {
    window.dataLayer = window.dataLayer || [];
    // gtag espera recibir el objeto `arguments` tal cual (no un array)
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    // Las páginas vistas se mandan a mano en cada cambio de ruta (es una SPA)
    window.gtag('config', GA_ID, { send_page_view: false, page_location: urlLimpia() });
    cargarScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
  }

  // Clarity graba la URL completa: si se entra con un link con secretos en la
  // query, esa visita no se graba (las siguientes sí)
  const urlConSecretos = /[?&](token|pase)=/i.test(window.location.search);
  if (CLARITY_ID && /^[a-z0-9]+$/i.test(CLARITY_ID) && !urlConSecretos) {
    // Mismo arranque que el snippet oficial de Clarity, sin script inline
    const clarity = ((...args: unknown[]) => {
      (clarity.q = clarity.q || []).push(args);
    }) as NonNullable<Window['clarity']>;
    window.clarity = window.clarity || clarity;
    cargarScript(`https://www.clarity.ms/tag/${CLARITY_ID}`);
  }
}

let ultimaRuta = '';

/** Página vista (se llama en cada cambio de ruta; ignora repetidos seguidos). */
export function registrarPagina(ruta: string, titulo: string) {
  if (ruta === ultimaRuta) return;
  ultimaRuta = ruta;
  // `set` hace que los eventos siguientes también usen la URL sin query
  window.gtag?.('set', { page_location: urlLimpia(ruta), page_title: titulo });
  window.gtag?.('event', 'page_view', { page_path: ruta, page_title: titulo, page_location: urlLimpia(ruta) });
}

/**
 * Evento de negocio. Nombres recomendados de GA4 cuando existen:
 * `sign_up`, `login`, `generate_lead` (consulta enviada); propios: `oferta`.
 */
export function registrarEvento(nombre: string, datos: Record<string, string | number> = {}) {
  window.gtag?.('event', nombre, datos);
  window.clarity?.('event', nombre);
}
