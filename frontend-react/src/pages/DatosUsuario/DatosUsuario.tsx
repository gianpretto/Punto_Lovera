import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SeccionVender from '../../components/secciones/SeccionVender';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import Campo from '../../components/ui/Campo';
import CampoFecha from '../../components/ui/CampoFecha';
import Etiqueta from '../../components/ui/Etiqueta';
import { useAuth, type User } from '../../services/AuthContext';
import { ApiError } from '../../services/api';
import styles from './DatosUsuario.module.scss';

// /datos — "Cargá tus datos" (wireframes 620:12952 escritorio y 620:15133
// celular; sin diseño final). Sigue el lenguaje de Contactanos: fondo claro
// con patrón, título serif a la izquierda con el avatar y el formulario de
// campos subrayados a la derecha; abajo la banda verde de SeccionVender.
// Son los datos que exige isProfileComplete para ofertar (PATCH /auth/me).

interface FormState {
  nombre: string;
  apellido: string;
  telefono: string;
  dni: string;
  fechaNacimiento: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  cp: string;
}

const soloNumeros = /^[0-9]*$/;

function formDesdeUsuario(user: User | null): FormState {
  return {
    nombre: user?.firstName ?? '',
    apellido: user?.lastName ?? '',
    telefono: user?.phone ?? '',
    dni: user?.dni ?? '',
    fechaNacimiento: user?.birthDate ?? '',
    direccion: user?.address ?? '',
    ciudad: user?.city ?? '',
    provincia: user?.province ?? '',
    cp: user?.zipCode ?? '',
  };
}

export default function DatosUsuario() {
  const navigate = useNavigate();
  const { user, loading, updateUserData } = useAuth();
  const [searchParams] = useSearchParams();
  // Ej: la sala del remate manda acá para completar datos antes de ofertar
  const volver = searchParams.get('volver');
  const destino = volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/perfil';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(() => formDesdeUsuario(user));
  // TODO: el backend todavía no guarda avatar; queda local a este navegador
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => localStorage.getItem('userAvatar'));
  const [touched, setTouched] = useState<Record<keyof FormState, boolean>>({
    nombre: false,
    apellido: false,
    telefono: false,
    dni: false,
    fechaNacimiento: false,
    direccion: false,
    ciudad: false,
    provincia: false,
    cp: false,
  });
  const [dirty, setDirty] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Sin sesión no hay datos que editar
  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  // Si el usuario termina de cargar después del primer render, completamos
  // el formulario (sin pisar lo que ya se haya editado).
  useEffect(() => {
    if (user && !dirty) setForm(formDesdeUsuario(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setField = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  };

  const errors: Record<keyof FormState, boolean> = {
    nombre: form.nombre.trim() === '',
    apellido: form.apellido.trim() === '',
    telefono: form.telefono.trim() === '' || !soloNumeros.test(form.telefono),
    dni: form.dni.trim() === '' || !soloNumeros.test(form.dni),
    fechaNacimiento: false,
    direccion: form.direccion.trim() === '',
    ciudad: form.ciudad.trim() === '',
    provincia: form.provincia.trim() === '',
    cp: form.cp.trim() === '',
  };
  const formInvalid = Object.values(errors).some(Boolean);

  const showInvalid = (field: keyof FormState) => (submitted || touched[field]) && errors[field];
  const markTouched = (field: keyof FormState) => setTouched((t) => ({ ...t, [field]: true }));

  // Texto que acompaña al campo marcado en rojo (antes solo cambiaba el borde)
  const mensajeError = (field: keyof FormState) => {
    if (!showInvalid(field)) return undefined;
    return form[field].trim() === '' ? 'Completá este dato.' : 'Ingresá solo números.';
  };

  // Props comunes de cada campo de texto del formulario
  const campo = (field: keyof FormState) => ({
    id: `datos-${field}`,
    value: form[field],
    error: mensajeError(field),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setField(field, e.target.value),
    onBlur: () => markTouched(field),
  });

  const onlyNumbers = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
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

    if (formInvalid || sending) return;

    setSending(true);
    try {
      await updateUserData(form);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'No se pudieron guardar los datos.');
      return;
    } finally {
      setSending(false);
    }

    setSuccessMessage('Datos actualizados correctamente.');
    setDirty(false);

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
            <Campo etiqueta="Nombre" type="text" autoComplete="given-name" {...campo('nombre')} />
            <Campo etiqueta="Apellido" type="text" autoComplete="family-name" {...campo('apellido')} />
            <Campo
              etiqueta="Teléfono"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              onKeyPress={onlyNumbers}
              {...campo('telefono')}
            />
            <Campo etiqueta="DNI / CUIT" type="text" inputMode="numeric" onKeyPress={onlyNumbers} {...campo('dni')} />
            <CampoFecha
              id="datos-fechaNacimiento"
              etiqueta="Fecha de nacimiento"
              className={styles.ancho}
              value={form.fechaNacimiento}
              error={mensajeError('fechaNacimiento')}
              onChange={(iso) => setField('fechaNacimiento', iso)}
              onBlur={() => markTouched('fechaNacimiento')}
            />
            <Campo
              etiqueta="Dirección"
              type="text"
              placeholder="Calle, altura, piso"
              autoComplete="street-address"
              className={styles.ancho}
              {...campo('direccion')}
            />
            <Campo etiqueta="Ciudad" type="text" autoComplete="address-level2" {...campo('ciudad')} />
            <Campo etiqueta="Código postal" type="text" autoComplete="postal-code" {...campo('cp')} />
            <Campo
              etiqueta="Provincia"
              type="text"
              autoComplete="address-level1"
              className={styles.ancho}
              {...campo('provincia')}
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
