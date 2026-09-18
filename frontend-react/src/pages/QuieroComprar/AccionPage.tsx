import BannerAccion from '../../components/banners/BannerAccion';
import styles from './AccionPage.module.scss';

const pasos = [
  {
    titulo: 'paso 1',
    desc: "Hey! I've been thinking about this amazing spot I came across recently—it's got such a warm, welcoming atmosphere, and that!",
  },
  {
    titulo: 'paso 2',
    desc: "Hey! I've been thinking about this amazing spot I came across recently—it's got such a warm, welcoming atmosphere, and the food is just next-level. It's one of those places where you can really take your time, savor each bite, and just relax. Let's plan a visit!",
  },
  {
    titulo: 'paso 3',
    desc: "Hey! I've been thinking about this amazing spot I came across recently—it's got such a warm, welcoming atmosphere, and the food does not hurt. It's one of those places you go.",
  },
  {
    titulo: 'paso 4',
    desc: "Hey! I've been thinking about this amazing spot I came across recently—it's got such a warm, welcoming atmosphere, and that the food is good and such. So yeah.",
  },
];

const razones = [
  {
    titulo: 'Titulo',
    desc: 'Alguna información relevante o interesante para detallar en un muy breve texto descriptivo, que no dure más que esto.',
  },
  {
    titulo: 'Titulo',
    desc: 'Alguna información relevante o interesante para detallar en un muy breve texto descriptivo, que no dure más que esto.',
  },
  {
    titulo: 'Titulo',
    desc: 'Alguna información relevante o interesante para detallar en un muy breve texto descriptivo, que no dure más que esto.',
  },
];

interface AccionPageProps {
  tipo: 'quiero-comprar' | 'quiero-vender';
}

export default function AccionPage({ tipo }: AccionPageProps) {
  return (
    <div className={styles.page}>
      <BannerAccion type={tipo} />

      <section className={styles.reasonsSection}>
        <div className={styles.reasonsInner}>
          <h2 className={styles.sectionTitle}>Por qué elegirnos</h2>

          <div className={styles.cardsGrid}>
            {razones.map((r, i) => (
              <div className={styles.reasonCard} key={i}>
                <div className={styles.cardIcon}>
                  <img src="/assets/img/default.png" alt="Icon" />
                </div>
                <h3 className={styles.cardTitle}>{r.titulo}</h3>
                <p className={styles.cardDesc}>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.explanationSection}>
        <div className={`${styles.explanationInner} ${styles.explanationInnerFlex}`}>
          <div className={styles.explanationContent}>
            <h2 className={styles.explanationTitle}>Breve explicación</h2>
            <p className={styles.explanationDesc}>
              Hey! I've been thinking about this amazing spot I came across recently—it's got such a warm,
              welcoming atmosphere, and the food is just next-level. It's one of those places where you can really
              take your time, savor each bite, and just relax. We should definitely go check it out together
              sometime soon. What do you think? Let's plan a visit!
            </p>
          </div>
          <div className={styles.explanationMedia}>
            <img src="/assets/img/default.png" alt="Explicacion" />
          </div>
        </div>
      </section>

      <section className={styles.stepsSection}>
        <div className={styles.stepsInner}>
          {pasos.map((p, i) => (
            <div className={styles.stepItem} key={i}>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>{p.titulo}</h3>
                <p className={styles.stepDesc}>{p.desc}</p>
              </div>
              <div className={styles.stepMedia}>
                <img src="/assets/img/default.png" alt={p.titulo} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <BannerAccion type={tipo} />
    </div>
  );
}
