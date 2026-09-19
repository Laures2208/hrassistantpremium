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
  Database,
} from 'lucide-react';
import { DocumentItem, DocumentCategory } from '../types';
import { extractTextFromFile } from '../services/documentParser';
import { saveDocumentToFirestore, deleteDocumentFromFirestore } from '../services/firebase';

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
  const [selectedDocPreview, setSelectedDocPreview] = useState<DocumentItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('law');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setStatusMessage(null);

    const newDocs: DocumentItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Đang xử lý và trích xuất văn bản từ "${file.name}" (${i + 1}/${files.length})...`);

      try {
        const parsed = await extractTextFromFile(file);
        if (!parsed.textContent || parsed.textContent.length < 10) {
          throw new Error('Không trích xuất được nội dung văn bản từ tệp này.');
        }

        const docItem: DocumentItem = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: parsed.name,
          fileType: parsed.fileType,
          size: parsed.size,
          uploadedAt: new Date().toISOString(),
          textContent: parsed.textContent,
          category: selectedCategory,
          summary: parsed.textContent.substring(0, 160).replace(/\n/g, ' ') + '...',
          source: 'firestore',
        };

        // Save to Firebase Firestore
        await saveDocumentToFirestore(docItem);
        newDocs.push(docItem);
      } catch (err: any) {
        console.error('Error processing file:', err);
        setStatusMessage({
          type: 'error',
          text: `Lỗi xử lý file "${file.name}": ${err?.message || 'Không thể trích xuất'}`,
        });
      }
    }

    if (newDocs.length > 0) {
      const updated = [...newDocs, ...documents];
      onDocumentsUpdated(updated);
      setStatusMessage({
        type: 'success',
        text: `Đã tải lên & đồng bộ thành công ${newDocs.length} tài liệu vào Firebase Firestore!`,
      });
    }

    setIsUploading(false);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (docId: string, docName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài liệu "${docName}" khỏi bộ tri thức?`)) return;

    await deleteDocumentFromFirestore(docId);
    const updated = documents.filter((d) => d.id !== docId);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Quản Lý File Luật & Nội Quy</h2>
              <p className="text-xs text-slate-400">
                Tải lên tài liệu PDF, DOCX, TXT để đồng bộ lên Firebase Firestore làm dữ liệu huấn luyện cho AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content: Split Screen */}
        <div className="grid flex-1 grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left / Top column: Upload and File List (7 cols) */}
          <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 p-5 lg:col-span-7 overflow-y-auto">
            {/* Category selection */}
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Phân loại tài liệu tải lên:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
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
                  : 'border-slate-700 bg-slate-950/40 hover:border-amber-500/50 hover:bg-slate-800/30'
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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 mb-2">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                Kéo thả file vào đây hoặc <span className="text-amber-400 underline">chọn từ máy tính</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Hỗ trợ định dạng: <strong>PDF, Word (.docx), TXT, Markdown</strong> (Tối đa 15MB)
              </p>
            </div>

            {/* Progress / Status banner */}
            {isUploading && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
                <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
                <span>{uploadProgress || 'Đang xử lý tệp...'}</span>
              </div>
            )}

            {statusMessage && (
              <div
                className={`mt-3 flex items-center gap-2 rounded-xl border p-3 text-xs ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Documents List */}
            <div className="mt-5 flex-1">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                        ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-amber-400">
                        {doc.fileType === 'pdf' ? (
                          <span className="text-[10px] font-bold text-rose-400">PDF</span>
                        ) : doc.fileType === 'docx' ? (
                          <span className="text-[10px] font-bold text-blue-400">DOC</span>
                        ) : (
                          <FileCode className="h-4 w-4 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-200" title={doc.name}>
                          {doc.name}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{formatFileSize(doc.size)}</span>
                          <span>•</span>
                          <span>{doc.textContent?.length.toLocaleString() || 0} ký tự</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Database className="h-3 w-3" />
                            {doc.source === 'firestore' ? 'Firestore' : 'Bộ luật Mẫu'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDocPreview(doc);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                        title="Xem chi tiết nội dung"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id, doc.name);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
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

          {/* Right column: Document Inspector & Text Content (5 cols) */}
          <div className="flex flex-col bg-slate-950/60 p-5 lg:col-span-5 overflow-hidden">
            {selectedDocPreview ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-slate-800 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-300 uppercase">
                      {selectedDocPreview.category || 'Tài liệu'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {selectedDocPreview.textContent.length.toLocaleString()} ký tự
                    </span>
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-white truncate" title={selectedDocPreview.name}>
                    {selectedDocPreview.name}
                  </h4>
                  <p className="mt-1 text-xs text-slate-400">
                    Thời gian tạo/tải: {new Date(selectedDocPreview.uploadedAt).toLocaleString('vi-VN')}
                  </p>
                </div>

                <div className="mt-3 flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap selection:bg-amber-500 selection:text-slate-950">
                  {selectedDocPreview.textContent}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center p-6 text-slate-500">
                <Eye className="h-10 w-10 text-slate-700 mb-2" />
                <p className="text-sm font-medium text-slate-400">Chọn một tài liệu để xem nội dung chi tiết</p>
                <p className="text-xs text-slate-600 mt-1">
                  Văn bản trích xuất sẽ được AI đối chiếu và trích dẫn trực tiếp trong câu trả lời
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
