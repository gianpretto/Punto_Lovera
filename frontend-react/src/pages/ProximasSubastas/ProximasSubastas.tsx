import { useEffect, useMemo, useState } from 'react';
import SubastaEnVivo from '../../components/secciones/SubastaEnVivo';
import TarjetaSubasta from '../../components/tarjetas/TarjetaSubasta';
import Redes from '../../components/secciones/Redes';
import SubastasAnteriores from '../../components/secciones/SubastasAnteriores';
import { makeCountdown, type Subasta } from '../../interfaces/subasta';
import styles from './ProximasSubastas.module.scss';

// 36 items para poder mostrar 3 páginas de 12
const allSubastas: Subasta[] = Array.from({ length: 36 }, (_, i) => ({
  id: i + 1,
  estado: i % 3 === 0 ? 'ACTIVA' : 'PRÓXIMA',
  titulo: `Subasta #${i + 1} - Heladería con elaboración`,
  ubicacion: i % 2 === 0 ? 'Castelar, Buenos Aires' : 'Morón, Buenos Aires',
  descripcion:
    'Alguna información relevante o interesante para detallar en un muy breve texto descriptivo, que no dure más que esto.',
  fecha: `Miércoles ${10 + (i % 20)}/11/25`,
  hora: `${10 + (i % 12)}:00`,
  countdown: makeCountdown(0, 5, 48, 9),
}));

export default function ProximasSubastas() {
  const [itemsPerPage, setItemsPerPage] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 425 ? 4 : 12
  );
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(allSubastas.length / itemsPerPage));

  useEffect(() => {
    const checkScreenSize = () => {
      setItemsPerPage(window.innerWidth <= 425 ? 4 : 12);
    };
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    setCurrentPage((p) => (p > totalPages ? 1 : p));
  }, [totalPages]);

  const paginatedSubastas = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return allSubastas.slice(start, start + itemsPerPage);
  }, [currentPage, itemsPerPage]);

  const visiblePages = useMemo((): (number | string)[] => {
    const total = totalPages;
    const current = currentPage;
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta) || i <= 3) {
        range.push(i);
      }
    }

    const uniqueRange = [...new Set(range)].sort((a, b) => a - b);

    for (const i of uniqueRange) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  }, [currentPage, totalPages]);

  const setPage = (page: number | string) => {
    if (typeof page === 'string') return;
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      const titleElement = document.getElementById('titulo-proximas');
      if (titleElement) {
        titleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const nextPage = () => {
    if (currentPage < totalPages) setPage(currentPage + 1);
  };

  return (
    <>
      <SubastaEnVivo />

      <section className={styles.prox}>
        <div className={styles.proxInner}>
          <h2 className={styles.proxTitulo} id="titulo-proximas">PRÓXIMAS SUBASTAS</h2>

          <div className={styles.proxGrid}>
            {paginatedSubastas.map((subasta) => (
              <TarjetaSubasta
                key={subasta.id}
                id={subasta.id}
                estado={subasta.estado}
                titulo={subasta.titulo}
                ubicacion={subasta.ubicacion}
                descripcion={subasta.descripcion}
                fecha={subasta.fecha}
                hora={subasta.hora}
                mostrarCuentaRegresiva={true}
                countdown={subasta.countdown}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.paginationWrapper}>
              <div className={styles.pagination}>
                {visiblePages.map((p, i) => (
                  <button
                    key={`${p}-${i}`}
                    className={`${styles.paginationPage} ${p === currentPage ? styles.active : ''} ${p === '...' ? styles.disabledDots : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}

                <button
                  className={`${styles.paginationNext} ${currentPage === totalPages ? styles.disabled : ''}`}
                  onClick={nextPage}
                  disabled={currentPage === totalPages}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Redes />

      <SubastasAnteriores />
    </>
  );
}
