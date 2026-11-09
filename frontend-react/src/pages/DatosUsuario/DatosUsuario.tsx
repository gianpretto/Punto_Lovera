import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SeccionVender from '../../components/secciones/SeccionVender';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import Campo from '../../components/ui/Campo';
import CampoFecha from '../../components/ui/CampoFecha';
import Etiqueta from '../../components/ui/Etiqueta';
import { useAuth, type User } from '../../services/AuthContext';
import { api, ApiError } from '../../services/api';
import * as v from '../../services/validaciones';
import styles from './DatosUsuario.module.scss';
import { destinoSeguro } from '../../services/destinoSeguro';

// /datos — "Cargá tus datos" (wireframes 620:12952 escritorio y 620:15133
// celular; sin diseño final). Sigue el lenguaje de Contactanos: fondo claro
// con patrón, título serif a la izquierda con el avatar y el formulario de
// campos subrayados a la derecha; abajo la banda verde de SeccionVender.
//
// Para ofertar hacen falta nombre, apellido, DNI/CUIL y el celular
// verificado (código por WhatsApp, POST /auth/me/celular). De la fecha de
// nacimiento para abajo es opcional (pedido del cliente, nov 2026).

interface FormState {
  nombre: string;
  apellido: string;
  dni: string;
  fechaNacimiento: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  cp: string;
}

type NombreCampo = keyof FormState;

function formDesdeUsuario(user: User | null): FormState {
  return {
    nombre: user?.firstName ?? '',
    apellido: user?.lastName ?? '',
    dni: user?.dni ?? '',
    fechaNacimiento: user?.birthDate ?? '',
    direccion: user?.address ?? '',
    ciudad: user?.city ?? '',
    provincia: user?.province ?? '',
    cp: user?.zipCode ?? '',
  };
}

// Mismas reglas que el backend. Los opcionales solo controlan largo y formato.
function validar(form: FormState): Record<NombreCampo, string | undefined> {
  return {
    nombre: v.nombrePersona(form.nombre, 'nombre'),
    apellido: v.nombrePersona(form.apellido, 'apellido'),
    dni: v.dniOCuil(form.dni),
    fechaNacimiento: undefined,
    direccion: v.largoMaximo(form.direccion, v.LARGOS.direccion),
    ciudad: v.largoMaximo(form.ciudad, v.LARGOS.ciudad),
    provincia: v.largoMaximo(form.provincia, v.LARGOS.provincia),
    cp: v.codigoPostal(form.cp),
  };
}

const soloDigitos = (valor: string) => valor.replace(/\D/g, '');

