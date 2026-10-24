import { useState, type FormEvent } from 'react';
import BannerRedes from '../../components/secciones/BannerRedes';
import { api, ApiError } from '../../services/api';
import styles from './Contactanos.module.scss';

// Contactanos (Figma "Contactanos 1440x1029", frame 721:73903): fondo claro
// con patrón, "Hablemos / Sin vueltas." a la izquierda, formulario a la
// derecha y el banner de redes abajo. La consulta va a POST /api/contacto
// (la guarda y avisa por mail al equipo), igual que SeccionVender.
export default function Contactanos() {
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
      const res = await api.post<{ message: string }>('/contacto', {
        name: nombre,
        email,
        message: mensaje,
        source: 'contactanos',
      });
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
    <div className={styles.pagina}>
      <div className={styles.contenedor}>
        <section className={styles.contacto}>
          <div>
            <h1 className={styles.titulo}>
              Hablemos
              <em>Sin vueltas.</em>
            </h1>
            <p className={styles.bajada}>
              Si querés comprar, vender o simplemente entender mejor cómo funcionan nuestras subastas, estamos para
              ayudarte.
            </p>
          </div>

          <form className={styles.formulario} onSubmit={enviar}>
            <label className={styles.campo}>
              <span>Nombre</span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                autoComplete="name"
                required
                maxLength={120}
              />
            </label>
            <label className={styles.campo}>
              <span>E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Tu e-mail"
                autoComplete="email"
                required
              />
            </label>
            <label className={`${styles.campo} ${styles.campoAncho}`}>
              <span>Mensaje</span>
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="¿Qué te gustaría saber?"
                required
                rows={1}
                maxLength={3000}
              />
            </label>

            <div className={styles.campoAncho} aria-live="polite">
              {ok && <p className={styles.aviso}>{ok}</p>}
              {error && <p className={`${styles.aviso} ${styles.avisoError}`}>{error}</p>}
            </div>

            <button className={`${styles.enviar} ${styles.campoAncho}`} type="submit" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar consulta →'}
            </button>
          </form>
        </section>

        <div className={styles.redes}>
          <BannerRedes />
        </div>
      </div>
    </div>
  );
}
