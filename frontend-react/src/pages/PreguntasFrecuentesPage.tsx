import PreguntasFrecuentes from '../components/secciones/PreguntasFrecuentes';
import { preguntasFrecuentes } from '../content/participar';
import styles from './PreguntasFrecuentesPage.module.scss';

// /faq: todas las preguntas, con el mismo bloque del Home
export default function PreguntasFrecuentesPage() {
  return (
    <div className={styles.pagina}>
      <PreguntasFrecuentes items={preguntasFrecuentes} />
    </div>
  );
}
