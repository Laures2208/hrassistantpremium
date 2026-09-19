import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

export interface FirebaseConfigOptions {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export const firebaseConfig: FirebaseConfigOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (import.meta.env.VITE_FIREBASE_PROJECT_ID ? `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com` : ""),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (import.meta.env.VITE_FIREBASE_PROJECT_ID ? `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com` : ""),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

// Check if custom config was saved via Admin UI or cached locally
export function getActiveFirebaseConfig(): FirebaseConfigOptions {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    return firebaseConfig;
  }
  try {
    const saved = localStorage.getItem('tro_ly_phap_ly_custom_firebase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.apiKey && parsed?.projectId) {
        return { ...firebaseConfig, ...parsed };
      }
    }
  } catch (e) {
    console.warn('[Firebase] Không thể đọc cấu hình tùy chỉnh từ localStorage:', e);
  }
  return firebaseConfig;
}

const activeConfig = getActiveFirebaseConfig();

// Safe initialization - Tránh khởi tạo lặp lại app & tránh crash khi chưa điền env
let initializedApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

try {
  if (activeConfig.apiKey && activeConfig.projectId) {
    initializedApp = getApps().length === 0 ? initializeApp(activeConfig) : getApp();
    firestoreDb = getFirestore(initializedApp);
  }
} catch (error) {
  console.warn("[Firebase] Khởi tạo an toàn (chờ cấu hình API Key hoàn tất):", error);
}

export const app = initializedApp;
export const db = firestoreDb;

/**
 * Tái cấu hình hoặc nạp cấu hình mới (ví dụ khi Admin nhập cấu hình qua giao diện hoặc tải từ server)
 */
export function reinitFirebase(newConfig: FirebaseConfigOptions): Firestore | null {
  try {
    if (!newConfig.apiKey || !newConfig.projectId) return null;
    const fbApp = getApps().length === 0 ? initializeApp(newConfig) : getApp();
    firestoreDb = getFirestore(fbApp);
    return firestoreDb;
  } catch (err) {
    console.error('[Firebase] Lỗi khi re-init Firebase với cấu hình mới:', err);
    return null;
  }
}

export function getFirestoreInstance(): Firestore | null {
  if (firestoreDb) return firestoreDb;
  const cfg = getActiveFirebaseConfig();
  if (cfg.apiKey && cfg.projectId) {
    return reinitFirebase(cfg);
  }
  return null;
}
