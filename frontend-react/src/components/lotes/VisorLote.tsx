import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import BotonFlecha from './BotonFlecha';
import type { LoteCatalogo } from './lote';
import styles from './VisorLote.module.scss';

// Pop-up de fotos y detalle de un lote (Figma "popup"): fondo negro al 85 %,
// panel blanco con la foto (780 x 546) a la izquierda y el detalle a la
// derecha, "CERRAR ✕" arriba. Accesible: diálogo modal, Escape cierra,
// flechas ← → pasan las fotos, el foco queda atrapado adentro y vuelve al
// botón que lo abrió al cerrar.
interface Props {
  lote: LoteCatalogo;
  fotoInicial?: number;
  onCerrar: () => void;
}

const ENFOCABLES = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function VisorLote({ lote, fotoInicial = 0, onCerrar }: Props) {
  const [foto, setFoto] = useState(fotoInicial);
  // La foto sola a pantalla completa (al tocarla)
  const [soloFoto, setSoloFoto] = useState(false);
  const dialogo = useRef<HTMLDivElement>(null);
  const cerrar = useRef<HTMLButtonElement>(null);
  const total = lote.imagenes.length;
  const varias = total > 1;

  const ir = (paso: number) => setFoto((i) => (i + paso + total) % total);

  // Foco inicial en "Cerrar", bloquea el scroll de la página y al cerrar
  // devuelve el foco a donde estaba.
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrar.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, []);

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // Primero cierra la foto sola, después el visor
        if (soloFoto) setSoloFoto(false);
        else onCerrar();
      } else if (e.key === 'ArrowRight' && total > 1) {
        e.preventDefault();
        setFoto((i) => (i + 1) % total);
      } else if (e.key === 'ArrowLeft' && total > 1) {
        e.preventDefault();
        setFoto((i) => (i - 1 + total) % total);
      } else if (e.key === 'Tab' && dialogo.current) {
        // Foco atrapado: Tab / Shift+Tab giran dentro del diálogo
        const items = Array.from(dialogo.current.querySelectorAll<HTMLElement>(ENFOCABLES));
        if (items.length === 0) return;
        const primero = items[0];
        const ultimo = items[items.length - 1];
        const actual = document.activeElement;
        if (e.shiftKey && (actual === primero || !dialogo.current.contains(actual))) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && (actual === ultimo || !dialogo.current.contains(actual))) {
          e.preventDefault();
          primero.focus();
        }
      }
    };
    document.addEventListener('keydown', teclas);
    return () => document.removeEventListener('keydown', teclas);
  }, [onCerrar, total, soloFoto]);

  const tituloId = `visor-lote-${lote.id}`;

  return createPortal(
    <div className={styles.fondo} onClick={onCerrar}>
      <div
        ref={dialogo}
        className={styles.dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={cerrar} type="button" className={styles.cerrar} onClick={onCerrar}>
          CERRAR
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1.5 1.5l13 13M14.5 1.5l-13 13" stroke="currentColor" strokeWidth="3" />
          </svg>
        </button>

        <div className={styles.panel}>
          <div className={styles.media}>
            {total > 0 ? (
              <button
                type="button"
                className={styles.fotoBoton}
                onClick={() => setSoloFoto(true)}
                aria-label="Ver la foto sola, en grande"
              >
                <img
                  className={styles.foto}
                  src={lote.imagenes[foto]}
                  alt={varias ? `${lote.titulo}, foto ${foto + 1} de ${total}` : lote.titulo}
                />
                <span className={styles.lupa} aria-hidden="true">
                  Tocá para ampliar
                </span>
              </button>
            ) : (
              <span className={styles.sinFotos}>Este lote todavía no tiene fotos</span>
            )}

            {varias && (
              <>
                <BotonFlecha direccion="anterior" onClick={() => ir(-1)} className={styles.flechaIzq} />
                <BotonFlecha direccion="siguiente" onClick={() => ir(1)} className={styles.flechaDer} />
                <div className={styles.puntos}>
                  {lote.imagenes.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`${styles.punto} ${i === foto ? styles.puntoActivo : ''}`}
                      onClick={() => setFoto(i)}
                      aria-label={`Ver foto ${i + 1} de ${total}`}
                      aria-current={i === foto ? 'true' : undefined}
                    />
                  ))}
                </div>
              </>
            )}
            <p className={styles.oculto} aria-live="polite">
              {varias ? `Foto ${foto + 1} de ${total}` : ''}
            </p>
          </div>

          <div className={styles.detalle}>
            <p className={styles.etiquetas}>
              <span className={styles.numero}>LOTE {lote.numeroTexto}</span>
              {lote.etiqueta && <span>{lote.etiqueta}</span>}
            </p>
            <h2 id={tituloId} className={styles.titulo}>
              {lote.titulo}
            </h2>
            {lote.resumen && <p className={styles.resumen}>{lote.resumen}</p>}
            {lote.detalle.length > 0 && (
              <div className={styles.texto}>
                {lote.detalle.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {soloFoto && total > 0 && (
        <div
          className={styles.soloFoto}
          onClick={(e) => {
            e.stopPropagation();
            setSoloFoto(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${foto + 1} de ${total} de ${lote.titulo}`}
        >
          <img
            src={lote.imagenes[foto]}
            alt={varias ? `${lote.titulo}, foto ${foto + 1} de ${total}` : lote.titulo}
            onClick={(e) => e.stopPropagation()}
          />
          <button type="button" className={styles.soloFotoCerrar} onClick={() => setSoloFoto(false)}>
            CERRAR ✕
          </button>
          {varias && (
            <>
              <BotonFlecha
                direccion="anterior"
                onClick={(e) => {
                  e.stopPropagation();
                  ir(-1);
                }}
                className={styles.flechaIzq}
              />
              <BotonFlecha
                direccion="siguiente"
                onClick={(e) => {
                  e.stopPropagation();
                  ir(1);
                }}
                className={styles.flechaDer}
              />
              <p className={styles.soloFotoContador}>
                {foto + 1} / {total}
              </p>
            </>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
