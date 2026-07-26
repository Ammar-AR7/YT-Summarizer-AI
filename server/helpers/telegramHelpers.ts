/**
 * Telegram Bot Helpers — دوال مساعدة لإرسال وتعديل رسائل تلغرام
 * 
 * جميع الدوال هنا هي Pure Functions تتعامل مع Telegram Bot API مباشرة.
 * لا تحتوي على أي منطق أعمال (Business Logic).
 */

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set in server environment.');
  }
  return token;
}

/**
 * إرسال رسالة نصية عادية عبر تلغرام
 */
export async function sendTelegramMessage(chatId: string | number, text: string): Promise<number | null> {
  try {
    const token = getToken();
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    if (response.ok) {
      const data = await response.json() as any;
      return data.result?.message_id || null;
    } else {
      const errorData = await response.json() as any;
      console.error('[Telegram] API error:', errorData);
    }
  } catch (error) {
    console.error('[Telegram] Error sending message:', error);
  }
  return null;
}

/**
 * إرسال رسالة مع أزرار تفاعلية (Inline Keyboard)
 */
export async function sendTelegramMessageWithKeyboard(
  chatId: string | number, 
  text: string, 
  replyMarkup: any
): Promise<number | null> {
  try {
    const token = getToken();
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
    if (response.ok) {
      const data = await response.json() as any;
      return data.result?.message_id || null;
    } else {
      const errorData = await response.json() as any;
      console.error('[Telegram] API error with keyboard:', errorData);
    }
  } catch (error) {
    console.error('[Telegram] Error sending message with keyboard:', error);
  }
  return null;
}

/**
 * تعديل رسالة موجودة (لتحديث حالة المعالجة)
 */
export async function editTelegramMessage(
  chatId: string | number, 
  messageId: number, 
  text: string,
  replyMarkup?: any
): Promise<boolean> {
  try {
    const token = getToken();
    const body: any = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML'
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.ok;
  } catch (error) {
    console.error('[Telegram] Error editing message:', error);
    return false;
  }
}

/**
 * الرد على Callback Query (إيقاف مؤشر التحميل في تلغرام)
 */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  try {
    const token = getToken();
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || ''
      })
    });
  } catch (error) {
    console.error('[Telegram] Error answering callback query:', error);
  }
}

/**
 * إرسال رسالة طويلة بتقسيمها تلقائياً (حد تلغرام 4096 حرف)
 */
export async function sendTelegramLongMessage(chatId: string | number, text: string): Promise<void> {
  if (text.length <= 4000) {
    await sendTelegramMessage(chatId, text);
    return;
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= 4000) {
      chunks.push(remaining);
      break;
    }

    let splitIdx = remaining.lastIndexOf('\n', 4000);
    if (splitIdx === -1 || splitIdx < 2000) {
      splitIdx = remaining.lastIndexOf(' ', 4000);
    }
    if (splitIdx === -1 || splitIdx < 2000) {
      splitIdx = 4000;
    }

    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx);
  }

  for (const chunk of chunks) {
    await sendTelegramMessage(chatId, chunk);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * إرسال إشعار "جاري الكتابة..." (Chat Action)
 */
export async function sendChatAction(chatId: string | number, action: string = 'typing'): Promise<void> {
  try {
    const token = getToken();
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action })
    });
  } catch (error) {
    // Non-critical — ignore silently
  }
}

/**
 * جلب معلومات البوت (getMe)
 */
export async function getBotInfo(): Promise<{ success: boolean; username?: string; name?: string; error?: string }> {
  try {
    const token = getToken();
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json() as any;
    if (data.ok) {
      return {
        success: true,
        username: data.result.username,
        name: data.result.first_name
      };
    }
    return { success: false, error: data.description || 'فشل جلب معلومات البوت' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
