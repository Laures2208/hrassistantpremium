import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  Firestore,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, getFirestoreInstance, getActiveFirebaseConfig, reinitFirebase, FirebaseConfigOptions } from '../config/firebase';
import { DocumentItem } from '../types';
import { SAMPLE_LABOR_LAWS } from '../data/sampleLaborLaws';

export const FIRESTORE_DOCS_COLLECTION = 'documents';
export const LOCAL_STORAGE_DOCS_KEY = 'SAVED_DOCUMENTS';

export function getFirestoreDb(): Firestore | null {
  return db || getFirestoreInstance();
}

export function isFirebaseConfigured(): boolean {
  const cfg = getActiveFirebaseConfig();
  return !!(cfg && cfg.apiKey && cfg.projectId);
}

/**
 * Thử đồng bộ cấu hình Firebase từ máy chủ nếu máy hiện tại chưa có cấu hình trong env hay localStorage
 */
export async function syncFirebaseConfigFromServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/firebase-config');
    if (res.ok) {
      const serverConfig = await res.json();
      if (serverConfig?.apiKey && serverConfig?.projectId) {
        localStorage.setItem('tro_ly_phap_ly_custom_firebase_config', JSON.stringify(serverConfig));
        reinitFirebase(serverConfig);
        console.log('[Firebase] Đã đồng bộ cấu hình Firebase từ máy chủ thành công!');
        return true;
      }
    }
  } catch (err) {
    // Server có thể offline hoặc không có cấu hình lưu trữ
  }
  return false;
}

/**
 * Global Document Fetching (Single Source of Truth: Firebase Firestore).
 * Dù mở ở bất kỳ máy nào, ứng dụng sẽ thực hiện getDocs từ collection "documents".
 *
 * 1. Kiểm tra & kết nối Firebase Firestore.
 * 2. Thực hiện hàm getDocs(collection(db, "documents")) để lấy danh sách tài liệu thực tế từ Firestore.
 * 3. Quy tắc đè dữ liệu mẫu:
 *    - NẾU Firestore có ít nhất 1 file -> XÓA HOÀN TOÀN dữ liệu mẫu (Sample data).
 *    - Trả về 100% tài liệu từ Firestore.
 *    - Đồng bộ cache offline trong localStorage (SAVED_DOCUMENTS).
 * 4. NẾU Firestore chưa kết nối được (hoặc offline):
 *    - Thử lấy dữ liệu sao lưu từ máy chủ (/api/documents).
 *    - Thử đọc cache offline từ localStorage (SAVED_DOCUMENTS).
 * 5. NẾU 0 có tài liệu người dùng ở mọi nguồn -> Mới fallback sang SAMPLE_LABOR_LAWS.
 */
