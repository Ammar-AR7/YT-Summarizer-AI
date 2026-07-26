/**
 * Trial Routes — مسار حالة الفترة التجريبية
 * 
 * GET /api/trial-status — فحص حالة الـ cooldown للمستخدم
 */
import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/trial-status
 * يتحقق إذا كان المستخدم/IP في فترة انتظار (10 دقائق cooldown)
 */
router.get('/trial-status', async (req: Request, res: Response): Promise<any> => {
  const userId = req.query.userId as string;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'anon_ip';
  const trialIdentifier = (userId && userId !== 'anonymous') ? userId : `ip_${clientIp}`;

  try {
    const { getTrialStatus } = await import('../services/trialService.js');
    const status = await getTrialStatus(trialIdentifier);
    return res.json({
      success: true,
      inCooldown: !status.allowed,
      remainingMinutes: status.remainingMinutes || 0,
      cooldownEndsAt: status.cooldownEndsAt || null
    });
  } catch (err: any) {
    return res.json({ success: true, inCooldown: false, remainingMinutes: 0 });
  }
});

export default router;
