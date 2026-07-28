/**
 * Telegram Routes — مسارات الـ Webhook لبوت تلغرام
 * 
 * المعمارية الجديدة (Instant Vercel Response + Render Async Engine):
 * 1. Vercel يمثّل واجهة الرد الفوري السريع (< 1 ثانية) مع المستخدم عبر Telegram API
 * 2. عند استقبال رابط يوتيوب، Vercel يُرسل رسالة الانتظار فوراً للمستخدم ويحصل على message_id
 * 3. Vercel يُحلّل ويمرر المهمة لخادم Render للقيام بـ Transcript + Gemini AI + Firebase
 * 4. Render يُعدّل الرسالة نفسها برابط الملخص والنتيجة كاملة فور انتهائه
 */
import { Router, Request, Response } from 'express';
import { handleTelegramUpdate } from '../services/telegramBot.js';

const router = Router();

/**
 * دالة مساعدة لإرسال رسالة سريعة من Vercel إلى تلغرام مباشرة
 */
async function sendInstantTelegramMessage(botToken: string, chatId: number, text: string, keyboard?: any): Promise<number | null> {
  try {
    const bodyObj: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    if (keyboard) {
      bodyObj.reply_markup = keyboard;
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj)
    });
    const data: any = await res.json();
    if (data.ok && data.result) {
      return data.result.message_id;
    }
  } catch (err) {
    console.error('[Instant Telegram Send Error]:', err);
  }
  return null;
}

/**
 * POST /api/telegram-webhook
 */
router.post('/telegram-webhook', async (req: Request, res: Response): Promise<any> => {
  try {
    const update = req.body;
    if (!update || (!update.message && !update.callback_query)) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const isVercel = !!(process.env.VERCEL === '1' || process.env.VERCEL_ENV);
    const isForwardedFromVercel = req.headers['x-webhook-source'] === 'vercel-relay';

    // ──── On Vercel: Instant Response & Relay to Render ────
    if (isVercel && !isForwardedFromVercel) {
      const renderUrl = process.env.RENDER_BACKEND_URL;
      const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

      const message = update.message;
      const chatId = message?.chat?.id;
      const text = message?.text?.trim() || '';
      const isYoutube = text.includes('youtube.com') || text.includes('youtu.be');

      let loadingMsgId: number | null = null;

      // 1. إذا كان رابط يوتيوب، ارسل رسالة الانتظار فوراً من Vercel (< 1 sec)
      if (isYoutube && chatId && botToken) {
        loadingMsgId = await sendInstantTelegramMessage(
          botToken,
          chatId,
          `⏳ <b>جاري تحليل الفيديو وتوليد الملخص بالذكاء الاصطناعي...</b>\nقد يستغرق ذلك بضع ثوانٍ.`
        );
      } else if (chatId && botToken && message && !text.startsWith('/')) {
        // رسالة نصية عادية ليست أمراً وليست رابطاً
        await sendInstantTelegramMessage(
          botToken,
          chatId,
          `💡 <b>أهلاً بك في منصة التمهيد!</b>\nأرسل لي رابط فيديو يوتيوب لتلخيصه فوراً، أو اختر أمراً من القائمة مثل <code>/start</code>.`
        );
        return res.status(200).json({ ok: true, instantReply: true });
      }

      // 2. توجيه الطلب إلى Render للمعالجة الثقيلة مع تمرير loadingMsgId
      if (renderUrl) {
        console.log('[Telegram Webhook Relay] Forwarding update + loadingMsgId to Render...');
        
        fetch(`${renderUrl}/api/telegram-webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Source': 'vercel-relay'
          },
          body: JSON.stringify({
            ...update,
            __loadingMsgId: loadingMsgId
          })
        }).catch(err => {
          console.error('[Telegram Webhook Relay] Async forward failed:', err.message);
        });
      } else {
        console.warn('[Telegram Webhook Relay] RENDER_BACKEND_URL not configured on Vercel.');
      }

      return res.status(200).json({ ok: true, vercelHandled: true, loadingMsgId });
    }

    // ──── On Render (or forwarded from Vercel): Execute Heavy Processing ────
    const getBaseUrl = req.app.get('getBaseUrl');
    const baseUrl = typeof getBaseUrl === 'function' 
      ? getBaseUrl() 
      : process.env.APP_URL || 'http://localhost:3000';

    const existingLoadingMsgId = update.__loadingMsgId;

    console.log(`[Telegram Webhook Engine] Executing processing on Render (loadingMsgId: ${existingLoadingMsgId || 'none'})...`);

    // المعالجة الكاملة (Gemini AI + Transcript + Firebase)
    handleTelegramUpdate(update, baseUrl, existingLoadingMsgId).catch(err => {
      console.error('[Telegram Processing Error on Render]:', err);
    });

    return res.status(200).json({ ok: true, processedOnRender: true });
  } catch (err: any) {
    console.error('[Telegram Webhook General Error]:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
});

export default router;
