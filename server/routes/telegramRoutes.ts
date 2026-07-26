/**
 * Telegram Routes — مسارات الـ Webhook للشبكات الخارجية وبوت تلغرام
 * 
 * POST /api/telegram-webhook — استقبال تحديثات تلغرام في بيئة الاستضافة
 */
import { Router, Request, Response } from 'express';
import { handleTelegramUpdate } from '../services/telegramBot.js';

const router = Router();

/**
 * POST /api/telegram-webhook
 * استقبال التحديثات من تلغرام عندما يُهيأ الـ Webhook
 */
router.post('/telegram-webhook', async (req: Request, res: Response): Promise<any> => {
  try {
    const update = req.body;
    const getBaseUrl = req.app.get('getBaseUrl');
    const baseUrl = typeof getBaseUrl === 'function' ? getBaseUrl() : process.env.APP_URL || 'http://localhost:3000';

    // Process update asynchronously so Telegram gets 200 OK fast
    handleTelegramUpdate(update, baseUrl).catch(err => {
      console.error('[Telegram Webhook Background Error]:', err);
    });

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
