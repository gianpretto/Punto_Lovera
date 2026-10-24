import Etiqueta from '../../components/ui/Etiqueta';
import SeccionVender from '../../components/secciones/SeccionVender';
import styles from './QuieroVender.module.scss';

// Quiero vender (Figma "Quiero vender 1440x1029", frame 721:73621):
//  1. Banda oscura "Guía para vendedores" con el título y la bajada.
//  2. Tres tarjetas con las ventajas de vender con Punto Lovera.
//  3. "Vos conocés tus bienes. Nosotros cómo venderlos." con la ilustración,
//     que se monta sobre la banda verde del formulario (SeccionVender).
const VENTAJAS = [
  {
    titulo: 'Precios reales, nada de promesas vacías',
    texto:
      'Trabajamos para que obtengas el mejor precio posible dentro del mercado, pero siendo realistas desde el principio, no te “endulzamos” con números que después no se cumplen.',
  },
  {
    titulo: 'Transparencia y cero complicaciones',
    texto:
      'Te explicamos cómo funciona toda la subasta de principio a fin y nos encargamos de todo el proceso. Vos no tenés que preocuparte por nada.',
  },
  {
    titulo: 'Cobrás en el momento',
    texto: 'Una vez que se vende, el dinero se cobra en el acto. Sin demora y sin perseguir pagos.',
  },
];

export default function QuieroVender() {
  return (
    <div className={styles.pagina}>
      <section className={styles.cabecera}>
        <div className={`${styles.contenedor} ${styles.cabeceraFila}`}>
          <div>
            <Etiqueta tono="claro" tamano="grande">
              Guía para vendedores
            </Etiqueta>
            <h1 className={styles.titulo}>
              Tu lote merece un proceso<em> claro.</em>
            </h1>
          </div>
          <p className={styles.bajada}>
            Tasamos con criterio de mercado, explicamos cada etapa y coordinamos toda la operación.
          </p>
        </div>
      </section>

      <section className={styles.ventajas} aria-label="Por qué vender con nosotros">
        <ul className={`${styles.contenedor} ${styles.tarjetas}`}>
          {VENTAJAS.map((v) => (
            <li key={v.titulo} className={styles.tarjeta}>
              {/* El diseño numera las tres tarjetas como "01." */}
              <span className={styles.numero}>01.</span>
              <span className={styles.icono} aria-hidden="true">
                <img src="/assets/figma/icono-vender-pago.svg" alt="" width={33} height={39} />
              </span>
              <h2 className={styles.tarjetaTitulo}>{v.titulo}</h2>
              <p className={styles.tarjetaTexto}>{v.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.conocer}>
        <h2 className={styles.tituloConocer}>
          {/* La "V" en itálica es del diseño */}
          <em>V</em>os conocés tus bienes.
          <br />
          <em className={styles.verde}>Nosotros cómo venderlos.</em>
        </h2>
        <img
          className={styles.ilustracion}
          src="/assets/figma/vender-ilustracion.webp"
          alt="Ilustración: muebles y vajilla publicados como lotes en una app de subastas"
          width={624}
          height={624}
        />
      </section>

      <SeccionVender origen="quiero-vender" />
    </div>
  );
}
