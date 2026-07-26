/**
 * Telegram Bot Service — المعالج الرئيسي لرسائل وأوامر بوت تلغرام
 */
import { db } from '../firebaseAdmin.js';
import { summarizeVideoWithGemini } from '../../src/services/geminiService.js';
import { exportToNotion } from '../../src/services/notionService.js';
import { 
  sendTelegramMessage, 
  sendTelegramMessageWithKeyboard, 
  editTelegramMessage, 
  answerCallbackQuery, 
  sendTelegramLongMessage,
  sendChatAction
} from '../helpers/telegramHelpers.js';
import { findUserByTelegramOrEmail } from '../helpers/userLookup.js';
import { createLoginToken } from '../helpers/loginToken.js';
import { markdownToHtml, generateWordDocument, generatePdfDocument } from '../helpers/htmlExporter.js';
import { GoogleGenAI } from '@google/genai';

/**
 * معالجة أي Update وارد من تلغرام (سواء عبر Webhook أو Long Polling)
 */
export async function handleTelegramUpdate(update: any, baseUrl: string) {
  try {
    // 1. Handle Inline Keyboards (Callback Queries)
    if (update.callback_query) {
      const cb = update.callback_query;
      const callbackQueryId = cb.id;
      const chatId = cb.message?.chat?.id;
      const data = cb.data as string;
      const telegramUserId = cb.from?.id;

      await answerCallbackQuery(callbackQueryId);

      if (!data || !chatId || !telegramUserId) return;

      const userMatch = await findUserByTelegramOrEmail(telegramUserId.toString());
      const userId = userMatch?.userId || `tg_${telegramUserId}`;
      const userData = userMatch?.userData || {};

      const [action, param] = data.split(':');
      await executeTelegramAction(chatId, action, param, userData, userId, baseUrl);
      return;
    }

    // 2. Handle Text Messages
    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const text = message.text.trim();
    const telegramUserId = message.from?.id;
    const telegramUsername = message.from?.username;

    if (!telegramUserId) return;

    let userMatch = await findUserByTelegramOrEmail(telegramUserId.toString());
    
    // Commands Handling
    if (text.startsWith('/start')) {
      const param = text.split(' ')[1];
      
      if (param && param.startsWith('link_')) {
        const targetEmail = decodeURIComponent(param.replace('link_', '')).toLowerCase();
        const userByEmail = await findUserByTelegramOrEmail(targetEmail);
        if (userByEmail) {
          await db.collection('users').doc(userByEmail.userId).set({
            telegramId: telegramUserId.toString(),
            telegramUsername: telegramUsername || '',
            updatedAt: new Date()
          }, { merge: true });
          
          await sendTelegramMessage(chatId, `✅ <b>تم ربط حسابك بنجاح!</b>\n\nأهلاً بك <b>${userByEmail.userData.displayName || 'مستخدم منصة التمهيد'}</b>.`);
          return;
        }
      }

      const welcomeText = `👋 <b>مرحباً بك في بوت التمهيد الذكي لتلخيص فيديوهات اليوتيوب!</b>\n\n` +
        `أرسل لي أي رابط فيديو يوتيوب وسأقوم بتلخيصه واستخراج النقاط الأساسية فوراً 🚀\n\n` +
        `💡 <b>الأوامر المتاحة:</b>\n` +
        `• <code>/account</code> - عرض وتعديل بيانات حسابك ومفاتيحك\n` +
        `• <code>/latest</code> - عرض أحدث ملخص تم إنشاؤه\n` +
        `• <code>/help</code> - تعليمات الاستخدام`;

      const loginToken = await createLoginToken(userMatch?.userId || `tg_${telegramUserId}`);
      const webUrl = `${baseUrl}/?token=${loginToken}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "فتح المنصة بالموقع 🌐", url: webUrl }]
        ]
      };

      await sendTelegramMessageWithKeyboard(chatId, welcomeText, keyboard);
      return;
    }

    if (text.startsWith('/account') || text.startsWith('/settings')) {
      const userId = userMatch?.userId || `tg_${telegramUserId}`;
      const loginToken = await createLoginToken(userId);
      const webUrl = `${baseUrl}/?token=${loginToken}`;

      const accMsg = `👤 <b>بيانات حسابك في المنصة:</b>\n\n` +
        `• <b>Telegram ID:</b> <code>${telegramUserId}</code>\n` +
        `• <b>الحالة:</b> ${userMatch ? 'مربوط بالحساب ✅' : 'حساب تجريبي ⚠️'}\n\n` +
        `اضغط على الزر أدناه للانتقال للموقع وتعديل المفاتيح وإعدادات Notion:`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "إدارة الحساب والإعدادات ⚙️", url: webUrl }]
        ]
      };

      await sendTelegramMessageWithKeyboard(chatId, accMsg, keyboard);
      return;
    }

    if (text.startsWith('/latest')) {
      if (!userMatch) {
        await sendTelegramMessage(chatId, `❌ لم تقم بربط حسابك بعد. أرسل رابط فيديو أولاً أو قم بإنشاء حساب.`);
        return;
      }

      const summariesSnap = await db.collection('summaries')
        .where('userId', '==', userMatch.userId)
        .get();

      if (summariesSnap.empty) {
        await sendTelegramMessage(chatId, `📭 ليس لديك أي ملخصات محفوظة حتى الآن.`);
        return;
      }

      const sorted = summariesSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      const latest = sorted[0];
      await sendSummaryResponseWithActions(chatId, latest.id, latest, userMatch.userData, baseUrl);
      return;
    }

    // Check if YouTube URL
    const isYoutube = text.includes('youtube.com') || text.includes('youtu.be');
    if (isYoutube) {
      await sendChatAction(chatId, 'typing');
      const loadingMsgId = await sendTelegramMessage(chatId, `⏳ <b>جاري تحليل الفيديو وتوليد الملخص بالذكاء الاصطناعي...</b>\nقد يستغرق ذلك بضع ثوانٍ.`);

      const userId = userMatch?.userId || `tg_${telegramUserId}`;
      let apiKey = userMatch?.userData?.geminiApiKey?.trim();
      let hasCustomApiKey = false;

      if (apiKey) {
        hasCustomApiKey = true;
      } else {
        apiKey = process.env.GEMINI_API_KEY;
      }

      // 1. Check trial cooldown if using server's default API key
      if (!hasCustomApiKey) {
        const { checkAndRecordTrialUsage } = await import('./trialService.js');
        const trialResult = await checkAndRecordTrialUsage(userId);
        if (!trialResult.allowed) {
          const loginToken = await createLoginToken(userId);
          const webUrl = `${baseUrl}/?token=${loginToken}`;
          const keyboard = {
            inline_keyboard: [[{ text: "إضافة مفتاحك الخاص بالموقع ⚙️", url: webUrl }]]
          };
          const cooldownMsg = trialResult.error || `⚠️ يُسمح بالتلخيص باستخدام المفتاح الافتراضي مرة واحدة كل 10 دقائق.`;
          if (loadingMsgId) {
            await editTelegramMessage(chatId, loadingMsgId, cooldownMsg, keyboard);
          } else {
            await sendTelegramMessageWithKeyboard(chatId, cooldownMsg, keyboard);
          }
          return;
        }
      }

      if (!apiKey) {
        if (loadingMsgId) {
          await editTelegramMessage(chatId, loadingMsgId, `❌ <b>خطأ:</b> مفتاح Gemini API غير مهيأ في الخادم.`);
        }
        return;
      }

      try {
        const result = await summarizeVideoWithGemini(text, apiKey, 'ar', userId);

        const summaryData = {
          userId,
          userDisplayName: userMatch?.userData?.displayName || message.from.first_name || 'مستخدم تلغرام',
          videoUrl: text,
          videoId: result.videoId,
          videoTitle: result.videoTitle,
          summaryText: result.summary,
          language: 'ar',
          status: 'completed',
          isPublic: true,
          createdAt: new Date()
        };

        const docRef = await db.collection('summaries').add(summaryData);
        const documentId = docRef.id;

        await sendSummaryResponseWithActions(chatId, documentId, { ...summaryData, id: documentId }, userMatch?.userData || {}, baseUrl, loadingMsgId || undefined);
      } catch (err: any) {
        console.error('[Telegram Summarize Error]:', err);
        const errMsg = `❌ <b>فشل معالجة الفيديو:</b>\n${err.message || 'حدث خطأ غير متوقع'}`;
        if (loadingMsgId) {
          await editTelegramMessage(chatId, loadingMsgId, errMsg);
        } else {
          await sendTelegramMessage(chatId, errMsg);
        }
      }
      return;
    }

    await sendTelegramMessage(chatId, `❓ لم أفهم هذه الرسالة. يرجى إرسال رابط فيديو يوتيوب لخصّه فوراً.`);
  } catch (err) {
    console.error('[Telegram Update Error]:', err);
  }
}

/**
 * إرسال ملخص الفيديو ومعه أزرار التفاعل والإجراءات
 */
export async function sendSummaryResponseWithActions(
  chatId: string | number, 
  summaryId: string, 
  summaryData: any, 
  userData: any, 
  baseUrl: string, 
  replaceMessageId?: number
) {
  const title = summaryData.videoTitle || 'ملخص دراسي';
  const summaryText = summaryData.summaryText || '';
  
  // Cut down text if too long for main card preview
  let previewText = summaryText;
  if (previewText.length > 2500) {
    previewText = previewText.substring(0, 2500) + '\n\n<i>... اضغط على "قراءة الملخص كاملاً" أدناه لمتابعة القراءة.</i>';
  }

  // Format bold / code for Telegram HTML
  previewText = previewText.replace(/^#\s+(.*)$/gm, '<b>$1</b>');
  previewText = previewText.replace(/^##\s+(.*)$/gm, '<b>$1</b>');
  previewText = previewText.replace(/^###\s+(.*)$/gm, '<b>$1</b>');
  previewText = previewText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  previewText = previewText.replace(/`(.*?)`/g, '<code>$1</code>');

  const textMsg = `📌 <b>${title}</b>\n\n${previewText}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📄 تنزيل Word", callback_data: `word_dl:${summaryId}` },
        { text: "📕 معاينة PDF", callback_data: `pdf_dl:${summaryId}` },
        { text: "📝 تنزيل Markdown", callback_data: `md_dl:${summaryId}` }
      ],
      [
        { text: "🚀 التصدير إلى Notion", callback_data: `notion_exp:${summaryId}` },
        { text: "✨ تحسين أكاديمي", callback_data: `refine_acad:${summaryId}` }
      ],
      [
        { text: "🌐 فتح بالموقع التفاعلي", url: `${baseUrl}/?summaryId=${summaryId}` }
      ]
    ]
  };

  if (replaceMessageId) {
    await editTelegramMessage(chatId, replaceMessageId, textMsg, keyboard);
  } else {
    await sendTelegramMessageWithKeyboard(chatId, textMsg, keyboard);
  }
}

