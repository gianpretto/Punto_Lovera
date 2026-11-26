import { useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ApiError, uploadUrl } from '../../services/api';
import panel from '../PanelMartillero/PanelMartillero.module.scss';
import * as v from '../../services/validaciones';
import styles from './AdminSubastas.module.scss';

// Lotes de una subasta dentro de la pantalla de edición: lista, alta,
// edición, borrado y fotos de cada lote. Las reglas (no cambiar el precio
// base ni borrar un lote con ofertas o vendido) las valida el backend; acá
// solo se deshabilitan los controles para que quede claro.

export interface LotImageAdmin {
  id: string;
  url: string;
  position: number;
}

export interface LotAdmin {
  id: string;
  number: number;
  /** "12 bis": agregado a último momento con el mismo número (uno por número) */
  bis?: boolean;
  title: string;
  description: string;
  startingPrice: string;
  currentPrice: string;
  bidIncrement: string;
  sold: boolean;
  leaderId: string | null;
  images: LotImageAdmin[];
}

interface Props {
  auction: { id: string; lots: LotAdmin[] };
  onChange: () => Promise<unknown>;
  onError: (msg: string) => void;
  onAviso: (msg: string) => void;
}

const MAX_FOTOS_POR_SUBIDA = 10;

const pesos = (n: number | string) => `$${Number(n).toLocaleString('es-AR')}`;
const numeroLote = (l: { number: number; bis?: boolean }) => `${l.number}${l.bis ? ' bis' : ''}`;
const mensaje = (err: unknown, porDefecto: string) => (err instanceof ApiError ? err.message : porDefecto);

/** Con ofertas (o vendido) ya no se puede tocar el precio base ni borrar el lote */
const tieneOfertas = (l: LotAdmin) => l.sold || l.leaderId !== null;

