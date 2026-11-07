import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Medicion from './components/layout/Medicion';
import PantallaCarga from './components/layout/PantallaCarga';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import { AuthProvider } from './services/AuthContext';
import Home from './pages/Home/Home';
const ProximasSubastas = lazy(() => import('./pages/ProximasSubastas/ProximasSubastas'));
const DetalleSubasta = lazy(() => import('./pages/DetalleSubasta/DetalleSubasta'));
const SubastaActiva = lazy(() => import('./pages/SubastaActiva/SubastaActiva'));
const PanelMartillero = lazy(() => import('./pages/PanelMartillero/PanelMartillero'));
const IrAlPanel = lazy(() => import('./pages/IrAlPanel/IrAlPanel'));
const AdminComprobantes = lazy(() => import('./pages/AdminComprobantes/AdminComprobantes'));
const AdminReintegros = lazy(() => import('./pages/AdminReintegros/AdminReintegros'));
const AdminConsultas = lazy(() => import('./pages/AdminConsultas/AdminConsultas'));
const AdminSubastas = lazy(() => import('./pages/AdminSubastas/AdminSubastas'));
const EditarSubasta = lazy(() => import('./pages/AdminSubastas/EditarSubasta'));
const Login = lazy(() => import('./pages/Login/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword/ForgotPassword'));
const Registro = lazy(() => import('./pages/Registro/Registro'));
const ValidarMail = lazy(() => import('./pages/ValidarMail/ValidarMail'));
const DatosUsuario = lazy(() => import('./pages/DatosUsuario/DatosUsuario'));
const PanelUsuario = lazy(() => import('./pages/PanelUsuario/PanelUsuario'));
const Creditos = lazy(() => import('./pages/Creditos/Creditos'));
const ComprobanteExitoso = lazy(() => import('./pages/ComprobanteExitoso/ComprobanteExitoso'));
const Reintegro = lazy(() => import('./pages/Reintegro/Reintegro'));
const QuienesSomos = lazy(() => import('./pages/QuienesSomos/QuienesSomos'));
const QuieroComprar = lazy(() => import('./pages/QuieroComprar/QuieroComprar'));
const QuieroVender = lazy(() => import('./pages/QuieroVender/QuieroVender'));
const Contactanos = lazy(() => import('./pages/Contactanos/Contactanos'));
const ComoParticipar = lazy(() => import('./pages/ComoParticipar/ComoParticipar'));
const PreguntasFrecuentesPage = lazy(() => import('./pages/PreguntasFrecuentesPage'));

// Después de que carga la primera página, en un momento libre se bajan las
// demás (y el reproductor de video): así pasar de una sección a otra es
// inmediato, sin esperar a descargar el código de la página nueva.
function precargarPaginas() {
  const paginas = [
    () => import('./pages/ProximasSubastas/ProximasSubastas'),
    () => import('./pages/DetalleSubasta/DetalleSubasta'),
    () => import('./pages/SubastaActiva/SubastaActiva'),
    () => import('./pages/PanelMartillero/PanelMartillero'),
    () => import('./pages/IrAlPanel/IrAlPanel'),
    () => import('./pages/AdminComprobantes/AdminComprobantes'),
    () => import('./pages/AdminReintegros/AdminReintegros'),
    () => import('./pages/AdminConsultas/AdminConsultas'),
    () => import('./pages/AdminSubastas/AdminSubastas'),
    () => import('./pages/AdminSubastas/EditarSubasta'),
    () => import('./pages/Login/Login'),
    () => import('./pages/ForgotPassword/ForgotPassword'),
    () => import('./pages/Registro/Registro'),
    () => import('./pages/ValidarMail/ValidarMail'),
    () => import('./pages/DatosUsuario/DatosUsuario'),
    () => import('./pages/PanelUsuario/PanelUsuario'),
    () => import('./pages/Creditos/Creditos'),
    () => import('./pages/ComprobanteExitoso/ComprobanteExitoso'),
    () => import('./pages/Reintegro/Reintegro'),
    () => import('./pages/QuienesSomos/QuienesSomos'),
    () => import('./pages/QuieroComprar/QuieroComprar'),
    () => import('./pages/QuieroVender/QuieroVender'),
    () => import('./pages/Contactanos/Contactanos'),
    () => import('./pages/ComoParticipar/ComoParticipar'),
    () => import('./pages/PreguntasFrecuentesPage'),
    () => import('./components/LivePlayer/LivePlayer'),
  ];
  const libre = (fn: () => void) =>
    'requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1500);
  libre(() => paginas.forEach((cargar) => cargar().catch(() => undefined)));
}

export default function App() {
  useEffect(precargarPaginas, []);

  return (
    <AuthProvider>
      <PantallaCarga />
      <Medicion />
      <Header />

      {/* Cada página se descarga recién cuando se visita (Home va en el
          paquete inicial). Mientras carga, <main> guarda el alto mínimo y el
          footer no salta para arriba. */}
      <main className="container my-4">
        <Suspense fallback={null}>
        <Routes>
          {/* Inicio */}
          <Route path="/" element={<Home />} />

          {/* Subastas */}
          <Route path="/subastas" element={<ProximasSubastas />} />
          <Route path="/subastas/:id" element={<DetalleSubasta />} />
          <Route path="/subastas/:id/activa" element={<SubastaActiva />} />
          <Route path="/subastas/:id/martillero" element={<PanelMartillero />} />
          <Route path="/martillero" element={<IrAlPanel />} />

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
          <Route path="/admin/comprobantes" element={<AdminComprobantes />} />
          <Route path="/admin/reintegros" element={<AdminReintegros />} />
          <Route path="/admin/consultas" element={<AdminConsultas />} />

          {/* Administración de subastas y lotes (martillero / admin) */}
          <Route path="/admin/subastas" element={<AdminSubastas />} />
          <Route path="/admin/subastas/nueva" element={<EditarSubasta key="nueva" />} />
          <Route path="/admin/subastas/:id" element={<EditarSubasta key="editar" />} />

          {/* Institucional */}
          <Route path="/quienes-somos" element={<QuienesSomos />} />
          <Route path="/quiero-comprar" element={<QuieroComprar />} />
          <Route path="/quiero-vender" element={<QuieroVender />} />
          <Route path="/contactanos" element={<Contactanos />} />
          <Route path="/como-participar" element={<ComoParticipar />} />
          <Route path="/faq" element={<PreguntasFrecuentesPage />} />

          {/* Fallback */}
          <Route path="*" element={<Home />} />
        </Routes>
        </Suspense>
      </main>

      <Footer />
    </AuthProvider>
  );
}
