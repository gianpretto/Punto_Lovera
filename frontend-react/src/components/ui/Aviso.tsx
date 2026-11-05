import type { ReactNode } from 'react';
import styles from './Aviso.module.scss';

// Mensaje de resultado de un formulario (mismo estilo que los avisos de
// Contactanos): 'ok' en verde claro, 'error' en rojo suave. Se anuncia a
// los lectores de pantalla (status / alert).
interface Props {
  tipo?: 'ok' | 'error';
  children: ReactNode;
  className?: string;
}

export default function Aviso({ tipo = 'ok', children, className }: Props) {
  return (
    <p className={[styles.aviso, styles[tipo], className ?? ''].join(' ')} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
