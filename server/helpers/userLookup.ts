/**
 * User Lookup Helpers — البحث عن المستخدمين في Firestore
 */
import { db } from '../firebaseAdmin.js';

/**
 * البحث عن مستخدم بمعرّف تلغرام أو البريد الإلكتروني
 */
export async function findUserByTelegramOrEmail(
  identifier: string
): Promise<{ userId: string; userData: any } | null> {
  try {
    // Search by telegramId
    const telegramQuery = db.collection('users').where('telegramId', '==', identifier);
    const telegramSnap = await telegramQuery.get();
    if (!telegramSnap.empty) {
      const doc = telegramSnap.docs[0];
      return { userId: doc.id, userData: doc.data() };
    }

    // Search by email
    const emailQuery = db.collection('users').where('email', '==', identifier);
    const emailSnap = await emailQuery.get();
    if (!emailSnap.empty) {
      const doc = emailSnap.docs[0];
      return { userId: doc.id, userData: doc.data() };
    }

    // Search by telegram username (stored as @username)
    if (!identifier.startsWith('@')) {
      const usernameQuery = db.collection('users').where('telegramId', '==', `@${identifier}`);
      const usernameSnap = await usernameQuery.get();
      if (!usernameSnap.empty) {
        const doc = usernameSnap.docs[0];
        return { userId: doc.id, userData: doc.data() };
      }
    }

    return null;
  } catch (err) {
    console.error('[User Lookup] Error finding user:', err);
    return null;
  }
}

/**
 * جلب بيانات مستخدم بالمعرّف المباشر (userId)
 */
export async function getUserById(userId: string): Promise<any | null> {
  try {
    const doc = await db.collection('users').doc(userId).get();
    if (doc.exists) {
      return { userId: doc.id, ...doc.data() };
    }
    return null;
  } catch (err) {
    console.error('[User Lookup] Error getting user by ID:', err);
    return null;
  }
}

/**
 * حفظ أو تحديث إعدادات المستخدم
 */
export async function saveUserConfig(userId: string, configData: any): Promise<boolean> {
  try {
    await db.collection('users').doc(userId).set({
      ...configData,
      updatedAt: new Date()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[User Lookup] Error saving user config:', err);
    return false;
  }
}
