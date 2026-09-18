import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './PanelUsuario.module.scss';

interface Compra {
  id: number;
  referencia: string;
  fecha: string;
  descripcion: string;
  valorUnitario: number;
  valorTotal: number;
}

const misCompras: Compra[] = [
  { id: 75, referencia: 'Lote 123456', fecha: '11-11-2024', descripcion: 'Lorem ipsum dolor lorem en amet', valorUnitario: 123000, valorTotal: 456456 },
  { id: 75, referencia: 'Lote 123456', fecha: '11-11-2024', descripcion: 'Lorem ipsum dolor lorem en amet', valorUnitario: 123000, valorTotal: 456456 },
  { id: 75, referencia: 'Lote 123456', fecha: '11-11-2024', descripcion: 'Lorem ipsum dolor lorem en amet', valorUnitario: 123000, valorTotal: 456456 },
  { id: 75, referencia: 'Lote 123456', fecha: '11-11-2024', descripcion: 'Lorem ipsum dolor lorem en amet', valorUnitario: 123000, valorTotal: 456456 },
  { id: 75, referencia: 'Lote 123456', fecha: '11-11-2024', descripcion: 'Lorem ipsum dolor lorem en amet', valorUnitario: 123000, valorTotal: 456456 },
];

const creditoDisponible = 20000000;

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const formatNumber = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

export default function PanelUsuario() {
  const [userName, setUserName] = useState('Usuario');
  const [userPhone, setUserPhone] = useState('');
  const [userDni, setUserDni] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [userCity, setUserCity] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const storedName = localStorage.getItem('registeredName');
    const storedLastName = localStorage.getItem('registeredLastname');
    const storedPhone = localStorage.getItem('registeredPhone');
    const storedDni = localStorage.getItem('registeredDni');
    const storedAddress = localStorage.getItem('registeredAddress');
    const storedCity = localStorage.getItem('registeredCity');

    setAvatarUrl(localStorage.getItem('userAvatar'));

    if (storedName || storedLastName) {
      setUserName(`${storedName || ''} ${storedLastName || ''}`.trim() || 'Usuario');
    }
    setUserPhone(storedPhone || '');
    setUserDni(storedDni || '');
    setUserAddress(storedAddress || '');
    setUserCity(storedCity || '');
  }, []);

  return (
    <div className={styles.perfilWrapper}>
      <div className={styles.userHeader}>
        <div className={styles.userInfoContainer}>
          <div className={styles.userAvatar}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className={styles.avatarImage} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#ccc">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
          </div>

          <div className={styles.userDetails}>
            <h1 className={styles.userName}>{userName}</h1>
            <p className={styles.userPhone}>Teléfono: {userPhone || 'Sin cargar'}</p>
          </div>

          <div className={styles.userExtra}>
            <div className={styles.extraColumn}>
              <p className={styles.extraTitle}>Datos de facturación</p>
              {userDni && <p className={styles.extraData}>DNI: {userDni}</p>}
              {userAddress && <p className={styles.extraData}>{userAddress}</p>}
              {userCity && <p className={styles.extraData}>{userCity}</p>}
              {!userDni && !userAddress && <p className={styles.extraData}>Sin datos cargados</p>}
            </div>

            <div className={styles.extraActions}>
              <Link to="/datos" className={styles.editProfileLink}>Editar perfil</Link>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.creditBanner}>
        <h2 className={styles.creditTitle}>Crédito disponible</h2>
        <div className={styles.creditAmount}>$ {formatNumber(creditoDisponible)}</div>
        <Link to="/creditos" className={styles.btnCargarCredito}>Cargar créditos</Link>
      </div>

      <div className={styles.purchasesSection}>
        <h3 className={styles.sectionTitle}>Mis Compras</h3>

        <div className={styles.tableResponsive}>
          <table className={styles.purchasesTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>Referencia</th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Valor unitario</th>
                <th>Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {misCompras.map((compra, i) => (
                <tr key={i}>
                  <td>{compra.id}</td>
                  <td>{compra.referencia}</td>
                  <td>{compra.fecha}</td>
                  <td>{compra.descripcion}</td>
                  <td>{formatCurrency(compra.valorUnitario)}</td>
                  <td><strong>{formatCurrency(compra.valorTotal)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
