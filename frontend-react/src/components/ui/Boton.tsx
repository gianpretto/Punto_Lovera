import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Boton.module.scss';

// Botones del rediseño (Figma): rectangulares, sin radio, alto 43 px.
//  - claro:     fondo #d5d9d8, texto #2e2d2b  ("Ver próximas subastas →")
//  - oscuro:    fondo #2e2d2b, texto #d5d9d8  ("Quiero vender" del header)
//  - verde:     fondo #3e6d72, texto blanco   ("Unirse a la sesión →")
//  - contorno:  borde #2e2d2b, texto #2e2d2b  ("Quiero comprar" del header)
//  - contorno-claro: borde y texto blancos sobre fondos oscuros ("Cómo participar →")
export type VarianteBoton = 'claro' | 'oscuro' | 'verde' | 'contorno' | 'contorno-claro';

interface Comun {
  variante?: VarianteBoton;
  /** Agrega la flecha "→" al final, como en el diseño */
  flecha?: boolean;
  /** Ocupa todo el ancho disponible */
  bloque?: boolean;
  className?: string;
  children: ReactNode;
}

type Props = Comun &
  (
    | { to: string; href?: never; onClick?: never; type?: never; disabled?: never }
    | { href: string; to?: never; onClick?: never; type?: never; disabled?: never }
    | ({ to?: never; href?: never } & Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type' | 'disabled'>)
  );

export default function Boton({ variante = 'claro', flecha, bloque, className, children, ...resto }: Props) {
  const clase = [styles.boton, styles[variante], bloque ? styles.bloque : '', className ?? ''].join(' ');
  const contenido = (
    <>
      {children}
      {/* Espacio duro: en un inline-flex el espacio común al inicio del span se pierde */}
      {flecha && <span aria-hidden="true">{' →'}</span>}
    </>
  );

  if ('to' in resto && resto.to) {
    return (
      <Link className={clase} to={resto.to}>
        {contenido}
      </Link>
    );
  }
  if ('href' in resto && resto.href) {
    return (
      <a className={clase} href={resto.href} target="_blank" rel="noopener noreferrer">
        {contenido}
      </a>
    );
  }
  const { onClick, type = 'button', disabled } = resto as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={clase} type={type} onClick={onClick} disabled={disabled}>
      {contenido}
    </button>
  );
}
