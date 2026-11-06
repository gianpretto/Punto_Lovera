import type { ReactNode } from 'react';
import SeccionVender from '../secciones/SeccionVender';
import Etiqueta from '../ui/Etiqueta';
import styles from './PantallaAuth.module.scss';

// Layout común de Login, Registro, Recuperar contraseña y Validar mail.
// Wireframes "Log in" / "Sign in" (620:12755, 620:12854): foto a la
// izquierda (838 de 1440 px) y el formulario a la derecha (433 px); abajo
// la banda "¿Querés vender?". En celular (620:14958) el formulario va
// primero y la foto queda como banda debajo. La foto lleva el mismo
// tratamiento que el hero de Home (blanco y negro, oscurecida y teñida de
// verde).
interface Props {
  etiqueta: string;
  /** Título serif grande; la parte en itálica va en <em> */
  titulo: ReactNode;
  bajada?: ReactNode;
  /** Origen que queda guardado si mandan la consulta de "¿Querés vender?" */
  origen: string;
  children: ReactNode;
  /** Foto a la derecha y formulario a la izquierda (Registro, para que no sea igual al Login) */
  invertida?: boolean;
}

export default function PantallaAuth({ etiqueta, titulo, bajada, origen, children, invertida = false }: Props) {
  return (
    <>
      <div className={`${styles.pantalla} ${invertida ? styles.invertida : ''}`}>
        <div className={styles.foto} aria-hidden="true">
          <img className={styles.fotoImagen} src="/assets/figma/subasta-cocina-3.webp" alt="" />
          <div className={styles.fotoTinte} />
        </div>

        <section className={styles.columna}>
          <div className={styles.contenido}>
            <Etiqueta tono="verde">{etiqueta}</Etiqueta>
            <h1 className={styles.titulo}>{titulo}</h1>
            {bajada && <p className={styles.bajada}>{bajada}</p>}
            {children}
          </div>
        </section>
      </div>

      <SeccionVender origen={origen} />
    </>
  );
}
