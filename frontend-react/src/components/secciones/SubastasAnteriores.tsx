import TarjetaSubasta from '../tarjetas/TarjetaSubasta';
import type { Subasta } from '../../interfaces/subasta';
import styles from './SubastasAnteriores.module.scss';

const subastasAnteriores: Subasta[] = [
  {
    titulo: 'Antigua panadería',
    ubicacion: 'Morón, Buenos Aires',
    descripcion: 'Panadería familiar vendida recientemente.',
    fecha: 'Marzo 10/25',
    hora: '12:00',
  },
  {
    titulo: 'Pequeña imprenta',
    ubicacion: 'Castelar, Buenos Aires',
    descripcion: 'Imprenta con prensa offset y clientela estable.',
    fecha: 'Febrero 05/25',
    hora: '10:30',
  },
  {
    titulo: 'Lavadero de autos',
    ubicacion: 'Ituzaingó, Buenos Aires',
    descripcion: 'Lavadero con sistema automatizado y buen flujo de clientes.',
    fecha: 'Enero 20/25',
    hora: '09:00',
  },
  {
    titulo: 'Local de ropa',
    ubicacion: 'Lomas, Buenos Aires',
    descripcion: 'Local boutique con stock inicial incluido.',
    fecha: 'Diciembre 12/24',
    hora: '14:45',
  },
];

export default function SubastasAnteriores() {
  return (
    <section className={`${styles.prox} ${styles.ant}`}>
      <div className={styles.prox__inner}>
        <h2 className={styles.prox__titulo}>SUBASTAS ANTERIORES</h2>

        <div className={styles.prox__grid}>
          {subastasAnteriores.map((item, i) => (
            <TarjetaSubasta
              key={i}
              estado="FINALIZADA"
              titulo={item.titulo}
              ubicacion={item.ubicacion}
              descripcion={item.descripcion}
              fecha={item.fecha}
              hora={item.hora}
              mostrarCuentaRegresiva={false}
            />
          ))}
        </div>

        <div className={styles.prox__cta}>
          <button className={styles['btn-negro']}>Ver más subastas →</button>
        </div>
      </div>
    </section>
  );
}
