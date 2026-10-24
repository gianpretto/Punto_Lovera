import { useMemo } from 'react';
import Boton from '../../components/ui/Boton';
import Etiqueta from '../../components/ui/Etiqueta';
import TarjetaSubasta from '../../components/tarjetas/TarjetaSubasta';
import SubastaDestacada from '../../components/secciones/SubastaDestacada';
import BannerRedes from '../../components/secciones/BannerRedes';
import PreguntasFrecuentes from '../../components/secciones/PreguntasFrecuentes';
import SeccionVender from '../../components/secciones/SeccionVender';
import { preguntasDestacadas } from '../../content/participar';
import { uploadUrl } from '../../services/api';
import { toSubasta, useAuctions, useNow } from '../../services/auctions';
import { ordenarSubastas } from '../../utils/ordenarSubastas';
import styles from './Home.module.scss';

// Home del rediseño (Figma "Home", 1440 px): hero, subasta en vivo +
// agenda con las próximas 4, Comprar / Vender, redes, preguntas frecuentes,
// marcas, los hermanos Lovera y el formulario para vender.

// Fotos del diseño para las subastas que todavía no tienen portada
const FOTOS_EJEMPLO = [
  '/assets/figma/subasta-cocina-2.webp',
  '/assets/figma/subasta-cocina-1.webp',
  '/assets/figma/subasta-cafeteria.webp',
  '/assets/figma/subasta-cocina-3.webp',
];

const MARCAS = [
  { src: '/assets/figma/marca-1.webp', alt: 'Coca-Cola', ancho: 256, alto: 80 },
  { src: '/assets/figma/marca-4.webp', alt: 'Grupo Ayudín', ancho: 237, alto: 88 },
  { src: '/assets/figma/marca-2.webp', alt: 'Toyota', ancho: 259, alto: 146 },
  { src: '/assets/figma/marca-3.webp', alt: 'Quilmes', ancho: 151, alto: 78 },
];

