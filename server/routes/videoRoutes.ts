/**
 * Video Routes — مسارات معالجة وجلب الملخصات
 * 
 * POST /api/process-video  — بدء تلخيص فيديو (متزامن)
 * GET  /api/summary/:id     — جلب ملخص بالمعرّف
 */
import { Router, Request, Response } from 'express';
import { db } from '../firebaseAdmin.js';
import { summarizeVideoWithGemini } from '../../src/services/geminiService.js';
import { summarizeLimiter } from '../middleware/rateLimiter.js';
import { videoTaskQueue } from '../services/taskQueue.js';

const router = Router();

/**
 * POST /api/process-video
 * معالجة متزامنة — ينتظر اكتمال التلخيص قبل الرد
 * (يحل مشكلة Background Processing على Vercel Serverless)
 */
router.post('/process-video', summarizeLimiter, async (req: Request, res: Response): Promise<any> => {
  const { videoUrl, isPublic, userId, userDisplayName, language, geminiApiKey: clientProvidedApiKey } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ success: false, error: 'رابط الفيديو مطلوب.' });
  }

  // Validate YouTube URL
  const isYoutube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
  if (!isYoutube) {
    return res.status(400).json({ success: false, error: 'رابط الفيديو غير صالح. يجب أن يكون رابط فيديو يوتيوب.' });
  }

  let apiKey = process.env.GEMINI_API_KEY;
  let hasCustomApiKey = false;

  // 1. Check client-supplied API key
  if (clientProvidedApiKey && typeof clientProvidedApiKey === 'string' && clientProvidedApiKey.trim().length > 0) {
    apiKey = clientProvidedApiKey.trim();
    hasCustomApiKey = true;
    console.log(`[API Key] Using custom key from request for user: ${userId || 'anonymous'}`);
  } else if (userId && userId !== 'anonymous') {
    // 2. Check user's stored API key in Firestore
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.geminiApiKey?.trim()) {
          apiKey = userData.geminiApiKey.trim();
          hasCustomApiKey = true;
          console.log(`[API Key] Using custom key from Firestore for user: ${userId}`);
        }
      }
    } catch (keyErr) {
      console.warn('[API Key] Failed to fetch user config:', keyErr);
    }
  }

  // Trial system: limit free usage of default server key
  if (!hasCustomApiKey) {
    const { checkAndRecordTrialUsage } = await import('../services/trialService.js');
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
    console.log(`[Process Video] Enqueuing processing task for: ${videoUrl}`);

    // Enqueue summarization task in task queue
    const result = await videoTaskQueue.enqueue(async () => {
      return summarizeVideoWithGemini(videoUrl, apiKey, language || 'ar', userId);
    }, `web_${userId || 'anon'}_${Date.now()}`);

    // Save completed summary to Firestore
    const summaryData = {
      userId: userId || 'anonymous',
      userDisplayName: userDisplayName || 'مستخدم مجهول',
      videoUrl,
      videoId: result.videoId,
      videoTitle: result.videoTitle,
      summaryText: result.summary,
      language: language || 'ar',
      status: 'completed',
      isPublic: isPublic !== false,
      createdAt: new Date()
    };

    const docRef = await db.collection('summaries').add(summaryData);
    const documentId = docRef.id;

    console.log(`[Process Video] Completed summary ${documentId}`);

    return res.json({
      success: true,
      summaryId: documentId,
      documentId: documentId,
      status: 'completed',
      summary: result.summary,
      videoTitle: result.videoTitle,
      videoId: result.videoId
    });
  } catch (error: any) {
    console.error('[Process Video] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'فشل معالجة الفيديو وتوليد الملخص.'
    });
  }
});

/**
 * GET /api/summary/:id
 * جلب ملخص بالمعرّف (للتوافق مع polling القديم وعرض الملخصات المحفوظة)
 */
router.get('/summary/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, error: 'المعرف مطلوب.' });

  try {
    const summaryDoc = await db.collection('summaries').doc(id).get();
    if (!summaryDoc.exists) {
      return res.status(404).json({ success: false, error: 'الملخص غير موجود.' });
    }

    const data = summaryDoc.data()!;
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

/**
 * POST /api/summary/delete
 * حذف ملخص عبر Admin SDK (يتجاوز قيود Firestore Client Rules للأدمن ولصاحب الملخص)
 */
router.post('/summary/delete', async (req: Request, res: Response): Promise<any> => {
  const { summaryId, userId, userEmail } = req.body;
  if (!summaryId) {
    return res.status(400).json({ success: false, error: 'معرّف الملخص مطلوب.' });
  }

  try {
    const docRef = db.collection('summaries').doc(summaryId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.json({ success: true, message: 'الملخص محذوف بالفعل.' });
    }

    const data = docSnap.data();
    const ownerId = data?.userId;

    // Admin check
    const adminEmailsEnv = process.env.ADMIN_EMAILS || '';
    const adminEmails = adminEmailsEnv.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = !!(userEmail && adminEmails.includes(userEmail.toLowerCase()));

    // Owner check
    const isOwner = !!(userId && ownerId && userId === ownerId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        error: 'غير مسموح لك بحذف هذا الملخص.'
      });
    }

    await docRef.delete();
    console.log(`[Delete Summary] Successfully deleted summary ${summaryId} by ${userEmail || userId || 'Admin'}`);
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Delete Summary Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
