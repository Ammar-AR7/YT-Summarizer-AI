import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCkElSWkb-_BErp5AuYPTh3RRPq9M_dkxM",
  authDomain: "gen-lang-client-0329124872.firebaseapp.com",
  projectId: "gen-lang-client-0329124872",
  storageBucket: "gen-lang-client-0329124872.firebasestorage.app",
  messagingSenderId: "403300826320",
  appId: "1:403300826320:web:47d38c1f8c82e3fbd372d5"
};

// Initialize App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific database ID from config
const db = getFirestore(app, "ai-studio-7faca6ee-f502-45b4-85e5-f11d3f96dc46");

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { app, db, auth, googleProvider };
export default app;
