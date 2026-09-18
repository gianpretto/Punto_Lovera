import { useNavigate } from 'react-router-dom';
import styles from './ComprobanteExitoso.module.scss';

export default function ComprobanteExitoso() {
  const navigate = useNavigate();

  return (
    <div className={styles.successWrapper}>
      <div className={styles.successCard}>
        <div className={styles.iconCircle}>
          <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h1 className={styles.title}>¡Comprobante cargado correctamente!</h1>
        <p className={styles.desc}>
          Te llegará una confirmación a tu correo electrónico una vez que el pago sea validado.
        </p>
        <button className={styles.btnBlack} onClick={() => navigate('/perfil')}>
          Volver a mi perfil
        </button>
      </div>
    </div>
  );
}
