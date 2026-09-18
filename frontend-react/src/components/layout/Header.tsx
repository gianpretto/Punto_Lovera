import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import styles from './Header.module.scss';

export default function Header() {
  const { currentUser, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen((v) => !v);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className={styles.encabezado}>
      {/* Barra superior */}
      <div className={styles['barra-top']}>
        <div className={`${styles['contenedor-header']} ${styles['barra-top__contenido']}`}>
          <div className={styles['barra-top__texto']}>Novedades asd asd asd</div>

          <div className={styles['barra-top__acciones']}>
            {currentUser ? (
              <>
                <Link className={`${styles['link-top']} ${styles['welcome-msg']}`} to="/perfil">
                  Bienvenido, <strong>{currentUser}</strong>
                </Link>
                <button className={`${styles['link-top']} ${styles['btn-logout']}`} onClick={logout}>
                  SALIR
                </button>
              </>
            ) : (
              <>
                <Link className={styles['link-top']} to="/registro">
                  REGISTRARSE
                </Link>
                <Link className={styles['link-top']} to="/login">
                  INICIAR SESIÓN
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Barra principal */}
      <div className={styles['barra-main']}>
        <div className={`${styles['contenedor-header']} ${styles['barra-main__contenido']}`}>
          {/* Hamburger button (mobile only) */}
          <button
            className={`${styles['hamburger-btn']} ${mobileMenuOpen ? styles.active : ''}`}
            onClick={toggleMobileMenu}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          {/* Logo */}
          <Link className={styles.logo} to="/">
            <img className={styles.logo__img} src="/assets/img/logo.svg" alt="Punto Lovera" />
          </Link>

          {/* Navegación */}
          <nav className={styles.nav}>
            <Link className={styles.nav__link} to="/subastas">
              Próximas subastas
            </Link>
            <Link className={styles.nav__link} to="/quienes-somos">
              Quiénes somos
            </Link>
            <Link className={styles.nav__link} to="/contactanos">
              Contactanos
            </Link>
          </nav>

          {/* Botones derecha */}
          <div className={styles.cta}>
            <Link className={styles['btn-negro']} to="/quiero-comprar">
              Quiero comprar
            </Link>
            <Link className={styles['btn-negro']} to="/quiero-vender">
              Quiero vender
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={`${styles['mobile-menu-overlay']} ${mobileMenuOpen ? styles.active : ''}`}
        onClick={closeMobileMenu}
      >
        <div className={styles['mobile-menu']} onClick={(e) => e.stopPropagation()}>
          <nav className={styles['mobile-nav']}>
            <Link className={styles['mobile-nav__link']} to="/subastas" onClick={closeMobileMenu}>
              Próximas subastas
            </Link>
            <Link className={styles['mobile-nav__link']} to="/quienes-somos" onClick={closeMobileMenu}>
              Quiénes somos
            </Link>
            <Link className={styles['mobile-nav__link']} to="/contactanos" onClick={closeMobileMenu}>
              Contactános
            </Link>
          </nav>

          <div className={styles['mobile-cta']}>
            <Link className={styles['btn-negro']} to="/quiero-comprar" onClick={closeMobileMenu}>
              Quiero comprar
            </Link>
            <Link className={styles['btn-negro']} to="/quiero-vender" onClick={closeMobileMenu}>
              Quiero vender
            </Link>

            <div className={styles['mobile-auth-section']}>
              {currentUser ? (
                <>
                  <Link className={styles['welcome-msg-mobile']} to="/perfil" onClick={closeMobileMenu}>
                    Bienvenido, <strong>{currentUser}</strong>
                  </Link>
                  <button
                    className={styles['btn-logout-mobile']}
                    onClick={() => {
                      logout();
                      closeMobileMenu();
                    }}
                  >
                    SALIR
                  </button>
                </>
              ) : (
                <div className={styles['guest-actions']}>
                  <Link className={styles['mobile-auth__link']} to="/registro" onClick={closeMobileMenu}>
                    REGISTRARSE
                  </Link>
                  <span className={styles.separator}>|</span>
                  <Link className={styles['mobile-auth__link']} to="/login" onClick={closeMobileMenu}>
                    INICIAR SESIÓN
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
