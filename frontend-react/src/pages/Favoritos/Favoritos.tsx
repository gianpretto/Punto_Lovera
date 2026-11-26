import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Etiqueta from '../../components/ui/Etiqueta';
import Boton from '../../components/ui/Boton';
import TarjetaLote from '../../components/lotes/TarjetaLote';
import VisorLote from '../../components/lotes/VisorLote';
import { partirDescripcion, textoNumeroLote, type LoteCatalogo } from '../../components/lotes/lote';
import { useAuth } from '../../services/AuthContext';
import { api } from '../../services/api';
import { formatFecha, lotImages, type LotApi } from '../../services/auctions';
import styles from './Favoritos.module.scss';

// "Mis favoritos" (pedido del cliente, nov 2026): los lotes que el usuario
// marcó con el corazón en el catálogo, agrupados por remate.

interface FavoritoApi extends LotApi {
  auction: { id: string; title: string; startsAt: string; status: string; location: string };
}

const aLote = (lot: FavoritoApi): LoteCatalogo => ({
  id: lot.id,
  numero: lot.number,
  numeroTexto: textoNumeroLote(lot.number, lot.bis),
  titulo: lot.title,
  ...partirDescripcion(lot.description),
  etiqueta: lot.sold ? 'VENDIDO' : 'SIN BASE',
  imagenes: lotImages(lot),
});

export default function Favoritos() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [lotes, setLotes] = useState<FavoritoApi[] | null>(null);
  const [visor, setVisor] = useState<{ lote: LoteCatalogo; foto: number } | null>(null);
  const cerrarVisor = useCallback(() => setVisor(null), []);

  useEffect(() => {
    if (!loading && !user) navigate('/login?volver=/favoritos');
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ lots: FavoritoApi[] }>('/favoritos')
      .then(({ lots }) => setLotes(lots))
      .catch(() => setLotes([]));
  }, [user]);

  const quitar = async (lotId: string) => {
    setLotes((l) => l?.filter((x) => x.id !== lotId) ?? null);
    await api.delete(`/favoritos/${lotId}`).catch(() => undefined);
  };

  // Agrupados por remate, en el orden en que llegan (el último marcado primero)
  const remates = (lotes ?? []).reduce<{ auction: FavoritoApi['auction']; lots: FavoritoApi[] }[]>((acc, lot) => {
    const grupo = acc.find((g) => g.auction.id === lot.auction.id);
    if (grupo) grupo.lots.push(lot);
    else acc.push({ auction: lot.auction, lots: [lot] });
    return acc;
  }, []);

  return (
    <div className={styles.pagina}>
      <div className={styles.contenedor}>
        <Etiqueta tono="verde">Mi cuenta</Etiqueta>
        <h1 className={styles.titulo}>
          Mis <em>favoritos</em>
        </h1>

        {lotes === null ? (
          <p className={styles.vacio}>Cargando...</p>
        ) : lotes.length === 0 ? (
          <div className={styles.vacio}>
            <p>Todavía no marcaste ningún lote. Tocá el corazón en el catálogo de una subasta para guardarlo acá.</p>
            <Boton variante="verde" to="/subastas" flecha>
              Ver subastas
            </Boton>
          </div>
        ) : (
          remates.map(({ auction, lots }) => (
            <section key={auction.id} className={styles.remate}>
              <h2 className={styles.remateTitulo}>
                <Link to={`/subastas/${auction.id}`}>{auction.title}</Link>
              </h2>
              <p className={styles.remateDatos}>
                {formatFecha(auction.startsAt)} · {auction.location}
              </p>
              <div className={styles.grilla}>
                {lots.map((lot) => {
                  const lote = aLote(lot);
                  return (
                    <TarjetaLote
                      key={lot.id}
                      lote={lote}
                      onVerFotos={(foto) => setVisor({ lote, foto })}
                      favorito
                      onFavorito={() => quitar(lot.id)}
                    />
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {visor && <VisorLote lote={visor.lote} fotoInicial={visor.foto} onCerrar={cerrarVisor} />}
    </div>
  );
}
