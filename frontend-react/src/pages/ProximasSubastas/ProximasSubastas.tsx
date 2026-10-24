import { useEffect, useMemo, useState } from 'react';
import Etiqueta from '../../components/ui/Etiqueta';
import TarjetaSubasta from '../../components/tarjetas/TarjetaSubasta';
import SubastaDestacada from '../../components/secciones/SubastaDestacada';
import BannerRedes from '../../components/secciones/BannerRedes';
import PreguntasFrecuentes from '../../components/secciones/PreguntasFrecuentes';
import { preguntasDestacadas } from '../../content/participar';
import { uploadUrl } from '../../services/api';
import { toSubasta, useAuctions, useNow } from '../../services/auctions';
import { ordenarSubastas } from '../../utils/ordenarSubastas';
import styles from './ProximasSubastas.module.scss';

// "Todas las subastas" del rediseño (Figma "Proximas subastas"): subasta en
// vivo (o la próxima) arriba, grilla de 4 x 3 con paginación (en vivo,
// próximas y terminadas), redes y preguntas frecuentes.

const FOTOS_EJEMPLO = [
  '/assets/figma/subasta-cocina-2.webp',
  '/assets/figma/subasta-cocina-1.webp',
  '/assets/figma/subasta-cafeteria.webp',
  '/assets/figma/subasta-cocina-3.webp',
];

const porPagina = () => (typeof window !== 'undefined' && window.innerWidth <= 425 ? 4 : 12);

export default function ProximasSubastas() {
  const now = useNow();
  const subastas = useAuctions(['ACTIVA', 'PROXIMA', 'FINALIZADA']);
  const ordenadas = useMemo(() => ordenarSubastas(subastas ?? []), [subastas]);
  const destacada = ordenadas.find((a) => a.status !== 'FINALIZADA');

  const [itemsPerPage, setItemsPerPage] = useState(porPagina);
  const [paginaElegida, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(ordenadas.length / itemsPerPage));
  // Si cambia la cantidad por página (resize) y la elegida ya no existe, vuelve a la 1
  const currentPage = paginaElegida > totalPages ? 1 : paginaElegida;

  useEffect(() => {
    const checkScreenSize = () => setItemsPerPage(porPagina());
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const inicio = (currentPage - 1) * itemsPerPage;
  const pagina = ordenadas.slice(inicio, inicio + itemsPerPage);

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
          {subastas && <p className={styles.total}>Total subastas ({ordenadas.length})</p>}
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
        {subastas && ordenadas.length === 0 && (
          <p className={styles.sinSubastas}>Pronto vamos a publicar nuevas subastas.</p>
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
