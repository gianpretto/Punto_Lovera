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
  SubastaActiva (sala de puja: lightbox, chat, contador — la lógica de
  puja/chat todavía es local/mock, **falta conectarla al WebSocket real**)
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

## Pendiente / próximos pasos

1. **Conectar el resto del frontend React al backend real** (auth y perfil
   ya están; faltan subastas/lotes — Home, ProximasSubastas,
   DetalleSubasta — y Creditos/comprobantes, que hoy usan datos
   hardcodeados).
2. Conectar `SubastaActiva` al WebSocket real de pujas/chat del backend
   (hoy la lógica de la sala en vivo es local, con `setTimeout` simulando
   respuestas). Antes hay que decidir cómo se sabe qué lote está en
   remate en cada momento: el schema no tiene "lote actual" y `bid:place`
   necesita un `lotId` (propuesta: `auctions.currentLotId` + evento
   `lot:change` que dispara el martillero).
3. Revisión y pulido visual conjunto (comparación final pixel a pixel).
4. Decidir contenido real para `/como-participar` y `/faq` (hoy vacíos en
   ambos frontends).
5. Opcional: si Gian consigue acceso de escritura al repo `rtsp-manager`,
   arreglar el bug de concurrencia documentado en `backend/README.md`.
