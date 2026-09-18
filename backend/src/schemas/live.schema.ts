import { z } from 'zod';

export const startCameraSchema = z.object({
  name: z.string().min(1),
  rtspUrl: z.string().min(1).startsWith('rtsp://', 'Tiene que ser una URL rtsp://'),
});
