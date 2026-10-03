import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { UPLOAD_ROOT } from './middleware/upload.middleware';

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // permite servir /uploads a otro origen (el front)
app.use(cors({ origin: env.frontendOrigins, credentials: true }));
app.use(express.json());
app.use(morgan(env.isProd ? 'combined' : 'dev'));

// Archivos subidos (comprobantes, fotos de lotes). En producción conviene
// moverlo a un bucket, ver nota en upload.middleware.ts.
// Solo las fotos de lotes son públicas. Los comprobantes de transferencia
// tienen datos bancarios: se sirven por GET /api/creditos/:id/archivo, que
// exige ser el dueño o admin.
app.use('/uploads/lots', express.static(path.join(UPLOAD_ROOT, 'lots')));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);
