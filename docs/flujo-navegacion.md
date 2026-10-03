# Flujo de navegación (diagrama de referencia)

Transcripción del diagrama de flujo del sitio ([flujo-navegacion.webp](flujo-navegacion.webp)),
encontrado por Gian. Es la referencia de **qué secciones existen y cómo se
conectan**; el diseño visual sigue siendo el del front Angular (pixel a
pixel). Donde la imagen es ambigua se aclara.

## Menú principal (secciones de primer nivel)

| Sección | Contenido, en orden |
|---|---|
| **Home** | Foto con presentación → *Subasta activa* → Próximas subastas → Quiénes somos → Empresas que confían → "¿Querés vender? Contactanos". Cada bloque linkea a su sección (Próximas subastas → catálogo, Quiénes somos → Quiénes somos, Querés vender → Quiero vender / Contáctanos). |
| **Próximas subastas** | *Subasta activa* (→ **Ingresar al remate**, ver abajo) → Catálogo de subastas → Redes sociales |
| **Quiénes somos** | Qué hacemos → Quiénes somos → Cómo lo hacemos → Contactanos |
| **Quiero vender** | Explicativo → Formulario de contacto → Contactanos |
| **Contáctanos** | Canales de atención → Redes sociales |
| **Cómo participar** | Tutorial con los pasos a seguir → Registrarse |
| **Preguntas frecuentes** | Ventanitas desplegables (acordeón) |

## Panel de usuario

Desplegable (en el header), disponible después de Login / Sign Up. Si no
hay sesión, lleva a **Sign Up**.

1. **Perfil** → ver y editar datos personales · foto de perfil · datos de facturación
2. **Crédito disponible** → explicación de garantías · datos bancarios (para transferir) · informes de depósitos (comprobantes enviados)
3. **Mis compras / ofertas**
4. **Log Out**

## Sign Up

Nombre completo → Correo electrónico → Contraseña → Repetir contraseña →
**Verificar correo electrónico** → (vuelve a) Perfil / ver y editar datos personales.

## Ingresar al remate (sala en vivo)

Desde *Subasta activa*. Antes de entrar se valida, en este orden:

| Si... | Va a... |
|---|---|
| no está registrado | Sign Up |
| no cargó sus datos | Perfil → ver y editar datos personales |
| no tiene crédito | Cargar crédito → Crédito disponible |

## Diferencias con lo implementado (a oct 2026)

- **Ingresar al remate**: hoy cualquiera entra a la sala como espectador
  (puede mirar sin sesión) y con sesión puede pujar sin haber cargado sus
  datos; solo se valida el crédito al pujar. El diagrama pide frenar antes
  de entrar. **A definir:** ¿se bloquea la entrada a la sala o solo pujar
  (dejando mirar como espectador)?
- **Verificar correo → Perfil**: hoy después de validar el mail se manda a
  iniciar sesión; el diagrama sigue a completar los datos personales.
- **Panel de usuario desplegable**: hoy el header muestra "Bienvenido,
  nombre" (link a /perfil) y SALIR, no un menú desplegable.
- **Crédito disponible**: el backend ya tiene todo, falta conectarlo en el
  front: datos bancarios (`GET /api/creditos/transferencia`), envío de
  comprobante (`POST /api/creditos`, campo `comprobante`) e "informes de
  depósitos" (`GET /api/creditos/mios`, comprobantes enviados y su estado).
  Tampoco hay pantalla de admin para aprobar comprobantes
  (`/api/creditos/pendientes`, `/:id/aprobar`, `/:id/rechazar`). La explicación de garantías no
  tiene contenido todavía.
- **Mis compras / ofertas**: hoy solo muestra compras; faltan las ofertas
  en curso (lotes donde va ganando / pujó).
- **Cómo participar** y **Preguntas frecuentes**: siguen sin contenido en
  ambos front; el diagrama define su estructura (tutorial de pasos + botón
  Registrarse; FAQ en acordeón).
- **Datos de facturación** en el perfil: el formulario actual tiene
  DNI/CUIT y dirección; confirmar si con eso alcanza o falta algo
  (razón social, condición frente al IVA, etc.).
