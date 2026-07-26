/**
 * Firebase Admin SDK — Server-side Initialization
 * 
 * يتجاوز قواعد أمان Firestore تلقائياً (يعمل بصلاحيات Admin كاملة).
 * يُستخدم حصراً في جانب الخادم (Express routes, Telegram bot, Trial system).
 * الـ Client SDK في src/lib/firebase.ts يظل للواجهة الأمامية فقط.
 */
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const DATABASE_ID = process.env.FIREBASE_DATABASE_ID
  || process.env.VITE_FIREBASE_DATABASE_ID
  || 'ai-studio-7faca6ee-f502-45b4-85e5-f11d3f96dc46';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID
  || process.env.VITE_FIREBASE_PROJECT_ID
  || 'gen-lang-client-0329124872';

/**
 * Initialize Firebase Admin app (singleton pattern — only initializes once)
 */
function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Option 1: Service Account JSON string in environment variable (recommended for Render/Cloud)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('[Firebase Admin] Initialized with service account credentials.');
      return initializeApp({
        credential: cert(serviceAccount),
        projectId: PROJECT_ID
      });
    } catch (err) {
      console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', err);
    }
  }

  // Option 2: GOOGLE_APPLICATION_CREDENTIALS file path (standard Google Cloud pattern)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('[Firebase Admin] Initialized with GOOGLE_APPLICATION_CREDENTIALS file.');
    return initializeApp({ projectId: PROJECT_ID });
  }

  // Option 3: Standard fallback with explicit Project ID (prevents 'Unable to detect Project Id' error on Vercel)
  console.log(`[Firebase Admin] Initializing with Project ID: ${PROJECT_ID}`);
  return initializeApp({ projectId: PROJECT_ID });
}

const adminApp = getAdminApp();

/**
 * Get Firestore instance for the named database.
 * Uses getFirestore(app, databaseId) pattern for named databases.
 */
const db: Firestore = (DATABASE_ID && DATABASE_ID !== '(default)')
  ? getFirestore(adminApp, DATABASE_ID)
  : getFirestore(adminApp);

export { db, adminApp, FieldValue, Timestamp };
export default db;
