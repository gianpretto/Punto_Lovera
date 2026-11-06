import { useMemo, useState } from 'react';
import Etiqueta from '../../components/ui/Etiqueta';
import TarjetaSubasta from '../../components/tarjetas/TarjetaSubasta';
import SubastaDestacada from '../../components/secciones/SubastaDestacada';
import BannerRedes from '../../components/secciones/BannerRedes';
import PreguntasFrecuentes from '../../components/secciones/PreguntasFrecuentes';
import { preguntasDestacadas } from '../../content/participar';
import { uploadUrl } from '../../services/api';
import { toSubasta, useAuctions, useAuctionsPage, useNow, type AuctionStatus } from '../../services/auctions';
import styles from './ProximasSubastas.module.scss';

// "Todas las subastas" del rediseño (Figma "Proximas subastas"): subasta en
// vivo (o la próxima) arriba, grilla paginada en el backend (6 por página:
// 3 x 2; en vivo, próximas y terminadas), redes y preguntas frecuentes.

const FOTOS_EJEMPLO = [
  '/assets/figma/subasta-cocina-2.webp',
  '/assets/figma/subasta-cocina-1.webp',
  '/assets/figma/subasta-cafeteria.webp',
  '/assets/figma/subasta-cocina-3.webp',
];

const POR_PAGINA = 6;
const ESTADOS: AuctionStatus[] = ['ACTIVA', 'PROXIMA', 'FINALIZADA'];

export default function ProximasSubastas() {
  const now = useNow();
  // La destacada es la primera en vivo o próxima (pedido aparte, 1 sola)
  const [destacada] = useAuctions(['ACTIVA', 'PROXIMA'], 1) ?? [];

  const [currentPage, setCurrentPage] = useState(1);
  const { data, error } = useAuctionsPage(ESTADOS, currentPage, POR_PAGINA);
  const totalPages = data?.pages ?? 1;
  const pagina = data?.auctions ?? [];
  const inicio = (currentPage - 1) * POR_PAGINA;

  const visiblePages = useMemo((): (number | string)[] => {
    const delta = 2;
    const range: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta) || i <= 3) {
        range.push(i);
      }
    }
    const conPuntos: (number | string)[] = [];
    let l: number | undefined;
    for (const i of range) {
      if (l) {
        if (i - l === 2) conPuntos.push(l + 1);
        else if (i - l !== 1) conPuntos.push('...');
      }
      conPuntos.push(i);
      l = i;
    }
    return conPuntos;
  }, [currentPage, totalPages]);

  const setPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    document.getElementById('titulo-proximas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={styles.pagina}>
      <div className={styles.contenedor}>
        {destacada && (
          <div className={styles.destacada}>
            <SubastaDestacada subasta={destacada} />
          </div>
        )}

        <div className={styles.cabecera}>
          <div>
            <Etiqueta tamano="grande">Agenda</Etiqueta>
            <h1 className={styles.titulo} id="titulo-proximas">
              Todas las subastas
            </h1>
          </div>
          {data && <p className={styles.total}>Total subastas ({data.total})</p>}
        </div>

        <div className={styles.grilla}>
          {pagina.map((a, i) => {
            const s = toSubasta(a, now);
            return (
              <TarjetaSubasta
                key={a.id}
                id={a.id}
                estado={s.estado}
                titulo={s.titulo}
                ubicacion={s.ubicacion}
                descripcion={s.descripcion}
                fecha={s.fecha}
                hora={s.hora}
                imagen={a.coverImageUrl ? uploadUrl(a.coverImageUrl) : FOTOS_EJEMPLO[(inicio + i) % FOTOS_EJEMPLO.length]}
                countdown={s.countdown}
              />
            );
          })}
        </div>
        {data && data.total === 0 && <p className={styles.sinSubastas}>Pronto vamos a publicar nuevas subastas.</p>}
        {error && !data && (
          <p className={styles.sinSubastas}>No pudimos cargar las subastas. Probá de nuevo en un momento.</p>
        )}

        {totalPages > 1 && (
          <nav className={styles.paginacion} aria-label="Páginas de subastas">
            {visiblePages.map((p, i) =>
              typeof p === 'number' ? (
                <button
                  key={p}
                  type="button"
                  className={p === currentPage ? styles.actual : undefined}
                  aria-current={p === currentPage ? 'page' : undefined}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ) : (
                <span key={`puntos-${i}`} className={styles.puntos}>
                  …
                </span>
              ),
            )}
            <button
              type="button"
              className={styles.siguiente}
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Siguiente →
            </button>
          </nav>
        )}

        <div className={styles.redes}>
          <BannerRedes />
        </div>
      </div>

      <PreguntasFrecuentes items={preguntasDestacadas} enlace="link" className={styles.faq} />
    </div>
  );
}
