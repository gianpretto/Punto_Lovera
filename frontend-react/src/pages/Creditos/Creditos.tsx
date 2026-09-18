import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Creditos.module.scss';

const creditoDisponible = 20000000;

const instrucciones = [
  {
    titulo: 'Título',
    desc: 'Alguna información relevante o interesante pero detallar en un muy breve texto descriptivo, que no dure más que esto.',
  },
  {
    titulo: 'Título',
    desc: 'Alguna información relevante o interesante pero detallar en un muy breve texto descriptivo, que no dure más que esto.',
  },
  {
    titulo: 'Título',
    desc: 'Alguna información relevante o interesante pero detallar en un muy breve texto descriptivo, que no dure más que esto.',
  },
];

const CardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth={1}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

export default function Creditos() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null);

  const formatNumber = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

  const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVoucherFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setVoucherPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const enviarComprobante = () => {
    if (voucherFile) {
      navigate('/comprobante-exitoso');
    }
  };

  return (
    <div className={styles.creditosWrapper}>
      <div className={styles.creditBanner}>
        <h2 className={styles.creditTitle}>Crédito disponible</h2>
        <div className={styles.creditAmount}>$ {formatNumber(creditoDisponible)}</div>
      </div>

      <div className={styles.uploadContainer}>
        <div className={styles.infoBox}>
          <h3>Transferir a:</h3>
          <div className={styles.infoDetails}>
            <p><strong>Alias:</strong> punto.lovera</p>
            <p><strong>CBU:</strong> 0540451251212</p>
            <p><strong>Cuenta:</strong> hshshssh</p>
            <p><strong>Nombre:</strong> hshshshshsh</p>
          </div>
          <p className={styles.infoNote}>La inscripción se hará efectiva una vez cargado el comprobante de pago.</p>
        </div>

        <div className={styles.uploadBox} onClick={() => fileInputRef.current?.click()}>
          {!voucherPreview && (
            <div className={styles.uploadContent}>
              <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>CARGAR COMPROBANTE</span>
            </div>
          )}
          {voucherPreview && (
            <img src={voucherPreview} alt="Comprobante" className={styles.voucherPreview} />
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={onFileSelected}
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.btnBlack} onClick={enviarComprobante} disabled={!voucherFile}>
          Enviar Comprobante
        </button>
      </div>

      <div className={styles.instructionsSection}>
        <h2 className={styles.sectionTitle}>Cómo cargar créditos</h2>
        <div className={styles.instructionCards}>
          {instrucciones.map((inst, i) => (
            <div className={styles.card} key={i}>
              <div className={styles.cardIcon}>
                <CardIcon />
              </div>
              <h4>{inst.titulo}</h4>
              <p>{inst.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.reintegroLink}>
        <Link to="/reintegro">Solicitar reintegro</Link>
      </div>
    </div>
  );
}
