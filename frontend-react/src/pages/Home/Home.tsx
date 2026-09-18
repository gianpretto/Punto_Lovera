import { useState } from 'react';
import { Link } from 'react-router-dom';
import Hero from '../../components/secciones/Hero';
import SubastaEnVivo from '../../components/secciones/SubastaEnVivo';
import SubastasAnteriores from '../../components/secciones/SubastasAnteriores';
import TarjetaSubasta from '../../components/tarjetas/TarjetaSubasta';
import { makeCountdown, type Subasta } from '../../interfaces/subasta';
import styles from './Home.module.scss';

const proximasSubastas: Subasta[] = [
  {
    id: 1,
    estado: 'ACTIVA',
    titulo: 'Heladería con elaboración',
    ubicacion: 'Castelar, Buenos Aires',
    descripcion:
      'Heladería equipada con máquina de helados, vitrinas y mobiliario completo. Heladería equipada con máquina de helados, vitrinas y mobiliario completo.Heladería equipada con máquina de helados, vitrinas y mobiliario completo.Heladería equipada con máquina de helados, vitrinas y mobiliario completo.Heladería equipada con máquina de helados, vitrinas y mobiliario completo.Heladería equipada con máquina de helados, vitrinas y mobiliario completo.',
    fecha: 'Miércoles 11/11/25',
    hora: '22:30',
    countdown: makeCountdown(0, 5, 48, 9),
  },
  {
    id: 2,
    estado: 'PRÓXIMA',
    titulo: 'Lote de maquinaria',
    ubicacion: 'San Isidro, Buenos Aires',
    descripcion: 'Lote de maquinaria en buen estado, ideal para taller pequeño.',
    fecha: 'Lunes 22/12/25',
    hora: '18:00',
    countdown: makeCountdown(2, 12, 0, 0),
  },
  {
    id: 3,
    estado: 'PRÓXIMA',
    titulo: 'Negocio gastronómico',
    ubicacion: 'Morón, Buenos Aires',
    descripcion: 'Local con equipamiento completo y excelente ubicación comercial.',
    fecha: 'Viernes 02/01/26',
    hora: '16:00',
    countdown: makeCountdown(10, 4, 30, 0),
  },
  {
    id: 4,
    estado: 'PRÓXIMA',
    titulo: 'Tienda de diseño',
    ubicacion: 'Palermo, Buenos Aires',
    descripcion: 'Local boutique con decoración moderna y clientela estable.',
    fecha: 'Miércoles 15/01/26',
    hora: '20:00',
    countdown: makeCountdown(20, 8, 15, 45),
  },
];

const logos = Array.from({ length: 7 }, (_, i) => ({
  src: '/assets/img/empresa-placeholder.png',
  alt: `Logo ${i + 1}`,
}));

const faqsIniciales = [
  {
    pregunta: '¿Cómo participa uno en una subasta?',
    respuesta: 'Registro, verificación y seguir los pasos indicados en la sesión.',
    abierta: true,
  },
  {
    pregunta: '¿Puedo vender mi local a través de la plataforma?',
    respuesta: 'Sí, podés crear un aviso de venta y coordinar la subasta con un asesor.',
    abierta: false,
  },
  {
    pregunta: '¿Qué comisiones aplica la plataforma?',
    respuesta: 'Las comisiones se detallan en los términos y condiciones.',
    abierta: false,
  },
];

export default function Home() {
  const [faqs, setFaqs] = useState(faqsIniciales);

  const toggleFaq = (index: number) => {
    setFaqs((prev) => prev.map((f, i) => ({ ...f, abierta: i === index ? !f.abierta : false })));
  };

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
                mostrarCuentaRegresiva={true}
                countdown={subasta.countdown}
              />
            ))}
          </div>

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
      <section className={styles.faq}>
        <div className={styles.faq__inner}>
          <h2 className={styles.faq__titulo}>PREGUNTAS FRECUENTES</h2>

          <div className={styles.faq__lista}>
            {faqs.map((f, i) => (
              <div className={`${styles.faq__item} ${f.abierta ? styles.activa : ''}`} key={i}>
                <button className={styles.faq__pregunta} onClick={() => toggleFaq(i)}>
                  <span>
                    {i + 1}. {f.pregunta}
                  </span>
                  <span className={styles.faq__icono}>+</span>
                </button>

                {f.abierta && (
                  <div className={styles.faq__respuesta}>
                    <p>{f.respuesta}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