export default function DatosUsuario() {
  const navigate = useNavigate();
  const { user, loading, updateUserData, setUser } = useAuth();
  const [searchParams] = useSearchParams();
  // Ej: la sala del remate manda acá para completar datos antes de ofertar
  const volver = searchParams.get('volver');
  const destino = destinoSeguro(volver, '/perfil');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(() => formDesdeUsuario(user));
  // TODO: el backend todavía no guarda avatar; queda local a este navegador
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => localStorage.getItem('userAvatar'));
  const [touched, setTouched] = useState<Partial<Record<NombreCampo, boolean>>>({});
  const [dirty, setDirty] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Celular: se guarda y se verifica aparte, con un código por WhatsApp
  const [area, setArea] = useState(user?.phoneAreaCode ?? '');
  const [numero, setNumero] = useState(user?.phone ?? '');
  const [celularTocado, setCelularTocado] = useState(false);
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [celularMensaje, setCelularMensaje] = useState('');
  const [celularError, setCelularError] = useState('');
  const [celularEnviando, setCelularEnviando] = useState(false);

  // Sin sesión no hay datos que editar
  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  // Si el usuario termina de cargar después del primer render, completamos
  // el formulario (sin pisar lo que ya se haya editado).
  useEffect(() => {
    if (user && !dirty) setForm(formDesdeUsuario(user));
    if (user && !celularTocado) {
      setArea(user.phoneAreaCode ?? '');
      setNumero(user.phone ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setField = (field: NombreCampo, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  };

  const errors = validar(form);
  const formInvalid = Object.values(errors).some(Boolean);

  const mensajeError = (field: NombreCampo) => ((submitted || touched[field]) && errors[field]) || undefined;
  const markTouched = (field: NombreCampo) => setTouched((t) => ({ ...t, [field]: true }));

  // Props comunes de cada campo de texto del formulario
  const campo = (field: NombreCampo, maxLength: number) => ({
    id: `datos-${field}`,
    value: form[field],
    maxLength,
    error: mensajeError(field),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setField(field, e.target.value),
    onBlur: () => markTouched(field),
  });

  // ---------- Celular ----------
  const celularCambio = area !== (user?.phoneAreaCode ?? '') || numero !== (user?.phone ?? '');
  const celularVerificado = Boolean(user?.phoneVerified) && !celularCambio;
  const errorArea = celularTocado ? v.codigoArea(area) : undefined;
  const errorNumero = celularTocado ? v.numeroCelular(numero, area) : undefined;

  const cambiarCelular = (setter: (valor: string) => void, valor: string) => {
    setter(soloDigitos(valor));
    setCelularTocado(true);
    setCodigoEnviado(false);
    setCodigo('');
    setCelularMensaje('');
    setCelularError('');
  };

  const enviarCodigo = async () => {
    setCelularTocado(true);
    setCelularError('');
    setCelularMensaje('');
    if (v.codigoArea(area) || v.numeroCelular(numero, area) || celularEnviando) return;
    setCelularEnviando(true);
    try {
      const res = await api.post<{ user: User; codeSent: boolean }>('/auth/me/celular', {
        areaCode: area,
        phone: numero,
      });
      setUser(res.user);
      setCodigoEnviado(res.codeSent);
      setCodigo('');
      if (res.codeSent) setCelularMensaje('Te mandamos un código de 6 números por WhatsApp.');
    } catch (err) {
      setCelularError(err instanceof ApiError ? err.message : 'No se pudo enviar el código.');
    } finally {
      setCelularEnviando(false);
    }
  };

  const verificarCodigo = async () => {
    setCelularError('');
    if (!/^\d{6}$/.test(codigo)) {
      setCelularError('El código tiene 6 números.');
      return;
    }
    setCelularEnviando(true);
    try {
      const res = await api.post<{ user: User }>('/auth/me/celular/verificar', { code: codigo });
      setUser(res.user);
      setCodigoEnviado(false);
      setCodigo('');
      setCelularTocado(false);
      setCelularMensaje('');
    } catch (err) {
      setCelularError(err instanceof ApiError ? err.message : 'No se pudo verificar el código.');
    } finally {
      setCelularEnviando(false);
    }
  };

  const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setAvatarUrl(result);
        localStorage.setItem('userAvatar', result);
        setDirty(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (formInvalid || sending) return;

    setSending(true);
    try {
      await updateUserData({ ...form, cp: form.cp.trim().toUpperCase() });
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'No se pudieron guardar los datos.');
      return;
    } finally {
      setSending(false);
    }

    setDirty(false);
    // Sin el celular verificado todavía no puede ofertar: se queda acá
    if (!celularVerificado) {
      setSuccessMessage('Datos guardados. Falta verificar tu celular para poder ofertar.');
      return;
    }
    setSuccessMessage('Datos actualizados correctamente.');
    setTimeout(() => {
      navigate(destino);
    }, 1500);
  };

  return (
    <>
      <div className={styles.pagina}>
        <div className={styles.contenedor}>
          <div className={styles.columnaTitulo}>
            <Etiqueta tono="verde">Mi cuenta</Etiqueta>
            <h1 className={styles.titulo}>
              Cargá <em>tus datos</em>
            </h1>

            <button
              type="button"
              className={styles.avatar}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Cambiar foto de perfil"
            >
              <span className={styles.avatarCirculo}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className={styles.avatarImagen} />
                ) : (
                  <svg width="72" height="72" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
              </span>
              <span className={styles.avatarCamara} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={onFileSelected}
              accept="image/*"
              className={styles.archivo}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>

          <form className={styles.formulario} onSubmit={onSubmit} noValidate>
            <Campo etiqueta="Nombre" type="text" autoComplete="given-name" {...campo('nombre', v.LARGOS.nombre)} />
            <Campo etiqueta="Apellido" type="text" autoComplete="family-name" {...campo('apellido', v.LARGOS.nombre)} />

            <Campo
              id="datos-area"
              etiqueta="Celular: cód. de área"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-area-code"
              placeholder="11"
              maxLength={v.LARGOS.area}
              value={area}
              error={errorArea}
              onChange={(e) => cambiarCelular(setArea, e.target.value)}
            />
            <Campo
              id="datos-celular"
              etiqueta="Número"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-local"
              placeholder="12345678"
              maxLength={v.LARGOS.celular}
              value={numero}
              error={errorNumero}
              onChange={(e) => cambiarCelular(setNumero, e.target.value)}
            />
            <div className={`${styles.ancho} ${styles.celular}`}>
              <p className={styles.ayuda}>Sin el 0 ni el 15 (ej. 11 y 12345678). Lo verificamos con un código por WhatsApp.</p>
              {celularVerificado ? (
                <p className={styles.verificado}>✓ Verificado</p>
              ) : codigoEnviado ? (
                <div className={styles.codigo}>
                  <Campo
                    id="datos-codigo"
                    etiqueta="Código de WhatsApp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={v.LARGOS.codigo}
                    value={codigo}
                    onChange={(e) => setCodigo(soloDigitos(e.target.value))}
                  />
                  <Boton type="button" variante="verde" onClick={verificarCodigo} disabled={celularEnviando}>
                    Verificar
                  </Boton>
                  <button type="button" className={styles.enlace} onClick={enviarCodigo} disabled={celularEnviando}>
                    Reenviar código
                  </button>
                </div>
              ) : (
                <Boton type="button" variante="contorno" onClick={enviarCodigo} disabled={celularEnviando}>
                  {celularEnviando ? 'Enviando...' : 'Enviar código por WhatsApp'}
                </Boton>
              )}
              {celularMensaje && <p className={styles.ayuda}>{celularMensaje}</p>}
              {celularError && <p className={styles.errorCelular}>{celularError}</p>}
            </div>

            <Campo etiqueta="DNI / CUIL" type="text" inputMode="numeric" className={styles.ancho} {...campo('dni', v.LARGOS.dni)} />
            <CampoFecha
              id="datos-fechaNacimiento"
              etiqueta="Fecha de nacimiento (opcional)"
              className={styles.ancho}
              value={form.fechaNacimiento}
              error={mensajeError('fechaNacimiento')}
              onChange={(iso) => setField('fechaNacimiento', iso)}
              onBlur={() => markTouched('fechaNacimiento')}
            />
            <Campo
              etiqueta="Dirección (opcional)"
              type="text"
              placeholder="Calle, altura, piso"
              autoComplete="street-address"
              className={styles.ancho}
              {...campo('direccion', v.LARGOS.direccion)}
            />
            <Campo etiqueta="Ciudad (opcional)" type="text" autoComplete="address-level2" {...campo('ciudad', v.LARGOS.ciudad)} />
            <Campo etiqueta="Código postal (opcional)" type="text" autoComplete="postal-code" {...campo('cp', v.LARGOS.cp)} />
            <Campo
              etiqueta="Provincia (opcional)"
              type="text"
              autoComplete="address-level1"
              className={styles.ancho}
              {...campo('provincia', v.LARGOS.provincia)}
            />

            {successMessage && <Aviso className={styles.ancho}>{successMessage}</Aviso>}
            {errorMessage && (
              <Aviso tipo="error" className={styles.ancho}>
                {errorMessage}
              </Aviso>
            )}

            <div className={`${styles.ancho} ${styles.acciones}`}>
              <Boton type="submit" variante="verde" flecha bloque disabled={!dirty || formInvalid || sending}>
                {sending ? 'Guardando...' : 'Guardar cambios'}
              </Boton>
            </div>
          </form>
        </div>
      </div>

      <SeccionVender origen="datos" />
    </>
  );
}
