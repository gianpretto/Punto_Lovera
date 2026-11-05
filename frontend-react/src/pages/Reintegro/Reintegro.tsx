import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError } from '../../services/api';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import Campo from '../../components/ui/Campo';
import Etiqueta from '../../components/ui/Etiqueta';
import styles from './Reintegro.module.scss';

// Pedido de reintegro: el usuario pide que le devuelvan crédito que no usó.
// El monto queda reservado hasta que un admin transfiere y lo aprueba (se
// descuenta del saldo) o lo rechaza (se libera).

const formatNumber = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

export default function Reintegro() {
  const navigate = useNavigate();
  const { user, loading, refreshUser } = useAuth();
  // Lo que puede pedir: saldo - reservas (lotes que va ganando y reintegros pendientes)
  const disponible = user?.availableCredit ?? 0;

  const [monto, setMonto] = useState('');
  const [cbu, setCbu] = useState('');
  const [alias, setAlias] = useState('');
  const [motivo, setMotivo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  const montoNumero = Number(monto);
  const cbuDigitos = cbu.replace(/[\s-]/g, '');
  const errors = {
    monto: monto === '' || !(montoNumero > 0) || montoNumero > disponible,
    cbu: !/^\d{22}$/.test(cbuDigitos),
    alias: alias.trim() === '',
  };
  const formInvalid = errors.monto || errors.cbu || errors.alias;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (formInvalid || sending) return;

    setSending(true);
    setError('');
    try {
      await api.post('/creditos/reintegros', {
        amount: montoNumero,
        cbu: cbuDigitos,
        alias: alias.trim(),
        reason: motivo.trim() || undefined,
      });
      // El disponible baja: el monto queda reservado mientras se procesa
      await refreshUser();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el pedido de reintegro.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => navigate('/creditos'), 3000);
    return () => clearTimeout(t);
  }, [success, navigate]);

  if (!user) return null;

  // Mensajes por campo (antes solo se marcaba el borde en rojo en los que no tenían texto)
  const errorMonto = !submitted || !errors.monto
    ? undefined
    : monto !== '' && montoNumero > disponible
      ? 'Supera tu crédito disponible.'
      : 'Indicá un monto mayor a cero.';
  const errorCbu = !submitted || !errors.cbu
    ? undefined
    : cbu.trim() !== ''
      ? 'El CBU tiene que tener 22 dígitos.'
      : 'Indicá el CBU.';
  const errorAlias = submitted && errors.alias ? 'Indicá el alias.' : undefined;

  return (
    <div className={styles.pagina}>
      {!success && (
        <div className={styles.contenedor}>
          <div className={styles.columnaTexto}>
            <Etiqueta tono="verde" tamano="grande">
              reintegro
            </Etiqueta>
            <h1 className={styles.titulo}>
              Solicitar <em>reintegro.</em>
            </h1>
            <p className={styles.bajada}>
              Completá los datos de la cuenta donde querés recibir el dinero de vuelta.
            </p>
            <div className={styles.disponible}>
              <span>Podés pedir hasta</span>
              <strong>$ {formatNumber(Math.max(disponible, 0))}</strong>
              <span>(tu crédito disponible)</span>
            </div>
          </div>

          <form className={styles.formulario} onSubmit={onSubmit} noValidate>
            <Campo
              etiqueta="Monto a reintegrar"
              type="number"
              min={1}
              placeholder="$ 0.00"
              value={monto}
              error={errorMonto}
              onChange={(e) => setMonto(e.target.value)}
            />

            <Campo
              etiqueta="CBU (22 dígitos)"
              type="text"
              inputMode="numeric"
              placeholder="0000000000000000000000"
              value={cbu}
              error={errorCbu}
              onChange={(e) => setCbu(e.target.value)}
            />

            <Campo
              etiqueta="Alias"
              type="text"
              placeholder="mi.alias.pago"
              value={alias}
              error={errorAlias}
              onChange={(e) => setAlias(e.target.value)}
            />

            <label className={styles.campo}>
              <span>Motivo (opcional)</span>
              <textarea
                placeholder="¿Por qué solicitas el reintegro?"
                value={motivo}
                maxLength={500}
                rows={2}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>

            {error && <Aviso tipo="error">{error}</Aviso>}

            <div className={styles.acciones}>
              <Boton variante="verde" type="submit" flecha bloque disabled={sending || disponible <= 0}>
                {sending ? 'Enviando...' : 'Solicitar reintegro'}
              </Boton>
              <Link to="/creditos" className={styles.cancelar}>
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      )}

      {success && (
        <section className={styles.exito} aria-live="polite">
          <span className={styles.icono} aria-hidden="true">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <h2 className={styles.exitoTitulo}>
            Solicitud <em>enviada</em>
          </h2>
          <p className={styles.exitoTexto}>
            Recibimos tu pedido de reintegro. El monto queda reservado hasta que te lo transfiramos; te avisamos por mail.
            Serás redirigido a tus créditos en un momento.
          </p>
        </section>
      )}
    </div>
  );
}
