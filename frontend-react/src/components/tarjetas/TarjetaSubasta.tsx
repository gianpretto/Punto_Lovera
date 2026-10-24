import { Link } from 'react-router-dom';
import { truncate } from '../../utils/truncate';
import type { Countdown } from '../../interfaces/subasta';
import styles from './TarjetaSubasta.module.scss';

// Tarjeta de subasta del rediseño (Figma, 305 x 431). Tres variantes según
// el estado:
//  - PRÓXIMA:    pastilla gris + cuenta regresiva (D : H : M : S)
//  - ACTIVA:     pastilla verde clara + recuadro verde "SUBASTA ACTIVA"
//  - FINALIZADA: recuadro oscuro "LOTE VENDIDO"
export type EstadoSubasta = 'ACTIVA' | 'PRÓXIMA' | 'PROXIMA' | 'FINALIZADA' | string;

interface TarjetaSubastaProps {
  id?: string | number;
  estado?: EstadoSubasta;
  titulo?: string;
  ubicacion?: string;
  descripcion?: string;
  fecha?: string;
  hora?: string;
  /** Portada de la subasta; si no hay, se usa una foto de ejemplo del diseño */
  imagen?: string | null;
  mostrarCuentaRegresiva?: boolean;
  countdown?: Countdown;
}

const IMAGEN_DEFAULT = '/assets/figma/subasta-cocina-1.webp';

export default function TarjetaSubasta({
  id,
  estado,
  titulo = '',
  ubicacion = '',
  descripcion = '',
  fecha = '',
  hora = '',
  imagen,
  mostrarCuentaRegresiva = true,
  countdown = { d: '00', h: '00', m: '00', s: '00' },
}: TarjetaSubastaProps) {
  const activa = estado === 'ACTIVA';
  const finalizada = estado === 'FINALIZADA';
  const pastilla = activa ? 'ACTIVA' : finalizada ? 'TERMINADA' : 'PRÓXIMAMENTE';

  return (
    <Link className={styles.tarjeta} to={`/subastas/${id}`}>
      <div className={styles.media}>
        <img className={styles.foto} src={imagen || IMAGEN_DEFAULT} alt="" loading="lazy" />

        <span className={`${styles.pastilla} ${activa ? styles.pastillaActiva : ''}`}>
          <img src="/assets/figma/icono-martillo.svg" alt="" width={13} height={13} />
          {pastilla}
        </span>

        {activa && <div className={`${styles.recuadro} ${styles.recuadroActiva}`}>SUBASTA ACTIVA</div>}
        {finalizada && <div className={`${styles.recuadro} ${styles.recuadroVendido}`}>LOTE VENDIDO</div>}
        {!activa && !finalizada && mostrarCuentaRegresiva && (
          <div className={styles.cuenta} aria-label="Tiempo restante">
            {(
              [
                ['d', 'D'],
                ['h', 'H'],
                ['m', 'M'],
                ['s', 'S'],
              ] as const
            ).map(([k, label], i) => (
              <div key={k} className={styles.cuentaGrupo}>
                {i > 0 && <span className={styles.cuentaSeparador}>:</span>}
                <span className={styles.cuentaUnidad}>
                  <span className={styles.cuentaNumero}>{countdown[k]}</span>
                  <span className={styles.cuentaLabel}>{label}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.cuerpo}>
        <h3 className={styles.titulo} title={titulo}>
          {truncate(titulo, 40)}
        </h3>
        <p className={styles.ubicacion} title={ubicacion}>
          <img src="/assets/figma/icono-ubicacion.svg" alt="" width={11} height={11} />
          {truncate(ubicacion, 40)}
        </p>
        <p className={styles.descripcion} title={descripcion}>
          {truncate(descripcion, 140)}
        </p>

        <div className={styles.pie}>
          <span>
            <img src="/assets/figma/icono-calendario.svg" alt="" width={14} height={14} />
            {fecha}
          </span>
          <span>
            <img src="/assets/figma/icono-reloj.svg" alt="" width={13} height={13} />
            {hora}
          </span>
        </div>
      </div>
    </Link>
  );
}
