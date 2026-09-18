import { Link } from 'react-router-dom';
import { truncate } from '../../utils/truncate';
import type { Countdown } from '../../interfaces/subasta';
import styles from './TarjetaSubasta.module.scss';

export type EstadoSubasta = 'ACTIVA' | 'PROXIMA' | 'FINALIZADA' | string;

interface TarjetaSubastaProps {
  id?: string | number;
  estado?: EstadoSubasta;
  titulo?: string;
  ubicacion?: string;
  descripcion?: string;
  fecha?: string;
  hora?: string;
  mostrarCuentaRegresiva?: boolean;
  countdown?: Countdown;
}

export default function TarjetaSubasta({
  id,
  estado,
  titulo = '',
  ubicacion = '',
  descripcion = '',
  fecha = '',
  hora = '',
  mostrarCuentaRegresiva = true,
  countdown = { d: '00', h: '00', m: '00', s: '00' },
}: TarjetaSubastaProps) {
  return (
    <div className={styles['tarjeta-subasta']}>
      <Link className={styles['sub-card']} to={`/subastas/${id}`}>
        <div className={styles['sub-card__media']}>
          <span className={`${styles.pill} ${estado === 'ACTIVA' ? styles['pill--activa'] : ''}`}>{estado}</span>

          {estado === 'FINALIZADA' && <div className={styles['sold-badge']}>LOTE VENDIDO</div>}

          {estado !== 'FINALIZADA' && mostrarCuentaRegresiva && countdown && (
            <div className={styles.countdown}>
              <div className={styles['countdown__units']}>
                <div className={styles['countdown__unit']}>
                  <span className={styles['countdown__num']}>{countdown.d}</span>
                  <span className={styles['countdown__label']}>D</span>
                </div>
                <div className={styles['countdown__unit']}>
                  <span className={styles['countdown__num']}>{countdown.h}</span>
                  <span className={styles['countdown__label']}>H</span>
                </div>
                <div className={styles['countdown__unit']}>
                  <span className={styles['countdown__num']}>{countdown.m}</span>
                  <span className={styles['countdown__label']}>M</span>
                </div>
                <div className={styles['countdown__unit']}>
                  <span className={styles['countdown__num']}>{countdown.s}</span>
                  <span className={styles['countdown__label']}>S</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles['sub-card__body']}>
          <h3 className={styles['sub-card__titulo']} title={titulo}>
            {truncate(titulo, 30)}
          </h3>
          <p className={styles['sub-card__loc']} title={ubicacion}>
            📍 {truncate(ubicacion, 30)}
          </p>

          <p className={styles['sub-card__desc']} title={descripcion}>
            {truncate(descripcion, 200)}
          </p>

          <div className={styles['sub-card__footer']}>
            <span>📅 {fecha}</span>
            <span>🕒 {hora}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
