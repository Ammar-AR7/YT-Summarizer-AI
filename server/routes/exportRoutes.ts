/**
 * Export Routes — مسارات التصدير (Word, PDF, Markdown, Notion, Document Refinement)
 * 
 * GET  /api/export-file      — تصدير ملخص كملف Word/PDF/Markdown
 * POST /api/notion/export     — تصدير ملخص إلى Notion
 * POST /api/document/refine   — تحسين ملخص بالذكاء الاصطناعي للتصدير
 */
import { Router, Request, Response } from 'express';
import { db } from '../firebaseAdmin.js';
import { exportToNotion } from '../../src/services/notionService.js';
import { markdownToHtml, generateWordDocument, generatePdfDocument } from '../helpers/htmlExporter.js';
import { exportLimiter } from '../middleware/rateLimiter.js';
import { GoogleGenAI } from '@google/genai';

const router = Router();

/**
 * GET /api/export-file
 * تصدير ملخص كملف Word أو PDF أو Markdown
 */
router.get('/export-file', async (req: Request, res: Response): Promise<any> => {
  const { id, format } = req.query;

  if (!id) {
    return res.status(400).send('معرّف الملخص مطلوب.');
  }

  try {
    const summaryDoc = await db.collection('summaries').doc(id as string).get();
    if (!summaryDoc.exists) {
      return res.status(404).send('الملخص غير موجود.');
    }

    const data = summaryDoc.data()!;
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

    const htmlContent = markdownToHtml(summaryText);

    if (format === 'word') {
      const fullHtml = generateWordDocument(title, htmlContent, videoUrl);
      res.setHeader('Content-Type', 'application/msword; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="summary.doc"; filename*=UTF-8''${encodedFilename}.doc`);
      return res.send('\ufeff' + fullHtml);
    }

    if (format === 'pdf') {
      const fullHtml = generatePdfDocument(title, htmlContent, videoUrl);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(fullHtml);
    }

    return res.status(400).send('نوع التصدير غير مدعوم.');
  } catch (err: any) {
    console.error('[Export] Error:', err);
    return res.status(500).send(`حدث خطأ أثناء التصدير: ${err.message}`);
  }
});

/**
 * POST /api/notion/export
 * تصدير ملخص إلى Notion (يتجنب مشكلة CORS في العميل)
 */
router.post('/notion/export', exportLimiter, async (req: Request, res: Response): Promise<any> => {
  const { credentials, videoTitle, videoUrl, summaryMarkdown } = req.body;

  if (!credentials || !credentials.apiKey || !credentials.databaseId) {
    return res.status(400).json({
      success: false,
      error: 'بيانات Notion غير مكتملة. يرجى تهيئتها في الإعدادات.'
    });
  }

  try {
    console.log(`[Notion Export] Exporting "${videoTitle}" to database ${credentials.databaseId}`);
    const result = await exportToNotion(credentials, videoTitle, videoUrl, summaryMarkdown);
    return res.json(result);
  } catch (error: any) {
    console.error('[Notion Export] Failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'حدث خطأ غير متوقع أثناء التصدير لـ Notion.'
    });
  }
});

/**
 * POST /api/document/refine
 * تحسين ملخص بالذكاء الاصطناعي للتصدير الاحترافي
 */
router.post('/document/refine', async (req: Request, res: Response): Promise<any> => {
  const { summaryMarkdown, videoTitle, userId, mode } = req.body;

  if (!summaryMarkdown) {
    return res.status(400).json({ success: false, error: 'محتوى الملخص مطلوب للتحسين.' });
  }

  let apiKey = process.env.GEMINI_API_KEY;

  // Check user's custom API key
  if (userId && userId !== 'anonymous') {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.geminiApiKey?.trim()) {
          apiKey = userData.geminiApiKey.trim();
        }
      }
    } catch (keyErr) {
      console.warn('[API Key] Failed to fetch user config:', keyErr);
    }
  }

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'مفتاح Gemini API غير مهيأ على الخادم.'
    });
  }

  try {
    console.log(`[Document Refine] Refining "${videoTitle}" with mode: ${mode}`);

    const aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    let systemPrompt = '';
    if (mode === 'concise_text') {
      systemPrompt = `أنت خبير محترف في التلخيص الأكاديمي السلس وهيكلة الملاحظات الدراسية المباشرة والواضحة باللغة العربية الفصحى.
قم بإعادة صياغة وتنظيم وهيكلة الملخص التالي ليكون ملخصاً دراسياً مكثفاً ومبسطاً للغاية ومنظماً في شكل فقرات قصيرة وقوائم منقطة واضحة ومباشرة.

الملخص المراد تنسيقه:
"""
${summaryMarkdown}
"""

المتطلبات الإلزامية:
1. لا تستخدم الجداول أبداً. النص فقط.
2. استخدم العناوين بوضوح (#, ##, ###).
3. صياغة مباشرة بدون مقدمات أو خواتيم.
4. حافظ على القيمة التعليمية كاملة بطريقة مبسطة.`;
    } else {
      systemPrompt = `أنت خبير في التنسيق الأكاديمي وتصميم المستندات الاحترافية.
قم بإعادة صياغة وتنسيق الملخص التالي ليكون ملخصاً دراسياً احترافياً صالحاً للتصدير كملف Word أو PDF.

الملخص المراد تنسيقه:
"""
${summaryMarkdown}
"""

المتطلبات الإلزامية:
1. حافظ على القيمة التعليمية كاملة.
2. استخدم العناوين بوضوح (#, ##, ###).
3. حوّل المقارنات والمفاهيم إلى جداول Markdown.
4. صياغة أنيقة بدون عبارات تمهيدية أو ختامية.
5. حافظ على اتساق القوائم والمستويات الفرعية.`;
    }

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: systemPrompt
    });

    return res.json({
      success: true,
      refinedSummary: response.text || summaryMarkdown
    });
  } catch (error: any) {
    console.error('[Document Refine] Failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'حدث خطأ أثناء تحسين المستند.'
    });
  }
});

export default router;
