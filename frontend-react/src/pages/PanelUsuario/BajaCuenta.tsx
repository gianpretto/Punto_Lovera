import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import Campo from '../../components/ui/Campo';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError } from '../../services/api';
import { LARGOS } from '../../services/validaciones';
import styles from './PanelUsuario.module.scss';

// "Dar de baja mi cuenta" (DELETE /auth/me): link discreto al final del
// perfil que abre la confirmación con la contraseña. El backend no deja si
// tiene crédito cargado, va ganando un lote o tiene trámites pendientes.
export default function BajaCuenta() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [abierta, setAbierta] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setError('');
    setEnviando(true);
    try {
      await api.delete('/auth/me', { password: password || undefined });
      logout();
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo dar de baja la cuenta.');
    } finally {
      setEnviando(false);
    }
  };

  if (!abierta) {
    return (
      <button type="button" className={styles.baja} onClick={() => setAbierta(true)}>
        Dar de baja mi cuenta
      </button>
    );
  }

  return (
    <form className={styles.bajaFormulario} onSubmit={confirmar} noValidate>
      <p>Se borran tus datos personales y no vas a poder volver a entrar con esta cuenta.</p>
      <Campo
        etiqueta="Tu contraseña"
        type="password"
        autoComplete="current-password"
        placeholder="Si entrás con Google, dejala vacía"
        maxLength={LARGOS.password}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className={styles.bajaAcciones}>
        <Boton type="submit" variante="oscuro" disabled={enviando}>
          {enviando ? 'Dando de baja...' : 'Confirmar baja'}
        </Boton>
        <button type="button" className={styles.baja} onClick={() => setAbierta(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
