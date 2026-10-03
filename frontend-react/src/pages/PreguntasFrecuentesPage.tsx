import PreguntasFrecuentes from '../components/secciones/PreguntasFrecuentes';
import { preguntasFrecuentes } from '../content/participar';

// /faq: todas las preguntas (el Home muestra solo las primeras 3)
export default function PreguntasFrecuentesPage() {
  return (
    <div style={{ paddingTop: 60 }}>
      <PreguntasFrecuentes items={preguntasFrecuentes} />
    </div>
  );
}
