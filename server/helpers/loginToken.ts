/**
 * Login Token Helpers — إنشاء والتحقق من رموز الدخول عبر تلغرام
 */
import * as crypto from 'crypto';
import { db } from '../firebaseAdmin.js';

/**
 * إنشاء رمز دخول جديد صالح لمدة 15 دقيقة
 */
export async function createLoginToken(userId: string): Promise<string> {
  const tokenId = crypto.randomUUID();
  try {
    await db.collection('login_tokens').doc(tokenId).set({
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });
    console.log(`[Login Token] Created for user ${userId}: ${tokenId}`);
  } catch (err) {
    console.error('[Login Token] Failed to store in Firestore:', err);
  }
  return tokenId;
}

/**
 * التحقق من رمز دخول واسترجاع بيانات المستخدم
 */
export async function verifyLoginToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  userData?: any;
  error?: string;
  httpStatus?: number;
}> {
  try {
    const tokenDoc = await db.collection('login_tokens').doc(token).get();
    if (!tokenDoc.exists) {
      return { valid: false, error: 'رمز الدخول غير صالح أو انتهت صلاحيته.', httpStatus: 404 };
    }

    const tokenData = tokenDoc.data();
    if (!tokenData) {
      return { valid: false, error: 'بيانات الرمز مفقودة.', httpStatus: 404 };
    }

    // Check expiration
    let isExpired = false;
    if (tokenData.expiresAt) {
      let expireTime = 0;
      if (tokenData.expiresAt.toDate) {
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
      await db.collection('login_tokens').doc(token).delete();
      return { valid: false, error: 'انتهت صلاحية رمز الدخول. يرجى طلب رابط جديد من البوت.', httpStatus: 410 };
    }

    const userId = tokenData.userId;

    // Fetch user profile
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    return {
      valid: true,
      userId,
      userData: {
        email: userData?.email || '',
        displayName: userData?.displayName || 'مستخدم تلغرام',
        telegramId: userData?.telegramId || '',
        geminiApiKey: userData?.geminiApiKey || '',
        notionCredentials: userData?.notionCredentials || null
      }
    };
  } catch (err: any) {
    console.error('[Login Token] Verification error:', err);
    return { valid: false, error: err.message || 'حدث خطأ في الخادم.', httpStatus: 500 };
  }
}
