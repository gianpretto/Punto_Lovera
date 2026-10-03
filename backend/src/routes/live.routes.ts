import express, { Router } from 'express';
import * as liveController from '../controllers/live.controller';

const router = Router();

// Callback interno de nginx-rtmp (media-server). Manda form urlencoded.
router.post('/rtmp/publish', express.urlencoded({ extended: false }), liveController.rtmpPublish);

export default router;
