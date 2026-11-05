import Boton from '../../components/ui/Boton';
import Etiqueta from '../../components/ui/Etiqueta';
import styles from './ComprobanteExitoso.module.scss';

// Confirmación después de subir un comprobante de transferencia (sin
// wireframe: misma línea que Créditos). Tarjeta blanca sobre el patrón.
export default function ComprobanteExitoso() {
  return (
    <div className={styles.pagina}>
      <section className={styles.tarjeta}>
        <span className={styles.icono} aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <Etiqueta tono="verde" className={styles.etiqueta}>
          comprobante enviado
        </Etiqueta>
        <h1 className={styles.titulo}>
          ¡Comprobante cargado <em>correctamente!</em>
        </h1>
        <p className={styles.texto}>
          Te llegará una confirmación a tu correo electrónico una vez que el pago sea validado.
        </p>
        <div className={styles.acciones}>
          <Boton variante="verde" to="/perfil" flecha>
            Volver a mi perfil
          </Boton>
          <Boton variante="contorno" to="/creditos">
            Ver mis créditos
          </Boton>
        </div>
      </section>
    </div>
  );
}
