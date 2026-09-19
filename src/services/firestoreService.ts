import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  Firestore,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, getFirestoreInstance, isFirebaseConfigured, getActiveFirebaseConfig, reinitFirebase } from '../config/firebase';
import { DocumentItem } from '../types';
import { SAMPLE_LABOR_LAWS } from '../data/sampleLaborLaws';

export const FIRESTORE_DOCS_COLLECTION = 'documents';
export const FIRESTORE_SETTINGS_COLLECTION = 'settings';
export const FIRESTORE_SETTINGS_DOC = 'global_config';
export const DEFAULT_ADMIN_PASSWORD = '123456';
export const LOCAL_STORAGE_DOCS_KEY = 'SAVED_DOCUMENTS';
export const LOCAL_STORAGE_ADMIN_PW_KEY = 'tro_ly_phap_ly_custom_admin_password';

export interface GlobalConfigDoc {
  adminPassword: string;
  updated_at?: string;
  [key: string]: any;
}

export function getDb(): Firestore | null {
  return db || getFirestoreInstance();
}

/**
 * Kiểm tra trạng thái cấu hình Firebase Firestore
 */
export function checkFirebaseConfigured(): boolean {
  if (isFirebaseConfigured) return true;
  const cfg = getActiveFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.projectId);
}

// =========================================================================
// 1. QUẢN LÝ CÀI ĐẶT & MẬT KHẨU ADMIN (SETTINGS / GLOBAL_CONFIG)
// =========================================================================

/**
 * getGlobalSettings: Lấy Mật khẩu Admin và cấu hình chung từ Firestore Cloud
 * - Đọc document settings/global_config từ Firestore về.
 * - Lấy adminPassword trên Firestore.
 * - (Fallback): Nếu Firestore chưa có document này, tự động tạo mới với giá trị mặc định ('123456').
 */
export async function getGlobalSettings(): Promise<GlobalConfigDoc> {
  const activeDb = getDb();

  if (activeDb) {
    try {
      const configRef = doc(activeDb, FIRESTORE_SETTINGS_COLLECTION, FIRESTORE_SETTINGS_DOC);
      const snapshot = await getDoc(configRef);

      if (snapshot.exists()) {
        const data = snapshot.data() as GlobalConfigDoc;
        const password = data.adminPassword || DEFAULT_ADMIN_PASSWORD;
        console.log('[Firestore] Đã nạp settings/global_config từ Cloud:', data);
        try {
          localStorage.setItem(LOCAL_STORAGE_ADMIN_PW_KEY, password);
        } catch (_) {}
        return {
          ...data,
          adminPassword: password,
          updated_at: data.updated_at || new Date().toISOString(),
        };
      } else {
        // Document chưa tồn tại -> Tự động khởi tạo lên Firestore với mật khẩu mặc định '123456'
        console.log('[Firestore] settings/global_config chưa tồn tại. Đang tự động tạo mới document...');
        const initialConfig: GlobalConfigDoc = {
          adminPassword: DEFAULT_ADMIN_PASSWORD,
          updated_at: new Date().toISOString(),
        };
        await setDoc(configRef, initialConfig);
        try {
          localStorage.setItem(LOCAL_STORAGE_ADMIN_PW_KEY, DEFAULT_ADMIN_PASSWORD);
        } catch (_) {}
        return initialConfig;
      }
    } catch (err) {
      console.warn('[Firestore] Lỗi truy vấn settings/global_config:', err);
    }
  }

  // Nguồn dự phòng 1: Server API
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const serverSettings = await res.json();
      if (serverSettings?.adminPassword) {
        return {
          adminPassword: serverSettings.adminPassword,
          updated_at: serverSettings.updated_at,
        };
      }
    }
  } catch (_) {}

  // Nguồn dự phòng 2: LocalStorage / Mặc định 123456
  const cachedPw =
    localStorage.getItem(LOCAL_STORAGE_ADMIN_PW_KEY) ||
    import.meta.env.VITE_ADMIN_PASSWORD ||
    DEFAULT_ADMIN_PASSWORD;

  return {
    adminPassword: cachedPw,
    updated_at: new Date().toISOString(),
  };
}

/**
 * updateGlobalSettings: Cập nhật Mật khẩu Admin mới và Cài đặt lên Cloud
 */
export async function updateGlobalSettings(settingsData: Partial<GlobalConfigDoc>): Promise<boolean> {
  const cleanPassword = (settingsData.adminPassword || '').trim();
  const payload: GlobalConfigDoc = {
    adminPassword: cleanPassword || DEFAULT_ADMIN_PASSWORD,
    updated_at: new Date().toISOString(),
    ...settingsData,
  };

  let savedToFirestore = false;
  const activeDb = getDb();

  if (activeDb) {
    try {
      const configRef = doc(activeDb, FIRESTORE_SETTINGS_COLLECTION, FIRESTORE_SETTINGS_DOC);
      await setDoc(configRef, payload, { merge: true });
      console.log('[Firestore] Đã cập nhật settings/global_config lên Cloud thành công!');
      savedToFirestore = true;
    } catch (err) {
      console.error('[Firestore] Lỗi ghi settings/global_config lên Firestore:', err);
    }
  }

  // Cập nhật bộ nhớ tạm localStorage
  if (cleanPassword) {
    try {
      localStorage.setItem(LOCAL_STORAGE_ADMIN_PW_KEY, cleanPassword);
    } catch (_) {}
  }

  // Đồng bộ lên server backup
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (_) {}

  return savedToFirestore;
}

