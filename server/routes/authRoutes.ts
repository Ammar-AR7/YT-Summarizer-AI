/**
 * Auth Routes — مسارات المصادقة وإدارة إعدادات المستخدم
 * 
 * POST /api/auth/login-with-token  — تسجيل دخول برمز تلغرام
 * POST /api/save-user-config       — حفظ إعدادات المستخدم
 */
import { Router, Request, Response } from 'express';
import { verifyLoginToken } from '../helpers/loginToken.js';
import { saveUserConfig } from '../helpers/userLookup.js';

const router = Router();

/**
 * POST /api/auth/login-with-token
 * التحقق من رمز الدخول المؤقت (من بوت تلغرام) واسترجاع بيانات المستخدم
 */
router.post('/auth/login-with-token', async (req: Request, res: Response): Promise<any> => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: 'الرمز (Token) مطلوب.' });
  }

  const result = await verifyLoginToken(token);

  if (!result.valid) {
    return res.status(result.httpStatus || 400).json({
      success: false,
      error: result.error
    });
  }

  return res.json({
    success: true,
    userId: result.userId,
    userData: result.userData,
    firebaseCustomToken: null
  });
});

/**
 * POST /api/save-user-config
 * حفظ إعدادات المستخدم (Notion credentials, Gemini API key, etc.)
 */
router.post('/save-user-config', async (req: Request, res: Response): Promise<any> => {
  const { userId, configData } = req.body;
  if (!userId || !configData) {
    return res.status(400).json({ success: false, error: 'معرّف المستخدم أو البيانات مفقودة.' });
  }

  try {
    const success = await saveUserConfig(userId, configData);
    if (success) {
      console.log(`[Save Config] Saved for user ${userId}`);
      return res.json({ success: true });
    } else {
      return res.status(500).json({ success: false, error: 'فشل حفظ الإعدادات.' });
    }
  } catch (err: any) {
    console.error('[Save Config] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/check
 * فحص هل المستخدم الحالي أدمن (بناءً على متغير ADMIN_EMAILS)
 */
router.get('/admin/check', async (req: Request, res: Response): Promise<any> => {
  const userEmail = req.query.email as string;
  const userId = req.query.userId as string;
  
  if (!userEmail && !userId) {
    return res.json({ isAdmin: false });
  }

  const adminEmailsEnv = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsEnv.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  
  const isAdmin = !!(userEmail && adminEmails.includes(userEmail.toLowerCase()));

  return res.json({ isAdmin });
});

export default router;
