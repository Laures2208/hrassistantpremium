import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileCode,
  X,
  RefreshCw,
  Eye,
  Layers,
  Zap,
} from 'lucide-react';
import { DocumentItem, DocumentCategory } from '../types';
import { extractTextFromFile } from '../services/documentParser';
import {
  saveDocumentToFirestore,
  deleteDocumentFromFirestore,
  LOCAL_STORAGE_DOCS_KEY,
} from '../services/firebase';

interface AdminFileManagerModalProps {
  isOpen: boolean;
  documents: DocumentItem[];
  onDocumentsUpdated: (updatedDocs: DocumentItem[]) => void;
  onClose: () => void;
}

export const AdminFileManagerModal: React.FC<AdminFileManagerModalProps> = ({
  isOpen,
  documents,
  onDocumentsUpdated,
  onClose,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [selectedDocPreview, setSelectedDocPreview] = useState<DocumentItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('law');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastAttemptedFiles, setLastAttemptedFiles] = useState<File[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setLastAttemptedFiles(fileArray);

    setIsUploading(true);
    setStatusMessage(null);
    setUploadPercent(10);
    setUploadProgress('Bắt đầu xử lý tài liệu...');

    const newDocs: DocumentItem[] = [];
    const totalFiles = fileArray.length;

    try {
      for (let i = 0; i < totalFiles; i++) {
        const file = fileArray[i];
        const basePercent = Math.round((i / totalFiles) * 80);

        setUploadProgress(`Đang xử lý "${file.name}" (${i + 1}/${totalFiles})...`);
        setUploadPercent(Math.max(basePercent, 15));

        // 1. Trích xuất văn bản từ tệp với Fallback an toàn (DOCX, DOC cũ, PDF, TXT)
        const parsed = await extractTextFromFile(file, (percent, msg) => {
          const fileContribution = Math.round((percent / 100) * (70 / totalFiles));
          setUploadPercent(Math.min(basePercent + fileContribution, 85));
          setUploadProgress(`[${i + 1}/${totalFiles}] "${file.name}": ${msg}`);
        });

        if (!parsed.textContent || parsed.textContent.length < 5) {
          throw new Error(`Tệp "${file.name}" không có nội dung văn bản khả dụng.`);
        }

        const docItem: DocumentItem = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: parsed.name,
          fileType: parsed.fileType,
          size: parsed.size,
          uploadedAt: new Date().toISOString(),
          textContent: parsed.textContent,
          category: selectedCategory,
          summary: parsed.textContent.substring(0, 180).replace(/\n/g, ' ') + '...',
          source: 'firestore',
        };

        setUploadProgress(`[${i + 1}/${totalFiles}] Đang lưu "${file.name}" lên Cloud Firestore...`);
        setUploadPercent(90);

        // 2. Cơ chế Timeout tối đa 10 giây cho lệnh lưu Firestore
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Quá thời gian phản hồi từ Cloud Firestore (Timeout 10s)')), 10000)
        );

        await Promise.race([saveDocumentToFirestore(docItem), timeoutPromise]);
        newDocs.push(docItem);
      }

      // Xử lý khi thành công toàn bộ danh sách
      setUploadPercent(100);
      setUploadProgress('Đã hoàn tất lưu trữ tài liệu!');

      if (newDocs.length > 0) {
        const existingUserDocs = documents.filter((d) => d.source !== 'sample');
        const updated = [...newDocs, ...existingUserDocs];

        try {
          localStorage.setItem(LOCAL_STORAGE_DOCS_KEY, JSON.stringify(updated));
        } catch (err) {
          console.warn('LocalStorage limit:', err);
        }

        onDocumentsUpdated(updated);
        setStatusMessage({
          type: 'success',
          text: `⚡ Đã nạp thành công ${newDocs.length} tài liệu vào bộ tri thức Cloud (Chuyển sang 100% dữ liệu thực tế)!`,
        });
      }
    } catch (err: any) {
      console.error('Lỗi khi tải lên tài liệu:', err);
      // NẾU CÓ LỖI: Ngay lập tức hủy thanh tiến trình 90%
      setUploadPercent(0);
      setUploadProgress(null);

      // Hiển thị thông báo Toast / Alert màu đỏ rõ ràng
      setStatusMessage({
        type: 'error',
        text: `❌ Lỗi tải lên: ${err?.message || 'Không thể xử lý hoặc kết nối tới Cloud Firestore'}`,
      });
    } finally {
      // Đảm bảo luôn giải phóng trạng thái tải lên
      setIsUploading(false);
      setUploadProgress(null);
      setUploadPercent(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRetry = () => {
    if (lastAttemptedFiles && lastAttemptedFiles.length > 0) {
      handleFiles(lastAttemptedFiles);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleDelete = async (docId: string, docName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài liệu "${docName}" khỏi bộ tri thức?`)) return;

    await deleteDocumentFromFirestore(docId);
    const updated = documents.filter((d) => d.id !== docId);

    try {
      localStorage.setItem(LOCAL_STORAGE_DOCS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('LocalStorage error updating docs:', err);
    }

    onDocumentsUpdated(updated);
    if (selectedDocPreview?.id === docId) setSelectedDocPreview(null);
    setStatusMessage({
      type: 'success',
      text: `Đã xóa tài liệu "${docName}".`,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6 backdrop-blur-sm dark:bg-slate-950/80">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-700/80 dark:bg-slate-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quản Lý File Luật & Nội Quy</h2>
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Zap className="h-3 w-3 fill-amber-500" /> Tốc độ cao
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tải lên tài liệu PDF, Word (.docx, .doc), TXT để đồng bộ lên Firebase Firestore làm dữ liệu tham vấn cho AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content: Split Screen */}
        <div className="grid flex-1 grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left column: Upload and File List (7 cols) */}
          <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-5 lg:col-span-7 overflow-y-auto">
            {/* Category selection */}
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Phân loại tài liệu tải lên:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="law">Văn bản Luật / Nghị định / Thông tư</option>
                <option value="regulation">Nội quy lao động Doanh nghiệp</option>
                <option value="contract">Mẫu Hợp đồng / Thỏa ước lao động</option>
                <option value="guide">Hướng dẫn & Quy chế nội bộ</option>
                <option value="custom">Tài liệu tham khảo khác</option>
              </select>
            </div>

            {/* Drag and drop upload box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-slate-300 bg-slate-50 hover:border-amber-500/50 hover:bg-amber-50/20 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-amber-500/50 dark:hover:bg-slate-800/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 mb-2">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Kéo thả file vào đây hoặc <span className="text-amber-600 dark:text-amber-400 underline">chọn từ máy tính</span>
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Hỗ trợ: <strong>Word (.docx, .doc), PDF, TXT, Markdown</strong> (Tự động tối ưu dung lượng &lt; 1MB)
              </p>
            </div>

            {/* Progress / Status banner */}
            {isUploading && (
              <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-600 dark:text-amber-400" />
                    {uploadProgress || 'Đang xử lý tệp...'}
                  </span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-300">{uploadPercent}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200/60 dark:bg-amber-950/60">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300 ease-out"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
              </div>
            )}

            {statusMessage && (
              <div
                className={`mt-3 flex items-center justify-between rounded-xl border p-3 text-xs ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300'
                    : 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  )}
                  <span className="font-medium">{statusMessage.text}</span>
                </div>
                {statusMessage.type === 'error' && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="ml-3 shrink-0 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Thử lại
                  </button>
                )}
              </div>
            )}

            {/* Documents List */}
            <div className="mt-5 flex-1">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Danh sách tài liệu đã đồng bộ ({documents.length})
                  </h3>
                </div>
              </div>

              <div className="mt-2 space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocPreview(doc)}
                    className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                      selectedDocPreview?.id === doc.id
                        ? 'border-amber-500 bg-amber-50 dark:border-amber-500 dark:bg-amber-500/10 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-amber-400">
                        {doc.fileType === 'pdf' ? (
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">PDF</span>
                        ) : doc.fileType === 'docx' ? (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">DOC</span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">TXT</span>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {doc.name}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                          <span>{formatFileSize(doc.size)}</span>
                          <span>•</span>
                          <span className="capitalize">{doc.category || 'Luật'}</span>
                          {doc.source === 'sample' && (
                            <span className="rounded bg-amber-100 px-1 text-[9px] text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              Mẫu mặc định
                            </span>
                          )}
                          {doc.source === 'firestore' && (
                            <span className="rounded bg-emerald-100 px-1 text-[9px] text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Cloud
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDocPreview(doc);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                        title="Xem nội dung"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id, doc.name);
                        }}
                        className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition"
                        title="Xóa tài liệu"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: Document Preview (5 cols) */}
          <div className="flex flex-col bg-slate-50 p-5 lg:col-span-5 dark:bg-slate-950/60 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Xem trước nội dung trích xuất
                </h3>
              </div>
              {selectedDocPreview && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {selectedDocPreview.textContent.length.toLocaleString('vi-VN')} ký tự
                </span>
              )}
            </div>

            {selectedDocPreview ? (
              <div className="mt-3 flex flex-1 flex-col overflow-hidden">
                <div className="mb-2">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                    {selectedDocPreview.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Cập nhật: {new Date(selectedDocPreview.uploadedAt).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 whitespace-pre-wrap">
                  {selectedDocPreview.textContent}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-6">
                <FileText className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Chọn một tài liệu từ danh sách bên trái để xem nội dung văn bản AI sẽ sử dụng để tham vấn.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
