import { useNavigate } from 'react-router-dom';
import TarjetaSubasta from '../tarjetas/TarjetaSubasta';
import { toSubasta, useAuctions } from '../../services/auctions';
import styles from './SubastasAnteriores.module.scss';

export default function SubastasAnteriores() {
  const navigate = useNavigate();
  const finalizadas = useAuctions(['FINALIZADA']);

  // Las más recientes primero; sin finalizadas todavía, no se muestra
  if (!finalizadas || finalizadas.length === 0) return null;
  const subastasAnteriores = [...finalizadas].reverse().slice(0, 4).map((a) => toSubasta(a, Date.now()));

  return (
    <section className={`${styles.prox} ${styles.ant}`}>
      <div className={styles.prox__inner}>
        <h2 className={styles.prox__titulo}>SUBASTAS ANTERIORES</h2>

        <div className={styles.prox__grid}>
          {subastasAnteriores.map((item) => (
            <TarjetaSubasta
              key={item.id}
              id={item.id}
              estado="FINALIZADA"
              titulo={item.titulo}
              ubicacion={item.ubicacion}
              descripcion={item.descripcion}
              fecha={item.fecha}
              hora={item.hora}
              mostrarCuentaRegresiva={false}
            />
          ))}
        </div>

        <div className={styles.prox__cta}>
          <button className={styles['btn-negro']} onClick={() => navigate('/subastas')}>
            Ver más subastas →
          </button>
        </div>
      </div>
    </section>
  );
}
