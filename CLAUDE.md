# Punto Lovera

Plataforma de subastas online de fondos de comercio / locales comerciales en
el conurbano bonaerense (GBA), con puja en vivo (video + chat) al estilo
remate. Proyecto de Gian para un amigo/colega — desarrollo part-time,
delegado en gran parte a Claude, con revisión conjunta periódica.

## Cómo trabajamos

- Gian tiene poco tiempo: la idea es que Claude avance de forma autónoma en
  tareas concretas (backend primero, después frontend) mientras Gian sigue
  con su trabajo principal, y se revisa junto de tanto en tanto.
- Sin gateway de pago dentro de la app — pedido explícito del colega de Gian.
  La app solo debe *mostrar* datos de transferencia/alias/QR; el pago se
  hace fuera de la plataforma. Si esto cambia, avisar antes de tocarlo.
- Puja en vivo requiere WebSockets (ya implementado con Socket.io).
- Hay un repo separado de un colega (Francis, `rtsp-manager`) para
  video/webcam en vivo, que se integra vía proxy autenticado en vez de
  reescribirlo.

## Cómo pushear a GitHub (importante, leer antes de reintentar nada)

**Actualización (oct 2026):** si la sesión corre en la app de escritorio
de Claude directamente sobre la compu de Gian (Windows, carpeta
`Punto_Lovera_Front`), `git push origin main` funciona: usa el Git
Credential Manager de Windows. Lo de abajo aplica solo a sesiones en el
sandbox de la nube.

Esta sesión corre en un sandbox de la nube de Anthropic. **Ese sandbox NO
tiene, y nunca va a tener, credenciales de GitHub de Gian** — es una
limitación conocida y actual de la plataforma (proxy de git bloquea
repos no autorizados explícitamente para la sesión). No tiene sentido
que una futura sesión reintente `git push` desde ahí una y otra vez.

El flujo que sí funciona, y que hay que seguir usando:

1. Gian conecta la carpeta de su compu (`Punto_Lovera_Front`, en
   `C:\Users\Gian\Desktop\puntoLovera-front\Punto_Lovera_Front`) a la sesión
   de Claude, vía el bridge de dispositivo ("Link to this computer" en la
   app de escritorio).
2. Claude escribe los archivos y hace `git commit` directamente en esa
   carpeta conectada (que es la carpeta real de la compu de Gian, no una
   copia) usando las herramientas `device_bash` / `device_commit_files`.
   Ojo: ese `device_bash` corre en una VM Linux aislada, separada de su
   Windows real — tampoco tiene sus credenciales, así que **tampoco se
   puede pushear desde ahí**. Solo sirve para escribir archivos y commitear
   localmente.
3. Gian pushea él mismo desde su Git Bash real en Windows (ahí sí están sus
   credenciales guardadas), con `git push origin main`, cuando le queden
   commits pendientes.

Si en algún momento Anthropic arregla el acceso de git desde el sandbox en
la nube, este proceso se puede simplificar. Hasta entonces, este es el
camino.

## Flujo de navegación (referencia de producto)

`docs/flujo-navegacion.md` (+ la imagen `docs/flujo-navegacion.webp`):
diagrama de qué secciones existen y cómo se conectan — menú principal,
panel de usuario (Perfil / Crédito disponible / Mis compras y ofertas /
Log Out), Sign Up, y la regla de **Ingresar al remate**: si no está
registrado → Sign Up; si no cargó sus datos → Perfil; si no tiene crédito
→ Cargar crédito. Al final del doc está la lista de diferencias con lo
implementado; usarla como backlog de producto.

## Deploy

- **Backend → Railway** (Root Directory `backend`, config en
  `backend/railway.json`): build `npm run build`, start `npm run
  start:prod` (aplica migraciones con `dist/db/migrate.js` y levanta el
  server), healthcheck `/api/health`. Variables: `DATABASE_URL` (Neon
  pooler), `MIGRATIONS_DATABASE_URL` (Neon directa, opcional),
  `JWT_SECRET`, `FRONTEND_URL` (lista separada por comas; la primera se usa
  en los links de los mails), `UPLOAD_DIR` (mount path de un **Volume**, si
  no los archivos se borran en cada deploy), `TRANSFER_*`, `SMTP_*`
  (sin SMTP los mails solo se loguean), `RTSP_*`.
- **Primer admin en producción** (no correr el seed ahí):
  `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin` apuntando a la
  base de producción (también sirve con `ADMIN_ROLE=MARTILLERO`).
- **Front React → Vercel**: proyecto con Root Directory `frontend-react`
  (`frontend-react/vercel.json`, SPA rewrites) y `VITE_API_URL` = URL de
  Railway. El proyecto Vercel actual publica el Angular (`frontend/`).
- **Base**: Neon. Rama `dev` para desarrollo/pruebas (es la de
  `backend/.env`), `production` para datos reales (vaciada, sin seed).
