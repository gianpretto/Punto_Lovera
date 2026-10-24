import { Link } from 'react-router-dom';
import Boton from '../../components/ui/Boton';
import Etiqueta from '../../components/ui/Etiqueta';
import SeccionVender from '../../components/secciones/SeccionVender';
import TarjetaSubasta from '../../components/tarjetas/TarjetaSubasta';
import { toSubasta, useAuctions } from '../../services/auctions';
import { uploadUrl } from '../../services/api';
import styles from './QuienesSomos.module.scss';

// Quiénes somos (Figma "Quienes somos 1440x1029", frame 719:52573):
//  1. Fondo claro con patrón: "¿Qué hacemos?" + logo grande y
//     "¿Quiénes somos?" (foto de los hermanos, textos y cita).
//  2. Fondo negro con patrón: "¿Cómo lo hacemos?" y las últimas subastas
//     finalizadas (reales, del backend).
//  3. Banda verde "¿Tenés bienes para vender?" (SeccionVender).
export default function QuienesSomos() {
  const finalizadas = useAuctions(['FINALIZADA']);
  // Las más recientes primero (la API las ordena por fecha de inicio)
  const anteriores = (finalizadas ?? []).slice().reverse().slice(0, 4);

  return (
    <div className={styles.pagina}>
      <div className={styles.fondoClaro}>
        <div className={styles.contenedor}>
          <nav className={styles.migas} aria-label="Ruta de navegación">
            <Link to="/">Inicio</Link> / <span aria-current="page">Quiénes somos</span>
          </nav>

          {/* ¿Qué hacemos? */}
          <section className={styles.queHacemos}>
            <div>
              <Etiqueta tamano="grande" className={styles.etiquetaVerde}>
                ¿Qué hacemos?
              </Etiqueta>
              <h1 className={styles.tituloSubastas}>
                Subastas,
                <br />
                <em>sin vueltas.</em>
              </h1>
              <div className={styles.textoIntro}>
                <p>
                  Alguna información relevante o interesante para detallar en un muy breve texto descriptivo, que no
                  dure más que esto.
                </p>
                <p>
                  Alguna información relevante o interesante para detallar en un muy breve texto descriptivo, que no
                  dure más que esto.
                </p>
              </div>
            </div>
            <img className={styles.logo} src="/assets/figma/logo-oscuro.svg" alt="Punto Lovera" width={737} height={75} />
          </section>

          {/* ¿Quiénes somos? */}
          <section className={styles.quienes} aria-labelledby="quienes-titulo">
            <p className={styles.etiquetaLarga}>
              <span className={styles.lineaLarga} aria-hidden="true" />
              <span className={styles.etiquetaLargaTexto}>¿Quiénes somos?</span>
            </p>

            <div className={styles.quienesCuerpo}>
              <img
                className={styles.fotoHermanos}
                src="/assets/figma/hermanos-lovera.webp"
                alt="Gonzalo y Emiliano Lovera"
                width={502}
                height={381}
              />

              <div>
                <h2 id="quienes-titulo" className={styles.tituloHermanos}>
                  Dos hermanos.
                </h2>
                <p className={styles.subtituloHermanos}>Una forma más clara de hacer las cosas.</p>

                <div className={styles.columnas}>
                  <div>
                    <p>
                      Somos Gonzalo y Emiliano Lovera, dos hermanos que decidimos entrar de lleno en el mundo de las
                      subastas con una idea clara: “Hacerlo más simple, más accesible y más actual.”
                    </p>
                    <p>
                      Todo este recorrido nos permitió ganar experiencia en el mundo de las subastas y construir una
                      cartera de clientes que confían en nosotros y nos siguen eligiendo día a día.
                    </p>
                  </div>
                  <div>
                    <p>
                      Con el tiempo entendimos algo clave: muchas veces comprar o vender no es complicado… Lo
                      complicado es cómo está armado el sistema.
                    </p>
                    <p>
                      A partir de eso nace Punto Lovera, donde decidimos dar un paso más y crear nuestro propio
                      espacio, donde podemos hacer las cosas de acuerdo a nuestros ideales: sin vueltas raras, con
                      procesos simples y claros, para que cualquiera pueda participar sin problemas.
                    </p>
                  </div>
                </div>

                <blockquote className={styles.cita}>
                  <span className={styles.citaPunto} aria-hidden="true" />
                  <p>“Hacerlo más simple, más accesible y más actual.”</p>
                </blockquote>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ¿Cómo lo hacemos? + subastas anteriores */}
      <section className={styles.fondoOscuro}>
        <div className={styles.contenedor}>
          <Etiqueta tono="claro" tamano="grande">
            ¿Cómo lo hacemos?
          </Etiqueta>
          <div className={styles.comoFila}>
            <h2 className={styles.tituloComo}>Un sistema pensado para que participar se sienta fácil.</h2>
            <p className={styles.textoComo}>
              Acompañamos cada operación con información clara, procesos ordenados y una relación directa.
            </p>
          </div>

          {anteriores.length > 0 && (
            <div className={styles.anteriores}>
              <div className={styles.anterioresCabecera}>
                <h2 className={styles.tituloAnteriores}>Subastas anteriores</h2>
                <Boton variante="verde" to="/subastas" flecha className={styles.verTodas}>
                  Ver todas las subastas
                </Boton>
              </div>
              <div className={styles.grilla}>
                {anteriores.map((a) => {
                  const s = toSubasta(a, 0); // finalizadas: sin cuenta regresiva
                  return (
                    <TarjetaSubasta
                      key={a.id}
                      id={a.id}
                      estado="FINALIZADA"
                      titulo={s.titulo}
                      ubicacion={s.ubicacion}
                      descripcion={s.descripcion}
                      fecha={s.fecha}
                      hora={s.hora}
                      imagen={a.coverImageUrl ? uploadUrl(a.coverImageUrl) : null}
                      mostrarCuentaRegresiva={false}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <SeccionVender origen="quienes-somos" etiquetaGrande />
    </div>
  );
}
