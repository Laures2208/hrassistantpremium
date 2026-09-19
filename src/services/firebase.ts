import {
  getGlobalSettings,
  updateGlobalSettings,
  updateAdminPasswordOnCloud,
  getDocuments,
  addDocument,
  deleteDocument,
  getDb,
  checkFirebaseConfigured,
  DEFAULT_ADMIN_PASSWORD,
  LOCAL_STORAGE_DOCS_KEY,
  LOCAL_STORAGE_ADMIN_PW_KEY,
  GlobalConfigDoc,
} from './firestoreService';
import { reinitFirebase, FirebaseConfigOptions, isFirebaseConfigured } from '../config/firebase';
import { DocumentItem } from '../types';

export {
  getGlobalSettings,
  updateGlobalSettings,
  updateAdminPasswordOnCloud,
  getDocuments,
  addDocument,
  deleteDocument,
  DEFAULT_ADMIN_PASSWORD,
  LOCAL_STORAGE_DOCS_KEY,
  LOCAL_STORAGE_ADMIN_PW_KEY,
  isFirebaseConfigured,
};

export type { GlobalConfigDoc };

export function isFirebaseActive(): boolean {
  return checkFirebaseConfigured();
}

/**
 * Xác thực Mật khẩu Admin qua Firestore Cloud
 */
export async function verifyAdminPassword(inputPassword: string): Promise<boolean> {
  const cleanInput = inputPassword.trim();
  if (!cleanInput) return false;

  // 1. Mật khẩu mặc định hệ thống '123456' luôn luôn hợp lệ (Khóa cứu hộ Master)
  if (cleanInput === DEFAULT_ADMIN_PASSWORD || cleanInput === '123456') {
    return true;
  }

  // 2. Kiểm tra mật khẩu mới nhất từ Firestore settings/global_config
  try {
    const settings = await getGlobalSettings();
    const remotePassword = (settings?.adminPassword || '').trim();
    if (remotePassword && cleanInput === remotePassword) return true;
  } catch (err) {
    console.warn('[Auth] Lỗi xác thực với Cloud, dùng bộ nhớ dự phòng:', err);
  }

  // 3. Kiểm tra các khóa bộ nhớ LocalStorage
  const cached =
    localStorage.getItem("admin_password") ||
    localStorage.getItem(LOCAL_STORAGE_ADMIN_PW_KEY) ||
    import.meta.env.VITE_ADMIN_PASSWORD ||
    DEFAULT_ADMIN_PASSWORD;

  return cleanInput === cached.trim();
}

/**
 * Tương thích ngược: getGlobalAdminSettings
 */
export async function getGlobalAdminSettings(): Promise<GlobalConfigDoc> {
  return getGlobalSettings();
}

/**
 * Tương thích ngược: updateGlobalAdminPassword
 */
export async function updateGlobalAdminPassword(newPassword: string): Promise<boolean> {
  return updateGlobalSettings({ adminPassword: newPassword });
}

/**
 * Tương thích ngược: fetchInitialDocuments
 */
export async function fetchInitialDocuments(): Promise<{
  documents: DocumentItem[];
  source: 'firestore' | 'sample' | 'local';
}> {
  return getDocuments();
}

/**
 * Tương thích ngược: saveDocumentToFirestore
 */
export async function saveDocumentToFirestore(document: DocumentItem): Promise<boolean> {
  return addDocument(document);
}

/**
 * Tương thích ngược: deleteDocumentFromFirestore
 */
export async function deleteDocumentFromFirestore(docId: string): Promise<boolean> {
  return deleteDocument(docId);
}

/**
 * Lưu cấu hình Firebase tùy chỉnh vào localStorage và đồng bộ lên server
 */
export function saveCustomFirebaseConfig(config: FirebaseConfigOptions): void {
  try {
    localStorage.setItem('tro_ly_phap_ly_custom_firebase_config', JSON.stringify(config));
    reinitFirebase(config);

    // Đồng bộ lên server để mọi máy khác truy cập trang web đều nhận được cấu hình này
    fetch('/api/firebase-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }).catch((e) => {
      console.warn('[Server] Không thể lưu cấu hình Firebase lên server:', e);
    });
  } catch (e) {
    console.error('Error saving firebase config:', e);
  }
}
