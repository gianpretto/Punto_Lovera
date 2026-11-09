import { useState, type FormEvent } from 'react';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import Campo from '../../components/ui/Campo';
import { api, ApiError, setToken } from '../../services/api';
import { LARGOS, passwordNueva } from '../../services/validaciones';
import styles from './PanelUsuario.module.scss';

// "Cambiar mi contraseña" (POST /auth/me/password): link discreto al final
// del perfil, como "Dar de baja mi cuenta". El backend cierra las otras
// sesiones abiertas y devuelve un token nuevo para seguir en esta.
export default function CambiarPassword() {
  const [abierta, setAbierta] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setError('');
    const invalida = passwordNueva(nueva);
    if (invalida) return setError(invalida);

    setEnviando(true);
    try {
      const res = await api.post<{ token: string; message: string }>('/auth/me/password', {
        currentPassword: actual || undefined,
        newPassword: nueva,
      });
      setToken(res.token);
      setOk(res.message);
      setAbierta(false);
      setActual('');
      setNueva('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setEnviando(false);
    }
  };

  if (!abierta) {
    return (
      <>
        {ok && <Aviso>{ok}</Aviso>}
        <button
          type="button"
          className={styles.baja}
          onClick={() => {
            setOk('');
            setAbierta(true);
          }}
        >
          Cambiar mi contraseña
        </button>
      </>
    );
  }

  return (
    <form className={styles.bajaFormulario} onSubmit={guardar} noValidate>
      <p>Al cambiarla se cierra tu sesión en los otros dispositivos.</p>
      <Campo
        etiqueta="Contraseña actual"
        type="password"
        autoComplete="current-password"
        placeholder="Si entrás con Google, dejala vacía"
        maxLength={LARGOS.password}
        value={actual}
        onChange={(e) => setActual(e.target.value)}
      />
      <Campo
        etiqueta="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        maxLength={LARGOS.password}
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className={styles.bajaAcciones}>
        <Boton type="submit" variante="oscuro" disabled={enviando}>
          {enviando ? 'Guardando...' : 'Cambiar contraseña'}
        </Boton>
        <button type="button" className={styles.baja} onClick={() => setAbierta(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
