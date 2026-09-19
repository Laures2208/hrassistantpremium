import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  Firestore,
  query,
  orderBy,
} from 'firebase/firestore';
import { DocumentItem } from '../types';
import { SAMPLE_LABOR_LAWS } from '../data/sampleLaborLaws';

const FIRESTORE_DOCS_COLLECTION = 'documents';
const LOCAL_STORAGE_DOCS_KEY = 'tro_ly_phap_ly_cached_documents';

// Check for config from environment variables or custom config
function getFirebaseConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (apiKey && projectId) {
    return {
      apiKey: apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
      projectId: projectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };
  }

  // Check if there's custom saved config in localStorage
  try {
    const saved = localStorage.getItem('tro_ly_phap_ly_custom_firebase_config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error parsing custom firebase config:', e);
  }

  return null;
}

let firebaseAppInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;

export function getFirestoreDb(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  try {
    const config = getFirebaseConfig();
    if (config && config.projectId && config.apiKey) {
      if (!getApps().length) {
        firebaseAppInstance = initializeApp(config);
      } else {
        firebaseAppInstance = getApp();
      }
      firestoreInstance = getFirestore(firebaseAppInstance);
      return firestoreInstance;
    }
  } catch (err) {
    console.warn('Firebase initialization skipped or failed:', err);
  }
  return null;
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}

/**
 * Load documents once on app boot.
 * 1. Checks Firebase Firestore if configured.
 * 2. If Firestore has docs, returns them.
 * 3. If Firestore has 0 docs or is not configured, checks local cache or returns Sample Data.
 */
export async function fetchInitialDocuments(): Promise<{
  documents: DocumentItem[];
  source: 'firestore' | 'sample' | 'local';
}> {
  const db = getFirestoreDb();

  if (db) {
    try {
      const docsRef = collection(db, FIRESTORE_DOCS_COLLECTION);
      const q = query(docsRef, orderBy('uploadedAt', 'desc'));
      const snapshot = await getDocs(q).catch(async () => {
        // Fallback without orderBy in case index is not built yet
        return await getDocs(docsRef);
      });

      if (!snapshot.empty) {
        const firestoreDocs: DocumentItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          firestoreDocs.push({
            id: docSnap.id,
            name: data.name || 'Tài liệu không tên',
            fileType: data.fileType || 'txt',
            size: data.size || 0,
            uploadedAt: data.uploadedAt || new Date().toISOString(),
            textContent: data.textContent || '',
            category: data.category || 'law',
            summary: data.summary || '',
            source: 'firestore',
          });
        });

        // Cache locally for instant offline availability
        try {
          localStorage.setItem(LOCAL_STORAGE_DOCS_KEY, JSON.stringify(firestoreDocs));
        } catch (storageErr) {
          console.warn('Local storage cache limit:', storageErr);
        }

        return { documents: firestoreDocs, source: 'firestore' };
      }
    } catch (err) {
      console.warn('Error fetching documents from Firestore, using fallback:', err);
    }
  }

  // Check if user has uploaded docs stored locally
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_DOCS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { documents: parsed, source: 'local' };
      }
    }
  } catch (e) {
    console.warn('Could not read cached docs:', e);
  }

  // Default to rich built-in sample legal laws
  return { documents: SAMPLE_LABOR_LAWS, source: 'sample' };
}

/**
 * Save or update document to Firebase Firestore (and local state fallback)
 */
export async function saveDocumentToFirestore(document: DocumentItem): Promise<boolean> {
  const db = getFirestoreDb();
  if (db) {
    try {
      const docRef = doc(db, FIRESTORE_DOCS_COLLECTION, document.id);
      await setDoc(docRef, {
        id: document.id,
        name: document.name,
        fileType: document.fileType,
        size: document.size,
        uploadedAt: document.uploadedAt,
        textContent: document.textContent,
        category: document.category || 'regulation',
        summary: document.summary || '',
      });
      return true;
    } catch (err) {
      console.error('Error saving document to Firestore:', err);
    }
  }
  return false;
}

/**
 * Delete document from Firebase Firestore
 */
export async function deleteDocumentFromFirestore(docId: string): Promise<boolean> {
  const db = getFirestoreDb();
  if (db) {
    try {
      const docRef = doc(db, FIRESTORE_DOCS_COLLECTION, docId);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.error('Error deleting document from Firestore:', err);
    }
  }
  return false;
}

/**
 * Save custom Firebase Config in localStorage
 */
export function saveCustomFirebaseConfig(config: any): void {
  try {
    localStorage.setItem('tro_ly_phap_ly_custom_firebase_config', JSON.stringify(config));
    firestoreInstance = null; // reset instance so it re-inits
  } catch (e) {
    console.error('Error saving firebase config:', e);
  }
}
