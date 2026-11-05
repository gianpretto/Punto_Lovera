import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { iniciarMedicion, registrarPagina } from '../../services/analytics';

// Título de cada página (pestaña del navegador, resultados de Google y
// reportes de Analytics) y página vista en cada cambio de ruta.

const MARCA = 'Punto Lovera';

const TITULOS: [RegExp, string][] = [
  [/^\/$/, 'Subastas de fondos de comercio en vivo'],
  [/^\/subastas\/?$/, 'Todas las subastas'],
  [/^\/subastas\/[^/]+\/activa$/, 'Remate en vivo'],
  [/^\/subastas\/[^/]+\/martillero$/, 'Panel del martillero'],
  [/^\/subastas\/[^/]+$/, 'Catálogo de la subasta'],
  [/^\/quienes-somos$/, 'Quiénes somos'],
  [/^\/quiero-comprar$/, 'Quiero comprar'],
  [/^\/quiero-vender$/, 'Quiero vender'],
  [/^\/contactanos$/, 'Contactanos'],
  [/^\/como-participar$/, 'Cómo participar'],
  [/^\/faq$/, 'Preguntas frecuentes'],
  [/^\/login$/, 'Iniciar sesión'],
  [/^\/registro$/, 'Registrarse'],
  [/^\/forgot-password$/, 'Recuperar contraseña'],
  [/^\/validar-mail$/, 'Validar email'],
  [/^\/datos$/, 'Mis datos'],
  [/^\/perfil$/, 'Mi perfil'],
  [/^\/creditos$/, 'Mis créditos'],
  [/^\/comprobante-exitoso$/, 'Comprobante enviado'],
  [/^\/reintegro$/, 'Solicitar reintegro'],
  [/^\/admin\//, 'Administración'],
];

function tituloDe(ruta: string) {
  const encontrado = TITULOS.find(([patron]) => patron.test(ruta));
  return encontrado ? `${encontrado[1]} | ${MARCA}` : MARCA;
}

export default function Medicion() {
  const { pathname } = useLocation();

  useEffect(() => {
    iniciarMedicion();
  }, []);

  useEffect(() => {
    const titulo = tituloDe(pathname);
    document.title = titulo;
    registrarPagina(pathname, titulo);
  }, [pathname]);

  return null;
}
