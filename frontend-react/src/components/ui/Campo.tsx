import { useId, type InputHTMLAttributes } from 'react';
import styles from './Campo.module.scss';

// Campo de formulario del rediseño: etiqueta en negrita arriba y el input
// subrayado (sin caja), como en Contactanos / SeccionVender. El mensaje de
// error queda debajo, enlazado con aria-describedby.
//  - tono 'claro':  para fondos claros (texto #2e2d2b, foco verde)
//  - tono 'oscuro': para fondos oscuros o verdes (texto y línea claros)
interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  etiqueta: string;
  /** Mensaje de error; si viene, el campo se marca como inválido */
  error?: string;
  tono?: 'claro' | 'oscuro';
  className?: string;
}

export default function Campo({ etiqueta, error, tono = 'claro', className, id, ...input }: Props) {
  const idAuto = useId();
  const idCampo = id ?? idAuto;
  const idError = `${idCampo}-error`;

  return (
    <div className={[styles.campo, styles[tono], error ? styles.invalido : '', className ?? ''].join(' ')}>
      <label htmlFor={idCampo}>{etiqueta}</label>
      <input
        id={idCampo}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : undefined}
        {...input}
      />
      {error && (
        <p id={idError} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