- Comprobantes de transferencia: privados, se sirven solo por
  `GET /api/creditos/:id/archivo` (dueño o admin). `/uploads/lots` sí es
  público.

## Video en vivo: decisión (oct 2026)

El martillero transmite desde **una PC con OBS** hacia un servidor de video
propio en Railway (basado en el nginx-rtmp del repo de Francis: recibe
RTMP y genera HLS); el backend lo sirve por el proxy autenticado que ya
existe. Último recurso si eso falla: vivo de YouTube embebido (pero lo ve
cualquiera con el link). El modelo de rtsp-manager "el servidor se conecta
a la cámara IP" no sirve tal cual: la cámara está dentro de la red del
local. Pendiente: desplegar el servidor RTMP con clave de transmisión por
subasta (validada contra el backend) y mostrarla en el panel del martillero.

## Estructura del repo

```
backend/          API Node.js + Express + TypeScript (completa)
frontend/          Sitio original en Angular (diseño fuente, no se toca más
                   salvo bugs — es la referencia visual para el port a React)
frontend-react/    Migración a React en curso/completa (ver estado abajo)
```

## Backend (`backend/`)

- Node.js + Express + TypeScript + Drizzle ORM + PostgreSQL (se eligió
  Drizzle en vez de Prisma porque el binario de Prisma se descarga de un
  CDN bloqueado por el proxy de egress del sandbox — no es una preferencia,
  fue forzado por el entorno).
- Auth JWT (jsonwebtoken + bcryptjs), validación con zod, uploads con
  multer (local disk por ahora — falta migrar a S3/Cloudinary en prod).
- Pujas en vivo: Socket.io + REST comparten la misma lógica
  (`realtime.service.ts` → `placeBidAndBroadcast`), con control de
  concurrencia optimista en `bid.service.ts` (retry loop sobre UPDATE
  condicional) para evitar carreras entre pujas simultáneas.
- Video en vivo: proxy autenticado hacia el `rtsp-manager` de Francis
  (microservicio sin auth propia) — ver `src/services/live.service.ts` y
  `src/controllers/live.controller.ts`. Hay un bug de concurrencia
  documentado en el README del backend, es de ese repo externo, no de acá.
- Variables de entorno: ver `.env.example` (incluye datos de transferencia,
  JWT secret, DB, SMTP, URLs del rtsp-manager).

## Frontend React (`frontend-react/`)

Vite + React 19 + TypeScript + react-router-dom v7. CSS Modules
(`*.module.scss`) por componente, para replicar el `ViewEncapsulation` de
Angular (estilos scoped por componente) y evitar colisiones de clases
globales entre secciones que reutilizan nombres como `.btn-negro`,
`.sub-card`, `.pill`, etc.

**Objetivo: fidelidad pixel a pixel con el diseño Angular original**
(está diseñado uno a uno por la diseñadora, no debe "aflojarse" el diseño
al portar). Metodología usada: correr ambos front (Angular y React) en
paralelo y comparar screenshots con Playwright en los mismos viewports —
así se detectó y corrigió, por ejemplo, un bug de subrayado en
`TarjetaSubasta` (el original usaba un `<article>` con click, el port usa
un `<Link>` real que trae `text-decoration` por defecto).

### Estado de la migración (todas las vistas reales ya están portadas)

Portadas y verificadas (`tsc --noEmit`, `vite build`, smoke test con
Playwright sobre las 19 rutas, sin errores de consola/React):

- Layout: Header, Footer
- Home + secciones compartidas: Hero, SubastaEnVivo, SubastasAnteriores,
  TarjetaSubasta, Redes, BannerAccion, TarjetaProductoCatalogo
- Institucionales: QuienesSomos, QuieroComprar, QuieroVender (comparten
  layout vía `pages/QuieroComprar/AccionPage.tsx`), Contactanos
- Subastas: ProximasSubastas (con paginación), DetalleSubasta,
  SubastaActiva (sala de puja: lightbox, chat, contador — conectada al
  WebSocket real, ver abajo)
- Auth/usuario: Login, Registro, ForgotPassword, ValidarMail,
  DatosUsuario, PanelUsuario, Creditos, ComprobanteExitoso, Reintegro

**Sin portar a propósito** (`/como-participar` y `/faq`): en el Angular
original son componentes stub sin implementar (`<p>works!</p>`, el
boilerplate default de Angular CLI). No hay nada real ahí todavía — quedan
como placeholder "en construcción" en React hasta que Gian defina el
contenido.

**Se descartaron sin portar** (dead code en Angular, confirmado que no los
usa ninguna vista real): `TituloConCards`, `BannerSaldo`, `TextoImagen`.

### `AuthContext` (`src/services/AuthContext.tsx`) y `api.ts`

Auth real contra el backend (JWT): `login` → `POST /api/auth/login`, el
token se guarda en `localStorage` (`authToken`) y `src/services/api.ts` lo
manda como `Authorization: Bearer`. Al cargar la app se valida con
`GET /auth/me`. Expone `user` (con `creditBalance`), `currentUser` (nombre
para el header), `loading`, y `login/register/updateUserData` (async).

