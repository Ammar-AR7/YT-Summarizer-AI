/**
 * Telegram Long Polling Engine — محرك الاستطلاع المستمر على Render
 * 
 * يحذف أي Webhook مُهيأ أولاً (ضروري وإلا يفشل getUpdates)
 * ثم يبدأ الاستطلاع المستمر لاستقبال التحديثات.
 */
import { handleTelegramUpdate } from './telegramBot.js';

let isPolling = false;
let lastUpdateId = 0;

/**
 * حذف أي Webhook مُهيأ على تلغرام (شرط لنجاح Long Polling)
 */
async function deleteWebhookIfExists(token: string): Promise<void> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
    const data = await response.json() as any;
    if (data.ok) {
      console.log('[Telegram Polling] Webhook cleared successfully. Ready for Long Polling.');
    } else {
      console.warn('[Telegram Polling] Could not clear webhook:', data.description);
    }
  } catch (err) {
    console.error('[Telegram Polling] Error clearing webhook:', err);
  }
}

export async function startTelegramPolling(baseUrl: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || isPolling) return;

  isPolling = true;
  console.log('🤖 [Telegram Polling] Starting Telegram bot long polling engine...');

  // Step 1: Remove any existing Webhook (critical — prevents getUpdates rejection)
  await deleteWebhookIfExists(token);

  const poll = async () => {
    if (!isPolling) return;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`,
        { signal: AbortSignal.timeout(35000) } // إيقاف اتصال متوقف
      );
      if (response.ok) {
        const data = await response.json() as any;
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = update.update_id;
            // معالجة كل تحديث بشكل مستقل (لا تُوقف الحلقة إذا فشل أحدها)
            handleTelegramUpdate(update, baseUrl).catch(err => {
              console.error('[Telegram Polling] Update handler error:', err);
            });
          }
        } else if (!data.ok) {
          console.error('[Telegram Polling] API error:', data.description);
        }
      }
    } catch (err: any) {
      if (err.name !== 'TimeoutError' && err.name !== 'AbortError') {
        console.error('[Telegram Polling] Network error:', err.message);
      }
      // انتظر ثانية واحدة قبل إعادة المحاولة عند الخطأ
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (isPolling) {
      // تشغيل فوري — طول timeout=30 يعني الانتظار بالفعل
      setImmediate(poll);
    }
  };

  poll();
}

export function stopTelegramPolling() {
  isPolling = false;
  console.log('🛑 [Telegram Polling] Stopped Telegram bot long polling engine.');
}
