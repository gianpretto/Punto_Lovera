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

## Pedido del cliente: pase temporal para ver el remate

> Hay que agregar alguna opción para poder generar un link temporal tipo
> pasaporte, para pasarle a la gente y que no te pida crearte un usuario
> para poder ver el remate. Por ejemplo, se lo paso a la persona que está
> rematando el local, que es un cliente de única vez; si le queda el
> usuario armado, lo único que hace es ocupar espacio en la base de datos.

Interpretación acordada (define también la regla de "Ingresar al remate"):

- **Mirar** la sala (video + chat en modo lectura): con cuenta **o** con un
  pase temporal. Sin ninguna de las dos → Sign Up (como el diagrama).
- **Pujar / escribir en el chat**: cuenta + datos cargados + crédito.
- El pase lo genera el martillero/admin por subasta, con vencimiento y
  una etiqueta (ej: "Dueño del local"); se puede revocar. Se guarda en una
  tabla propia, **no** crea usuarios.

## Estado (a oct 2026)

Implementado:

- Listas reales: Home (subasta en vivo, próximas con cuenta regresiva,
  anteriores), Próximas subastas (paginada) y Detalle (lotes + botón
  "Ingresar al remate" cuando está ACTIVA).
- **Ingresar al remate**: mirar con cuenta o pase de invitado (sin ninguno
  → `/registro?volver=<sala>`); al ofertar, si faltan datos → `/datos?volver=<sala>`,
  si no hay crédito → `/creditos`. El backend también lo exige (socket y
  video piden sesión o pase; la puja pide datos completos y crédito).
- **Pases de invitado**: panel del martillero → "Pases de invitado" (crear
  con etiqueta + vencimiento, copiar link, revocar, ver último uso). El
  invitado ve video y chat, no puede ofertar ni escribir.
- **Verificar correo → Perfil**: verificar el mail deja la sesión iniciada
  y lleva a `/datos`.
- Panel de usuario desplegable, Crédito disponible conectado + admin de
  comprobantes, ofertas en curso.
- **Cómo participar** (`/como-participar`) y **Preguntas frecuentes** (`/faq`,
  el Home muestra las 3 primeras): textos en `frontend-react/src/content/participar.ts`.
- **Reintegro** (`/reintegro`) conectado: el pedido reserva el crédito y el
  admin lo paga desde `/admin/reintegros`.
- **Administrar subastas** (`/admin/subastas`): alta y edición de subastas,
  lotes y fotos (antes solo se podía por API).

Pendiente / a validar con el cliente:

- Textos de Cómo participar, FAQ y garantías: son un **borrador** armado a
  partir de cómo funciona el sistema.
- **Datos de facturación**: hoy DNI/CUIT y dirección; confirmar si falta
  razón social, condición frente al IVA, etc.
