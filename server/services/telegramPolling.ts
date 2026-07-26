/**
 * Telegram Long Polling Engine — محرك الاستطلاع المستمر محلياً
 */
import { handleTelegramUpdate } from './telegramBot.js';

let isPolling = false;
let lastUpdateId = 0;

export async function startTelegramPolling(baseUrl: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || isPolling) return;

  isPolling = true;
  console.log('🤖 [Telegram Polling] Started Telegram bot long polling engine...');

  const poll = async () => {
    if (!isPolling) return;

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
      if (response.ok) {
        const data = await response.json() as any;
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = update.update_id;
            await handleTelegramUpdate(update, baseUrl);
          }
        }
      }
    } catch (err) {
      // Ignore network timeouts during long polling
    }

    if (isPolling) {
      setTimeout(poll, 1000);
    }
  };

  poll();
}

export function stopTelegramPolling() {
  isPolling = false;
  console.log('🛑 [Telegram Polling] Stopped Telegram bot long polling engine.');
}
