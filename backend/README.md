# Punto Lovera — Backend

API para la plataforma de subastas de comercios Punto Lovera: casa de remates
con subastas de negocios/maquinaria, pujas en vivo por WebSocket, chat en la
sala de subasta activa, y sistema de créditos por comprobante de
transferencia (sin pasarela de pago integrada — el usuario transfiere por
fuera y sube el comprobante para que un admin lo apruebe).

## Stack

- Node.js + Express + TypeScript
- PostgreSQL + [Drizzle ORM](https://orm.drizzle.team/) (no Prisma: el
  binario nativo de Prisma se descarga desde una CDN propia que quedaba
  bloqueada en el sandbox donde se desarrolló esto; Drizzle es 100% JS/TS y
  no tiene ese problema en ningún entorno)
- Socket.io para pujas en vivo y chat
- JWT + bcrypt para auth, multer para subida de archivos (comprobantes y
  fotos de lotes)

## Setup local

```bash
cp .env.example .env      # completar DATABASE_URL, JWT_SECRET, etc.
npm install
npm run db:migrate        # crea las tablas
npm run seed               # admin + usuario de prueba + subasta de ejemplo
npm run dev                 # http://localhost:4000
```

Usuarios de prueba después de `npm run seed`:
- `admin@puntolovera.com` / `admin1234` (rol ADMIN)
- `usuario@test.com` / `user1234` (rol USER, saldo $500.000)

## Estructura

```
src/
  config/       env, conexión a la DB (pg + drizzle)
  db/           schema.ts (tablas) y migrations/ (SQL generado)
  middleware/   auth (JWT), manejo de errores, upload (multer)
  schemas/      validación de inputs con zod
  services/     lógica de negocio (auth, subastas, lotes, pujas, créditos, compras)
  controllers/  handlers HTTP, delgados: parsean/validan y llaman al service
  routes/       definición de endpoints Express
  sockets/      WebSocket: sala de subasta en vivo (pujas + chat)
  seed/         datos de prueba
```

## Modelo de datos (resumen)

- **users**: cuenta, rol (USER/MARTILLERO/ADMIN), saldo de créditos
- **auctions**: subasta (PROXIMA/ACTIVA/FINALIZADA/CANCELADA)
- **lots**: lote dentro de una subasta, con precio actual e incremento mínimo
- **lot_images**: fotos de cada lote
- **bids**: pujas (una por cada oferta)
- **chat_messages**: chat de la sala en vivo (incluye mensajes automáticos "ofreció $X")
- **credit_vouchers**: comprobantes de transferencia subidos por el usuario, con estado PENDIENTE/APROBADO/RECHAZADO
- **purchases**: se genera al cerrar un lote, con la referencia y el comprador ganador

## Endpoints principales

Todos bajo `/api`. Ver `src/routes/*.routes.ts` para el detalle completo.

- `POST /auth/register`, `/auth/login`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `GET /auth/me`
- `GET /subastas`, `GET /subastas/:id` (públicas)
- `POST /subastas`, `PATCH /subastas/:id` (MARTILLERO/ADMIN)
- `POST /subastas/:auctionId/lotes` (crear lote), `POST /subastas/:auctionId/lotes/:lotId/imagenes` (subir fotos)
- `POST /subastas/:auctionId/lotes/:lotId/pujas` (pujar por HTTP, fallback del WebSocket)
- `GET /creditos/transferencia` (alias/CBU para mostrar en /creditos)
- `POST /creditos` (subir comprobante), `GET /creditos/mios`
- `GET /creditos/pendientes`, `POST /creditos/:id/aprobar`, `POST /creditos/:id/rechazar` (ADMIN)
- `GET /compras/mias`, `POST /compras/cerrar-lote/:lotId` (MARTILLERO/ADMIN)
- `POST /subastas/:id/camara`, `DELETE /subastas/:id/camara` (MARTILLERO/ADMIN, prender/apagar la cámara en vivo)
- `GET /subastas/:id/vivo/hls/*` y `/vivo/dash/*` (cualquier usuario logueado — proxy autenticado hacia rtsp-manager)

## Video en vivo (integración con rtsp-manager)

El repo de Francis ([rtsp-manager](https://github.com/FrancisMoscatelli1/rtsp-manager))
re-transmite una cámara RTSP como HLS/DASH vía ffmpeg + nginx-rtmp, pero no
tiene ninguna autenticación propia. Por eso corre como dos servicios internos
aparte (nunca expuestos directamente a internet):

- **Control plane** (la API Node de ese repo, puerto 5000 por defecto): este
  backend le pega server-to-server en `live.service.ts` para prender/apagar
  cámaras. Configurar `RTSP_CONTROL_URL` en `.env`.
- **Media server** (el nginx-rtmp de ese repo, sirve `.m3u8`/`.mpd`): este
  backend lo proxea en `GET /subastas/:id/vivo/:protocol/*` exigiendo el
  mismo JWT que el resto de la API — es la única forma autorizada de llegar
  al video. Configurar `RTSP_MEDIA_URL` en `.env`.

El frontend apunta su reproductor (dash.js/hls.js) a esa URL proxeada,
mandando el JWT en el header `Authorization` (ambas librerías soportan
inyectar headers en cada request vía su config de requests/xhrSetup).

**⚠️ Bug encontrado en rtsp-manager:** el servicio de persistencia
(`streamPersistenceService`) tiene una condición de carrera en su escritura
atómica (`streams.json.tmp` → rename a `streams.json`): si dos guardados se
disparan casi al mismo tiempo (por ejemplo, un error de conexión RTSP y un
DELETE llegando juntos), uno de los renames falla con ENOENT y el archivo
`data/streams.json` puede terminar corrupto (JSON duplicado/mal formado).
Lo reproduje fácil apagando una cámara justo después de crearla con una URL
RTSP inválida. Vale la pena que se lo comenten a Francis, o si preferís lo
reviso yo si me das acceso a ese repo.

## WebSocket (sala de subasta en vivo)

```js
const socket = io(API_URL, { auth: { token: jwt } });
socket.emit('auction:join', { auctionId });
socket.emit('bid:place', { lotId, amount });
socket.emit('chat:message', { auctionId, text });

socket.on('chat:history', (messages) => {...});   // al hacer join
socket.on('bid:new', ({ lotId, currentPrice, bid }) => {...});
socket.on('chat:message', (msg) => {...});
socket.on('bid:error', ({ message }) => {...});
```

## Pendiente / próximos pasos

- Conectar el frontend Angular (reemplazar los mocks de `AuthService`, `panel-usuario`, `detalle-subasta`, `creditos`, `subasta-activa`)
- Guards de ruta en el front para páginas que requieren login
- Definir quién puede pasar una subasta de PROXIMA a ACTIVA y cerrar lotes (¿automático por horario, o manual del martillero?)
- Storage de archivos: hoy los comprobantes y fotos de lotes se guardan en disco local (`backend/uploads/`, gitignoreado). Para producción en Railway/Render conviene migrar a un bucket (Cloudinary/S3) porque esos servicios no garantizan disco persistente.
- Revisar si el repo de video/webcam en vivo de Gian se integra acá o queda aparte, y cómo se sincroniza con el chat de este backend
