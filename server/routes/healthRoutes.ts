/**
 * Health Routes — مسار فحص صحة الخادم
 */
import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/health
 * نقطة فحص الحالة (يستخدمها UptimeRobot لإبقاء Render حياً)
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;
