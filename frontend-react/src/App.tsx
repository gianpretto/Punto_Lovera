import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import { AuthProvider } from './services/AuthContext';
import Home from './pages/Home/Home';
import EnConstruccion from './pages/EnConstruccion';

// Vistas que todavía no migramos de Angular — placeholder para que el
// ruteo completo funcione mientras las vamos portando una por una.
const stub = (nombre: string) => () => <EnConstruccion nombre={nombre} />;

export default function App() {
  return (
    <AuthProvider>
      <Header />

      <main className="container my-4">
        <Routes>
          {/* Inicio */}
          <Route path="/" element={<Home />} />

          {/* Subastas */}
          <Route path="/subastas" element={stub('Próximas subastas')()} />
          <Route path="/subastas/:id" element={stub('Detalle de subasta')()} />
          <Route path="/subastas/:id/activa" element={stub('Subasta en vivo')()} />

          {/* Autenticación / usuario */}
          <Route path="/login" element={stub('Iniciar sesión')()} />
          <Route path="/forgot-password" element={stub('Recuperar contraseña')()} />
          <Route path="/registro" element={stub('Registro')()} />
          <Route path="/validar-mail" element={stub('Validar mail')()} />
          <Route path="/datos" element={stub('Mis datos')()} />
          <Route path="/perfil" element={stub('Mi panel')()} />
          <Route path="/creditos" element={stub('Créditos')()} />
          <Route path="/comprobante-exitoso" element={stub('Comprobante enviado')()} />
          <Route path="/reintegro" element={stub('Reintegro')()} />

          {/* Institucional */}
          <Route path="/quienes-somos" element={stub('Quiénes somos')()} />
          <Route path="/quiero-comprar" element={stub('Quiero comprar')()} />
          <Route path="/quiero-vender" element={stub('Quiero vender')()} />
          <Route path="/contactanos" element={stub('Contactanos')()} />
          <Route path="/como-participar" element={stub('Cómo participar')()} />
          <Route path="/faq" element={stub('Preguntas frecuentes')()} />

          {/* Fallback */}
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      <Footer />
    </AuthProvider>
  );
}
