/**
 * Telegram Routes — مسارات الـ Webhook لبوت تلغرام
 * 
 * التدفق (Webhook Relay Architecture):
 * 1. Telegram يُرسل التحديث إلى Vercel (سريع، بدون cold start)
 * 2. Vercel يُعيد توجيهه إلى Render (خادم مستمر للمعالجة الثقيلة)
 * 3. Render يُعالج ويُرسل الرد مباشرة عبر Telegram Bot API
 * 
 * POST /api/telegram-webhook — نقطة استقبال Telegram (على Vercel)
 */
import { Router, Request, Response } from 'express';
import { handleTelegramUpdate } from '../services/telegramBot.js';

const router = Router();

/**
 * POST /api/telegram-webhook
 * 
 * على Vercel: يستقبل التحديث ويُعيد توجيهه لـ Render فوراً (fire-and-forget)
 * على Render: يستقبل التحديث المُعاد توجيهه ويُعالجه بالكامل
 */
router.post('/telegram-webhook', async (req: Request, res: Response): Promise<any> => {
  try {
    const update = req.body;
    if (!update || (!update.message && !update.callback_query)) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const isVercel = !!(process.env.VERCEL === '1' || process.env.VERCEL_ENV);
    const isForwardedFromVercel = req.headers['x-webhook-source'] === 'vercel-relay';

    // ──── On Vercel: Forward to Render and respond 200 immediately ────
    if (isVercel && !isForwardedFromVercel) {
      const renderUrl = process.env.RENDER_BACKEND_URL;
      
      if (!renderUrl) {
        console.error('[Telegram Webhook] RENDER_BACKEND_URL not set on Vercel!');
        return res.status(200).json({ ok: true, error: 'backend_url_missing' });
      }

      console.log('[Telegram Webhook] Forwarding update to Render...');

      // Fire-and-forget: don't await, just send
      fetch(`${renderUrl}/api/telegram-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Source': 'vercel-relay' // Prevent infinite loop
        },
        body: JSON.stringify(update)
      }).catch(err => {
        console.error('[Telegram Webhook] Forward to Render failed:', err.message);
      });

      return res.status(200).json({ ok: true, relay: 'forwarded' });
    }

    // ──── On Render (or forwarded): Process the update fully ────
    const getBaseUrl = req.app.get('getBaseUrl');
    const baseUrl = typeof getBaseUrl === 'function' 
      ? getBaseUrl() 
      : process.env.APP_URL || 'http://localhost:3000';

    console.log(`[Telegram Webhook] Processing update on Render (type: ${update.message ? 'message' : 'callback_query'})`);

    // Process asynchronously — respond 200 first, then handle
    handleTelegramUpdate(update, baseUrl).catch(err => {
      console.error('[Telegram Webhook] Processing error:', err);
    });

    return res.status(200).json({ ok: true, processed: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    // Always return 200 to Telegram to prevent retries
    return res.status(200).json({ ok: false, error: err.message });
  }
});

export default router;
