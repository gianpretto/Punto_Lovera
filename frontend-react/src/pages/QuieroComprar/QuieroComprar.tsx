import Boton from '../../components/ui/Boton';
import Etiqueta from '../../components/ui/Etiqueta';
import styles from './QuieroComprar.module.scss';

// "Quiero comprar" del rediseño (Figma, frame 719:68301): guía para
// compradores. Banda verde con el título, "Por qué elegirnos" (tres
// tarjetas + la ilustración del proceso) sobre el patrón de logos, y la
// línea de tiempo oscura "Cómo comprar" con los seis pasos.
// Los textos son los del diseño (las tarjetas todavía son de relleno: los
// define la diseñadora, no reescribirlos).
// La flecha de los botones va dentro del texto (y no con la prop `flecha`)
// porque el flex del botón se come el espacio antes del span " →".

interface Razon {
  icono: string;
  titulo: string;
  texto: string;
}

const RAZONES: Razon[] = [
  {
    icono: '/assets/figma/icono-comprar-pago.svg',
    titulo: 'Título',
    texto: 'Alguna información relevante o interesante para detallar en un muy breve texto descriptivo, que no dure más que esto.',
  },
  {
    icono: '/assets/figma/icono-comprar-dinero.svg',
    titulo: 'Título',
    texto: 'Alguna información relevante o interesante para detallar en un muy breve texto descriptivo, que no dure más que esto.',
  },
  {
    icono: '/assets/figma/icono-comprar-garantia.svg',
    titulo: 'Título',
    texto: 'Alguna información relevante o interesante para detallar en un muy breve texto descriptivo, que no dure más que esto.',
  },
];

interface Paso {
  etiqueta: string;
  titulo: string;
  texto: string;
  imagen: string;
  /** Las ilustraciones de los pasos 4 a 6 son cuadradas; las otras, 4:3 */
  cuadrada?: boolean;
  boton?: { texto: string; to: string };
}

// En el diseño el paso 3 repite la ilustración del paso 2 (el escudo).
const PASOS: Paso[] = [
  {
    etiqueta: '01. cuenta',
    titulo: 'Registrate',
    texto: 'Creá tu cuenta y cargá tus datos básicos para operar dentro de la plataforma.',
    imagen: '/assets/figma/comprar-ilustracion-1.webp',
    boton: { texto: 'Crear mi cuenta', to: '/registro' },
  },
  {
    etiqueta: '02. perfil',
    titulo: 'Completá tu perfil',
    texto:
      'Completá la información necesaria en la sección “Mi perfil” para validar tu identidad y habilitar la participación en subastas.',
    imagen: '/assets/figma/comprar-ilustracion-2.webp',
  },
  {
    etiqueta: '03. crédito',
    titulo: 'Cargá crédito',
    texto:
      'Ingresá una suma representativa de dinero en tu cuenta para poder utilizar como garantía (10% del valor del lote) y así poder ofertar.',
    imagen: '/assets/figma/comprar-ilustracion-2.webp',
  },
  {
    etiqueta: '04. explorar',
    titulo: 'Encontrá los lotes que te interesan',
    texto: 'Podés consultar la agenda de subastas.',
    imagen: '/assets/figma/comprar-ilustracion-4.webp',
    cuadrada: true,
    boton: { texto: 'Consultar próximas subastas', to: '/subastas' },
  },
  {
    etiqueta: '05. ofertar',
    titulo: 'Participá en vivo',
    texto: 'Sumate a la subasta en vivo, seguí cada lote y realizá tus ofertas en tiempo real.',
    imagen: '/assets/figma/comprar-ilustracion-3.webp',
    cuadrada: true,
    boton: { texto: 'Consultar próximas subastas', to: '/subastas' },
  },
  {
    etiqueta: '06. coordinar',
    titulo: 'Ganá y coordiná la operación',
    texto: 'Si ganás el lote, te enviamos un detalle de todo lo comprado para coordinar el pago y retiro de los bienes.',
    imagen: '/assets/figma/comprar-ilustracion-5.webp',
    cuadrada: true,
  },
];

