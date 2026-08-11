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
  sendChatAction,
  sendTelegramDocument
} from '../helpers/telegramHelpers.js';
import { findUserByTelegramOrEmail } from '../helpers/userLookup.js';
import { createLoginToken } from '../helpers/loginToken.js';
import { markdownToHtml, generateWordDocument, generatePdfDocument } from '../helpers/htmlExporter.js';
import { GoogleGenAI } from '@google/genai';

/**
 * معالجة أي Update وارد من تلغرام (سواء عبر Webhook أو Relay)
 */
export async function handleTelegramUpdate(update: any, baseUrl: string, existingLoadingMsgId?: number) {
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
      const targetUserId = userMatch?.userId || `tg_${telegramUserId}`;

      const summariesSnap = await db.collection('summaries')
        .where('userId', '==', targetUserId)
        .get();

      if (summariesSnap.empty) {
        await sendTelegramMessage(chatId, `📭 <b>ليس لديك أي ملخصات محفوظة حتى الآن.</b>\n\nأرسل لي أي رابط فيديو يوتيوب وسأقوم بتلخيصه فوراً 🚀`);
        return;
      }

      const sorted = summariesSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => {
          const tA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
          const tB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
          return tB - tA;
        });

      const latest = sorted[0];
      await sendSummaryResponseWithActions(chatId, latest.id, latest, userMatch?.userData || {}, baseUrl);
      return;
    }

    // Check if YouTube URL
    const isYoutube = text.includes('youtube.com') || text.includes('youtu.be');
    if (isYoutube) {
      await sendChatAction(chatId, 'typing');
      let loadingMsgId = existingLoadingMsgId;
      if (!loadingMsgId) {
        loadingMsgId = await sendTelegramMessage(chatId, `⏳ <b>جاري تحليل الفيديو وتوليد الملخص بالذكاء الاصطناعي...</b>\nقد يستغرق ذلك بضع ثوانٍ.`);
      }

      try {
        // 1. Safe User Lookup (Firestore or Telegram fallback)
        let userMatch: any = null;
        try {
          userMatch = await findUserByTelegramOrEmail(telegramUserId.toString());
        } catch (dbErr) {
          console.warn('[Telegram Bot] Firestore user lookup failed, proceeding as trial user:', dbErr);
        }

        const userId = userMatch?.userId || `tg_${telegramUserId}`;
        let apiKey = userMatch?.userData?.geminiApiKey?.trim();
        let hasCustomApiKey = false;

        if (apiKey) {
          hasCustomApiKey = true;
        } else {
          apiKey = process.env.GEMINI_API_KEY?.trim();
        }

        // 2. Check trial cooldown if using server's default API key
        if (!hasCustomApiKey) {
          try {
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
          } catch (trialErr) {
            console.warn('[Telegram Bot] Trial check warning (proceeding anyway):', trialErr);
          }
        }

        if (!apiKey) {
          const noKeyMsg = `❌ <b>خطأ في الإعدادات:</b> مفتاح Gemini API غير مضبوط في الخادم.\nيرجى إضافة مفتاحك الخاص بالموقع.`;
          if (loadingMsgId) {
            await editTelegramMessage(chatId, loadingMsgId, noKeyMsg);
          } else {
            await sendTelegramMessage(chatId, noKeyMsg);
          }
          return;
        }

        // 3. Perform Summarization with Gemini
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

        // 4. Save to Firestore (with safe catch if DB unavailable)
        let documentId = `summary_${Date.now()}`;
        try {
          const docRef = await db.collection('summaries').add(summaryData);
          documentId = docRef.id;
        } catch (dbSaveErr) {
          console.warn('[Telegram Bot] Could not save summary to Firestore:', dbSaveErr);
        }

        // 5. Send result back to Telegram
        await sendSummaryResponseWithActions(
          chatId,
          documentId,
          { ...summaryData, id: documentId },
          userMatch?.userData || {},
          baseUrl,
          loadingMsgId || undefined
        );
      } catch (err: any) {
        console.error('[Telegram Summarize Error]:', err);
        const errMsg = `❌ <b>فشل معالجة الفيديو:</b>\n${err.message || 'حدث خطأ غير متوقع أثناء توليد الملخص.'}`;
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
  const userName = userData?.displayName || userData?.name || 'مستخدم المنصة';

  const cleanTitleEscaped = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const userNameEscaped = userName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const textMsg = `🎯 <b>تم تلخيص الفيديو وإعداد النتائج بنجاح!</b>\n\n` +
    `📺 <b>العنوان:</b> ${cleanTitleEscaped}\n` +
    `👤 <b>المستخدم:</b> ${userNameEscaped}\n\n` +
    `📩 <b>اختر من الأزرار التفاعلية أدناه طريقة التصدير أو المعاينة المناسبة لك:</b>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🌐 فتح ومعاينة الملخص على الويب (تفاعلي) ↗️", url: `${baseUrl}/?summaryId=${summaryId}` }
      ],
      [
        { text: "📕 تحميل PDF", url: `${baseUrl}/?s=${summaryId}&autoPdf=true` },
        { text: "📄 تحميل Word", callback_data: `word_dl:${summaryId}` }
      ],
      [
        { text: "📝 تحميل Markdown", callback_data: `md_dl:${summaryId}` },
        { text: "🔗 تصدير لـ Notion", callback_data: `notion_exp:${summaryId}` }
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
      await sendChatAction(chatId, 'upload_document');
      const wordDoc = generateWordDocument(sData.videoTitle || 'ملخص دراسي', markdownToHtml(sData.summaryText || ''), sData.videoUrl || '');
      const sent = await sendTelegramDocument(
        chatId,
        Buffer.from('\ufeff' + wordDoc, 'utf-8'),
        `${cleanTitle}.doc`,
        `📄 <b>ملف Word الأكاديمي جاهز:</b>\nتم إنشاء وتنسيق الملف بنجاح.`
      );
      if (!sent) {
        const downloadUrl = `${baseUrl}/api/export-file?id=${param}&format=word`;
        await sendTelegramMessage(chatId, `📄 <b>رابط تحضير ملف Word الأكاديمي:</b>\n\n<a href="${downloadUrl}">اضغط هنا للتنزيل المباشر (${cleanTitle}.doc)</a>`);
      }
    } else if (action === 'pdf_dl') {
      const autoPdfUrl = `${baseUrl}/?s=${param}&autoPdf=true`;
      const printUrl = `${baseUrl}/api/export-file?id=${param}&format=pdf`;
      
      const keyboard = {
        inline_keyboard: [
          [{ text: "📕 تنزيل PDF بتنسيق الموقع المباشر 🚀", url: autoPdfUrl }],
          [{ text: "🖨️ فتح للطباعة والمعاينة الفورية (A4)", url: printUrl }]
        ]
      };

      const msg = `📕 <b>تحميل وثيقة الـ PDF لـ (${sData.videoTitle || 'الملخص'}):</b>\n\n` +
        `اضغط على الزر أدناه ليتم التنزيل المباشر بتنسيق A4 المطابق للموقع:`;

      await sendTelegramMessageWithKeyboard(chatId, msg, keyboard);
    } else if (action === 'md_dl') {
      await sendChatAction(chatId, 'upload_document');
      const sent = await sendTelegramDocument(
        chatId,
        Buffer.from(sData.summaryText || '', 'utf-8'),
        `${cleanTitle}.md`,
        `📝 <b>ملف Markdown النصي:</b>`
      );
      if (!sent) {
        const downloadUrl = `${baseUrl}/api/export-file?id=${param}&format=markdown`;
        await sendTelegramMessage(chatId, `📝 <b>ملف Markdown النصي:</b>\n\n<a href="${downloadUrl}">اضغط هنا للتنزيل المباشر</a>`);
      }
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
