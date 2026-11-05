# Pendientes para salir a producción (con el cliente)

Checklist de lo que falta hacer **fuera del código** (cuentas, variables,
datos y decisiones del cliente). Ir tachando a medida que se hace.

Dónde se cargan las variables: **Railway → servicio del backend →
Variables** (el backend se reinicia solo al guardar). Nunca pegar
contraseñas ni secretos en chats.

## 1. Infraestructura y cuentas

- [ ] **Railway: plan Hobby pago** (5 USD/mes) y en **Usage** poner un
      límite de gasto (ej. 20 USD) para evitar sorpresas. Lo que más
      consume son los remates en vivo (video saliente).
- [ ] **Pasar Railway a la base de producción**: cambiar `DATABASE_URL`
      (y `MIGRATIONS_DATABASE_URL`) a la rama `production` de Neon. Hoy
      Railway usa la rama `dev`. Las migraciones se aplican solas al deploy.
- [ ] **Crear el primer admin en producción** (no correr el seed ahí):
      `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin` con
      `DATABASE_URL` apuntando a producción. Repetir con
      `ADMIN_ROLE=MARTILLERO` para Gonzalo y Emiliano.
- [ ] **Volumen para archivos**: confirmar que `UPLOAD_DIR` apunta al
      Volume de Railway (fotos de lotes, comprobantes); si no, se borran en
      cada deploy.
- [ ] **Dominio propio** (si van a usar uno, ej. puntolovera.com.ar):
      configurarlo en Vercel, agregarlo a `FRONTEND_URL` en Railway y a los
      orígenes autorizados de Google (punto 3).

## 2. Seguridad (antes de tener usuarios reales)

- [ ] **Rotar secretos que quedaron en chats**: contraseña de Neon
      (`neondb_owner`, ramas dev y production) ✔ ya rotada; falta
      `JWT_SECRET` y `RTMP_AUTH_SECRET` (este último cambiarlo en los dos
      servicios: backend y media-server, mismo valor). Cambiar `JWT_SECRET`
      cierra todas las sesiones abiertas (es esperable).
- [ ] Las cuentas de prueba del seed (`admin1234` / `user1234`) existen
      solo en la rama dev: no usarlas en producción.

## 3. Mails e ingreso con Google

- [ ] **SMTP** (sin esto no salen mails: validación de cuenta, olvidé mi
      contraseña, avisos de comprobantes/reintegros y de consultas). Opción
      simple: Gmail de Punto Lovera con verificación en dos pasos +
      contraseña de aplicación (https://myaccount.google.com/apppasswords).
      Variables: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`,
      `SMTP_USER=<la cuenta>`, `SMTP_PASS=<16 letras sin espacios>`,
      `MAIL_FROM=Punto Lovera <la cuenta>`. Prueba: registrarse con un mail
      propio y ver que llegue la validación.
- [ ] **`CONTACT_EMAIL`**: casilla donde llegan las consultas de "¿Tenés
      bienes para vender?" y Contactanos (hoy por defecto
      `lovera@lovera.com.ar`: confirmar que exista y la lean). Igual quedan
      todas en Admin → **Consultas recibidas**.
- [ ] **Ingreso con Google**: en https://console.cloud.google.com con una
      cuenta de Punto Lovera: crear proyecto → Pantalla de consentimiento
      de OAuth (Externo, nombre "Punto Lovera", **publicarla "En
      producción"**) → Credenciales → ID de cliente de OAuth tipo
      "Aplicación web", orígenes autorizados
      `https://punto-lovera.vercel.app` (+ dominio propio si hay) y
      `http://localhost:5173`. Copiar el ID de cliente a
      `GOOGLE_CLIENT_ID` en Railway. El botón aparece solo.

## 4. Datos del negocio

- [ ] **Datos de transferencia** para cargar crédito: `TRANSFER_ALIAS`,
      `TRANSFER_CBU`, titular y cuenta (`TRANSFER_*` en Railway; ver
      `backend/.env.example`).
- [ ] **QR de pago** (opcional): hoy no hay; si lo quieren, pasar la
      imagen y se agrega.
- [ ] **Datos de facturación**: el cliente todavía no los definió.
- [ ] **Matrícula de los martilleros** (Gonzalo y Emiliano Lovera): cuando
      la tengan, pasarla como texto y se agrega en la web.

## 5. Contenido (diseñadora / cliente)

- [ ] **Preguntas frecuentes**: revisar con el cliente las respuestas
      (hoy son borradores) en Home, /faq y Cómo participar.
- [ ] Textos de relleno de las tarjetas de **Quiero comprar** y de las 3
      tarjetas de instrucciones de **Créditos**.
- [ ] ¿Los lotes llevan **categoría** (ej. "MOBILIARIO", como en el
      diseño)? Hoy la tarjeta muestra el precio base. Si sí, se agrega el
      campo al admin.
- [ ] **Formato del ID de subasta** que quieren mostrar (hoy: 8
      caracteres del identificador interno).
- [ ] Revisar con la diseñadora las pantallas sin diseño final (login,
      registro, datos, perfil, créditos, sala en vivo, admin), que se
      hicieron siguiendo la línea de las pantallas finales.
- [ ] Fuente: solo de Google Fonts (decisión del cliente). Si la
      diseñadora elige otra en vez de Akatab/Instrument Serif, se cambia.

## 6. Prueba completa antes de abrir

- [ ] Cargar una subasta real desde Admin → Subastas (portada, lotes,
      fotos, precio base).
- [ ] **Prueba de transmisión con OBS**: generar la clave en el panel del
      martillero, transmitir, ver el video en la sala desde otra compu y el
      celular. Cámara chica del martillero: armarla dentro de la escena de
      OBS. Recomendado 720p a ~2500 kbps (menos consumo en Railway).
- [ ] Flujo completo con dos usuarios: registro (mail y Google) → datos →
      cargar crédito (comprobante) → admin lo aprueba → ofertar en vivo →
      adjudicar → reintegro del crédito sobrante.
- [ ] Probar desde celulares reales (pensando en público mayor: tamaños
      de letra y botones).

## Mejoras técnicas para más adelante (no bloquean)

- Sesiones revocables (hoy cambiar la contraseña no cierra las otras
  sesiones abiertas).
- Si el backend pasa a varias réplicas: contadores de rate limit en Redis.
- Archivos subidos en un storage externo (S3/Cloudinary) en vez del
  Volume.