export default function QuieroComprar() {
  return (
    <div className={styles.pagina}>
      {/* ---------- Banda verde */}
      <section className={styles.hero}>
        <div className={styles.heroContenido}>
          <div>
            <Etiqueta tono="claro" tamano="grande">
              guía para compradores
            </Etiqueta>
            <h1 className={styles.heroTitulo}>
              Comprar en una subasta puede ser <em>simple.</em>
            </h1>
          </div>
          <div className={styles.heroLado}>
            <p className={styles.heroBajada}>
              Te acompañamos desde el registro hasta la entrega. Seis pasos claros, toda la información a mano y
              asistencia cuando la necesites.
            </p>
            <Boton variante="claro" to="/registro" className={styles.botonClaro}>
              Registrarme para ofertar →
            </Boton>
          </div>
        </div>
      </section>

      {/* ---------- Por qué elegirnos */}
      <section className={styles.razones}>
        <div className={styles.razonesContenido}>
          <Etiqueta tono="verde" tamano="grande">
            por qué elegirnos
          </Etiqueta>
          <h2 className={styles.razonesTitulo}>Todo lo necesario para ofertar con confianza.</h2>

          <ul className={styles.tarjetas}>
            {RAZONES.map((r, i) => (
              <li className={styles.tarjeta} key={i}>
                <span className={styles.tarjetaNumero}>{String(i + 1).padStart(2, '0')}.</span>
                <img className={styles.tarjetaIcono} src={r.icono} alt="" width={113} height={112} />
                <h3 className={styles.tarjetaTitulo}>{r.titulo}</h3>
                <p className={styles.tarjetaTexto}>{r.texto}</p>
              </li>
            ))}
          </ul>

          <img
            className={styles.proceso}
            src="/assets/figma/comprar-banner.webp"
            alt="El proceso de compra: te registrás, elegís los lotes, ofertás en el remate y recibís lo que compraste."
            width={1280}
            height={427}
            loading="lazy"
          />
        </div>
      </section>

      {/* ---------- Cómo comprar: línea de tiempo */}
      <section className={styles.pasos}>
        <div className={styles.pasosContenido}>
          <div className={styles.pasosEncabezado}>
            <div>
              <Etiqueta tono="claro" tamano="grande">
                cómo comprar
              </Etiqueta>
              <h2 className={styles.pasosTitulo}>
                <em>Tu próxima oportunidad empieza en un punto.</em>
              </h2>
            </div>
            <p className={styles.pasosBajada}>Un recorrido para que siempre sepas qué sigue.</p>
          </div>

          <ol className={styles.lineaTiempo}>
            {PASOS.map((p, i) => (
              <li className={`${styles.paso} ${i % 2 === 0 ? styles.pasoTextoIzquierda : ''}`} key={p.etiqueta}>
                <div className={styles.pasoTexto}>
                  <p className={styles.pasoEtiqueta}>{p.etiqueta}</p>
                  <h3 className={styles.pasoTitulo}>{p.titulo}</h3>
                  <p className={styles.pasoDescripcion}>{p.texto}</p>
                  {p.boton && (
                    <Boton variante="verde" to={p.boton.to} className={styles.botonPaso}>
                      {`${p.boton.texto} →`}
                    </Boton>
                  )}
                </div>
                <span className={styles.pasoPunto} aria-hidden="true" />
                <div className={`${styles.pasoImagen} ${p.cuadrada ? styles.cuadrada : ''}`}>
                  <img src={p.imagen} alt="" loading="lazy" />
                </div>
              </li>
            ))}
          </ol>

          <div className={styles.cierre}>
            <h2 className={styles.cierreTitulo}>
              <em>Registrate y empezá a participar.</em>
            </h2>
            <Boton variante="claro" to="/registro" className={styles.botonClaro}>
              Registrarme para ofertar →
            </Boton>
          </div>
        </div>
      </section>
    </div>
  );
}