// =========================================================================
// 2. QUẢN LÝ TÀI LIỆU (COLLECTION "DOCUMENTS")
// =========================================================================

/**
 * getDocuments: Lấy toàn bộ danh sách file do Admin tải lên từ Firestore Cloud
 * - Hoạt động trên mọi thiết bị (kể cả khi chưa đăng nhập Admin).
 * - Nếu Firestore có ít nhất 1 tài liệu do Admin tải lên, hệ thống chuyển sang dùng tài liệu thật.
 */
export async function getDocuments(): Promise<{
  documents: DocumentItem[];
  source: 'firestore' | 'sample' | 'local';
}> {
  const activeDb = getDb();

  // 1. Truy vấn trực tiếp từ Firebase Firestore collection "documents"
  if (activeDb) {
    try {
      console.log('[Firestore] Đang tải danh sách tài liệu từ collection "documents"...');
      const docsRef = collection(activeDb, FIRESTORE_DOCS_COLLECTION);

      let snapshot;
      try {
        const q = query(docsRef, orderBy('uploadedAt', 'desc'));
        snapshot = await getDocs(q);
      } catch (orderErr) {
        snapshot = await getDocs(docsRef);
      }

      if (!snapshot.empty) {
        const cloudDocs: DocumentItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          cloudDocs.push({
            id: docSnap.id,
            name: data.name || 'Tài liệu không tên',
            fileType: data.fileType || 'txt',
            size: Number(data.size) || 0,
            uploadedAt: data.uploadedAt || new Date().toISOString(),
            textContent: data.textContent || '',
            category: data.category || 'law',
            summary: data.summary || '',
            source: 'firestore',
          });
        });

        if (cloudDocs.length > 0) {
          console.log(`[Firestore] Đã nạp ${cloudDocs.length} tài liệu từ Cloud. Xóa bỏ dữ liệu mẫu.`);
          try {
            localStorage.setItem(LOCAL_STORAGE_DOCS_KEY, JSON.stringify(cloudDocs));
          } catch (_) {}
          return { documents: cloudDocs, source: 'firestore' };
        }
      } else {
        console.log('[Firestore] Collection "documents" chưa có tài liệu nào.');
      }
    } catch (err) {
      console.warn('[Firestore] Lỗi đọc collection "documents":', err);
    }
  }

  // 2. Dự phòng Server Backup
  try {
    const res = await fetch('/api/documents');
    if (res.ok) {
      const serverDocs = await res.json();
      if (Array.isArray(serverDocs) && serverDocs.length > 0) {
        return { documents: serverDocs, source: 'firestore' };
      }
    }
  } catch (_) {}

  // 3. Dự phòng LocalStorage Cache
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_DOCS_KEY);
    if (cached) {
      const parsed: DocumentItem[] = JSON.parse(cached);
      const userDocs = parsed.filter((d) => d.source !== 'sample');
      if (userDocs.length > 0) {
        return { documents: userDocs, source: 'local' };
      }
    }
  } catch (_) {}

  // 4. Mặc định: Dữ liệu mẫu Bộ luật Lao động
  return { documents: SAMPLE_LABOR_LAWS, source: 'sample' };
}

/**
 * addDocument: Thêm tài liệu mới vào Firestore Cloud
 */
export async function addDocument(docData: DocumentItem): Promise<boolean> {
  let success = false;
  const activeDb = getDb();

  if (activeDb) {
    try {
      const docRef = doc(activeDb, FIRESTORE_DOCS_COLLECTION, docData.id);
      await setDoc(docRef, {
        id: docData.id,
        name: docData.name,
        fileType: docData.fileType,
        size: docData.size,
        uploadedAt: docData.uploadedAt,
        textContent: docData.textContent,
        category: docData.category || 'regulation',
        summary: docData.summary || '',
      });
      console.log(`[Firestore] Đã thêm tài liệu "${docData.name}" vào collection "documents".`);
      success = true;
    } catch (err) {
      console.error('[Firestore] Lỗi thêm tài liệu:', err);
    }
  }

  // Đồng bộ sang server backup
  try {
    await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docData),
    });
  } catch (_) {}

  return success;
}

/**
 * deleteDocument: Xóa tài liệu khỏi Firestore Cloud
 */
export async function deleteDocument(docId: string): Promise<boolean> {
  let success = false;
  const activeDb = getDb();

  if (activeDb) {
    try {
      const docRef = doc(activeDb, FIRESTORE_DOCS_COLLECTION, docId);
      await deleteDoc(docRef);
      console.log(`[Firestore] Đã xóa tài liệu (ID: ${docId}) khỏi Cloud.`);
      success = true;
    } catch (err) {
      console.error('[Firestore] Lỗi xóa tài liệu khỏi Firestore:', err);
    }
  }

  // Đồng bộ lệnh xóa sang server backup
  try {
    await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
  } catch (_) {}

  return success;
}
