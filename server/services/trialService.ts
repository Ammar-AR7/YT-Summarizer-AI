/**
 * Trial Service (Server-side) — نظام الفترة التجريبية باستخدام Admin SDK
 * 
 * يتحكم في حد الاستخدام المجاني: ملخص واحد كل 10 دقائق بالمفتاح الافتراضي.
 */
import { db } from '../firebaseAdmin.js';

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

interface TrialRecord {
  lastTrialAt: number;
  trialCount: number;
}

const memoryTrialCache = new Map<string, TrialRecord>();

export interface TrialCheckResult {
  allowed: boolean;
  remainingMinutes?: number;
  error?: string;
  cooldownEndsAt?: number;
}

/**
 * يتحقق ويسجّل استخدام الفترة التجريبية
 */
export async function checkAndRecordTrialUsage(identifier: string): Promise<TrialCheckResult> {
  const cleanId = String(identifier).trim();
  if (!cleanId) return { allowed: true };

  const now = Date.now();

  // 1. Check in-memory cache
  const memRecord = memoryTrialCache.get(cleanId);
  if (memRecord) {
    const elapsed = now - memRecord.lastTrialAt;
    if (memRecord.trialCount >= 1 && elapsed < COOLDOWN_MS) {
      const remainingMins = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
      return {
        allowed: false,
        remainingMinutes: remainingMins,
        cooldownEndsAt: memRecord.lastTrialAt + COOLDOWN_MS,
        error: `⚠️ يُسمح بالتلخيص باستخدام المفتاح الافتراضي مرة واحدة كل 10 دقائق. يرجى الانتظار لمدة ${remainingMins} دقيقة، أو إضافة مفتاح Gemini API الخاص بك في الإعدادات.`
      };
    }
  }

  // 2. Check Firestore
  try {
    const trialRef = db.collection('trial_usage').doc(cleanId);
    const trialSnap = await trialRef.get();

    if (trialSnap.exists) {
      const trialData = trialSnap.data()!;
      const lastTrialAt = trialData.lastTrialAt || 0;
      const trialCount = trialData.trialCount || 1;
      const elapsed = now - lastTrialAt;

      if (trialCount >= 1 && elapsed < COOLDOWN_MS) {
        const remainingMins = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
        memoryTrialCache.set(cleanId, { lastTrialAt, trialCount });
        return {
          allowed: false,
          remainingMinutes: remainingMins,
          cooldownEndsAt: lastTrialAt + COOLDOWN_MS,
          error: `⚠️ يُسمح بالتلخيص باستخدام المفتاح الافتراضي مرة واحدة كل 10 دقائق. يرجى الانتظار لمدة ${remainingMins} دقيقة، أو إضافة مفتاح Gemini API الخاص بك في الإعدادات.`
        };
      }
    }

    // 3. Allowed — record usage
    const existingCount = trialSnap.exists ? (trialSnap.data()!.trialCount || 0) : 0;
    const newCount = existingCount + 1;

    memoryTrialCache.set(cleanId, { lastTrialAt: now, trialCount: newCount });

    await trialRef.set({
      lastTrialAt: now,
      trialCount: newCount,
      updatedAt: new Date()
    }, { merge: true });

    return { allowed: true };
  } catch (err) {
    console.warn('[Trial System] Firestore error:', err);
    memoryTrialCache.set(cleanId, { lastTrialAt: now, trialCount: 1 });
    return { allowed: true };
  }
}

/**
 * جلب حالة الـ cooldown بدون تسجيل محاولة جديدة
 */
export async function getTrialStatus(identifier: string): Promise<TrialCheckResult> {
  const cleanId = String(identifier).trim();
  if (!cleanId) return { allowed: true };

  const now = Date.now();

  const memRecord = memoryTrialCache.get(cleanId);
  if (memRecord) {
    const elapsed = now - memRecord.lastTrialAt;
    if (memRecord.trialCount >= 1 && elapsed < COOLDOWN_MS) {
      return {
        allowed: false,
        remainingMinutes: Math.ceil((COOLDOWN_MS - elapsed) / 60000),
        cooldownEndsAt: memRecord.lastTrialAt + COOLDOWN_MS
      };
    }
  }

  try {
    const trialSnap = await db.collection('trial_usage').doc(cleanId).get();
    if (trialSnap.exists) {
      const data = trialSnap.data()!;
      const lastTrialAt = data.lastTrialAt || 0;
      const elapsed = now - lastTrialAt;
      if ((data.trialCount || 1) >= 1 && elapsed < COOLDOWN_MS) {
        return {
          allowed: false,
          remainingMinutes: Math.ceil((COOLDOWN_MS - elapsed) / 60000),
          cooldownEndsAt: lastTrialAt + COOLDOWN_MS
        };
      }
    }
  } catch (e) {}

  return { allowed: true };
}
