import dotenv from 'dotenv';
// Load environment variables immediately
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './src/lib/firebase.js';
import { summarizeVideoWithGemini } from './src/services/geminiService.js';
import { exportToNotion } from './src/services/notionService.js';
import { checkAndRecordTrialUsage, getTrialStatus } from './src/services/trialService.js';
import { GoogleGenAI } from "@google/genai";
import crypto from 'crypto';

const resolvedDirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

async function createLoginToken(userId: string): Promise<string> {
  const tokenId = crypto.randomUUID();
  try {
    const tokenRef = doc(db, 'login_tokens', tokenId);
    await setDoc(tokenRef, {
      userId,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // Valid for 15 minutes
    });
    console.log(`[Login Token] Created login token for user ${userId}: ${tokenId}`);
  } catch (err) {
    console.error('[Login Token] Failed to store token in Firestore:', err);
  }
  return tokenId;
}

export const app = express();
const PORT = 3000;

// Use JSON parsing middleware
app.use(express.json());

// Log requests in dev mode
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// Global Telegram base URL tracker
let globalLastKnownBaseUrl = process.env.APP_URL || '';

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

  // Middleware to capture external base URL on every HTTP request
  app.use((req, res, next) => {
    const host = req.get('host');
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      const derived = `${proto}://${host}`;
      if (globalLastKnownBaseUrl !== derived) {
        globalLastKnownBaseUrl = derived;
      }
    }
    next();
  });

  // Dynamic Telegram Bot Info Endpoint
  app.get('/api/telegram-bot-info', async (req, res): Promise<any> => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return res.json({ success: false, error: 'TELEGRAM_BOT_TOKEN غير مهيأ في الخادم' });
    }
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await response.json() as any;
      if (data.ok) {
        return res.json({
          success: true,
          botUsername: data.result.username,
          botName: data.result.first_name,
          botUrl: `https://t.me/${data.result.username}`
        });
      }
      return res.json({ success: false, error: data.description || 'فشل جلب معلومات البوت' });
    } catch (err: any) {
      return res.json({ success: false, error: err.message });
    }
  });

  // Auto-Login Token Verification Endpoint
  app.post('/api/auth/login-with-token', async (req, res): Promise<any> => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'الرمز (Token) مطلوب.' });
    }

    try {
      const tokenRef = doc(db, 'login_tokens', token);
      const tokenDoc = await getDoc(tokenRef);
      if (!tokenDoc.exists()) {
        return res.status(404).json({ success: false, error: 'رمز الدخول غير صالح أو انتهت صلاحيته.' });
      }

      const tokenData = tokenDoc.data();
      if (!tokenData) {
        return res.status(404).json({ success: false, error: 'بيانات الرمز مفقودة.' });
      }

      // Check expiration safely
      let isExpired = false;
      if (tokenData.expiresAt) {
        let expireTime = 0;
        if (typeof tokenData.expiresAt.toDate === 'function') {
          expireTime = tokenData.expiresAt.toDate().getTime();
        } else if (tokenData.expiresAt instanceof Date) {
          expireTime = tokenData.expiresAt.getTime();
        } else {
          expireTime = new Date(tokenData.expiresAt).getTime();
        }
        if (expireTime < Date.now()) {
          isExpired = true;
        }
      }

      if (isExpired) {
        await deleteDoc(tokenRef);
        return res.status(410).json({ success: false, error: 'انتهت صلاحية رمز الدخول. يرجى طلب رابط جديد من البوت.' });
      }

      const userId = tokenData.userId;

      // Fetch user profile from users collection
      const userDocSnap = await getDoc(doc(db, 'users', userId));
      const userData = userDocSnap.exists() ? userDocSnap.data() : {};

      // Token remains valid for its 15-minute window (allows refreshes or re-clicks)
      return res.json({
        success: true,
        userId,
        userData: {
          email: userData?.email || '',
          displayName: userData?.displayName || 'مستخدم تلغرام',
          telegramId: userData?.telegramId || '',
          geminiApiKey: userData?.geminiApiKey || '',
          notionCredentials: userData?.notionCredentials || null
        },
        firebaseCustomToken: null
      });
    } catch (err: any) {
      console.error('Error in login-with-token endpoint:', err);
      return res.status(500).json({ success: false, error: err.message || 'حدث خطأ في الخادم أثناء التحقق من الرمز.' });
    }
  });

  // Save User Configuration Endpoint (Accessible by virtually logged in sessions)
  app.post('/api/save-user-config', async (req, res): Promise<any> => {
    const { userId, configData } = req.body;
    if (!userId || !configData) {
      return res.status(400).json({ success: false, error: 'معرّف المستخدم أو البيانات مفقودة.' });
    }

    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        ...configData,
        updatedAt: serverTimestamp()
      }, { merge: true });

      console.log(`[Save Config] Saved configuration for user ${userId} successfully`);
      return res.json({ success: true });
    } catch (err: any) {
      console.error('Error in save-user-config endpoint:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 1. Process Video Endpoint (Asynchronous pattern to mitigate serverless/Vercel timeouts)
  app.post('/api/process-video', async (req, res): Promise<any> => {
    const { videoUrl, isPublic, userId, userDisplayName, language, geminiApiKey: clientProvidedApiKey } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ success: false, error: 'رابط الفيديو مطلوب.' });
    }

    let apiKey = process.env.GEMINI_API_KEY;
    let hasCustomApiKey = false;

    // 1. Check if client supplied a custom Gemini API key in request body
    if (clientProvidedApiKey && typeof clientProvidedApiKey === 'string' && clientProvidedApiKey.trim().length > 0) {
      apiKey = clientProvidedApiKey.trim();
      hasCustomApiKey = true;
      console.log(`[API Key] Using custom Gemini API key provided in request body for user: ${userId || 'anonymous'}`);
    } else if (userId && userId !== 'anonymous') {
      // 2. Fall back to checking user config in Firestore
      try {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.geminiApiKey && userData.geminiApiKey.trim()) {
            apiKey = userData.geminiApiKey.trim();
            hasCustomApiKey = true;
            console.log(`[API Key] Using custom Gemini API key from Firestore for user: ${userId}`);
          }
        }
      } catch (keyErr) {
        console.warn(`[API Key] Failed to fetch user config for API key:`, keyErr);
      }
    }

    // Backend Trial Usage System: Users using the default server key are restricted to 1 summary every 10 minutes.
    // Custom API keys bypass this limit completely.
    if (!hasCustomApiKey) {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'anon_ip';
      const trialIdentifier = (userId && userId !== 'anonymous') ? userId : `ip_${clientIp}`;
      
      const trialResult = await checkAndRecordTrialUsage(trialIdentifier);
      if (!trialResult.allowed) {
        return res.status(429).json({
          success: false,
          error: trialResult.error,
          cooldownRemainingMinutes: trialResult.remainingMinutes,
          cooldownEndsAt: trialResult.cooldownEndsAt,
          requiresAccountSetup: true
        });
      }
    }

    if (!apiKey) {
      return res.status(500).json({ 
        success: false, 
        error: 'مفتاح Gemini API غير مهيأ على الخادم. يرجى إضافة مفتاحك الخاص في الإعدادات.' 
      });
    }

    try {
      console.log(`[Process Video] Creating initial processing document for: ${videoUrl}`);

      // 1. Create immediate Firestore document with status: "processing"
      const initialSummaryData = {
        userId: userId || 'anonymous',
        userDisplayName: userDisplayName || 'مستخدم مجهول',
        videoUrl,
        language: language || 'ar',
        status: 'processing',
        isPublic: isPublic !== false,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'summaries'), initialSummaryData);
      const documentId = docRef.id;

      // 2. Respond immediately to the client with 200 OK and status: "processing"
      res.json({
        success: true,
        summaryId: documentId,
        documentId: documentId,
        status: 'processing',
        message: 'تم البدء في تحليل الفيديو في الخلفية بنجاح.'
      });

      // 3. Asynchronously process Gemini summary in background without blocking response
      (async () => {
        try {
          console.log(`[Async Background Worker] Processing video ID ${documentId} for ${videoUrl}...`);
          const result = await summarizeVideoWithGemini(videoUrl, apiKey, language || 'ar', userId);

          // Update Firestore document upon completion
          const summaryDocRef = doc(db, 'summaries', documentId);
          await setDoc(summaryDocRef, {
            status: 'completed',
            summaryText: result.summary,
            videoTitle: result.videoTitle,
            videoId: result.videoId,
            updatedAt: serverTimestamp()
          }, { merge: true });

          console.log(`[Async Background Worker] Successfully completed summary ${documentId}`);
        } catch (bgError: any) {
          console.error(`[Async Background Worker] Failed to process summary ${documentId}:`, bgError);
          try {
            const summaryDocRef = doc(db, 'summaries', documentId);
            await setDoc(summaryDocRef, {
              status: 'error',
              error: bgError.message || 'فشل معالجة الفيديو وتوليد الملخص.',
              updatedAt: serverTimestamp()
            }, { merge: true });
          } catch (updateErr) {
            console.error(`[Async Background Worker] Failed to set error status:`, updateErr);
          }
        }
      })();

      return;
    } catch (error: any) {
      console.error('Error initiating video processing:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message || 'فشل معالجة الفيديو وتوليد الملخص.' 
      });
    }
  });

  // 1a. Summary Status Query Endpoint (For polling status if Firestore listener isn't used)
  app.get('/api/summary/:id', async (req, res): Promise<any> => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: 'المعرف مطلوب.' });

    try {
      const summaryDoc = await getDoc(doc(db, 'summaries', id));
      if (!summaryDoc.exists()) {
        return res.status(404).json({ success: false, error: 'الملخص غير موجود.' });
      }

      const data = summaryDoc.data();
      return res.json({
        success: true,
        id: summaryDoc.id,
        status: data.status || 'completed',
        summary: data.summaryText || '',
        videoTitle: data.videoTitle || '',
        videoId: data.videoId || '',
        error: data.error || null
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 1a-2. Trial Status Endpoint (Allows clients to check if user/IP is in a 10-minute trial cooldown)
  app.get('/api/trial-status', async (req, res): Promise<any> => {
    const userId = req.query.userId as string;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'anon_ip';
    const trialIdentifier = (userId && userId !== 'anonymous') ? userId : `ip_${clientIp}`;

    try {
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

  // 1b. Notion Export Endpoint (Avoids client-side CORS errors when calling Notion API directly)
  app.post('/api/notion/export', async (req, res): Promise<any> => {
    const { credentials, videoTitle, videoUrl, summaryMarkdown } = req.body;

    if (!credentials || !credentials.apiKey || !credentials.databaseId) {
      return res.status(400).json({
        success: false,
        error: 'بيانات Notion غير مكتملة. يرجى تهيئتها في الإعدادات.'
      });
    }

    try {
      console.log(`[Notion Export API] Exporting to Notion database ${credentials.databaseId} for video: "${videoTitle}"`);
      const result = await exportToNotion(credentials, videoTitle, videoUrl, summaryMarkdown);
      return res.json(result);
    } catch (error: any) {
      console.error('[Notion Export API] Failed to export:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'حدث خطأ غير متوقع أثناء التصدير لـ Notion.'
      });
    }
  });

  // 1c. Document Refinement Endpoint (Refines markdown with Gemini to optimize for academic/professional Word/PDF documents)
  app.post('/api/document/refine', async (req, res): Promise<any> => {
    const { summaryMarkdown, videoTitle, userId, mode } = req.body;

    if (!summaryMarkdown) {
      return res.status(400).json({
        success: false,
        error: 'محتوى الملخص مطلوب للتحسين.'
      });
    }

    let apiKey = process.env.GEMINI_API_KEY;

    if (userId && userId !== 'anonymous') {
      try {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.geminiApiKey && userData.geminiApiKey.trim()) {
            apiKey = userData.geminiApiKey.trim();
          }
        }
      } catch (keyErr) {
        console.warn(`[API Key] Failed to fetch user config for API key:`, keyErr);
      }
    }

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'مفتاح Gemini API غير مهيأ على الخادم. يرجى تهيئته أولاً.'
      });
    }

    try {
      console.log(`[Document Refinement API] Refining summary for: "${videoTitle}" with mode: ${mode}`);
      
      const aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      let systemPrompt = '';
      if (mode === 'concise_text') {
        systemPrompt = `أنت خبير محترف في التلخيص الأكاديمي السلس وهيكلة الملاحظات الدراسية المباشرة والواضحة باللغة العربية الفصحى.
قم بإعادة صياغة وتنظيم وهيكلة الملخص التالي ليكون ملخصاً دراسياً مكثفاً ومبسطاً للغاية ومنظماً في شكل فقرات قصيرة وقوائم منقطة واضحة ومباشرة.

الملخص المراد تنسيقه:
"""
${summaryMarkdown}
"""

المتطلبات الإلزامية في الناتج:
1. لا تستخدم الجداول الماركداون (Markdown Tables) أبداً. يجب أن يكون التلخيص نصياً فقط.
2. استخدم العناوين بوضوح (العنوان الرئيسي بـ #، الفرعي بـ ##، والتفصيلي بـ ###) لتوضيح الأقسام.
3. ركز على التبسيط الشديد والوضوح والصياغة المباشرة الخالية تماماً من أي مقدمات أو خواتيم موجهة من الذكاء الاصطناعي (مثل "إليك الملخص" أو "أتمنى أن يفيدك"). نريد محتوى الملاحظات مباشرة.
4. حافظ بالكامل على القيمة التعليمية والمعلوماتية للملخص الأصلي ولكن بطريقة مبسطة يفهمها أي قارئ دون تشتيت.`;
      } else {
        systemPrompt = `أنت خبير في التنسيق الأكاديمي وتصميم المستندات الاحترافية عالية الجودة.
قم بإعادة صياغة وتنسيق وهيكلة الملخص التالي ليكون ملخصاً دراسياً احترافياً ومكثفاً وصالحاً للتصدير مباشرة كملف Word أو PDF أكاديمي متميز.

الملخص المراد تنسيقه:
"""
${summaryMarkdown}
"""

المتطلبات الإلزامية في الناتج:
1. حافظ بالكامل على القيمة التعليمية والمعلوماتية، ولكن رتبها بهيكل مرئي متناسق.
2. استخدم العناوين بوضوح (العنوان الرئيسي بـ #، الفرعي بـ ##، والتفصيلي بـ ###).
3. حوّل أي مقارنات، مصطلحات، مفاهيم أساسية، أو إحصائيات إلى جداول ماركداون (Markdown Tables) منسقة بشكل صحيح (مثال: | المصطلح | التعريف |). الجداول تجعل المستند يبدو احترافياً للغاية!
4. تأكد من أن الصياغة باللغة العربية الفصحى الأنيقة، خالية تماماً من العبارات التمهيدية أو الختامية الموجهة من الذكاء الاصطناعي (مثل "إليك الملخص المنسق" أو "أتمنى أن يعجبك"). نريد المستند الأكاديمي مباشرة.
5. حافظ على اتساق القوائم المنقطة والمستويات الفرعية.`;
      }

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: systemPrompt
      });

      const refinedText = response.text || summaryMarkdown;

      return res.json({
        success: true,
        refinedSummary: refinedText
      });
    } catch (error: any) {
      console.error('[Document Refinement API] Failed to refine:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'حدث خطأ أثناء الاتصال بالذكاء الاصطناعي لتحسين المستند.'
      });
    }
  });

  // 1d. Server-side Document Export (Word / Markdown / PDF-print)
  app.get('/api/export-file', async (req, res): Promise<any> => {
    const { id, format } = req.query;

    if (!id) {
      return res.status(400).send('معرّف الملخص مطلوب.');
    }

    try {
      const summaryDoc = await getDoc(doc(db, 'summaries', id as string));
      if (!summaryDoc.exists()) {
        return res.status(404).send('الملخص غير موجود.');
      }

      const data = summaryDoc.data();
      const title = data.videoTitle || 'ملخص دراسي';
      const summaryText = data.summaryText || '';
      const videoUrl = data.videoUrl || '';

      const cleanTitle = (title || 'ملخص_دراسي').replace(/[^\w\s\u0600-\u06FF]/gi, '_').replace(/\s+/g, '_').substring(0, 50);
      const fullFilenameStr = `${cleanTitle}_ملخص_دراسي`;
      const encodedFilename = encodeURIComponent(fullFilenameStr);

      if (format === 'markdown') {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="summary.md"; filename*=UTF-8''${encodedFilename}.md`);
        return res.send(summaryText);
      }

      // Generate HTML list and table rendering for Word & PDF (similar to client side!)
      const lines = summaryText.split('\n');
      let htmlContent = '';
      let inTable = false;
      let tableRows: string[][] = [];
      let tableWidth = 0;

      // Flush table helper
      const flushTable = (rows: string[][], width: number) => {
        if (rows.length === 0) return '';
        let html = '<table style="width: 100%; border-collapse: collapse; margin: 18px 0; direction: rtl; text-align: right; border: 1px solid #cbd5e1; font-family: Arial, sans-serif;">';
        const headerRow = rows[0];
        html += '<thead><tr style="background-color: #f1f5f9; border-bottom: 2px solid #94a3b8;">';
        for (let i = 0; i < width; i++) {
          html += `<th style="padding: 10px 14px; text-align: right; font-weight: bold; color: #1e1b4b; font-size: 11pt; border: 1px solid #cbd5e1;">${headerRow[i] || ''}</th>`;
        }
        html += '</tr></thead><tbody>';
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const bgColor = r % 2 === 0 ? '#f8fafc' : '#ffffff';
          html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #e2e8f0;">`;
          for (let c = 0; c < width; c++) {
            html += `<td style="padding: 8px 14px; text-align: right; color: #334155; font-size: 10pt; border: 1px solid #cbd5e1; line-height: 1.5;">${row[c] || ''}</td>`;
          }
          html += '</tr>';
        }
        html += '</tbody></table>';
        return html;
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          const cells = line.split('|').map(c => c.trim());
          if (cells[0] === '') cells.shift();
          if (cells[cells.length - 1] === '') cells.pop();

          const isSeparator = cells.every(cell => /^[:-]+$/.test(cell));
          if (isSeparator) {
            inTable = true;
            continue;
          }

          if (!inTable) {
            inTable = true;
            tableRows = [];
          }
          tableRows.push(cells);
          if (cells.length > tableWidth) {
            tableWidth = cells.length;
          }
          continue;
        } else if (inTable) {
          htmlContent += flushTable(tableRows, tableWidth);
          inTable = false;
          tableRows = [];
          tableWidth = 0;
        }

        if (!trimmed) {
          htmlContent += '<br/>';
          continue;
        }

        if (trimmed.startsWith('# ')) {
          htmlContent += `<h1 style="color:#4f46e5; font-family:Arial, sans-serif; font-size:20pt; margin-top:16pt; margin-bottom:8pt; border-bottom:1px solid #e5e7eb; padding-bottom:4pt; direction:rtl; text-align:right;">${trimmed.slice(2)}</h1>`;
        } else if (trimmed.startsWith('## ')) {
          htmlContent += `<h2 style="color:#4f46e5; font-family:Arial, sans-serif; font-size:16pt; margin-top:14pt; margin-bottom:6pt; direction:rtl; text-align:right;">${trimmed.slice(3)}</h2>`;
        } else if (trimmed.startsWith('### ')) {
          htmlContent += `<h3 style="color:#111827; font-family:Arial, sans-serif; font-size:12pt; margin-top:12pt; margin-bottom:4pt; direction:rtl; text-align:right;">${trimmed.slice(4)}</h3>`;
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
          htmlContent += `<li style="font-family:Arial, sans-serif; font-size:11pt; color:#374151; margin-bottom:4pt; direction:rtl; text-align:right; list-style-type:square;">${trimmed.slice(2)}</li>`;
        } else if (/^\d+\.\s/.test(trimmed)) {
          const content = trimmed.replace(/^\d+\.\s/, '');
          const num = trimmed.match(/^\d+/)?.[0] || '1';
          htmlContent += `<li style="font-family:Arial, sans-serif; font-size:11pt; color:#374151; margin-bottom:4pt; direction:rtl; text-align:right;">${num}. ${content}</li>`;
        } else {
          htmlContent += `<p style="font-family:Arial, sans-serif; font-size:11pt; color:#374151; line-height:1.6; direction:rtl; text-align:right; margin-bottom:8pt;">${trimmed}</p>`;
        }
      }

      if (inTable && tableRows.length > 0) {
        htmlContent += flushTable(tableRows, tableWidth);
      }

      htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#4f46e5; font-weight:bold; background-color:#f5f3ff; padding:2px 4px; border-radius:4px;">$1</strong>');
      htmlContent = htmlContent.replace(/`(.*?)`/g, '<code style="font-family:Consolas, monospace; font-size:10pt; background-color:#f3f4f6; color:#4f46e5; padding:2px 4px; border-radius:4px;">$1</code>');

      if (format === 'word') {
        const fullHtml = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head>
            <title>${title}</title>
            <!--[if gte mso 9]>
            <xml>
              <w:WordDocument>
                <w:View>Print</w:View>
                <w:Zoom>100</w:Zoom>
                <w:DoNotOptimizeForBrowser/>
              </w:WordDocument>
            </xml>
            <![endif]-->
            <meta charset="utf-8">
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 1in;
                direction: rtl;
                text-align: right;
                background-color: #ffffff;
              }
            </style>
          </head>
          <body>
            <div style="background-color:#e0e7ff; border:2px solid #818cf8; padding:15px; margin-bottom:20px; border-radius:8px; direction:rtl; text-align:right;">
              <h1 style="color:#4f46e5; font-family:Arial, sans-serif; font-size:22pt; margin:0 0 5px 0;">${title}</h1>
              ${videoUrl ? `<p style="color:#4b5563; font-family:Arial, sans-serif; font-size:10pt; margin:0 0 5px 0;">رابط الفيديو الأصلي: <a href="${videoUrl}" style="color:#4f46e5;">${videoUrl}</a></p>` : ''}
              <p style="color:#9ca3af; font-family:Arial, sans-serif; font-size:9pt; margin:0;">تم توليد هذا الملخص الدراسي مهيكلاً ومنسقاً بالألوان بواسطة منصة التمهيد الذكية</p>
            </div>
            <div style="direction:rtl; text-align:right;">
              ${htmlContent}
            </div>
          </body>
          </html>
        `;
        res.setHeader('Content-Type', 'application/msword; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="summary.doc"; filename*=UTF-8''${encodedFilename}.doc`);
        return res.send('\ufeff' + fullHtml);
      }

      if (format === 'pdf') {
        // We serve a self-printing HTML page which immediately triggers browser print/save PDF
        const fullHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${title}</title>
            <meta charset="utf-8">
            <style>
              @media print {
                body {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                  margin: 0;
                }
                @page {
                  margin: 20mm;
                  size: A4;
                }
              }
              body {
                font-family: Arial, sans-serif;
                margin: 40px;
                direction: rtl;
                text-align: right;
                background-color: #ffffff;
                color: #334155;
              }
            </style>
          </head>
          <body onload="window.print();">
            <div style="background-color:#e0e7ff; border:2px solid #818cf8; padding:20px; margin-bottom:30px; border-radius:12px;">
              <h1 style="color:#4f46e5; font-size:24px; margin:0 0 10px 0;">${title}</h1>
              ${videoUrl ? `<p style="color:#4b5563; font-size:12px; margin:0 0 5px 0;">رابط الفيديو الأصلي: <a href="${videoUrl}" style="color:#4f46e5; text-decoration:none;">${videoUrl}</a></p>` : ''}
              <p style="color:#64748b; font-size:11px; margin:0;">تاريخ التوليد: ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
            <div>
              ${htmlContent}
            </div>
          </body>
          </html>
        `;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(fullHtml);
      }

      return res.status(400).send('نوع التصدير غير مدعوم.');
    } catch (err: any) {
      console.error('Export endpoint error:', err);
      return res.status(500).send(`حدث خطأ أثناء التصدير: ${err.message}`);
    }
  });

  // Helper to answer Telegram callback query (stops the loading spinner in client)
  async function answerCallbackQuery(callbackQueryId: string, text?: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    try {
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text || ''
        })
      });
    } catch (error) {
      console.error('Error answering Telegram callback query:', error);
    }
  }

  // Helper to split and send long messages to Telegram safely within character limits
  async function sendTelegramLongMessage(chatId: string | number, text: string) {
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

      const chunk = remaining.slice(0, splitIdx);
      chunks.push(chunk);
      remaining = remaining.slice(splitIdx);
    }

    for (const chunk of chunks) {
      await sendTelegramMessage(chatId, chunk);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Helper to send Telegram message
  async function sendTelegramMessage(chatId: string | number, text: string): Promise<number | null> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error('TELEGRAM_BOT_TOKEN is not set in server environment.');
      return null;
    }

    try {
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
        console.error('Telegram API error:', errorData);
      }
    } catch (error) {
      console.error('Error sending Telegram message:', error);
    }
    return null;
  }

  // Helper to send Telegram message with Inline Keyboard
  async function sendTelegramMessageWithKeyboard(chatId: string | number, text: string, replyMarkup: any): Promise<number | null> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return null;

    try {
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
        console.error('Telegram API error with keyboard:', errorData);
      }
    } catch (error) {
      console.error('Error sending Telegram message with keyboard:', error);
    }
    return null;
  }

  // Helper to edit Telegram message text in-place (replaces loading message)
  async function editTelegramMessage(chatId: string | number, messageId: number, text: string, replyMarkup?: any): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !messageId) return false;

    try {
      const payload: any = {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'HTML'
      };
      if (replyMarkup) {
        payload.reply_markup = replyMarkup;
      }
      const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) return true;
      const err = await response.json() as any;
      console.warn('Telegram editMessageText failed:', err);
    } catch (error) {
      console.error('Error editing Telegram message:', error);
    }
    return false;
  }
  // Helper to find linked user by telegramId, username, or email
  async function findUserByTelegramOrEmail(telegramUserId: string | number, telegramUsername?: string, textInput?: string) {
    const strId = telegramUserId.toString();
    const numId = Number(telegramUserId);
    
    // 1. Check exact match on telegramId field (string)
    let q = query(collection(db, 'users'), where('telegramId', '==', strId));
    let snap = await getDocs(q);
    if (!snap.empty) {
      return { doc: snap.docs[0], id: snap.docs[0].id, data: snap.docs[0].data() };
    }

    // 1b. Check numeric match on telegramId field (if saved as a number)
    if (!isNaN(numId)) {
      q = query(collection(db, 'users'), where('telegramId', '==', numId as any));
      snap = await getDocs(q);
      if (!snap.empty) {
        return { doc: snap.docs[0], id: snap.docs[0].id, data: snap.docs[0].data() };
      }
    }

    // 2. Check if user typed their username or handle in telegramId or displayName field
    if (telegramUsername) {
      const cleanUsername = telegramUsername.replace(/^@/, '').trim();
      if (cleanUsername) {
        // Search by telegramId = cleanUsername or @cleanUsername
        for (const possibleVal of [cleanUsername, `@${cleanUsername}`]) {
          q = query(collection(db, 'users'), where('telegramId', '==', possibleVal));
          snap = await getDocs(q);
          if (!snap.empty) {
            const userDoc = snap.docs[0];
            try {
              await setDoc(doc(db, 'users', userDoc.id), {
                telegramId: strId,
                telegramUsername: cleanUsername,
                updatedAt: serverTimestamp()
              }, { merge: true });
              console.log(`Auto-linked telegramId ${strId} to user ${userDoc.id} by username @${cleanUsername}`);
            } catch (e) {}
            return { doc: userDoc, id: userDoc.id, data: { ...userDoc.data(), telegramId: strId } };
          }
        }
      }
    }

    // 2b. Check if textInput or telegramId matches a username or displayName
    if (textInput && textInput.trim()) {
      const cleanInput = textInput.replace(/^@/, '').trim();
      q = query(collection(db, 'users'), where('displayName', '==', cleanInput));
      snap = await getDocs(q);
      if (!snap.empty) {
        const userDoc = snap.docs[0];
        try {
          await setDoc(doc(db, 'users', userDoc.id), {
            telegramId: strId,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {}
        return { doc: userDoc, id: userDoc.id, data: { ...userDoc.data(), telegramId: strId } };
      }
    }

    // 3. Check if textInput or telegramId contains an email matching users.email or users.telegramId
    if (textInput && textInput.includes('@')) {
      const possibleEmail = textInput.trim().toLowerCase();
      // Check email field
      q = query(collection(db, 'users'), where('email', '==', possibleEmail));
      snap = await getDocs(q);
      if (!snap.empty) {
        const userDoc = snap.docs[0];
        try {
          await setDoc(doc(db, 'users', userDoc.id), {
            telegramId: strId,
            updatedAt: serverTimestamp()
          }, { merge: true });
          console.log(`Auto-linked telegramId ${strId} to user ${userDoc.id} (${possibleEmail})`);
        } catch (e) {
          console.warn('Failed to auto-link telegramId:', e);
        }
        return { doc: userDoc, id: userDoc.id, data: { ...userDoc.data(), telegramId: strId } };
      }

      // Check telegramId field if user entered email as telegramId in web settings
      q = query(collection(db, 'users'), where('telegramId', '==', possibleEmail));
      snap = await getDocs(q);
      if (!snap.empty) {
        const userDoc = snap.docs[0];
        try {
          await setDoc(doc(db, 'users', userDoc.id), {
            telegramId: strId,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {}
        return { doc: userDoc, id: userDoc.id, data: { ...userDoc.data(), telegramId: strId } };
      }
    }

    return null;
  }

  async function getLatestSummaryForTelegramUser(telegramUserId: string | number, telegramUsername?: string) {
    const userMatch = await findUserByTelegramOrEmail(telegramUserId, telegramUsername);
    if (!userMatch) {
      return null;
    }
    const userId = userMatch.id;
    const userData = userMatch.data;

    // Query summaries
    const summariesSnapshot = await getDocs(
      query(collection(db, 'summaries'), where('userId', '==', userId))
    );

    if (summariesSnapshot.empty) {
      return null;
    }

    // Sort in memory by createdAt descending
    const sorted = summariesSnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }) as any).sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

    return {
      summary: sorted[0],
      userData,
      userId
    };
  }

  // Helper to send a native Document file to a Telegram chat
  async function sendTelegramDocument(chatId: string | number, documentUrl: string, filename: string, caption?: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          document: documentUrl,
          caption: caption || '',
          parse_mode: 'HTML'
        })
      });
      if (!response.ok) {
        console.error('Telegram API sendDocument error:', await response.json());
      }
    } catch (error) {
      console.error('Error sending Telegram document:', error);
    }
  }

  // Helper to upload a document directly to Telegram as multipart/form-data (bypasses sandbox external HTTP reachability blocks)
  async function sendTelegramDocumentFile(chatId: string | number, content: string | Buffer, filename: string, caption?: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    try {
      const formData = new FormData();
      formData.append('chat_id', chatId.toString());
      
      const fileObj = typeof File !== 'undefined'
        ? new File([content], filename, { type: 'application/octet-stream' })
        : new Blob([content], { type: 'application/octet-stream' });

      formData.append('document', fileObj, filename);
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        console.error('Telegram API sendDocument upload error:', await response.json());
      }
    } catch (error) {
      console.error('Error uploading Telegram document:', error);
    }
  }

  // Core executor for interactive multi-format / refinement commands on Telegram
  async function executeTelegramAction(chatId: string | number, action: string, param: string, userData: any, userId: string, baseUrl: string) {
    const notionCredentials = userData.notionCredentials;
    
    if (action === 'word_dl') {
      const summaryDoc = await getDoc(doc(db, 'summaries', param));
      if (summaryDoc.exists()) {
        const sData = summaryDoc.data();
        const cleanTitle = (sData.videoTitle || 'ملخص').replace(/[^\w\s\u0600-\u06FF]/gi, '_').substring(0, 40);
        const downloadUrl = `${baseUrl}/api/export-file?id=${param}&format=word`;
        await sendTelegramMessage(chatId, `⏳ <b>جاري تحضير ملف Word الأكاديمي...</b>`);
        try {
          const localUrl = `http://127.0.0.1:3000/api/export-file?id=${param}&format=word`;
          const fileResponse = await fetch(localUrl);
          if (fileResponse.ok) {
            const arrayBuf = await fileResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            await sendTelegramDocumentFile(
              chatId,
              buffer,
              `${cleanTitle}.doc`,
              `📄 <b>ملف Word الأكاديمي المنسق للملخص:</b> ${sData.videoTitle || ''}\n\n🔗 <b>رابط التنزيل المباشر:</b>\n${downloadUrl}`
            );
          } else {
            throw new Error(`Failed local generate: ${fileResponse.statusText}`);
          }
        } catch (fetchErr: any) {
          console.error('[Telegram Export] Local generation failed, trying fallback URL...', fetchErr);
          await sendTelegramDocument(chatId, downloadUrl, `${cleanTitle}.doc`, `📄 <b>ملف Word للملخص:</b> ${sData.videoTitle || ''}\n\n🔗 ${downloadUrl}`);
        }
      } else {
        await sendTelegramMessage(chatId, `❌ عذراً، لم نتمكن من العثور على هذا الملخص.`);
      }
    } else if (action === 'pdf_dl') {
      const summaryDoc = await getDoc(doc(db, 'summaries', param));
      if (summaryDoc.exists()) {
        const sData = summaryDoc.data();
        const cleanTitle = (sData.videoTitle || 'ملخص').replace(/[^\w\s\u0600-\u06FF]/gi, '_').substring(0, 40);
        const downloadUrl = `${baseUrl}/api/export-file?id=${param}&format=pdf`;
        await sendTelegramMessage(chatId, `⏳ <b>جاري تحضير وثيقة PDF المنسقة للطباعة والتحميل...</b>`);
        
        const pdfMsg = `📕 <b>ملف PDF الطباعي المنسق للملخص:</b> ${sData.videoTitle || ''}\n\n` +
          `اضغط على الزر أدناه للفتح والمعاينة والطباعة المباشرة / الحفظ كـ PDF:`;
        
        const keyboard = {
          inline_keyboard: [
            [{ text: "عرض وطباعة / حفظ كـ PDF 📕", url: downloadUrl }]
          ]
        };

        // Also send Word document as an attached document for offline editing
        try {
          const localUrl = `http://127.0.0.1:3000/api/export-file?id=${param}&format=word`;
          const fileResponse = await fetch(localUrl);
          if (fileResponse.ok) {
            const arrayBuf = await fileResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            await sendTelegramDocumentFile(
              chatId,
              buffer,
              `${cleanTitle}.doc`,
              `📄 <b>مستند Word قابل للتعديل والطباعة:</b> ${sData.videoTitle || ''}`
            );
          }
        } catch (e) {}

        await sendTelegramMessageWithKeyboard(chatId, pdfMsg, keyboard);
      } else {
        await sendTelegramMessage(chatId, `❌ عذراً، لم نتمكن من العثور على هذا الملخص.`);
      }
    } else if (action === 'md_dl') {
      const summaryDoc = await getDoc(doc(db, 'summaries', param));
      if (summaryDoc.exists()) {
        const sData = summaryDoc.data();
        const cleanTitle = (sData.videoTitle || 'ملخص').replace(/[^\w\s\u0600-\u06FF]/gi, '_').substring(0, 40);
        const downloadUrl = `${baseUrl}/api/export-file?id=${param}&format=markdown`;
        await sendTelegramMessage(chatId, `⏳ <b>جاري تحضير ملف Markdown النصي...</b>`);
        try {
          const localUrl = `http://127.0.0.1:3000/api/export-file?id=${param}&format=markdown`;
          const fileResponse = await fetch(localUrl);
          if (fileResponse.ok) {
            const arrayBuf = await fileResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            await sendTelegramDocumentFile(
              chatId,
              buffer,
              `${cleanTitle}.md`,
              `📝 <b>ملف Markdown النصي للملخص:</b> ${sData.videoTitle || ''}\n\n🔗 <b>رابط التنزيل المباشر:</b>\n${downloadUrl}`
            );
          } else {
            throw new Error(`Failed local generate: ${fileResponse.statusText}`);
          }
        } catch (fetchErr: any) {
          console.error('[Telegram Export] Local Markdown generation failed, trying fallback URL...', fetchErr);
          await sendTelegramDocument(chatId, downloadUrl, `${cleanTitle}.md`, `📝 <b>ملف Markdown النصي للملخص:</b> ${sData.videoTitle || ''}\n\n🔗 ${downloadUrl}`);
        }
      } else {
        await sendTelegramMessage(chatId, `❌ عذراً، لم نتمكن من العثور على هذا الملخص.`);
      }
    } else if (action === 'notion_exp') {
      const summaryDoc = await getDoc(doc(db, 'summaries', param));
      if (summaryDoc.exists()) {
        const sData = summaryDoc.data();
        let targetNotionCreds = userData?.notionCredentials;

        // Smart Fallback: Check if summary owner's account has Notion credentials configured
        if ((!targetNotionCreds || !targetNotionCreds.apiKey || !targetNotionCreds.databaseId) && sData.userId) {
          try {
            const ownerSnap = await getDoc(doc(db, 'users', sData.userId));
            if (ownerSnap.exists()) {
              const ownerData = ownerSnap.data();
              if (ownerData.notionCredentials?.apiKey && ownerData.notionCredentials?.databaseId) {
                targetNotionCreds = ownerData.notionCredentials;
                console.log(`[Notion Export] Using owner (${sData.userId}) Notion credentials for Telegram user ${chatId}`);
              }
            }
          } catch (credsErr) {
            console.warn('[Notion Export Fallback Warning]:', credsErr);
          }
        }

        if (!targetNotionCreds || !targetNotionCreds.apiKey || !targetNotionCreds.databaseId) {
          const loginToken = await createLoginToken(userId);
          const settingsUrl = `${baseUrl}/?token=${loginToken}#notion-settings-card`;
          const keyboard = {
            inline_keyboard: [
              [{ text: "فتح إعدادات Notion بالموقع 🌐", url: settingsUrl }]
            ]
          };
          await sendTelegramMessageWithKeyboard(
            chatId,
            `⚠️ <b>إعدادات Notion غير مكتملة في حسابك:</b>\n\n` +
            `يرجى إدخال مفتاح API ومعرّف قاعدة البيانات في إعدادات الحساب بالموقع للربط والتصدير المباشر.\n\n` +
            `اضغط على الزر أدناه للانتقال للإعدادات والربط مباشرة:`,
            keyboard
          );
          return;
        }

        await sendTelegramMessage(chatId, `⏳ <b>جاري تصدير هذا الملخص إلى حساب Notion الخاص بك...</b>`);
        const notionResult = await exportToNotion(
          targetNotionCreds,
          sData.videoTitle || 'ملخص دراسي',
          sData.videoUrl || '',
          sData.summaryText || ''
        );
        if (notionResult.success) {
          await sendTelegramMessage(chatId, `✅ <b>تم تصدير الملخص بنجاح إلى Notion!</b>\n\n🔗 <a href="${notionResult.url}">اضغط هنا لفتح صفحة Notion الخاصة بك</a>`);
        } else {
          await sendTelegramMessage(chatId, `❌ <b>فشل التصدير لـ Notion:</b>\n${notionResult.error}`);
        }
      } else {
        await sendTelegramMessage(chatId, `❌ عذراً، لم نتمكن من العثور على هذا الملخص.`);
      }
    } else if (action === 'view_text') {
      const summaryDoc = await getDoc(doc(db, 'summaries', param));
      if (summaryDoc.exists()) {
        const sData = summaryDoc.data();
        let formattedText = sData.summaryText || '';
        formattedText = formattedText.replace(/^#\s+(.*)$/gm, '<b>$1</b>');
        formattedText = formattedText.replace(/^##\s+(.*)$/gm, '<b>$1</b>');
        formattedText = formattedText.replace(/^###\s+(.*)$/gm, '<b>$1</b>');
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        formattedText = formattedText.replace(/`(.*?)`/g, '<code>$1</code>');

        await sendTelegramLongMessage(chatId, `📖 <b>الملخص الكامل لـ (${sData.videoTitle || 'الفيديو'}):</b>\n\n` + formattedText);
      } else {
        await sendTelegramMessage(chatId, `❌ عذراً، لم نتمكن من العثور على هذا الملخص.`);
      }
    } else if (action === 'refine_acad') {
      const summaryDocRef = doc(db, 'summaries', param);
      const summaryDoc = await getDoc(summaryDocRef);
      if (summaryDoc.exists()) {
        const sData = summaryDoc.data();
        const loadingMsgId = await sendTelegramMessage(chatId, `⏳ <b>جاري إعادة صياغة الملخص وتنسيقه أكاديمياً بجداول بالذكاء الاصطناعي...</b>`);
        
        let geminiKey = userData.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
        if (!geminiKey) {
          const noKeyErr = `❌ خطأ: مفتاح API الخاص بالخادم غير مهيأ.`;
          if (loadingMsgId) await editTelegramMessage(chatId, loadingMsgId, noKeyErr);
          else await sendTelegramMessage(chatId, noKeyErr);
          return;
        }

        try {
          const prompt = `أنت بروفيسور وأكاديمي متميز بالجامعة. أعد صياغة الملخص الدراسي التالي بالكامل وحوّله إلى وثيقة أكاديمية احترافية ومنسقة.
استخدم جداول مقارنة وجداول مفاهيم منسقة بـ Markdown (جداول واضحة) لشرح الأفكار الرئيسية والمصطلحات المتقاطعة.
لا تكتب أي عبارات تمهيدية أو جانبية، اكتب الملاحظات والملخص مباشرة باللغة العربية الفصحى.
الملخص المراد صياغته:
${sData.summaryText}`;

          let refinedSummary = '';
          try {
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            const response = await ai.models.generateContent({
              model: "gemini-3.6-flash",
              contents: prompt,
            });
            refinedSummary = response.text || '';
          } catch (keyErr: any) {
            if (process.env.GEMINI_API_KEY && geminiKey !== process.env.GEMINI_API_KEY) {
              console.warn('[Refine Acad] Custom API key failed, falling back to process.env.GEMINI_API_KEY:', keyErr);
              const fallbackAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
              const fallbackResp = await fallbackAi.models.generateContent({
                model: "gemini-3.6-flash",
                contents: prompt,
              });
              refinedSummary = fallbackResp.text || '';
            } else {
              throw keyErr;
            }
          }

          if (refinedSummary) {
            await setDoc(summaryDocRef, { summaryText: refinedSummary }, { merge: true });

            const loginToken = await createLoginToken(userId);
            const viewUrl = `${baseUrl}/?s=${param}&token=${loginToken}`;

            const keyboard = {
              inline_keyboard: [
                [
                  { text: "فتح ومعاينة الإصدار الأكاديمي على الويب 🌐", url: viewUrl }
                ],
                [
                  { text: "تحميل Word 📄", callback_data: `word_dl|${param}` },
                  { text: "تحميل PDF 📕", callback_data: `pdf_dl|${param}` }
                ],
                [
                  { text: "تصدير لـ Notion 🔗", callback_data: `notion_exp|${param}` },
                  { text: "تحميل Markdown 📝", callback_data: `md_dl|${param}` }
                ],
                [
                  { text: "تنسيق أكاديمي ذكي 📊", callback_data: `refine_acad|${param}` },
                  { text: "تبسيط مكثف 📝", callback_data: `refine_conc|${param}` }
                ],
                [
                  { text: "عرض نص الملخص مباشرة هُنا 📖", callback_data: `view_text|${param}` }
                ]
              ]
            };
            const resultMsg = `📊 <b>تم تحديث الملخص بالتنسيق الأكاديمي الجديد بنجاح!</b>\n\n<b>العنوان:</b> ${sData.videoTitle || ''}\n\nاختر طريقة التصدير أو المعاينة المناسبة لك:`;
            if (loadingMsgId) {
              await editTelegramMessage(chatId, loadingMsgId, resultMsg, keyboard);
            } else {
              await sendTelegramMessageWithKeyboard(chatId, resultMsg, keyboard);
            }
          }
        } catch (err: any) {
          const errMsg = `❌ حدث خطأ أثناء التنسيق الأكاديمي: ${err.message}`;
          if (loadingMsgId) await editTelegramMessage(chatId, loadingMsgId, errMsg);
          else await sendTelegramMessage(chatId, errMsg);
        }
      } else {
        await sendTelegramMessage(chatId, `❌ عذراً، لم نتمكن من العثور على هذا الملخص.`);
      }
    } else if (action === 'refine_conc') {
      const summaryDocRef = doc(db, 'summaries', param);
      const summaryDoc = await getDoc(summaryDocRef);
      if (summaryDoc.exists()) {
        const sData = summaryDoc.data();
        const loadingMsgId = await sendTelegramMessage(chatId, `⏳ <b>جاري تبسيط واختصار الملخص بالكامل كنصوص وقوائم بالذكاء الاصطناعي...</b>`);
        
        let geminiKey = userData.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
        if (!geminiKey) {
          const noKeyErr = `❌ خطأ: مفتاح API الخاص بالخادم غير مهيأ.`;
          if (loadingMsgId) await editTelegramMessage(chatId, loadingMsgId, noKeyErr);
          else await sendTelegramMessage(chatId, noKeyErr);
          return;
        }

        try {
          const prompt = `أنت معلم متميز يركز على التبسيط والاختصار المباشر والمفهوم. أعد صياغة الملخص الدراسي التالي بالكامل وحوّله إلى قوائم نقطية مبسطة ومباشرة ومفهومة.
لا تستخدم أي جداول ماركداون (Markdown Tables) أبداً. يجب أن يكون الناتج نصياً وقوائم نقطية فقط خالية من التعقيدات.
لا تكتب أي عبارات تمهيدية أو جانبية، اكتب الملخص مباشرة.
الملخص المراد صياغته:
${sData.summaryText}`;

          let refinedSummary = '';
          try {
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            const response = await ai.models.generateContent({
              model: "gemini-3.6-flash",
              contents: prompt,
            });
            refinedSummary = response.text || '';
          } catch (keyErr: any) {
            if (process.env.GEMINI_API_KEY && geminiKey !== process.env.GEMINI_API_KEY) {
              console.warn('[Refine Conc] Custom API key failed, falling back to process.env.GEMINI_API_KEY:', keyErr);
              const fallbackAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
              const fallbackResp = await fallbackAi.models.generateContent({
                model: "gemini-3.6-flash",
                contents: prompt,
              });
              refinedSummary = fallbackResp.text || '';
            } else {
              throw keyErr;
            }
          }
          if (refinedSummary) {
            await setDoc(summaryDocRef, { summaryText: refinedSummary }, { merge: true });

            const loginToken = await createLoginToken(userId);
            const viewUrl = `${baseUrl}/?s=${param}&token=${loginToken}`;

            const keyboard = {
              inline_keyboard: [
                [
                  { text: "فتح ومعاينة الإصدار المبسط على الويب 🌐", url: viewUrl }
                ],
                [
                  { text: "تحميل Word 📄", callback_data: `word_dl|${param}` },
                  { text: "تحميل PDF 📕", callback_data: `pdf_dl|${param}` }
                ],
                [
                  { text: "تصدير لـ Notion 🔗", callback_data: `notion_exp|${param}` },
                  { text: "تحميل Markdown 📝", callback_data: `md_dl|${param}` }
                ],
                [
                  { text: "تنسيق أكاديمي ذكي 📊", callback_data: `refine_acad|${param}` },
                  { text: "تبسيط مكثف 📝", callback_data: `refine_conc|${param}` }
                ],
                [
                  { text: "عرض نص الملخص مباشرة هُنا 📖", callback_data: `view_text|${param}` }
                ]
              ]
            };
            const resultMsg = `📝 <b>تم تبسيط واختصار الملخص بنجاح!</b>\n\n<b>العنوان:</b> ${sData.videoTitle || ''}\n\nاختر طريقة التصدير أو المعاينة المناسبة لك:`;
            if (loadingMsgId) {
              await editTelegramMessage(chatId, loadingMsgId, resultMsg, keyboard);
            } else {
              await sendTelegramMessageWithKeyboard(chatId, resultMsg, keyboard);
            }
          }
        } catch (err: any) {
          const errMsg = `❌ حدث خطأ أثناء تبسيط المحتوى: ${err.message}`;
          if (loadingMsgId) await editTelegramMessage(chatId, loadingMsgId, errMsg);
          else await sendTelegramMessage(chatId, errMsg);
        }
      } else {
        await sendTelegramMessage(chatId, `❌ عذراً، لم نتمكن من العثور على هذا الملخص.`);
      }
    }
  }

  // Helper to generate a summary and send it directly in the Telegram chat
  async function processChatSummary(chatId: string | number, userId: string, userDisplayName: string, videoUrl: string, baseUrl: string) {
    const loadingMsgId = await sendTelegramMessage(
      chatId,
      `⏳ <b>جاري تحليل مقطع الفيديو وتوليد الملخص الدراسي الأكاديمي...</b>\nيرجى الانتظار بضع ثوانٍ.`
    );

    let apiKey = process.env.GEMINI_API_KEY;
    let hasCustomApiKey = false;
    let userData: any = {};
    if (userId) {
      try {
        const userDocSnap = await getDoc(doc(db, 'users', userId));
        if (userDocSnap.exists()) {
          userData = userDocSnap.data();
          if (userData.geminiApiKey && userData.geminiApiKey.trim()) {
            apiKey = userData.geminiApiKey.trim();
            hasCustomApiKey = true;
            console.log(`[Telegram API Key] Using custom Gemini API key for Telegram user: ${userId}`);
          }
        }
      } catch (err) {
        console.warn('Failed to load user config for Telegram API key:', err);
      }
    }

    if (!hasCustomApiKey) {
      const trialIdentifier = userId ? userId : `tg_${chatId}`;
      const trialResult = await checkAndRecordTrialUsage(trialIdentifier);
      if (!trialResult.allowed) {
        const trialMsg = `⚠️ <b>تنبيه فترة الانتظار التجريبية:</b>\n\n` +
          `لقد استنفدت التجربة المجانية الواحدة باستخدام المفتاح الافتراضي.\n` +
          `يرجى الانتظار لمدة <b>${trialResult.remainingMinutes} دقائق</b>، أو إضافة مفتاح Gemini API الخاص بك في إعدادات الحساب للتجاوز والتلخيص الفوري دون قيود.`;
        if (loadingMsgId) {
          await editTelegramMessage(chatId, loadingMsgId, trialMsg);
        } else {
          await sendTelegramMessage(chatId, trialMsg);
        }
        return;
      }
    }

    if (!apiKey) {
      const noKeyMsg = `❌ خطأ في الخادم: مفتاح Gemini API غير مهيأ.`;
      if (loadingMsgId) {
        await editTelegramMessage(chatId, loadingMsgId, noKeyMsg);
      } else {
        await sendTelegramMessage(chatId, noKeyMsg);
      }
      return;
    }

    try {
      const result = await summarizeVideoWithGemini(videoUrl, apiKey);
      
      // Save to Firestore summaries history so they can access it on the website too
      const summaryData = {
        userId,
        userDisplayName,
        videoUrl: videoUrl,
        videoId: result.videoId,
        videoTitle: result.videoTitle,
        summaryText: result.summary,
        isPublic: true,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'summaries'), summaryData);
      const summaryId = docRef.id;

      const loginToken = await createLoginToken(userId);
      const viewUrl = `${baseUrl}/?s=${summaryId}&token=${loginToken}`;

      // Offer multi-format download & export buttons directly without filling chat screen with raw summary text!
      const menuMsg = `🎯 <b>تم تلخيص الفيديو وإعداد النتائج بنجاح!</b>\n\n` +
        `<b>📺 العنوان:</b> ${result.videoTitle}\n` +
        `<b>👤 المستخدم:</b> ${userDisplayName}\n\n` +
        `<b>📥 اختر من الأزرار التفاعلية أدناه طريقة التصدير أو المعاينة المناسبة لك:</b>`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "فتح ومعاينة الملخص على الويب 🌐 (تفاعلي)", url: viewUrl }
          ],
          [
            { text: "تحميل Word 📄", callback_data: `word_dl|${summaryId}` },
            { text: "تحميل PDF 📕", callback_data: `pdf_dl|${summaryId}` }
          ],
          [
            { text: "تصدير لـ Notion 🔗", callback_data: `notion_exp|${summaryId}` },
            { text: "تحميل Markdown 📝", callback_data: `md_dl|${summaryId}` }
          ],
          [
            { text: "تنسيق أكاديمي ذكي 📊", callback_data: `refine_acad|${summaryId}` },
            { text: "تبسيط مكثف 📝", callback_data: `refine_conc|${summaryId}` }
          ],
          [
            { text: "عرض نص الملخص مباشرة هُنا 📖", callback_data: `view_text|${summaryId}` }
          ]
        ]
      };

      if (loadingMsgId) {
        const edited = await editTelegramMessage(chatId, loadingMsgId, menuMsg, keyboard);
        if (!edited) {
          await sendTelegramMessageWithKeyboard(chatId, menuMsg, keyboard);
        }
      } else {
        await sendTelegramMessageWithKeyboard(chatId, menuMsg, keyboard);
      }
    } catch (error: any) {
      console.error('Error processing chat summary:', error);
      const errorMsg = `❌ حدث خطأ أثناء تلخيص الفيديو وعرضه: ${error.message}`;
      if (loadingMsgId) {
        await editTelegramMessage(chatId, loadingMsgId, errorMsg);
      } else {
        await sendTelegramMessage(chatId, errorMsg);
      }
    }
  }

  // Extract Telegram processing logic into a standalone reusable function
  async function handleTelegramUpdate(body: any, baseUrl?: string) {
    if (!body) return;
    const finalBaseUrl = baseUrl || globalLastKnownBaseUrl || process.env.APP_URL || '';

    // SCENARIO A: Callback Query (User clicked a button)
    if (body.callback_query) {
      const { id: queryId, from, data, message } = body.callback_query;
      const chatId = message?.chat?.id;
      const telegramUserId = from ? from.id : chatId;
      const telegramUsername = from?.username;

      console.log(`Received callback query from ${telegramUserId}: data=${data}`);

      // Always answer callback query with a toast notification to give instant feedback
      await answerCallbackQuery(queryId, "⏳ جاري تنفيذ طلبك...");

      if (!data || !chatId) {
        return;
      }

      const [action, param] = data.split('|');
      if (!param) {
        return;
      }

      // Look up user in Firestore using findUserByTelegramOrEmail
      let userMatch = await findUserByTelegramOrEmail(telegramUserId, telegramUsername);

      // Robust Fallback: If userMatch was not found by telegramId, but param exists (which is summaryId), look up summary doc
      if (!userMatch && param) {
        try {
          const summarySnap = await getDoc(doc(db, 'summaries', param));
          if (summarySnap.exists()) {
            const summaryData = summarySnap.data();
            if (summaryData.userId) {
              const ownerSnap = await getDoc(doc(db, 'users', summaryData.userId));
              if (ownerSnap.exists()) {
                userMatch = { doc: ownerSnap as any, id: ownerSnap.id, data: ownerSnap.data() };
                await setDoc(doc(db, 'users', ownerSnap.id), {
                  telegramId: telegramUserId.toString(),
                  updatedAt: serverTimestamp()
                }, { merge: true });
                console.log(`[Telegram Callback Auto-Link] Linked telegramId ${telegramUserId} to user ${ownerSnap.id}`);
              }
            }
          }
        } catch (fallbackErr) {
          console.warn('[Telegram Callback Fallback Error]:', fallbackErr);
        }
      }

      // Auto-create user document for this Telegram user if still not found
      if (!userMatch) {
        try {
          const newDocRef = await addDoc(collection(db, 'users'), {
            telegramId: telegramUserId.toString(),
            displayName: telegramUsername ? `@${telegramUsername}` : `Telegram User ${telegramUserId}`,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          const newSnap = await getDoc(newDocRef);
          userMatch = { doc: newSnap as any, id: newDocRef.id, data: newSnap.data() };
          console.log(`[Telegram Callback] Auto-created user profile ${newDocRef.id} for telegramId ${telegramUserId}`);
        } catch (createErr) {
          console.error('[Telegram Callback User Create Error]:', createErr);
        }
      }

      if (!userMatch) {
        await sendTelegramMessage(chatId, `❌ عذراً، حدث خطأ أثناء معالجة حسابك. يرجى إعادة المحاولة.`);
        return;
      }

      const userData = userMatch.data;
      const userId = userMatch.id;
      const userDisplayName = userData.displayName || 'مستخدم تلغرام';
      const notionCredentials = userData.notionCredentials;

      // Handle file download/formatting operations natively
      if (['word_dl', 'pdf_dl', 'md_dl', 'notion_exp', 'refine_acad', 'refine_conc', 'view_text'].includes(action)) {
        await executeTelegramAction(chatId, action, param, userData, userId, finalBaseUrl);
        return;
      }

      // Handle initial prompt selections
      if (action === 'notion_export') {
        if (!param.startsWith('http')) {
          // If param is a summary ID instead of a video URL
          await executeTelegramAction(chatId, 'notion_exp', param, userData, userId, finalBaseUrl);
          return;
        }
        if (!notionCredentials || !notionCredentials.apiKey || !notionCredentials.databaseId) {
          const missingNotion = `⚠️ لم تقم بتهيئة إعدادات Notion الخاصة بك بعد في تطبيق الويب.\n` +
            `سنقوم بتوليد الملخص وعرضه لك هنا مباشرة بدلاً من ذلك.`;
          await sendTelegramMessage(chatId, missingNotion);
          await processChatSummary(chatId, userId, userDisplayName, param, finalBaseUrl);
          return;
        }

        await sendTelegramMessage(
          chatId,
          `⏳ <b>جاري تحليل الفيديو وتلخيصه وتصديره مباشرة إلى صفحة Notion الخاصة بك...</b>\nيرجى الانتظار، قد يستغرق هذا بضع ثوانٍ.`
        );

        let apiKey = userData.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
        if (!apiKey) {
          await sendTelegramMessage(chatId, `❌ خطأ في الخادم: مفتاح Gemini API غير مهيأ.`);
          return;
        }

        try {
          const result = await summarizeVideoWithGemini(param, apiKey);
          const notionResult = await exportToNotion(
            notionCredentials,
            result.videoTitle,
            param,
            result.summary
          );

          if (notionResult.success) {
            // Save to Firestore summaries history
            const summaryData = {
              userId,
              userDisplayName,
              videoUrl: param,
              videoId: result.videoId,
              videoTitle: result.videoTitle,
              summaryText: result.summary,
              isPublic: true,
              createdAt: serverTimestamp()
            };
            const docRef = await addDoc(collection(db, 'summaries'), summaryData);
            const summaryId = docRef.id;

            const loginToken = await createLoginToken(userId);
            const viewUrl = `${finalBaseUrl}/?s=${summaryId}&token=${loginToken}`;

            const successMsg = `✅ <b>تم تلخيص مقطع الفيديو بنجاح وتصديره لـ Notion!</b>\n\n` +
              `<b>عنوان الفيديو:</b> ${result.videoTitle}\n\n` +
              `🔗 <a href="${notionResult.url}">اضغط هنا لفتح صفحة Notion الشخصية الخاصة بك</a>\n` +
              `🌐 <a href="${viewUrl}">رابط العرض التفاعلي والمعاينة على الويب</a>\n\n` +
              `اختر أحد الخيارات بالأسفل لتحميل ملفات المستندات أو صياغتها أكاديمياً:`;

            const keyboard = {
              inline_keyboard: [
                [
                  { text: "عرض الملخص على الويب 🌐 (تفاعلي)", url: viewUrl }
                ],
                [
                  { text: "تحميل Word 📄", callback_data: `word_dl|${summaryId}` },
                  { text: "تحميل PDF 📕", callback_data: `pdf_dl|${summaryId}` }
                ],
                [
                  { text: "تصدير لـ Notion 🔗", callback_data: `notion_exp|${summaryId}` },
                  { text: "تحميل Markdown 📝", callback_data: `md_dl|${summaryId}` }
                ],
                [
                  { text: "تنسيق أكاديمي ذكي 📊", callback_data: `refine_acad|${summaryId}` },
                  { text: "تبسيط مكثف 📝", callback_data: `refine_conc|${summaryId}` }
                ]
              ]
            };
            await sendTelegramMessageWithKeyboard(chatId, successMsg, keyboard);
          } else {
            await sendTelegramMessage(
              chatId,
              `❌ <b>فشل تصدير الملخص إلى Notion:</b>\n${notionResult.error || 'حدث خطأ غير معروف.'}\n` +
              `سنقوم بعرض الملخص لك هنا بدلاً من ذلك.`
            );
            await processChatSummary(chatId, userId, userDisplayName, param, finalBaseUrl);
          }
        } catch (error: any) {
          console.error('Error processing video for Notion:', error);
          await sendTelegramMessage(chatId, `❌ حدث خطأ أثناء تلخيص الفيديو وتصديره: ${error.message}`);
        }

      } else if (action === 'chat_summary') {
        await processChatSummary(chatId, userId, userDisplayName, param, finalBaseUrl);
      }

      return;
    }

    // SCENARIO B: Standard Message received
    if (body.message) {
      const { chat, text, from } = body.message;
      const chatId = chat.id;
      const telegramUserId = from ? from.id : chatId;
      const telegramUsername = from?.username;

      console.log(`Received Telegram message from ${telegramUserId} (@${telegramUsername || ''}): ${text}`);

      if (!text) {
        return;
      }

      const trimmedText = text.trim();

      // Handle start command and deep linking (e.g. /start link_USERID)
      if (trimmedText.startsWith('/start')) {
        const parts = trimmedText.split(/\s+/);
        const startPayload = parts[1] || '';
        let targetUserId = startPayload.replace(/^(link_|user_)/, '').trim();

        if (targetUserId) {
          try {
            const userDocRef = doc(db, 'users', targetUserId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              await setDoc(userDocRef, {
                telegramId: telegramUserId.toString(),
                updatedAt: serverTimestamp()
              }, { merge: true });

              console.log(`[Telegram DeepLink] Linked telegramId ${telegramUserId} to user ${targetUserId}`);

              const loginToken = await createLoginToken(targetUserId);
              const webUrl = `${finalBaseUrl}/?token=${loginToken}`;

              const linkSuccessMsg = `🎉 <b>تم ربط حسابك في التلغرام بموقع الويب بنجاح وبأعلى معايير الأمان!</b>\n\n` +
                `• <b>المستخدم:</b> ${userDocSnap.data()?.displayName || 'مستخدم'}\n` +
                `• <b>معرف تلغرام:</b> <code>${telegramUserId}</code>\n\n` +
                `أصبح البوت الآن يتعرف عليك رسمياً. أي فيديو يوتيوب ترسله هنا سيتم تلخيصه وحفظه في حسابك مباشرة، وتصديره لـ Notion إذا كانت إعداداتك مفعلة!\n\n` +
                `🔗 <a href="${webUrl}">دخول تلقائي موثّق إلى موقع الويب</a>`;

              const keyboard = {
                inline_keyboard: [
                  [{ text: "فتح الموقع والدخول أوتوماتيكياً 🌐", url: webUrl }]
                ]
              };
              await sendTelegramMessageWithKeyboard(chatId, linkSuccessMsg, keyboard);
              return;
            }
          } catch (deepLinkErr) {
            console.error('[Telegram DeepLink Error]:', deepLinkErr);
          }
        }

        const userMatch = await findUserByTelegramOrEmail(telegramUserId, telegramUsername);

        let greeting = `<b>مرحباً بك في بوت تلخيص يوتيوب إلى Notion والملفات الأكاديمية! 🤖✨</b>\n\n`;
        let keyboard;

        if (userMatch) {
          const userId = userMatch.id;
          const userData = userMatch.data;
          const displayName = userData.displayName || 'مستخدم تلغرام';
          
          // Generate a secure single-use login token for auto-login
          const loginToken = await createLoginToken(userId);
          const webUrl = `${finalBaseUrl}/?token=${loginToken}`;

          greeting += `🎯 <b>حسابك مرتبط بنجاح!</b>\n` +
            `أهلاً بك مجدداً يا <b>${displayName}</b>.\n\n` +
            `يمكنك الانتقال إلى الموقع وسيقوم بتسجيل دخولك تلقائياً وبأمان التام:\n` +
            `🔗 <a href="${webUrl}">دخول تلقائي سريع إلى الموقع</a>\n\n` +
            `<b>💡 الأوامر المتاحة بعد تلخيص أي فيديو:</b>\n` +
            `• 📄 <code>/word</code> - تحميل الملخص الأخير كملف مستند Word\n` +
            `• 📕 <code>/pdf</code> - تحميل الملخص الأخير كوثيقة PDF تفاعلية مطبوعة\n` +
            `• 📝 <code>/markdown</code> - تحميل الملخص الأخير كملف Markdown نصي\n` +
            `• 📊 <code>/academic</code> - إعادة صياغة الملخص بذكاء وجداول أكاديمية\n` +
            `• 📝 <code>/concise</code> - تبسيط واختصار الملخص بالكامل كنقاط نصوص مريحة\n` +
            `• 🔗 <code>/notion</code> - التصدير المباشر لملخصك الأخير إلى حساب Notion الشخصي\n` +
            `• 🌐 <code>/login</code> - توليد رابط دخول تلقائي للموقع\n\n` +
            `أرسل أي رابط فيديو يوتيوب الآن وسنقوم بتلخيصه وحفظه في حسابك مباشرة!`;

          keyboard = {
            inline_keyboard: [
              [
                { text: "الانتقال إلى الموقع (دخول تلقائي) 🌐", url: webUrl }
              ]
            ]
          };
        } else {
          greeting += `لتفعيل البوت وتوصيله بحسابك بشكل فوري، استخدم إحدى الطريقتين السهلتين:\n\n` +
            `1️⃣ <b>أرسل بريدك الإلكتروني المسجل بالموقع</b> (مثل <code>name@gmail.com</code>) هنا في المحادثة مباشرة وسيتم ربط الحساب فوراً!\n\n` +
            `2️⃣ <b>أو انسخ معرّفك الرقمي التالي</b> وضعْه في إعدادات ملفك الشخصي بتطبيق الويب:\n` +
            `معرف الدردشة (Telegram Chat ID):\n` +
            `<code>${telegramUserId}</code>\n\n` +
            `<b>💡 بعد ربط الحساب، يمكنك إرسال أي رابط فيديو يوتيوب لتلخيصه وحفظه! 👇</b>`;
        }
        
        if (keyboard) {
          await sendTelegramMessageWithKeyboard(chatId, greeting, keyboard);
        } else {
          await sendTelegramMessage(chatId, greeting);
        }
        return;
      }

      // Handle direct email input or /link command
      let emailToLink = '';
      if (trimmedText.startsWith('/link ')) {
        emailToLink = trimmedText.replace('/link ', '').trim();
      } else if (trimmedText.includes('@') && trimmedText.includes('.') && !trimmedText.includes('http') && !trimmedText.includes('youtube')) {
        emailToLink = trimmedText.trim();
      }

      if (emailToLink) {
        await sendTelegramMessage(chatId, `🔍 جاري البحث عن حسابك المسجل بالبريد الإلكتروني (<code>${emailToLink}</code>)...`);
        const userMatch = await findUserByTelegramOrEmail(telegramUserId, telegramUsername, emailToLink);
        if (userMatch) {
          const loginToken = await createLoginToken(userMatch.id);
          const webUrl = `${finalBaseUrl}/?token=${loginToken}`;
          const linkSuccessMsg = `🎉 <b>تم ربط حسابك في تلغرام بحساب جوجل بنجاح!</b>\n\n` +
            `• <b>اسم الحساب:</b> ${userMatch.data.displayName || 'مستخدم'}\n` +
            `• <b>البريد الإلكتروني:</b> ${userMatch.data.email || emailToLink}\n` +
            `• <b>معرف تلغرام:</b> <code>${telegramUserId}</code>\n\n` +
            `اضغط على الزر أدناه للانتقال للموقع والدخول تلقائياً:\n` +
            `🔗 <a href="${webUrl}">دخول تلقائي سريع إلى الموقع</a>\n\n` +
            `أو أرسل أي رابط فيديو يوتيوب هنا مباشرة للبدء في التلخيص!`;
          const keyboard = {
            inline_keyboard: [
              [{ text: "فتح الموقع والدخول تلقائياً 🌐", url: webUrl }]
            ]
          };
          await sendTelegramMessageWithKeyboard(chatId, linkSuccessMsg, keyboard);
          return;
        } else {
          await sendTelegramMessage(
            chatId,
            `❌ لم نتمكن من العثور على حساب مسجل بهذا البريد الإلكتروني (<code>${emailToLink}</code>).\n\n` +
            `يرجى زيارة الموقع وتسجيل الدخول بحساب جوجل أولاً، أو إدخال معرّفك الرقمي (<code>${telegramUserId}</code>) في إعدادات الملف الشخصي بالموقع.`
          );
          return;
        }
      }

      // Handle Slash Commands for the last generated summary
      const commandMap: Record<string, string> = {
        '/word': 'word_dl',
        '/pdf': 'pdf_dl',
        '/markdown': 'md_dl',
        '/notion': 'notion_exp',
        '/academic': 'refine_acad',
        '/concise': 'refine_conc'
      };

      if (commandMap[trimmedText]) {
        await sendTelegramMessage(chatId, `🔍 جاري البحث عن ملخصك الأخير لمعالجة طلبك...`);
        const latestInfo = await getLatestSummaryForTelegramUser(telegramUserId, telegramUsername);
        if (!latestInfo) {
          await sendTelegramMessage(chatId, `❌ لم نتمكن من العثور على أي ملخصات سابقة في حسابك لتنفيذ هذا الأمر. أرسل رابط يوتيوب لتوليد ملخص أولاً!`);
          return;
        }

        await executeTelegramAction(chatId, commandMap[trimmedText], latestInfo.summary.id, latestInfo.userData, latestInfo.userId, finalBaseUrl);
        return;
      }

      // Check if it's a YouTube link
      const isYoutube = trimmedText.includes('youtube.com') || trimmedText.includes('youtu.be');
      if (!isYoutube) {
        const warning = `⚠️ عذراً، يرجى إرسال رابط فيديو يوتيوب صحيح للبدء في تلخيصه وتصديره.\n\n` +
          `💡 للربط الفوري بحسابك، أرسل بريدك الإلكتروني المسجل بالموقع هُنا (مثال: name@gmail.com).\n` +
          `أو يمكنك استخدام أحد الأوامر المباشرة للملخص الأخير:\n` +
          `/word, /pdf, /markdown, /notion, /academic, /concise`;
        await sendTelegramMessage(chatId, warning);
        return;
      }

      // Look up user in Firestore by telegramId, username, or email
      console.log(`Looking up user for Telegram ${telegramUserId} (@${telegramUsername || ''})`);
      let userMatch = await findUserByTelegramOrEmail(telegramUserId, telegramUsername);

      if (!userMatch) {
        // Auto-create user doc so Telegram user is never blocked!
        try {
          const newDocRef = await addDoc(collection(db, 'users'), {
            telegramId: telegramUserId.toString(),
            displayName: from?.first_name ? `${from.first_name} ${from.last_name || ''}`.trim() : 'مستخدم تلغرام',
            email: '',
            geminiApiKey: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          const newDocSnap = await getDoc(newDocRef);
          userMatch = { doc: newDocSnap as any, id: newDocRef.id, data: { ...(newDocSnap.data() || {}), telegramId: telegramUserId.toString() } };
          console.log(`Auto-created user doc for new Telegram user ${telegramUserId}: ${newDocRef.id}`);
        } catch (createErr) {
          console.error('Failed to auto-create user doc for Telegram:', createErr);
        }
      }

      if (!userMatch) {
        const missingUser = `❌ لم نتمكن من إعداد حسابك في التلغرام.\n\n` +
          `يرجى الانتقال إلى منصة الويب وإدخال هذا المعرف (<code>${telegramUserId}</code>) في إعدادات الملف الشخصي.`;
        await sendTelegramMessage(chatId, missingUser);
        return;
      }

      const userData = userMatch.data;
      const userId = userMatch.id;
      const userDisplayName = userData.displayName || 'مستخدم تلغرام';

      await processChatSummary(chatId, userId, userDisplayName, trimmedText, finalBaseUrl);
      return;
    }
  }

  // 2. Telegram Webhook Endpoint (Kept as fallback)
  app.post('/api/telegram-webhook', async (req, res): Promise<any> => {
    try {
      const body = req.body;
      const host = req.get('host');
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const baseUrl = `${protocol}://${host}`;
      await handleTelegramUpdate(body, baseUrl);
      return res.json({ success: true });
    } catch (error: any) {
      console.error('Error handling Telegram webhook:', error);
      try {
        const body = req.body;
        const chatId = body?.message?.chat?.id || body?.callback_query?.message?.chat?.id;
        if (chatId) {
          await sendTelegramMessage(chatId, `❌ حدث خطأ غير متوقع أثناء معالجة طلبك: ${error.message}`);
        }
      } catch (tgError) {
        console.error('Failed to notify user about error:', tgError);
      }
      return res.json({ success: true }); // Always return 200 to Telegram
    }
  });

  // Long Polling Engine for Sandbox & Cloud Run
  let lastUpdateId = 0;
  async function startTelegramPolling() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.warn('[Telegram Engine] Missing TELEGRAM_BOT_TOKEN. Delivery engine skipped.');
      return;
    }

    console.log('[Telegram Engine] Clearing webhooks to ensure direct long-polling active...');
    try {
      await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
    } catch (e) {
      console.warn('[Telegram Engine] Error deleting webhook:', e);
    }

    console.log('[Telegram Engine] Initializing Telegram long polling loop...');

    let pollErrorDelay = 1000;
    async function poll() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(
          `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&limit=10&timeout=15`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (response.ok) {
          pollErrorDelay = 1000;
          const data = await response.json() as any;
          if (data.ok && data.result && data.result.length > 0) {
            for (const update of data.result) {
              lastUpdateId = Math.max(lastUpdateId, update.update_id);
              await handleTelegramUpdate(update, globalLastKnownBaseUrl).catch(err => {
                console.error(`[Telegram Poll] Error handling update ${update.update_id}:`, err);
              });
            }
          }
        } else {
          console.warn(`[Telegram Poll] Non-200 response from Telegram API: ${response.status}`);
          pollErrorDelay = Math.min(pollErrorDelay * 2, 10000);
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const causeMsg = err?.cause?.message || err?.cause?.code || String(err?.cause || '');
        if (
          err?.name === 'AbortError' ||
          errMsg.includes('aborted') ||
          causeMsg.includes('ETIMEDOUT') ||
          causeMsg.includes('ECONNRESET') ||
          causeMsg.includes('UND_ERR')
        ) {
          // Normal transient timeout in long-polling
          pollErrorDelay = 2000;
        } else {
          console.warn('[Telegram Poll] Network connection attempt failed, backing off:', errMsg);
          pollErrorDelay = Math.min(pollErrorDelay * 2, 10000);
        }
      } finally {
        setTimeout(poll, pollErrorDelay);
      }
    }

    poll();
  }

async function startServer() {
  // 3. Vite development / production static server configuration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted in development mode');
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist'))
      ? path.join(process.cwd(), 'dist')
      : path.join(resolvedDirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production static files from:', distPath);
  }

  // Launch Telegram Polling as primary delivery mechanism
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  if (tgToken) {
    startTelegramPolling().catch(err => {
      console.error('[Telegram Poll] Failed to start polling loop:', err);
    });
  } else {
    console.warn(`[Telegram Poll] Polling skipped: TELEGRAM_BOT_TOKEN not found in env.`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((error) => {
    console.error('Fatal server startup error:', error);
  });
}

export default app;