Ya conectadas al backend: Login, Registro, ValidarMail (`?token=` del mail
+ reenviar), ForgotPassword (`?token=` → nueva contraseña), DatosUsuario
(`PATCH /auth/me`), PanelUsuario (datos, saldo y `GET /compras/mias`).
El avatar sigue siendo local (el backend no guarda avatar todavía).

En dev, Vite proxea `/api`, `/uploads` y `/socket.io` a `localhost:4000`
(`vite.config.ts`); `FRONTEND_URL` del backend apunta a `localhost:5173`.

### Sala en vivo (`SubastaActiva` + `src/services/useAuctionRoom.ts`)

Conectada al Socket.io del backend. Con sesión se puja y chatea; sin
sesión se mira como espectador. Eventos (documentados también en
`backend/src/sockets/bidding.socket.ts`):

- cliente → `auction:join`, `auction:leave`, `bid:place`, `chat:message`
- servidor → `auction:state` (al entrar), `chat:history`, `bid:new`,
  `chat:message`, `lot:change`, `lot:sold`, y `bid:error` / `chat:error` /
  `auction:error` al socket que falló

Lote en remate: `auctions.current_lot_id` (migración 0003). Lo mueve el
martillero con `PATCH /api/subastas/:id/lote-actual { lotId }`; si es null
se usa el primer lote sin vender. Al cerrar un lote
(`POST /api/compras/cerrar-lote/:lotId`) la sala recibe `lot:sold` y avanza
sola al siguiente. Solo se puede pujar al lote en remate.

Video: `components/LivePlayer` reproduce HLS con hls.js contra el proxy
autenticado del backend (`/api/subastas/:id/vivo/hls/index.m3u8`, manda el
JWT en cada request; sin sesión muestra "Iniciá sesión para ver..."). Si la
cámara recién se prendió o se corta, reintenta solo cada 4 s. Cuando el
martillero prende/apaga la cámara la sala recibe el `cameraId` por
`lot:change` y el reproductor arranca/para solo.

Panel del martillero: `/subastas/:id/martillero` (solo MARTILLERO/ADMIN;
link desde la sala). Abrir/finalizar subasta, poner un lote en remate,
adjudicar al mejor postor y prender/apagar la cámara (nombre + URL rtsp).
Es una pantalla interna nueva, sin diseño de la diseñadora.

Créditos (opción elegida: reservar mientras va ganando): `lots.leader_id`
guarda quién va ganando. Lo reservado de un usuario = suma del precio
actual de los lotes sin vender que lidera en subastas PROXIMA/ACTIVA (se
calcula en `credit.service.ts`, no hay tabla de reservas). Disponible =
saldo - reservado. Al pujar se valida contra el disponible con la fila del
usuario bloqueada (`FOR UPDATE`); si ya lideraba ese lote, su reserva ahí
se reemplaza por la nueva puja. Ser superado libera la reserva; adjudicar
descuenta el monto del saldo; finalizar/cancelar la subasta libera lo que
quedó sin adjudicar. `/auth/me` devuelve `heldCredit` y `availableCredit`.

Reglas de ingreso (diagrama + pedido del cliente): a la sala (socket y
video) se entra con sesión **o** con un pase de invitado de esa subasta
(`auction_passes`, `pass.service.ts`; el front lo lee de `?pase=`). Pujar
pide sesión + datos completos (`isProfileComplete`: nombre, apellido,
teléfono, DNI, dirección, ciudad, provincia, CP) + crédito disponible. El
seed deja a `usuario@test.com` con datos completos.

Las pujas y mensajes propios **no** se agregan localmente: vuelven por el
socket a toda la sala (si no, se duplican).

Probado end-to-end (28 checks de auth + sala con dos clientes, 9 de
cámara/proxy de video, y la UI en el navegador) contra un Postgres
embebido (PGlite) y un rtsp-manager falso (misma API `/streams`, ffmpeg con
patrón de prueba publicando HLS como nginx con `hls_nested on`), porque no
había Docker.

## Pendiente / próximos pasos

1. **Conectar el resto del frontend React al backend real** (auth y perfil
   ya están; faltan subastas/lotes — Home, ProximasSubastas,
   DetalleSubasta — y Creditos/comprobantes, que hoy usan datos
   hardcodeados).
2. Probar el video con el rtsp-manager real de Francis (solo se probó con
   uno falso) y la cámara chica del martillero en la sala (sigue siendo
   placeholder: hoy hay una sola cámara por subasta).
3. Revisión y pulido visual conjunto (comparación final pixel a pixel).
4. Decidir contenido real para `/como-participar` y `/faq` (hoy vacíos en
   ambos frontends).
5. Opcional: si Gian consigue acceso de escritura al repo `rtsp-manager`,
   arreglar el bug de concurrencia documentado en `backend/README.md`.
