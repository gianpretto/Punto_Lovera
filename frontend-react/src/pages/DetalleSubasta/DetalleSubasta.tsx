import { Link, useParams } from 'react-router-dom';
import { formatFecha, formatHora, lotImages, useAuction } from '../../services/auctions';
import TarjetaProductoCatalogo from '../../components/tarjetas/TarjetaProductoCatalogo';
import styles from './DetalleSubasta.module.scss';

export default function DetalleSubasta() {
  const { id } = useParams<{ id: string }>();
  const { auction, error } = useAuction(id);

  const subastaInfo = {
    titulo: auction?.title ?? (error ? 'Subasta no encontrada' : 'Cargando...'),
    ubicacion: auction?.location ?? '',
    descripcion: auction?.description ?? '',
    fecha: auction ? formatFecha(auction.startsAt) : '',
    hora: auction ? formatHora(auction.startsAt) : '',
  };
  const lotes = (auction?.lots ?? []).map((l) => ({
    lote: l.number,
    titulo: l.sold ? `${l.title} (vendido)` : l.title,
    descripcion: l.description,
    imagenes: lotImages(l),
  }));

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

          {auction?.status === 'ACTIVA' && (
            <Link to={`/subastas/${auction.id}/activa`} className={styles.btnIngresar}>
              Ingresar al remate →
            </Link>
          )}
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
