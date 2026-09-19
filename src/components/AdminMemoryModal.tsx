import React, { useState } from 'react';
import { Database, Search, Cpu, Check, Copy, Download, Upload, ShieldCheck, X } from 'lucide-react';
import { DocumentItem } from '../types';
import { buildDocumentContext, MAX_DOC_CONTEXT_LENGTH } from '../services/gemini';

interface AdminMemoryModalProps {
  isOpen: boolean;
  documents: DocumentItem[];
  onClose: () => void;
}

export const AdminMemoryModal: React.FC<AdminMemoryModalProps> = ({
  isOpen,
  documents,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const totalChars = documents.reduce((acc, d) => acc + (d.textContent?.length || 0), 0);
  const estimatedTokens = Math.round(totalChars / 3.8);
  const builtContext = buildDocumentContext(documents);
  const contextLength = builtContext.length;
  const contextPercentage = Math.min(100, Math.round((contextLength / MAX_DOC_CONTEXT_LENGTH) * 100));

  const filteredDocs = searchQuery
    ? documents.filter(
        (d) =>
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.textContent.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : documents;

  const handleCopyContext = () => {
    navigator.clipboard.writeText(builtContext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(documents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `bo_tri_thuc_phap_ly_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-sm">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Bộ Nhớ & Tri Thức Pháp Lý (Knowledge Base)</h2>
              <p className="text-xs text-slate-400">
                Toàn bộ dữ liệu ngữ cảnh mà mô hình Gemini sử dụng để suy luận và giải đáp luật
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

        {/* Top metrics banner */}
        <div className="grid grid-cols-2 gap-3 border-b border-slate-800 bg-slate-950/40 p-4 sm:grid-cols-4 sm:px-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-[11px] font-medium text-slate-400">Tổng tài liệu active</p>
            <p className="mt-1 text-lg font-bold text-cyan-400">{documents.length} văn bản</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-[11px] font-medium text-slate-400">Tổng số ký tự</p>
            <p className="mt-1 text-lg font-bold text-amber-400">{totalChars.toLocaleString()} chars</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-[11px] font-medium text-slate-400">Ước tính Tokens</p>
            <p className="mt-1 text-lg font-bold text-emerald-400">~{estimatedTokens.toLocaleString()}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>Độ đầy ngữ cảnh (Max 15k)</span>
              <span className="text-amber-300 font-semibold">{contextPercentage}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  contextPercentage > 90 ? 'bg-rose-500' : 'bg-gradient-to-r from-amber-500 to-amber-300'
                }`}
                style={{ width: `${contextPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-1 flex-col overflow-hidden p-6">
          {/* Controls row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div className="relative flex-1 min-w-[240px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm điều khoản, tiền lương, thai sản, kỷ luật..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 pl-10 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyContext}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-400" />}
                <span>{copied ? 'Đã sao chép' : 'Sao chép ngữ cảnh'}</span>
              </button>

              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 transition"
              >
                <Download className="h-4 w-4" />
                <span>Xuất JSON</span>
              </button>
            </div>
          </div>

          {/* Documents list and context preview */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-700"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 uppercase">
                      {doc.category || 'Law'}
                    </span>
                    <h3 className="text-xs font-bold text-white">{doc.name}</h3>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {doc.textContent.length.toLocaleString()} ký tự (~{Math.round(doc.textContent.length / 3.8)} tokens)
                  </span>
                </div>

                <div className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                  {doc.textContent}
                </div>
              </div>
            ))}

            {filteredDocs.length === 0 && (
              <div className="py-12 text-center text-slate-500">
                <Search className="mx-auto h-8 w-8 text-slate-700 mb-2" />
                <p className="text-sm">Không tìm thấy tài liệu phù hợp với từ khóa "{searchQuery}"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
