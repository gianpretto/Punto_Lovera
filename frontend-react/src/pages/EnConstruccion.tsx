// Página todavía no migrada de Angular a React. Placeholder temporal para
// que el ruteo funcione de punta a punta mientras portamos el resto de las
// vistas — no es el diseño final.
export default function EnConstruccion({ nombre }: { nombre: string }) {
  return (
    <div style={{ padding: '80px 32px', textAlign: 'center', fontFamily: 'Montserrat, sans-serif' }}>
      <h2>{nombre}</h2>
      <p style={{ color: '#777' }}>Esta vista todavía no fue portada a React. Próximamente.</p>
    </div>
  );
}
