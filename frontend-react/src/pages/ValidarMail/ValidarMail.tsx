import { Link } from 'react-router-dom';
import styles from './ValidarMail.module.scss';

export default function ValidarMail() {
  const resendEmail = () => {
    console.log('Re-sending verification email...');
    alert('Correo de verificación reenviado.');
  };

  return (
    <div className={styles.validarWrapper}>
      <div className={styles.validarContent}>
        <h1 className={styles.validarTitle}>VALIDAR EMAIL</h1>

        <div className={styles.validarIcon}>✉️</div>

        <p className={styles.validarDesc}>
          Te hemos enviado un correo electrónico para confirmar tu cuenta. Por favor, revisá tu bandeja de entrada y
          seguí las instrucciones que allí se indican.
        </p>

        <p className={styles.validarInfo}>Si no lo encontrás, revisá tu carpeta de spam.</p>

        <div className={styles.formActions}>
          <button type="button" className={`${styles.btn} ${styles.btnBlack}`} onClick={resendEmail}>
            Reenviar correo
          </button>
          <Link to="/login" className={`${styles.btn} ${styles.btnLink}`}>Volver al inicio de sesión</Link>
        </div>
      </div>
    </div>
  );
}
