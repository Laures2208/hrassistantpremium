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

// 1. Đọc các thông số cấu hình Firebase từ biến môi trường Vite (import.meta.env)
const envConfig: FirebaseConfigOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (import.meta.env.VITE_FIREBASE_PROJECT_ID ? `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com` : ""),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (import.meta.env.VITE_FIREBASE_PROJECT_ID ? `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com` : ""),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const firebaseConfig = envConfig;

// Hỗ trợ kiểm tra cấu hình tùy chỉnh đã lưu trong localStorage hoặc từ server
export function getActiveFirebaseConfig(): FirebaseConfigOptions {
  if (envConfig.apiKey && envConfig.projectId) {
    return envConfig;
  }
  try {
    const saved = localStorage.getItem("tro_ly_phap_ly_custom_firebase_config");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.apiKey && parsed?.projectId) {
        return { ...envConfig, ...parsed };
      }
    }
  } catch (e) {
    console.warn("[Firebase] Không thể đọc cấu hình tùy chỉnh:", e);
  }
  return envConfig;
}

const activeConfig = getActiveFirebaseConfig();

// 2. Viết mã kiểm tra an toàn (Graceful Check)
// Nếu phát hiện thiếu các biến môi trường, KHÔNG làm ứng dụng bị sập màn hình trắng (White Screen of Death)
export const isFirebaseConfigured: boolean = Boolean(
  activeConfig.apiKey && activeConfig.projectId && activeConfig.apiKey.trim() !== "" && activeConfig.projectId.trim() !== ""
);

let initializedApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

try {
  if (isFirebaseConfigured && activeConfig.apiKey && activeConfig.projectId) {
    initializedApp = getApps().length === 0 ? initializeApp(activeConfig) : getApp();
    firestoreDb = getFirestore(initializedApp);
    console.log("[Firebase] Khởi tạo kết nối Firebase Firestore thành công!");
  } else {
    console.info("[Firebase] Chưa có thông tin cấu hình Firebase. Ứng dụng chạy ở chế độ dự phòng an toàn (Local Fallback).");
  }
} catch (error) {
  console.warn("[Firebase] Khởi tạo an toàn (tránh sập ứng dụng):", error);
}

export const app = initializedApp;
export const db = firestoreDb;

/**
 * Tái cấu hình hoặc nạp cấu hình mới khi Admin nhập qua giao diện Cài đặt
 */
export function reinitFirebase(newConfig: FirebaseConfigOptions): Firestore | null {
  try {
    if (!newConfig.apiKey || !newConfig.projectId) return null;
    const fbApp = getApps().length === 0 ? initializeApp(newConfig) : getApp();
    firestoreDb = getFirestore(fbApp);
    return firestoreDb;
  } catch (err) {
    console.error("[Firebase] Lỗi khi re-init Firebase:", err);
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