export default function Home() {
  const now = useNow();
  const subastas = useAuctions(['ACTIVA', 'PROXIMA']);
  const ordenadas = useMemo(() => ordenarSubastas(subastas ?? []), [subastas]);
  const destacada = ordenadas[0];
  const agenda = ordenadas.slice(0, 4);

  return (
    <>
      {/* HERO */}
      <section className={styles.hero}>
        <img className={styles.heroFoto} src="/assets/figma/hero-galpon.webp" alt="" aria-hidden="true" />
        <div className={styles.heroTinte} aria-hidden="true" />
        <img className={styles.heroLineas} src="/assets/figma/hero-lineas.svg" alt="" aria-hidden="true" />

        <div className={styles.heroContenido}>
          <h1 className={styles.heroTitulo}>
            Subastas <em>online.</em>
          </h1>
          <p className={styles.heroBajada}>
            Bienes reales, información clara y un equipo que te acompaña.{' '}
            <br />
            Del galpón a tu pantalla, sin vueltas.
          </p>
          <div className={styles.heroBotones}>
            <Boton variante="claro" to="/subastas" className={styles.heroBoton}>
              Ver próximas subastas<span aria-hidden="true">→</span>
            </Boton>
            <Boton variante="contorno-claro" to="/como-participar" flecha className={`${styles.heroBoton} ${styles.heroBotonContorno}`}>
              Cómo participar
            </Boton>
          </div>
        </div>
      </section>

      {/* SUBASTA EN VIVO + AGENDA */}
      <section className={styles.agenda}>
        <div className={styles.contenedor}>
          {destacada && <SubastaDestacada subasta={destacada} />}

          <div className={styles.agendaCabecera}>
            <div>
              <Etiqueta tono="claro">Agenda</Etiqueta>
              <h2 className={styles.agendaTitulo}>Próximas Subastas</h2>
            </div>
            <Boton variante="verde" to="/subastas" flecha className={styles.botonGrande}>
              Ver todas las subastas
            </Boton>
          </div>

          <div className={styles.grilla}>
            {agenda.map((a, i) => {
              const s = toSubasta(a, now);
              return (
                <TarjetaSubasta
                  key={a.id}
                  id={a.id}
                  estado={s.estado}
                  titulo={s.titulo}
                  ubicacion={s.ubicacion}
                  descripcion={s.descripcion}
                  fecha={s.fecha}
                  hora={s.hora}
                  imagen={a.coverImageUrl ? uploadUrl(a.coverImageUrl) : FOTOS_EJEMPLO[i % FOTOS_EJEMPLO.length]}
                  countdown={s.countdown}
                />
              );
            })}
          </div>
          {subastas && agenda.length === 0 && (
            <p className={styles.sinSubastas}>Pronto vamos a publicar nuevas subastas.</p>
          )}
        </div>
      </section>

      {/* QUIERO COMPRAR / QUIERO VENDER */}
      <section className={styles.split}>
        <div className={`${styles.splitMitad} ${styles.splitComprar}`}>
          <span className={styles.splitCirculo} aria-hidden="true">
            <img src="/assets/figma/icono-home-comprar.webp" alt="" width={33} height={40} />
          </span>
          <div className={styles.splitTexto}>
            <p className={styles.splitQuiero}>Quiero</p>
            <h2 className={styles.splitTitulo}>Comprar</h2>
            <Boton variante="claro" to="/quiero-comprar" flecha className={styles.botonGrande}>
              Conocé el proceso
            </Boton>
          </div>
        </div>
        <div className={`${styles.splitMitad} ${styles.splitVender}`}>
          <span className={styles.splitCirculo} aria-hidden="true">
            <img src="/assets/figma/icono-home-vender.webp" alt="" width={33} height={40} />
          </span>
          <div className={styles.splitTexto}>
            <p className={styles.splitQuiero}>Quiero</p>
            <h2 className={styles.splitTitulo}>Vender</h2>
            <Boton variante="verde" to="/quiero-vender" flecha className={styles.botonGrande}>
              Contactate con nosotros
            </Boton>
          </div>
        </div>
      </section>

      {/* REDES */}
      <section className={styles.redes}>
        <div className={styles.contenedor}>
          <BannerRedes />
        </div>
      </section>

      {/* PREGUNTAS FRECUENTES + CONFÍAN EN NOSOTROS */}
      <div className={styles.claro}>
        <PreguntasFrecuentes items={preguntasDestacadas} />

        <section className={styles.marcas}>
          <div className={styles.contenedor}>
            <h2 className={styles.marcasTitulo}>Confían en nosotros</h2>
            <img className={styles.ornamento} src="/assets/figma/ornamento.webp" alt="" aria-hidden="true" width={241} height={44} />
            <ul className={styles.marcasLista}>
              {MARCAS.map((m) => (
                <li key={m.alt}>
                  <img src={m.src} alt={m.alt} width={m.ancho} height={m.alto} loading="lazy" />
                </li>
              ))}
            </ul>
            <img
              className={`${styles.ornamento} ${styles.ornamentoAbajo}`}
              src="/assets/figma/ornamento.webp"
              alt=""
              aria-hidden="true"
              width={241}
              height={44}
            />
          </div>
        </section>
      </div>

      {/* LOS HERMANOS LOVERA */}
      <section className={styles.hermanos}>
        <img className={styles.hermanosFoto} src="/assets/figma/hermanos-lovera.webp" alt="Gonzalo y Emiliano Lovera" loading="lazy" />
        <div className={styles.hermanosSombra} aria-hidden="true" />
        <div className={styles.contenedor}>
          <div className={styles.hermanosTexto}>
            <h2 className={styles.hermanosTitulo}>
              Una manera <br />
              <em>más clara</em> <br />
              de subastar.
            </h2>
            <p>
              Somos Gonzalo y Emiliano Lovera, dos hermanos que decidimos entrar de lleno en el mundo de las subastas con
              una idea clara: Hacerlo más simple, más accesible y más actual.
            </p>
            <p>Conocemos el mercado, cuidamos cada operación y construimos relaciones que siguen lote a lote.</p>
            <Boton variante="claro" to="/quienes-somos" flecha className={styles.hermanosBoton}>
              Conocé nuestra historia
            </Boton>
          </div>
        </div>
      </section>

      <SeccionVender origen="home" />
    </>
  );
}
