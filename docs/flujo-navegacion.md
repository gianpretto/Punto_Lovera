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

## Diferencias con lo implementado (a oct 2026)

Ya resueltas: panel de usuario desplegable en el header, Crédito disponible
conectado (datos bancarios, envío de comprobante, informes de depósitos) +
pantalla de admin `/admin/comprobantes`, y ofertas en curso en
`/perfil#compras`.

Pendientes:

- **Ingresar al remate + pase temporal** (ver arriba): hoy cualquiera mira
  sin sesión y con sesión se puede pujar sin datos cargados (solo se valida
  el crédito).
- **Verificar correo → Perfil**: hoy después de validar el mail se manda a
  iniciar sesión; el diagrama sigue a completar los datos personales.
- **Garantías**: la explicación en /creditos es un borrador armado a partir
  de cómo funciona la reserva de crédito; validar el texto con el cliente.
- **Cómo participar** y **Preguntas frecuentes**: siguen sin contenido en
  ambos front; el diagrama define su estructura (tutorial de pasos + botón
  Registrarse; FAQ en acordeón).
- **Datos de facturación** en el perfil: el formulario actual tiene
  DNI/CUIT y dirección; confirmar si con eso alcanza o falta algo
  (razón social, condición frente al IVA, etc.).
