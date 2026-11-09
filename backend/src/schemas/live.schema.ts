import { z } from 'zod';

export const startCameraSchema = z.object({
  name: z.string().min(1).max(80),
  rtspUrl: z.string().min(1).max(500).startsWith('rtsp://', 'Tiene que ser una URL rtsp://'),
});
