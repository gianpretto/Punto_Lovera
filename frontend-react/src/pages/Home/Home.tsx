import { Link } from 'react-router-dom';
import Hero from '../../components/secciones/Hero';
import SubastaEnVivo from '../../components/secciones/SubastaEnVivo';
import SubastasAnteriores from '../../components/secciones/SubastasAnteriores';
import PreguntasFrecuentes from '../../components/secciones/PreguntasFrecuentes';
import { preguntasFrecuentes } from '../../content/participar';
import TarjetaSubasta from '../../components/tarjetas/TarjetaSubasta';
import { toSubasta, useAuctions, useNow } from '../../services/auctions';
import styles from './Home.module.scss';

const logos = Array.from({ length: 7 }, (_, i) => ({
  src: '/assets/img/empresa-placeholder.png',
  alt: `Logo ${i + 1}`,
}));


export default function Home() {
  const now = useNow();
  const proximas = useAuctions(['ACTIVA', 'PROXIMA']);
  const proximasSubastas = (proximas ?? []).slice(0, 4).map((a) => toSubasta(a, now));



  return (
    <>
      {/* HERO PRINCIPAL */}
      <Hero
        titulo="TITULAR PRINCIPAL"
        detalle="detalle"
        subtitulo="Sub-texto con alguna info breve que explique rápidamente de qué va la plataforma."
        textoBoton="Botón"
        linkBoton="/subastas"
        imagenUrl="/images/hero-placeholder.jpg"
      />

      {/* SUBASTA ACTIVA */}
      <SubastaEnVivo />

      {/* PRÓXIMAS SUBASTAS */}
      <section className={styles.prox}>
        <div className={styles.prox__inner}>
          <h2 className={styles.prox__titulo}>PRÓXIMAS SUBASTAS</h2>

          <div className={styles.prox__grid}>
            {proximasSubastas.map((subasta) => (
              <TarjetaSubasta
                key={subasta.id}
                id={subasta.id}
                estado={subasta.estado}
                titulo={subasta.titulo}
                ubicacion={subasta.ubicacion}
                descripcion={subasta.descripcion}
                fecha={subasta.fecha}
                hora={subasta.hora}
                mostrarCuentaRegresiva={subasta.estado === 'PRÓXIMA'}
                countdown={subasta.countdown}
              />
            ))}
          </div>
          {proximas && proximasSubastas.length === 0 && (
            <p className={styles.sinSubastas}>Pronto vamos a publicar nuevas subastas.</p>
          )}

          <div className={styles.prox__cta}>
            <Link className={styles['btn-negro']} to="/subastas">
              Ver más subastas →
            </Link>
          </div>
        </div>
      </section>

      {/* QUIERO COMPRAR / QUIERO VENDER */}
      <section className={styles['cta-doble']}>
        <div className={styles['cta-doble__inner']}>
          <Link className={styles['cta-card']} to="/quiero-comprar" aria-label="Quiero comprar">
            <h3 className={styles['cta-card__titulo']}>QUIERO COMPRAR</h3>
            <div className={styles['cta-card__img']} aria-hidden="true"></div>
          </Link>

          <Link className={styles['cta-card']} to="/quiero-vender" aria-label="Quiero vender">
            <h3 className={styles['cta-card__titulo']}>QUIERO VENDER</h3>
            <div className={styles['cta-card__img']} aria-hidden="true"></div>
          </Link>
        </div>
      </section>

      {/* QUIÉNES SOMOS */}
      <section className={styles.qs}>
        <div className={styles.qs__inner}>
          <div className={styles.qs__texto}>
            <h2 className={styles.qs__titulo}>QUIENES SOMOS</h2>

            <p className={styles.qs__desc}>
              Hey! I've been thinking about this amazing spot I came across recently—it's got such a warm,
              welcoming atmosphere, and the food is just next-level. It's one of those places where you can really
              take your time, savor each bite, and just relax. We should definitely go check it out together
              sometime soon. What do you think? Let's plan a visit!
            </p>

            <button className={styles['btn-negro']}>Conocé más →</button>
          </div>

          <div className={styles.qs__media} aria-hidden="true">
            <div className={styles.qs__img}></div>
          </div>
        </div>
      </section>

      {/* SUBASTAS ANTERIORES */}
      <SubastasAnteriores />

      {/* CONFÍAN EN NOSOTROS */}
      <section className={styles.trust}>
        <div className={styles.trust__inner}>
          <p className={styles.trust__titulo}>CONFÍAN EN NOSOTROS</p>

          <div className={styles.trust__logos}>
            {logos.map((l, i) => (
              <div className={styles.trust__logo} key={i}>
                <img src={l.src} alt={l.alt} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREGUNTAS FRECUENTES */}
      <PreguntasFrecuentes items={preguntasFrecuentes.slice(0, 3)} />
    </>
  );
}
