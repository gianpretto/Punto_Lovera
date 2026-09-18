import { useEffect, useState } from 'react';
import styles from './TarjetaProductoCatalogo.module.scss';

interface TarjetaProductoCatalogoProps {
  lote?: number | string;
  titulo?: string;
  descripcion?: string;
  imagenes?: string[];
}

export default function TarjetaProductoCatalogo({
  lote = '',
  titulo = '',
  descripcion = '',
  imagenes = [],
}: TarjetaProductoCatalogoProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const hasMultiple = !!imagenes && imagenes.length > 1;
  const currentImage = imagenes && imagenes.length > 0 ? imagenes[currentIndex] : '/assets/img/default.png';

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!hasMultiple) return;
    setCurrentIndex((i) => (i + 1) % imagenes.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!hasMultiple) return;
    setCurrentIndex((i) => (i - 1 + imagenes.length) % imagenes.length);
  };

  const openLightbox = () => setIsLightboxOpen(true);
  const closeLightbox = () => setIsLightboxOpen(false);

  useEffect(() => {
    document.body.style.overflow = isLightboxOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isLightboxOpen]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox();
      else if (event.key === 'ArrowRight') nextImage();
      else if (event.key === 'ArrowLeft') prevImage();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLightboxOpen, currentIndex, imagenes]);

  return (
    <div className={styles.tarjetaCatalogo}>
      <article className={styles.catCard}>
        <div className={styles.catCardMedia} onClick={openLightbox}>
          <div className={styles.imageWrapper}>
            <img src={currentImage} alt={titulo} />
          </div>

          {hasMultiple && (
            <div className={styles.arrows}>
              <button className={styles.arrow} onClick={prevImage}>&lt;</button>
              <button className={styles.arrow} onClick={nextImage}>&gt;</button>
            </div>
          )}

          {hasMultiple && (
            <div className={styles.dots}>
              {imagenes.map((_, i) => (
                <span key={i} className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''}`} />
              ))}
            </div>
          )}
        </div>

        <div className={styles.catCardBody}>
          <div className={styles.loteBadge}>LOTE {lote}:</div>
          <h3 className={styles.catCardTitulo} title={titulo}>{titulo}</h3>
          <p className={styles.catCardDesc} title={descripcion}>
            {descripcion}
          </p>
        </div>
      </article>

      {isLightboxOpen && (
        <div className={styles.lightbox} onClick={closeLightbox}>
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.lightboxClose} onClick={closeLightbox}>&times;</button>

            <div className={styles.lightboxImageContainer}>
              <img src={currentImage} alt={titulo} />
            </div>

            {hasMultiple && (
              <div className={styles.lightboxControls}>
                <button className={styles.lightboxNav} onClick={prevImage}>&lt;</button>
                <button className={styles.lightboxNav} onClick={nextImage}>&gt;</button>
              </div>
            )}

            {hasMultiple && (
              <div className={styles.lightboxCounter}>
                {currentIndex + 1} / {imagenes.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
