import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../services/api';
import Etiqueta from '../ui/Etiqueta';
import styles from './SeccionVender.module.scss';

// Sección "¿Tenés bienes para vender?" del rediseño (Figma: banda verde
// #3e6d72 de 506 px con el título a la izquierda y el formulario a la
// derecha). Se repite en Home, Quiénes somos y Quiero vender; manda la
// consulta a POST /api/contacto, que la guarda y avisa por mail al equipo.
interface Props {
  /** Desde qué página se manda (queda guardado con la consulta) */
  origen: string;
}

export default function SeccionVender({ origen }: Props) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setError('');
    setOk('');
    setEnviando(true);
    try {
      const res = await api.post<{ message: string }>('/contacto', { name: nombre, email, message: mensaje, source: origen });
      setOk(res.message);
      setNombre('');
      setEmail('');
      setMensaje('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar la consulta. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className={styles.seccion}>
      <div className={styles.contenedor}>
        <div className={styles.columnaTexto}>
          <Etiqueta tono="claro">Hablemos</Etiqueta>
          <h2 className={styles.titulo}>
            ¿Tenés bienes
            <br />
            para vender?
          </h2>
          <p className={styles.bajada}>
            Contanos qué querés subastar y nuestro equipo se pondrá en contacto a la brevedad.
          </p>
        </div>

        <form className={styles.formulario} onSubmit={enviar}>
          <label className={styles.campo}>
            <span>Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" required maxLength={120} />
          </label>
          <label className={styles.campo}>
            <span>E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Tu e-mail" required />
          </label>
          <label className={`${styles.campo} ${styles.campoAncho}`}>
            <span>Mensaje</span>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="¿Qué te gustaría subastar?"
              required
              rows={1}
              maxLength={3000}
            />
          </label>

          {ok && <p className={`${styles.aviso} ${styles.campoAncho}`}>{ok}</p>}
          {error && <p className={`${styles.aviso} ${styles.avisoError} ${styles.campoAncho}`}>{error}</p>}

          <button className={`${styles.enviar} ${styles.campoAncho}`} type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar consulta →'}
          </button>
        </form>
      </div>
    </section>
  );
}
