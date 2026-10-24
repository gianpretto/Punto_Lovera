import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import Boton from '../ui/Boton';
import styles from './Header.module.scss';

// Header del rediseño (Figma): barra superior negra de 35 px (aviso + sesión)
// y barra principal gris clara de 80 px (logo, navegación y los dos botones).
const NAV = [
  { to: '/subastas', label: 'Próximas subastas' },
  { to: '/quienes-somos', label: 'Quiénes somos' },
  { to: '/contactanos', label: 'Contactanos' },
];

// En el diseño la barra principal es gris solo en estas páginas (las que
// arrancan con una banda de color); en el resto toma el fondo de la página
// con una línea abajo.
const RUTAS_BARRA_GRIS = ['/', '/quiero-comprar', '/quiero-vender'];

export default function Header() {
  const { currentUser, user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Panel de usuario (desplegable, según el diagrama de flujo)
  const userLinks = [
    { to: '/perfil', label: 'Perfil' },
    { to: '/datos', label: 'Mis datos' },
    { to: '/creditos', label: 'Crédito disponible' },
    { to: '/perfil#compras', label: 'Mis compras / ofertas' },
    ...(user?.role === 'ADMIN'
      ? [
          { to: '/admin/comprobantes', label: 'Comprobantes a revisar' },
          { to: '/admin/reintegros', label: 'Reintegros a pagar' },
        ]
      : []),
    ...(user?.role === 'MARTILLERO' || user?.role === 'ADMIN'
      ? [{ to: '/admin/subastas', label: 'Administrar subastas' }]
      : []),
  ];

  // Se cierran al navegar o al hacer click afuera
  useEffect(() => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [userMenuOpen]);

  return (
    <header className={styles.header}>
      {/* Barra superior */}
      <div className={styles.barraTop}>
        <div className={styles.contenedor}>
          <Link className={styles.aviso} to="/faq">
            Resolvé tus dudas en nuestra sección de Preguntas Frecuentes
          </Link>

          <div className={styles.sesion}>
            {currentUser ? (
              <div className={styles.userMenu} ref={userMenuRef}>
                <button
                  type="button"
                  className={styles.linkTop}
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-expanded={userMenuOpen}
                >
                  Bienvenido, <strong>{currentUser}</strong> ▾
                </button>
                {userMenuOpen && (
                  <div className={styles.userMenuLista}>
                    {userLinks.map((l) => (
                      <Link key={l.to} className={styles.userMenuItem} to={l.to}>
                        {l.label}
                      </Link>
                    ))}
                    <button type="button" className={styles.userMenuItem} onClick={logout}>
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link className={styles.linkTop} to="/registro">
                  REGISTRARSE
                </Link>
                <Link className={styles.linkTop} to="/login">
                  INICIAR SESIÓN
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Barra principal */}
      <div className={`${styles.barraMain} ${RUTAS_BARRA_GRIS.includes(location.pathname) ? '' : styles.barraClara}`}>
        <div className={styles.contenedor}>
          <Link className={styles.logo} to="/" aria-label="Punto Lovera, ir al inicio">
            <img src="/assets/figma/logo-oscuro.svg" alt="Punto Lovera" width={217} height={22} />
          </Link>

          <nav className={styles.nav} aria-label="Principal">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.activo : ''}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className={styles.cta}>
            <Boton variante="contorno" to="/quiero-comprar">
              Quiero comprar
            </Boton>
            <Boton variante="oscuro" to="/quiero-vender">
              Quiero vender
            </Boton>
          </div>

          <button
            type="button"
            className={`${styles.hamburguesa} ${mobileMenuOpen ? styles.abierto : ''}`}
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileMenuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* Menú del celular */}
      {mobileMenuOpen && (
        <div className={styles.menuMovil}>
          <nav className={styles.menuMovilNav} aria-label="Principal (móvil)">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className={styles.menuMovilLink}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className={styles.menuMovilCta}>
            <Boton variante="contorno" to="/quiero-comprar" bloque>
              Quiero comprar
            </Boton>
            <Boton variante="oscuro" to="/quiero-vender" bloque>
              Quiero vender
            </Boton>
          </div>
          <div className={styles.menuMovilSesion}>
            {currentUser ? (
              <>
                <p className={styles.menuMovilHola}>
                  Bienvenido, <strong>{currentUser}</strong>
                </p>
                {userLinks.map((l) => (
                  <Link key={l.to} to={l.to} className={styles.menuMovilSecundario}>
                    {l.label}
                  </Link>
                ))}
                <button type="button" className={styles.menuMovilSecundario} onClick={logout}>
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link to="/registro" className={styles.menuMovilSecundario}>
                  REGISTRARSE
                </Link>
                <Link to="/login" className={styles.menuMovilSecundario}>
                  INICIAR SESIÓN
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