export async function fetchInitialDocuments(): Promise<{
  documents: DocumentItem[];
  source: 'firestore' | 'sample' | 'local';
}> {
  // Nếu chưa có kết nối db, thử tải cấu hình từ server
  if (!getFirestoreDb()) {
    await syncFirebaseConfigFromServer();
  }

  const activeDb = getFirestoreDb();

  // 1. SINGLE SOURCE OF TRUTH: Firebase Firestore
  if (activeDb) {
    try {
      console.log('[Firestore] Đang thực hiện getDocs từ collection "documents" trên Firebase Firestore...');
      const docsRef = collection(activeDb, FIRESTORE_DOCS_COLLECTION);
      
      let snapshot;
      try {
        const q = query(docsRef, orderBy('uploadedAt', 'desc'));
        snapshot = await getDocs(q);
      } catch (orderErr) {
        // Fallback truy vấn trực tiếp không dùng orderBy nếu chưa build index
        snapshot = await getDocs(docsRef);
      }

      if (!snapshot.empty) {
        const firestoreDocs: DocumentItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          firestoreDocs.push({
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

        if (firestoreDocs.length > 0) {
          console.log(`[Firestore] Đã tải thành công ${firestoreDocs.length} tài liệu từ Firestore. XÓA BỎ HOÀN TOÀN dữ liệu mẫu.`);
          
          // Lưu cache offline vào localStorage (chỉ làm cache, không phụ thuộc)
          try {
            localStorage.setItem(LOCAL_STORAGE_DOCS_KEY, JSON.stringify(firestoreDocs));
          } catch (storageErr) {
            console.warn('[Firestore] Cảnh báo dung lượng localStorage:', storageErr);
          }

          // Đồng bộ sao lưu lên server
          syncDocsToServerBackup(firestoreDocs);

          return { documents: firestoreDocs, source: 'firestore' };
        }
      } else {
        console.log('[Firestore] Collection "documents" trên Firestore hiện đang rỗng.');
      }
    } catch (err) {
      console.warn('[Firestore] Lỗi kết nối Firestore, đang kiểm tra nguồn dự phòng:', err);
    }
  } else {
    console.info('[Firestore] Chưa tìm thấy kết nối Firestore trực tiếp.');
  }

  // 2. Server Shared Persistence Fallback (Đồng bộ giữa các máy thông qua server)
  try {
    const serverRes = await fetch('/api/documents');
    if (serverRes.ok) {
      const serverDocs = await serverRes.json();
      if (Array.isArray(serverDocs) && serverDocs.length > 0) {
        console.log(`[Server Shared] Đã tải ${serverDocs.length} tài liệu đồng bộ từ máy chủ.`);
        try {
          localStorage.setItem(LOCAL_STORAGE_DOCS_KEY, JSON.stringify(serverDocs));
        } catch (_) {}
        return { documents: serverDocs, source: 'firestore' };
      }
    }
  } catch (serverErr) {
    // Bỏ qua nếu server API không phản hồi
  }

  // 3. Offline Cache Fallback (localStorage key: SAVED_DOCUMENTS)
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_DOCS_KEY);
    if (cached) {
      const parsed: DocumentItem[] = JSON.parse(cached);
      const userDocs = parsed.filter((d) => d.source !== 'sample');
      if (userDocs.length > 0) {
        console.log(`[Cache Offline] Đã tải ${userDocs.length} tài liệu từ bộ nhớ tạm máy tính.`);
        return { documents: userDocs, source: 'local' };
      }
    }
  } catch (e) {
    console.warn('[Cache Offline] Không thể đọc cache:', e);
  }

  // 4. Nếu hoàn toàn không có tài liệu người dùng nào ở mọi nguồn, dùng dữ liệu mẫu
  console.log('[System] Chưa có tài liệu thực tế nào, hiển thị dữ liệu mẫu pháp lý.');
  return { documents: SAMPLE_LABOR_LAWS, source: 'sample' };
}

/**
 * Lưu hoặc cập nhật tài liệu lên Firebase Firestore
 */
export async function saveDocumentToFirestore(document: DocumentItem): Promise<boolean> {
  let savedToFirestore = false;
  const activeDb = getFirestoreDb();

  if (activeDb) {
    try {
      const docRef = doc(activeDb, FIRESTORE_DOCS_COLLECTION, document.id);
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
      console.log(`[Firestore] Đã lưu tài liệu "${document.name}" lên Firestore thành công.`);
      savedToFirestore = true;
    } catch (err) {
      console.error('[Firestore] Lỗi khi lưu tài liệu lên Firestore:', err);
    }
  }

  // Luôn đồng bộ sang server backup để các máy khác truy cập ngay lập tức
  try {
    await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(document),
    });
  } catch (e) {
    console.warn('[Server] Không thể đồng bộ tài liệu lên server backup:', e);
  }

  return savedToFirestore;
}

/**
 * Xóa tài liệu khỏi Firebase Firestore và Server backup
 */
export async function deleteDocumentFromFirestore(docId: string): Promise<boolean> {
  let deletedFromFirestore = false;
  const activeDb = getFirestoreDb();

  if (activeDb) {
    try {
      const docRef = doc(activeDb, FIRESTORE_DOCS_COLLECTION, docId);
      await deleteDoc(docRef);
      console.log(`[Firestore] Đã xóa tài liệu (ID: ${docId}) khỏi Firestore.`);
      deletedFromFirestore = true;
    } catch (err) {
      console.error('[Firestore] Lỗi khi xóa tài liệu khỏi Firestore:', err);
    }
  }

  // Đồng bộ xóa trên server backup
  try {
    await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
  } catch (e) {
    console.warn('[Server] Không thể gửi lệnh xóa lên server backup:', e);
  }

  return deletedFromFirestore;
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

/**
 * Đồng bộ toàn bộ tài liệu lên server dự phòng
 */
async function syncDocsToServerBackup(docs: DocumentItem[]) {
  try {
    for (const d of docs) {
      await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
    }
  } catch (_) {}
}
