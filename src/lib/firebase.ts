import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Environment variables helper for client & server compatibility
const getEnvVar = (key: string, fallback: string): string => {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string> })?.env;
  if (metaEnv && metaEnv[key]) {
    return metaEnv[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return fallback;
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', "AIzaSyCkElSWkb-_BErp5AuYPTh3RRPq9M_dkxM"),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', "gen-lang-client-0329124872.firebaseapp.com"),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', "gen-lang-client-0329124872"),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', "gen-lang-client-0329124872.firebasestorage.app"),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', "403300826320"),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', "1:403300826320:web:47d38c1f8c82e3fbd372d5")
};

const databaseId = getEnvVar('VITE_FIREBASE_DATABASE_ID', "ai-studio-7faca6ee-f502-45b4-85e5-f11d3f96dc46");

// Initialize App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore (handles default or named database ID)
const db = databaseId && databaseId !== '(default)'
  ? getFirestore(app, databaseId)
  : getFirestore(app);

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { app, db, auth, googleProvider };
export default app;
