import { useParams } from 'react-router-dom';
import TarjetaProductoCatalogo from '../../components/tarjetas/TarjetaProductoCatalogo';
import styles from './DetalleSubasta.module.scss';

// Mock data del encabezado de la subasta
const subastaInfo = {
  titulo: 'Heladería con elaboración',
  ubicacion: 'Castelar, Buenos Aires',
  descripcion:
    'Gran remate de equipamiento gastronómico completo por cierre definitivo. Oportunidad única para emprendedores del rubro.',
  fecha: 'Miércoles 11/11/25',
  hora: '22:30',
};

// Mock data de lotes
const lotes = Array.from({ length: 12 }, (_, i) => ({
  lote: i + 1,
  titulo: `Lote de mobiliario #${i + 1}`,
  descripcion:
    'Juego de mesas y sillas en excelente estado, ideal para salón principal. Madera maciza y tapizado premium.',
  imagenes: ['/assets/img/default.png', '/assets/img/default.png', '/assets/img/default.png'],
}));

export default function DetalleSubasta() {
  // El id de la ruta se usará más adelante para pedir los datos reales al backend
  const { id } = useParams<{ id: string }>();
  void id;

  return (
    <div className={styles.detalleSubastaPage}>
      <header className={styles.subastaHeader}>
        <div className={styles.headerInner}>
          <h1 className={styles.subastaTitulo}>{subastaInfo.titulo}</h1>

          <div className={styles.subastaMeta}>
            <span>📍 {subastaInfo.ubicacion}</span>
            <span>📅 {subastaInfo.fecha}</span>
            <span>🕒 {subastaInfo.hora}</span>
          </div>

          <p className={styles.subastaDesc}>{subastaInfo.descripcion}</p>
        </div>
      </header>

      <section className={styles.catalogoSection}>
        <div className={styles.catalogoInner}>
          <h2 className={styles.sectionTitle}>Lotes disponibles</h2>

          <div className={styles.catalogoGrid}>
            {lotes.map((lote) => (
              <TarjetaProductoCatalogo
                key={lote.lote}
                lote={lote.lote}
                titulo={lote.titulo}
                descripcion={lote.descripcion}
                imagenes={lote.imagenes}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