export default function LotesSubasta({ auction, onChange, onError, onAviso }: Props) {
  // id del lote que se está editando, 'nuevo' para el alta, null = ninguno
  const [editando, setEditando] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Por número, y el "bis" después de su número
  const lotes = [...auction.lots].sort((a, b) => a.number - b.number || Number(a.bis) - Number(b.bis));
  const loteEditado = editando && editando !== 'nuevo' ? lotes.find((l) => l.id === editando) ?? null : null;
  const siguienteNumero = lotes.reduce((max, l) => Math.max(max, l.number), 0) + 1;

  const borrar = async (lote: LotAdmin) => {
    if (!window.confirm(`¿Borrar el lote ${numeroLote(lote)} "${lote.title}" y sus fotos? No se puede deshacer.`)) return;
    setBusy(lote.id);
    try {
      await api.delete(`/subastas/${auction.id}/lotes/${lote.id}`);
      if (editando === lote.id) setEditando(null);
      await onChange();
      onAviso(`Lote ${numeroLote(lote)} borrado.`);
    } catch (err) {
      onError(mensaje(err, 'No se pudo borrar el lote'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={panel.card}>
      <div className={panel.header}>
        <h2>Lotes ({lotes.length})</h2>
        {editando !== 'nuevo' && (
          <button type="button" className={panel.btnChico} onClick={() => setEditando('nuevo')}>
            Agregar lote
          </button>
        )}
      </div>

      {lotes.length === 0 ? (
        <p className={panel.vacio}>Esta subasta todavía no tiene lotes.</p>
      ) : (
        <div className={panel.tableResponsive}>
          <table className={panel.table}>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Lote</th>
                <th>Base (interna)</th>
                <th>Precio actual</th>
                <th>Incremento</th>
                <th>Fotos</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id} className={editando === l.id ? panel.filaActual : ''}>
                  <td>{numeroLote(l)}</td>
                  <td>{l.title}</td>
                  <td>{pesos(l.startingPrice)}</td>
                  <td>{pesos(l.currentPrice)}</td>
                  <td>{pesos(l.bidIncrement)}</td>
                  <td>{l.images.length}</td>
                  <td>{l.sold ? 'Vendido' : l.leaderId ? 'Con ofertas' : 'Sin ofertas'}</td>
                  <td>
                    <div className={panel.acciones}>
                      <button
                        type="button"
                        className={panel.btnChico}
                        onClick={() => setEditando(editando === l.id ? null : l.id)}
                      >
                        {editando === l.id ? 'Cerrar' : 'Editar'}
                      </button>
                      <button
                        type="button"
                        className={`${panel.btnGris} ${styles.chico}`}
                        onClick={() => borrar(l)}
                        disabled={busy === l.id || tieneOfertas(l)}
                        title={tieneOfertas(l) ? 'No se puede borrar un lote vendido o con ofertas' : undefined}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando === 'nuevo' && (
        <LoteEditor
          key="nuevo"
          auctionId={auction.id}
          lote={null}
          siguienteNumero={siguienteNumero}
          onCerrar={() => setEditando(null)}
          onCreado={async (id) => {
            await onChange();
            setEditando(id);
            onAviso('Lote creado. Ya podés subirle fotos.');
          }}
          onChange={onChange}
          onError={onError}
          onAviso={onAviso}
        />
      )}
      {loteEditado && (
        <LoteEditor
          key={loteEditado.id}
          auctionId={auction.id}
          lote={loteEditado}
          siguienteNumero={siguienteNumero}
          onCerrar={() => setEditando(null)}
          onCreado={() => Promise.resolve()}
          onChange={onChange}
          onError={onError}
          onAviso={onAviso}
        />
      )}
    </section>
  );
}

interface EditorProps {
  auctionId: string;
  lote: LotAdmin | null; // null = lote nuevo
  siguienteNumero: number;
  onCerrar: () => void;
  onCreado: (id: string) => Promise<void>;
  onChange: () => Promise<unknown>;
  onError: (msg: string) => void;
  onAviso: (msg: string) => void;
}

function LoteEditor({ auctionId, lote, siguienteNumero, onCerrar, onCreado, onChange, onError, onAviso }: EditorProps) {
  const [number, setNumber] = useState(String(lote?.number ?? siguienteNumero));
  const [bis, setBis] = useState(lote?.bis ?? false);
  // Fotos elegidas al crear el lote: se suben apenas se crea
  const [fotosNuevas, setFotosNuevas] = useState<File[]>([]);
  const [title, setTitle] = useState(lote?.title ?? '');
  const [description, setDescription] = useState(lote?.description ?? '');
  const [startingPrice, setStartingPrice] = useState(lote ? String(Number(lote.startingPrice)) : '');
  const [bidIncrement, setBidIncrement] = useState(lote ? String(Number(lote.bidIncrement)) : '');
  const [busy, setBusy] = useState(false);

  const precioBloqueado = lote ? tieneOfertas(lote) : false;
  const base = `/subastas/${auctionId}/lotes`;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const invalido = v.primero(
      Number.isInteger(Number(number)) && Number(number) >= 1 && Number(number) <= 100_000
        ? undefined
        : 'El número de lote tiene que ser un entero entre 1 y 100.000.',
      v.requerido(title, 'Indicá un título para el lote.'),
      v.largoMaximo(title, v.LARGOS.titulo),
      v.requerido(description, 'Indicá una descripción para el lote.'),
      v.largoMaximo(description, v.LARGOS.descripcion),
      precioBloqueado ? undefined : v.monto(startingPrice, 'El precio base'),
      bidIncrement ? v.monto(bidIncrement, 'El incremento') : undefined
    );
    if (invalido) {
      onError(invalido);
      return;
    }
    if (!lote && fotosNuevas.length > MAX_FOTOS_POR_SUBIDA) {
      onError(`Podés subir hasta ${MAX_FOTOS_POR_SUBIDA} fotos por vez.`);
      return;
    }
    const datos = {
      number: Number(number),
      bis,
      title: title.trim(),
      description: description.trim(),
      ...(precioBloqueado ? {} : { startingPrice: Number(startingPrice) }),
      ...(bidIncrement ? { bidIncrement: Number(bidIncrement) } : {}),
    };
    setBusy(true);
    try {
      if (lote) {
        await api.patch(`${base}/${lote.id}`, datos);
        await onChange();
        onAviso(`Lote ${numeroLote(datos)} guardado.`);
      } else {
        const { lot } = await api.post<{ lot: { id: string } }>(base, datos);
        // Las fotos que eligió al crearlo se suben enseguida
        if (fotosNuevas.length > 0) {
          const fd = new FormData();
          fotosNuevas.forEach((f) => fd.append('images', f));
          try {
            await api.post(`${base}/${lot.id}/imagenes`, fd);
          } catch (err) {
            onError(mensaje(err, 'El lote se creó, pero no se pudieron subir las fotos'));
          }
        }
        await onCreado(lot.id);
      }
    } catch (err) {
      onError(mensaje(err, 'No se pudo guardar el lote'));
    } finally {
      setBusy(false);
    }
  };

  const subirFotos = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!lote || files.length === 0) return;
    if (files.length > MAX_FOTOS_POR_SUBIDA) {
      onError(`Podés subir hasta ${MAX_FOTOS_POR_SUBIDA} fotos por vez.`);
      return;
    }
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    setBusy(true);
    try {
      await api.post(`${base}/${lote.id}/imagenes`, fd);
      await onChange();
      onAviso(files.length === 1 ? 'Foto subida.' : `${files.length} fotos subidas.`);
    } catch (err) {
      onError(mensaje(err, 'No se pudieron subir las fotos'));
    } finally {
      setBusy(false);
    }
  };

  const borrarFoto = async (imageId: string) => {
    if (!lote || !window.confirm('¿Borrar esta foto?')) return;
    setBusy(true);
    try {
      await api.delete(`${base}/${lote.id}/imagenes/${imageId}`);
      await onChange();
      onAviso('Foto borrada.');
    } catch (err) {
      onError(mensaje(err, 'No se pudo borrar la foto'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.loteEditor}>
      <h3>{lote ? `Editar lote ${numeroLote(lote)}` : 'Nuevo lote'}</h3>
      <form className={`${styles.form} ${styles.formLote}`} onSubmit={guardar}>
        <label className={styles.campo}>
          <span>Número</span>
          <input
            className={panel.input}
            type="number"
            min={1}
            max={100000}
            step={1}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            required
          />
          <span className={styles.check}>
            <input type="checkbox" checked={bis} onChange={(e) => setBis(e.target.checked)} />
            Bis
          </span>
          <span className={styles.ayuda}>
            "Bis": un lote de último momento con el mismo número (ej. 12 bis). Uno solo por número.
          </span>
        </label>
        <label className={`${styles.campo} ${styles.loteTitulo}`}>
          <span>Título</span>
          <input className={panel.input} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={v.LARGOS.titulo} />
        </label>
        <label className={`${styles.campo} ${styles.campoAncho}`}>
          <span>Descripción</span>
          <textarea
            className={panel.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={3}
            maxLength={v.LARGOS.descripcion}
          />
        </label>
        <label className={`${styles.campo} ${styles.mitad}`}>
          <span>Precio base ($) · interno</span>
          <input
            className={panel.input}
            type="number"
            min={1}
            step="any"
            max={v.MONTO_MAXIMO}
            value={startingPrice}
            onChange={(e) => setStartingPrice(e.target.value)}
            required
            disabled={precioBloqueado}
          />
          {precioBloqueado ? (
            <span className={styles.ayuda}>No se puede cambiar: el lote ya tiene ofertas.</span>
          ) : (
            <span className={styles.ayuda}>
              El público ve "SIN BASE". En la sala, la primera oferta mínima es este precio.
            </span>
          )}
        </label>
        <label className={`${styles.campo} ${styles.mitad}`}>
          <span>Incremento de puja ($)</span>
          <input
            className={panel.input}
            type="number"
            min={1}
            step="any"
            max={v.MONTO_MAXIMO}
            value={bidIncrement}
            onChange={(e) => setBidIncrement(e.target.value)}
            placeholder="1000"
          />
          <span className={styles.ayuda}>Cuánto tiene que subir, como mínimo, cada oferta.</span>
        </label>
        {!lote && (
          <label className={`${styles.campo} ${styles.campoAncho}`}>
            <span>Fotos (opcional)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={(e) => setFotosNuevas(Array.from(e.target.files ?? []))}
              disabled={busy}
            />
            <span className={styles.ayuda}>
              {fotosNuevas.length > 0
                ? `${fotosNuevas.length} ${fotosNuevas.length === 1 ? 'foto elegida' : 'fotos elegidas'}: se suben al crear el lote.`
                : `Hasta ${MAX_FOTOS_POR_SUBIDA} por vez, 8 MB cada una. También podés agregarlas después.`}
            </span>
          </label>
        )}
        <div className={styles.botonera}>
          <button type="submit" className={panel.btnNegro} disabled={busy}>
            {busy ? 'Guardando...' : lote ? 'Guardar lote' : 'Crear lote'}
          </button>
          <button type="button" className={panel.btnGris} onClick={onCerrar} disabled={busy}>
            {lote ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>
      </form>

      {lote && (
        <>
          <h3 className={panel.mt}>Fotos ({lote.images.length})</h3>
          {lote.images.length === 0 ? (
            <p className={panel.vacio}>Este lote todavía no tiene fotos.</p>
          ) : (
            <div className={styles.fotos}>
              {lote.images.map((img) => (
                <div key={img.id} className={styles.foto}>
                  <img src={uploadUrl(img.url)} alt={`Foto del lote ${numeroLote(lote)}`} />
                  <button
                    type="button"
                    className={styles.borrarFoto}
                    onClick={() => borrarFoto(img.id)}
                    disabled={busy}
                    aria-label="Borrar foto"
                    title="Borrar foto"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className={styles.subirFotos}>
            <label className={`${panel.btnChico} ${styles.archivo}`}>
              {busy ? 'Subiendo...' : 'Subir fotos'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                onChange={subirFotos}
                disabled={busy}
              />
            </label>
            <span className={styles.ayuda}>Hasta {MAX_FOTOS_POR_SUBIDA} por vez, 8 MB cada una.</span>
          </div>
        </>
      )}
    </div>
  );
}
