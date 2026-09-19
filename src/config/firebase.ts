import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

export interface FirebaseConfigOptions {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

// Cấu hình Firebase Firestore chính thức của dự án "hrassistantpremium"
export const firebaseConfig: FirebaseConfigOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDj9O-cvmG80sVtej_fi-cspF08eVW8L7s",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "hrassistantpremium.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "hrassistantpremium",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "hrassistantpremium.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "741239358864",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:741239358864:web:2d8d89997459061c59df15",
  measurementId: "G-2JYNDLNXD5",
};

// Hỗ trợ kiểm tra cấu hình tùy chỉnh đã lưu trong localStorage (nếu có)
export function getActiveFirebaseConfig(): FirebaseConfigOptions {
  try {
    const saved = localStorage.getItem("tro_ly_phap_ly_custom_firebase_config");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.apiKey && parsed?.projectId) {
        return { ...firebaseConfig, ...parsed };
      }
    }
  } catch (e) {
    console.warn("[Firebase] Không thể đọc cấu hình tùy chỉnh:", e);
  }
  return firebaseConfig;
}

const activeConfig = getActiveFirebaseConfig();

// Kiểm tra cấu hình sẵn sàng
export const isFirebaseConfigured: boolean = Boolean(
  activeConfig.apiKey && activeConfig.projectId && activeConfig.apiKey.trim() !== "" && activeConfig.projectId.trim() !== ""
);

// Khởi tạo Firebase App
let initializedApp: FirebaseApp;
let firestoreDb: Firestore;

try {
  initializedApp = getApps().length === 0 ? initializeApp(activeConfig) : getApp();
  firestoreDb = getFirestore(initializedApp);
  console.log(`[Firebase] Đã kết nối Firebase Firestore thành công! (Project: ${activeConfig.projectId})`);
} catch (error) {
  console.warn("[Firebase] Khởi tạo an toàn:", error);
  initializedApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  firestoreDb = getFirestore(initializedApp);
}

export const app: FirebaseApp = initializedApp;
export const db: Firestore = firestoreDb;
export default app;

/**
 * Tái cấu hình hoặc nạp cấu hình mới
 */
export function reinitFirebase(newConfig: Partial<FirebaseConfigOptions>): Firestore | null {
  try {
    if (!newConfig.apiKey || !newConfig.projectId) return null;
    const fullConfig = { ...firebaseConfig, ...newConfig };
    const fbApp = getApps().length === 0 ? initializeApp(fullConfig) : getApp();
    firestoreDb = getFirestore(fbApp);
    return firestoreDb;
  } catch (err) {
    console.error("[Firebase] Lỗi khi re-init Firebase:", err);
    return null;
  }
}

export function getFirestoreInstance(): Firestore | null {
  return firestoreDb || db;
}
