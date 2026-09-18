import SubastasAnteriores from '../../components/secciones/SubastasAnteriores';
import styles from './QuienesSomos.module.scss';

const procesos = [
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

export default function QuienesSomos() {
  return (
    <div className={styles.qsPage}>
      {/* Section 1: Que Hacemos */}
      <section className={styles.qsSection}>
        <div className={`${styles.qsInner} ${styles.split}`}>
          <div className={styles.qsContent}>
            <h2 className={styles.qsTitle}>Que hacemos</h2>
            <p className={styles.qsDesc}>
              Hey! I've been thinking about this amazing spot I came across recently—it's got such a warm,
              welcoming atmosphere, and the food is just next-level. It's one of those places where you can really
              take your time, savor each bite, and just relax. We should definitely go check it out together
              sometime soon. What do you think? Let's plan a visit!
            </p>
          </div>
          <div className={styles.qsMedia}>
            <div className={styles.imagePlaceholder}>
              <img src="/assets/img/default.png" alt="Que Hacemos" />
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Quienes Somos */}
      <section className={`${styles.qsSection} ${styles.bgLight}`}>
        <div className={`${styles.qsInner} ${styles.split}`}>
          <div className={styles.qsMedia}>
            <div className={styles.imagePlaceholder}>
              <img src="/assets/img/default.png" alt="Quienes Somos" />
            </div>
          </div>
          <div className={styles.qsContent}>
            <h2 className={styles.qsTitle}>Quienes somos</h2>
            <p className={styles.qsDesc}>
              Hey! I've been thinking about this amazing spot I came across recently—it's got such a warm,
              welcoming atmosphere, and the food is just next-level. It's one of those places where you can really
              take your time, savor each bite, and just relax. We should definitely go check it out together
              sometime soon. What do you think? Let's plan a visit!
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Como lo Hacemos */}
      <section className={styles.qsSection}>
        <div className={`${styles.qsInner} ${styles.centered}`}>
          <h2 className={`${styles.qsTitle} ${styles.textCenter}`}>Como lo hacemos</h2>

          <div className={styles.processGrid}>
            {procesos.map((p, i) => (
              <div className={styles.processCard} key={i}>
                <div className={styles.processIcon}>
                  <img src="/assets/img/default.png" alt="Icon" />
                </div>
                <h3 className={styles.processTitle}>{p.titulo}</h3>
                <p className={styles.processDesc}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Subastas Anteriores (Reused) */}
      <SubastasAnteriores />
    </div>
  );
}
