import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes cooldown

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
 * Checks and records trial usage for users without a custom Gemini API key.
 * Grants 1 free summary using the default key, followed by a 10-minute cooldown or requiring account setup / key configuration.
 */
export async function checkAndRecordTrialUsage(identifier: string): Promise<TrialCheckResult> {
  const cleanId = String(identifier).trim();
  if (!cleanId) {
    return { allowed: true };
  }

  const now = Date.now();

  // 1. Check in-memory cache first for instant response
  const memRecord = memoryTrialCache.get(cleanId);
  if (memRecord) {
    const elapsed = now - memRecord.lastTrialAt;
    if (memRecord.trialCount >= 1 && elapsed < COOLDOWN_MS) {
      const remainingMins = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
      return {
        allowed: false,
        remainingMinutes: remainingMins,
        cooldownEndsAt: memRecord.lastTrialAt + COOLDOWN_MS,
        error: `⚠️ يُسمح بالتلخيص باستخدام المفتاح الافتراضي مرة واحدة كل 10 دقائق. يرجى الانتظار لمدة ${remainingMins} دقيقة للطلب التالي، أو إضافة مفتاح Gemini API الخاص بك في الإعدادات لاستخدام التلخيص المباشر بدون أي قيود أو انتظار.`
      };
    }
  }

  // 2. Query Firestore for persistent store across server reboots
  try {
    const trialRef = doc(db, 'trial_usage', cleanId);
    const trialSnap = await getDoc(trialRef);

    if (trialSnap.exists()) {
      const trialData = trialSnap.data();
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
          error: `⚠️ يُسمح بالتلخيص باستخدام المفتاح الافتراضي مرة واحدة كل 10 دقائق. يرجى الانتظار لمدة ${remainingMins} دقيقة للطلب التالي، أو إضافة مفتاح Gemini API الخاص بك في الإعدادات لاستخدام التلخيص المباشر بدون أي قيود أو انتظار.`
        };
      }
    }

    // 3. Allowed: record new trial summary timestamp and count
    const existingCount = trialSnap?.exists() ? (trialSnap.data().trialCount || 0) : 0;
    const newCount = existingCount + 1;

    memoryTrialCache.set(cleanId, { lastTrialAt: now, trialCount: newCount });

    await setDoc(trialRef, {
      lastTrialAt: now,
      trialCount: newCount,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { allowed: true };
  } catch (err) {
    console.warn('[Trial System] Firestore store update note:', err);
    memoryTrialCache.set(cleanId, { lastTrialAt: now, trialCount: 1 });
    return { allowed: true };
  }
}

/**
 * Retrieves trial cooldown status without recording a new attempt.
 */
export async function getTrialStatus(identifier: string): Promise<TrialCheckResult> {
  const cleanId = String(identifier).trim();
  if (!cleanId) return { allowed: true };

  const now = Date.now();

  const memRecord = memoryTrialCache.get(cleanId);
  if (memRecord) {
    const elapsed = now - memRecord.lastTrialAt;
    if (memRecord.trialCount >= 1 && elapsed < COOLDOWN_MS) {
      const remainingMins = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
      return {
        allowed: false,
        remainingMinutes: remainingMins,
        cooldownEndsAt: memRecord.lastTrialAt + COOLDOWN_MS
      };
    }
  }

  try {
    const trialRef = doc(db, 'trial_usage', cleanId);
    const trialSnap = await getDoc(trialRef);

    if (trialSnap.exists()) {
      const trialData = trialSnap.data();
      const lastTrialAt = trialData.lastTrialAt || 0;
      const trialCount = trialData.trialCount || 1;
      const elapsed = now - lastTrialAt;

      if (trialCount >= 1 && elapsed < COOLDOWN_MS) {
        const remainingMins = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
        return {
          allowed: false,
          remainingMinutes: remainingMins,
          cooldownEndsAt: lastTrialAt + COOLDOWN_MS
        };
      }
    }
  } catch (e) {}

  return { allowed: true };
}

export function clearMemoryTrialCacheForTesting(): void {
  memoryTrialCache.clear();
}