/**
 * تنفيذ إجراءات التفاعل الإضافية الموجهة من الأزرار (Download Word/PDF, Notion, Refine)
 */
export async function executeTelegramAction(
  chatId: string | number, 
  action: string, 
  param: string, 
  userData: any, 
  userId: string, 
  baseUrl: string
) {
  try {
    const summaryDoc = await db.collection('summaries').doc(param).get();
    if (!summaryDoc.exists) {
      await sendTelegramMessage(chatId, `❌ لم نتمكن من العثور على هذا الملخص.`);
      return;
    }

    const sData = summaryDoc.data()!;
    const cleanTitle = (sData.videoTitle || 'ملخص').replace(/[^\w\s\u0600-\u06FF]/gi, '_').substring(0, 40);

    if (action === 'word_dl') {
      const downloadUrl = `${baseUrl}/api/export-file?id=${param}&format=word`;
      await sendTelegramMessage(chatId, `📄 <b>رابط تحضير ملف Word الأكاديمي:</b>\n\n<a href="${downloadUrl}">اضغط هنا للتنزيل المباشر (${cleanTitle}.doc)</a>`);
    } else if (action === 'pdf_dl') {
      const downloadUrl = `${baseUrl}/api/export-file?id=${param}&format=pdf`;
      const keyboard = {
        inline_keyboard: [
          [{ text: "عرض وطباعة / حفظ كـ PDF 📕", url: downloadUrl }]
        ]
      };
      await sendTelegramMessageWithKeyboard(chatId, `📕 <b>فتح وثيقة PDF المنسقة للطباعة:</b>`, keyboard);
    } else if (action === 'md_dl') {
      const downloadUrl = `${baseUrl}/api/export-file?id=${param}&format=markdown`;
      await sendTelegramMessage(chatId, `📝 <b>ملف Markdown النصي:</b>\n\n<a href="${downloadUrl}">اضغط هنا للتنزيل المباشر</a>`);
    } else if (action === 'notion_exp') {
      let targetNotionCreds = userData?.notionCredentials;

      if (!targetNotionCreds || !targetNotionCreds.apiKey || !targetNotionCreds.databaseId) {
        const loginToken = await createLoginToken(userId);
        const settingsUrl = `${baseUrl}/?token=${loginToken}#notion-settings-card`;
        const keyboard = {
          inline_keyboard: [[{ text: "إعدادات Notion بالموقع 🌐", url: settingsUrl }]]
        };
        await sendTelegramMessageWithKeyboard(
          chatId,
          `⚠️ <b>إعدادات Notion غير مكتملة في حسابك:</b>\n\nيرجى ربط المفاتيح بالموقع أولاً.`,
          keyboard
        );
        return;
      }

      await sendTelegramMessage(chatId, `⏳ <b>جاري التصدير إلى Notion...</b>`);
      const notionResult = await exportToNotion(
        targetNotionCreds,
        sData.videoTitle || 'ملخص دراسي',
        sData.videoUrl || '',
        sData.summaryText || ''
      );

      if (notionResult.success) {
        await sendTelegramMessage(chatId, `✅ <b>تم التصدير بنجاح إلى Notion!</b>\n\n🔗 <a href="${notionResult.url}">افتح صفحة Notion</a>`);
      } else {
        await sendTelegramMessage(chatId, `❌ <b>فشل التصدير:</b> ${notionResult.error}`);
      }
    }
  } catch (err: any) {
    console.error('[Telegram Action Error]:', err);
    await sendTelegramMessage(chatId, `❌ حدث خطأ أثناء تنفيذ الإجراء.`);
  }
}
