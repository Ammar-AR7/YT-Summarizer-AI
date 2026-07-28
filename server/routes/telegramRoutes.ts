/**
 * Telegram Routes — مسارات الـ Webhook لبوت تلغرام
 * 
 * المعمارية الفائقة (Instant Vercel Response + Render Async Engine):
 * 1. Vercel يتكفل بتقديم الردود الآلية الفورية المباشرة (< 500ms) لأوامر البوت (/start, /help, /account, والرسائل الترحيبية)
 * 2. عند إرسال رابط يوتيوب، يُرسل Vercel رسالة الانتظار فوراً كـ Instant Reply ويحصل على message_id
 * 3. Vercel يمرر التحديث إلى خادم Render خلفياً للمعالجة الثقيلة (Transcript + Gemini AI + Firebase)
 * 4. Render يقوم بتعديل الرسالة نفسها برابط الملخص والنتيجة الكاملة فور انتهائه
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

    // ──── On Vercel: Instant Response Layer ────
    if (isVercel && !isForwardedFromVercel) {
      const renderUrl = process.env.RENDER_BACKEND_URL;
      const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

      const message = update.message;
      const chatId = message?.chat?.id;
      const text = message?.text?.trim() || '';
      const appUrl = process.env.APP_URL || 'https://yt-summarizer-ai-mocha.vercel.app';
      const isYoutube = text.includes('youtube.com') || text.includes('youtu.be');

      if (chatId && botToken) {
        // 1. التعامل الفوري المباشر مع الأوامر (/start, /help, /account)
        if (text.startsWith('/start')) {
          const welcomeText = `👋 <b>مرحباً بك في بوت التمهيد الذكي لتلخيص فيديوهات اليوتيوب!</b>\n\n` +
            `أرسل لي أي رابط فيديو يوتيوب وسأقوم بتلخيصه واستخراج النقاط الأساسية فوراً 🚀\n\n` +
            `💡 <b>الأوامر المتاحة:</b>\n` +
            `• <code>/account</code> - عرض وتعديل بيانات حسابك ومفاتيحك\n` +
            `• <code>/latest</code> - عرض أحدث ملخص تم إنشاؤه\n` +
            `• <code>/help</code> - تعليمات الاستخدام`;

          const keyboard = {
            inline_keyboard: [
              [{ text: "فتح المنصة بالموقع 🌐", url: appUrl }]
            ]
          };

          await sendInstantTelegramMessage(botToken, chatId, welcomeText, keyboard);

          // توجيه لـ Render للتعامل مع أي برامترات ربط للحساب إن وجدت
          if (renderUrl) {
            fetch(`${renderUrl}/api/telegram-webhook`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Webhook-Source': 'vercel-relay' },
              body: JSON.stringify(update)
            }).catch(() => {});
          }
          return res.status(200).json({ ok: true, commandReply: '/start' });
        }

        if (text.startsWith('/help')) {
          const helpText = `📖 <b>تعليمات استخدام بوت التمهيد:</b>\n\n` +
            `1️⃣ أرسل أي رابط فيديو يوتيوب (بما فيها البث المباشر والـ Shorts).\n` +
            `2️⃣ سيتم استخراج التفريغ النصي وتلخيصه بالذكاء الاصطناعي.\n` +
            `3️⃣ ستصلك خيارات التصدير إلى PDF و Word و Notion فوراً.\n\n` +
            `💡 يمكنك تزويد البوت بمفتاحك الخاص لرفع قيود الاستخدام اليومية من خلال إعدادات الموقع.`;

          const keyboard = {
            inline_keyboard: [
              [{ text: "انتقل لإعدادات المنصة ⚙️", url: appUrl }]
            ]
          };

          await sendInstantTelegramMessage(botToken, chatId, helpText, keyboard);
          return res.status(200).json({ ok: true, commandReply: '/help' });
        }

        if (text.startsWith('/account') || text.startsWith('/settings')) {
          const accMsg = `👤 <b>بيانات حسابك في المنصة:</b>\n\n` +
            `• <b>Telegram ID:</b> <code>${message.from?.id || 'غير معروف'}</code>\n\n` +
            `اضغط على الزر أدناه للانتقال للموقع وتعديل المفاتيح وإعدادات Notion:`;

          const keyboard = {
            inline_keyboard: [
              [{ text: "إدارة الحساب والإعدادات ⚙️", url: appUrl }]
            ]
          };

          await sendInstantTelegramMessage(botToken, chatId, accMsg, keyboard);
          return res.status(200).json({ ok: true, commandReply: '/account' });
        }

        // 2. إذا كان رابط يوتيوب: إرسال رسالة انتظار فورية وسحب message_id ثم التوجيه لـ Render
        if (isYoutube) {
          const loadingMsgId = await sendInstantTelegramMessage(
            botToken,
            chatId,
            `⏳ <b>جاري تحليل الفيديو وتوليد الملخص بالذكاء الاصطناعي...</b>\nقد يستغرق ذلك بضع ثوانٍ.`
          );

          if (renderUrl) {
            console.log('[Telegram Webhook Relay] Forwarding youtube update + loadingMsgId to Render...');
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
          }
          return res.status(200).json({ ok: true, vercelHandled: true, loadingMsgId });
        }

        // 3. رسالة نصية عادية ليست أمراً وليست رابطاً
        if (message && !text.startsWith('/')) {
          await sendInstantTelegramMessage(
            botToken,
            chatId,
            `💡 <b>أهلاً بك في منصة التمهيد!</b>\nأرسل لي رابط فيديو يوتيوب لتلخيصه فوراً، أو اختر أمراً من القائمة مثل <code>/start</code>.`
          );
          return res.status(200).json({ ok: true, instantReply: true });
        }
      }

      // توجيه احتياطي لـ Render لأي Callback Queries أو تفاعلات أخرى
      if (renderUrl) {
        fetch(`${renderUrl}/api/telegram-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Webhook-Source': 'vercel-relay' },
          body: JSON.stringify(update)
        }).catch(() => {});
      }

      return res.status(200).json({ ok: true, vercelHandled: true });
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
