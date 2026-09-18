import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import { AuthProvider } from './services/AuthContext';
import Home from './pages/Home/Home';
import EnConstruccion from './pages/EnConstruccion';
import ProximasSubastas from './pages/ProximasSubastas/ProximasSubastas';
import DetalleSubasta from './pages/DetalleSubasta/DetalleSubasta';
import SubastaActiva from './pages/SubastaActiva/SubastaActiva';
import Login from './pages/Login/Login';
import ForgotPassword from './pages/ForgotPassword/ForgotPassword';
import Registro from './pages/Registro/Registro';
import ValidarMail from './pages/ValidarMail/ValidarMail';
import DatosUsuario from './pages/DatosUsuario/DatosUsuario';
import PanelUsuario from './pages/PanelUsuario/PanelUsuario';
import Creditos from './pages/Creditos/Creditos';
import ComprobanteExitoso from './pages/ComprobanteExitoso/ComprobanteExitoso';
import Reintegro from './pages/Reintegro/Reintegro';
import QuienesSomos from './pages/QuienesSomos/QuienesSomos';
import QuieroComprar from './pages/QuieroComprar/QuieroComprar';
import QuieroVender from './pages/QuieroVender/QuieroVender';
import Contactanos from './pages/Contactanos/Contactanos';

// Vistas que en el Angular original también son solo un stub sin
// implementar ("works!") — no hay nada real que portar todavía.
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
          <Route path="/subastas" element={<ProximasSubastas />} />
          <Route path="/subastas/:id" element={<DetalleSubasta />} />
          <Route path="/subastas/:id/activa" element={<SubastaActiva />} />

          {/* Autenticación / usuario */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/validar-mail" element={<ValidarMail />} />
          <Route path="/datos" element={<DatosUsuario />} />
          <Route path="/perfil" element={<PanelUsuario />} />
          <Route path="/creditos" element={<Creditos />} />
          <Route path="/comprobante-exitoso" element={<ComprobanteExitoso />} />
          <Route path="/reintegro" element={<Reintegro />} />

          {/* Institucional */}
          <Route path="/quienes-somos" element={<QuienesSomos />} />
          <Route path="/quiero-comprar" element={<QuieroComprar />} />
          <Route path="/quiero-vender" element={<QuieroVender />} />
          <Route path="/contactanos" element={<Contactanos />} />
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
