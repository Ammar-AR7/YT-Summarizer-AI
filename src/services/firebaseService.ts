import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase.js';
import { UserConfig, Summary } from '../types.js';

const USERS_COLLECTION = 'users';
const SUMMARIES_COLLECTION = 'summaries';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function getUserConfig(uid: string): Promise<UserConfig | null> {
  const path = `${USERS_COLLECTION}/${uid}`;
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { uid, ...docSnap.data() } as UserConfig;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function saveUserConfig(uid: string, data: Partial<UserConfig>): Promise<void> {
  const path = `${USERS_COLLECTION}/${uid}`;
  try {
    const response = await fetch('/api/save-user-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, configData: data })
    });
    if (!response.ok) {
      throw new Error(`Server save-user-config failed: ${response.statusText}`);
    }
  } catch (error) {
    console.warn('Backend save-user-config failed, falling back to direct Firestore write:', error);
    try {
      const docRef = doc(db, USERS_COLLECTION, uid);
      await setDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (fallbackError) {
      handleFirestoreError(fallbackError, OperationType.WRITE, path);
    }
  }
}

export async function getPublicSummaries(): Promise<Summary[]> {
  const path = SUMMARIES_COLLECTION;
  try {
    const summariesRef = collection(db, SUMMARIES_COLLECTION);
    const q = query(
      summariesRef,
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const querySnapshot = await getDocs(q);
    const summaries: Summary[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      summaries.push({
        id: doc.id,
        userId: data.userId || '',
        userDisplayName: data.userDisplayName || 'مستخدم مجهول',
        videoUrl: data.videoUrl || '',
        videoId: data.videoId || '',
        videoTitle: data.videoTitle || 'فيديو يوتيوب',
        summaryText: data.summaryText || '',
        isPublic: data.isPublic !== false,
        createdAt: data.createdAt
      });
    });
    return summaries;
  } catch (error) {
    console.warn('Error getting public summaries with orderBy, falling back:', error);
    // If the index doesn't exist yet, we can fall back to querying without order to prevent crashing
    try {
      const summariesRef = collection(db, SUMMARIES_COLLECTION);
      const q = query(summariesRef, where('isPublic', '==', true), limit(20));
      const querySnapshot = await getDocs(q);
      const summaries: Summary[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        summaries.push({
          id: doc.id,
          userId: data.userId || '',
          userDisplayName: data.userDisplayName || 'مستخدم مجهول',
          videoUrl: data.videoUrl || '',
          videoId: data.videoId || '',
          videoTitle: data.videoTitle || 'فيديو يوتيوب',
          summaryText: data.summaryText || '',
          isPublic: data.isPublic !== false,
          createdAt: data.createdAt
        });
      });
      return summaries;
    } catch (fallbackError) {
      handleFirestoreError(fallbackError, OperationType.LIST, path);
      return [];
    }
  }
}

export async function saveSummary(summary: Omit<Summary, 'id' | 'createdAt'>): Promise<string> {
  const path = SUMMARIES_COLLECTION;
  try {
    const summariesRef = collection(db, SUMMARIES_COLLECTION);
    const docRef = await addDoc(summariesRef, {
      ...summary,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function deleteSummary(id: string): Promise<void> {
  const path = `${SUMMARIES_COLLECTION}/${id}`;
  try {
    const docRef = doc(db, SUMMARIES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function updateSummaryText(id: string, newSummaryText: string): Promise<void> {
  const path = `${SUMMARIES_COLLECTION}/${id}`;
  try {
    const docRef = doc(db, SUMMARIES_COLLECTION, id);
    await updateDoc(docRef, {
      summaryText: newSummaryText
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function getSummaryById(id: string): Promise<Summary | null> {
  const path = `${SUMMARIES_COLLECTION}/${id}`;
  try {
    const docRef = doc(db, SUMMARIES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: data.userId || '',
        userDisplayName: data.userDisplayName || 'مستخدم مجهول',
        videoUrl: data.videoUrl || '',
        videoId: data.videoId || '',
        videoTitle: data.videoTitle || 'فيديو يوتيوب',
        summaryText: data.summaryText || '',
        isPublic: data.isPublic !== false,
        createdAt: data.createdAt
      } as Summary;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}


