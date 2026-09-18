import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import styles from './DatosUsuario.module.scss';

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

export default function DatosUsuario() {
  const navigate = useNavigate();
  const { updateUserData } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(() => ({
    nombre: localStorage.getItem('registeredName') || '',
    apellido: localStorage.getItem('registeredLastname') || '',
    telefono: localStorage.getItem('registeredPhone') || '',
    dni: localStorage.getItem('registeredDni') || '',
    fechaNacimiento: localStorage.getItem('registeredBirth') || '',
    direccion: localStorage.getItem('registeredAddress') || '',
    ciudad: localStorage.getItem('registeredCity') || '',
    provincia: localStorage.getItem('registeredProvince') || '',
    cp: localStorage.getItem('registeredZip') || '',
  }));
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

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (formInvalid) return;

    updateUserData(form);
    localStorage.setItem('registeredBirth', form.fechaNacimiento);

    setSuccessMessage('Datos actualizados correctamente.');
    setDirty(false);

    setTimeout(() => {
      navigate('/perfil');
    }, 1500);
  };

  return (
    <div className={styles.editWrapper}>
      <h1 className={styles.editTitle}>Cargá tus datos</h1>

      <div className={styles.avatarContainer} onClick={() => fileInputRef.current?.click()}>
        <div className={styles.avatarCircle}>
          {!avatarUrl && (
            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="#ccc">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
          {avatarUrl && <img src={avatarUrl} alt="Avatar" className={styles.avatarImage} />}
        </div>
        <div className={styles.cameraIcon}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
          </svg>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          onChange={onFileSelected}
          accept="image/*"
          style={{ display: 'none' }}
        />
      </div>

      <form className={styles.editForm} onSubmit={onSubmit} noValidate>
        <div className={styles.formRow}>
          <div className={`${styles.formGroup} ${styles.half}`}>
            <input
              type="text"
              className={`${styles.formControl} ${showInvalid('nombre') ? styles.isInvalid : ''}`}
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setField('nombre', e.target.value)}
              onBlur={() => markTouched('nombre')}
            />
          </div>
          <div className={`${styles.formGroup} ${styles.half}`}>
            <input
              type="text"
              className={`${styles.formControl} ${showInvalid('apellido') ? styles.isInvalid : ''}`}
              placeholder="Apellido"
              value={form.apellido}
              onChange={(e) => setField('apellido', e.target.value)}
              onBlur={() => markTouched('apellido')}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={`${styles.formGroup} ${styles.half}`}>
            <input
              type="tel"
              className={`${styles.formControl} ${showInvalid('telefono') ? styles.isInvalid : ''}`}
              placeholder="Teléfono"
              value={form.telefono}
              onKeyPress={onlyNumbers}
              onChange={(e) => setField('telefono', e.target.value)}
              onBlur={() => markTouched('telefono')}
            />
          </div>
          <div className={`${styles.formGroup} ${styles.half}`}>
            <input
              type="text"
              className={`${styles.formControl} ${showInvalid('dni') ? styles.isInvalid : ''}`}
              placeholder="DNI / CUIT"
              value={form.dni}
              onKeyPress={onlyNumbers}
              onChange={(e) => setField('dni', e.target.value)}
              onBlur={() => markTouched('dni')}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={`${styles.formGroup} ${styles.full}`}>
            <label className={styles.formLabel}>Fecha de Nacimiento</label>
            <input
              type="date"
              className={styles.formControl}
              value={form.fechaNacimiento}
              onChange={(e) => setField('fechaNacimiento', e.target.value)}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={`${styles.formGroup} ${styles.full}`}>
            <input
              type="text"
              className={`${styles.formControl} ${showInvalid('direccion') ? styles.isInvalid : ''}`}
              placeholder="Dirección (Calle, altura, piso)"
              value={form.direccion}
              onChange={(e) => setField('direccion', e.target.value)}
              onBlur={() => markTouched('direccion')}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={`${styles.formGroup} ${styles.half}`}>
            <input
              type="text"
              className={`${styles.formControl} ${showInvalid('ciudad') ? styles.isInvalid : ''}`}
              placeholder="Ciudad"
              value={form.ciudad}
              onChange={(e) => setField('ciudad', e.target.value)}
              onBlur={() => markTouched('ciudad')}
            />
          </div>
          <div className={`${styles.formGroup} ${styles.half}`}>
            <input
              type="text"
              className={`${styles.formControl} ${showInvalid('cp') ? styles.isInvalid : ''}`}
              placeholder="Código Postal"
              value={form.cp}
              onChange={(e) => setField('cp', e.target.value)}
              onBlur={() => markTouched('cp')}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={`${styles.formGroup} ${styles.full}`}>
            <input
              type="text"
              className={`${styles.formControl} ${showInvalid('provincia') ? styles.isInvalid : ''}`}
              placeholder="Provincia"
              value={form.provincia}
              onChange={(e) => setField('provincia', e.target.value)}
              onBlur={() => markTouched('provincia')}
            />
          </div>
        </div>

        {successMessage && <div className={`${styles.alert} ${styles.alertSuccess}`}>{successMessage}</div>}

        <button type="submit" className={styles.btnBlack} disabled={!dirty || formInvalid}>
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
