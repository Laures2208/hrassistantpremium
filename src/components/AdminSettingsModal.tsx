import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Flame,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Shield,
  Sliders,
  Database,
  Lock,
} from 'lucide-react';
import { AppConfig, QuotaState } from '../types';
import { DEFAULT_MODEL, FALLBACK_MODELS } from '../services/gemini';
import { saveCustomFirebaseConfig, isFirebaseConfigured, updateGlobalAdminPassword } from '../services/firebase';
import { getActiveFirebaseConfig } from '../config/firebase';

interface AdminSettingsModalProps {
  isOpen: boolean;
  config: AppConfig;
  quota: QuotaState;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onResetQuota: () => void;
  onClose: () => void;
}

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  isOpen,
  config,
  quota,
  onUpdateConfig,
  onResetQuota,
  onClose,
}) => {
  const [model, setModel] = useState(config.model || DEFAULT_MODEL);
  const [temperature, setTemperature] = useState(config.temperature ?? 0.2);
  const [maxTokens, setMaxTokens] = useState(config.maxOutputTokens || 2048);
  const [apiKey, setApiKey] = useState(() => {
    try {
      const stored = localStorage.getItem('GEMINI_API_KEY');
      if (stored && stored.trim()) return stored.trim();
    } catch (e) {
      console.warn('Error reading GEMINI_API_KEY from localStorage:', e);
    }
    return config.customApiKey || '';
  });
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [firebaseApiKey, setFirebaseApiKey] = useState(() => {
    const active = getActiveFirebaseConfig();
    return active.apiKey || '';
  });
  const [firebaseProjectId, setFirebaseProjectId] = useState(() => {
    const active = getActiveFirebaseConfig();
    return active.projectId || '';
  });

  useEffect(() => {
    if (isOpen) {
      const active = getActiveFirebaseConfig();
      if (active.apiKey) setFirebaseApiKey(active.apiKey);
      if (active.projectId) setFirebaseProjectId(active.projectId);
    }
  }, [isOpen]);

  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string } | null>(
    null
  );
  const [saveToast, setSaveToast] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanApiKey = apiKey.trim();
    const cleanNewPassword = newAdminPassword.trim();

    // Cập nhật Mật khẩu Admin mới trực tiếp lên Firebase Firestore (settings/global_config)
    if (cleanNewPassword) {
      await updateGlobalAdminPassword(cleanNewPassword);
    }

    // 1. Mandatory requirement: Persist API Key in localStorage with key 'GEMINI_API_KEY'
    try {
      if (cleanApiKey) {
        localStorage.setItem('GEMINI_API_KEY', cleanApiKey);
      } else {
        localStorage.removeItem('GEMINI_API_KEY');
      }
    } catch (err) {
      console.error('Failed to write GEMINI_API_KEY to localStorage:', err);
    }

    const updated: AppConfig = {
      ...config,
      model,
      temperature,
      maxOutputTokens: maxTokens,
      customApiKey: cleanApiKey || undefined,
      customAdminPassword: cleanNewPassword || config.customAdminPassword,
    };

    onUpdateConfig(updated);

    if (firebaseApiKey && firebaseProjectId) {
      saveCustomFirebaseConfig({
        apiKey: firebaseApiKey.trim(),
        projectId: firebaseProjectId.trim(),
        authDomain: `${firebaseProjectId.trim()}.firebaseapp.com`,
      });
    }

    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
      onClose();
    }, 900);
  };

  const handleTestApiKey = async () => {
    setTestStatus({ loading: true });
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        setTestStatus({
          loading: false,
          success: true,
          message: 'Kết nối máy chủ và mô hình Gemini thành công!',
        });
      } else {
        setTestStatus({
          loading: false,
          success: false,
          message: 'Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra lại cấu hình.',
        });
      }
    } catch (err: any) {
      setTestStatus({
        loading: false,
        success: false,
        message: `Lỗi kiểm tra kết nối: ${err?.message || 'Lỗi mạng'}`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6 backdrop-blur-sm dark:bg-slate-950/80">
      <div className="flex h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-700/80 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cài Đặt & Cấu Hình AI</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tùy chỉnh mô hình Gemini, API Key, tham số nhiệt độ và hạn mức
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

        {/* Settings Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* AI Model Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Mô hình Trí tuệ Nhân tạo (Gemini AI Model)
              </h3>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-slate-600 dark:text-slate-400">Chọn mô hình Gemini:</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="gemini-3.8-flash">gemini-3.8-flash (Khuyên dùng - Phản hồi siêu tốc & thông minh)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Tiết kiệm chi phí & tốc độ cao)</option>
                <option value="gemini-2.5-flash-preview-12-2025">gemini-2.5-flash-preview-12-2025</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash (Fallback model)</option>
              </select>
            </div>

            {/* Temperature Slider */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Nhiệt độ sáng tạo (Temperature):</span>
                <span className="font-mono font-bold text-amber-400">{temperature} (Chính xác cao)</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="h-2 w-full cursor-pointer accent-amber-500 bg-slate-800 rounded-lg"
              />
              <p className="text-[11px] text-slate-500">
                Giá trị <strong>0.2</strong> giúp AI trích dẫn đúng nguyên văn luật, hạn chế hiện tượng bịa đặt (hallucination).
              </p>
            </div>

            {/* Max Output Tokens */}
            <div className="mt-4">
              <label className="block text-xs text-slate-400 mb-1.5">Độ dài câu trả lời tối đa (maxOutputTokens):</label>
              <select
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                <option value={1024}>1024 Tokens (Ngắn gọn, súc tích)</option>
                <option value={2048}>2048 Tokens (Tiêu chuẩn - Khuyên dùng)</option>
                <option value={4096}>4096 Tokens (Chi tiết, đầy đủ bảng biểu)</option>
              </select>
            </div>
          </div>

          {/* Gemini API Key Configuration for Vercel */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Cấu hình Gemini API Key
                </h3>
              </div>
              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={testStatus?.loading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
              >
                {testStatus?.loading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />
                ) : (
                  <Sliders className="h-3.5 w-3.5 text-amber-400" />
                )}
                <span>Kiểm tra kết nối</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-slate-400">
                Gemini API Key (Tùy chọn ghi đè hoặc dùng khi deploy lên Vercel):
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... (Mặc định dùng biến môi trường server)"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {testStatus && (
              <div
                className={`mt-3 flex items-center gap-2 rounded-xl border p-2.5 text-xs ${
                  testStatus.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {testStatus.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>{testStatus.message}</span>
              </div>
            )}
          </div>

          {/* Firebase Firestore config */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Đồng bộ Firebase Firestore (Tùy chọn)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Trạng thái:{' '}
              <span className="font-semibold text-emerald-400">
                {isFirebaseConfigured ? '🟢 Đã cấu hình Firebase' : '🟡 Đang dùng Bộ lưu trữ Local & Tri thức mẫu'}
              </span>
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Firebase Project ID:</label>
                <input
                  type="text"
                  value={firebaseProjectId}
                  onChange={(e) => setFirebaseProjectId(e.target.value)}
                  placeholder="vi-du: my-labor-law-app"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Firebase API Key:</label>
                <input
                  type="password"
                  value={firebaseApiKey}
                  onChange={(e) => setFirebaseApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Quota Reset & Security */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Hạn mức Hỏi & Bảo mật Quản trị
              </h3>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-900 p-3 border border-slate-800">
              <div>
                <p className="text-xs font-semibold text-slate-200">
                  Lượt hỏi đã dùng hôm nay: <span className="text-amber-400">{quota.queryCount}/{quota.maxQueries}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  (Còn lại: {quota.remaining} lượt - Tự động reset sang ngày mới)
                </p>
              </div>
              <button
                type="button"
                onClick={onResetQuota}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset về 0 (Admin Test)
              </button>
            </div>

            {/* Change Admin Password */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Đổi mật khẩu Admin (Để trống nếu giữ nguyên):
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Nhập mật khẩu Admin mới..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 pl-9 text-xs text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                />
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-white/95 pt-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
            {saveToast ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Đã lưu cấu hình thành công!
              </span>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400">Các thay đổi sẽ được áp dụng ngay lập tức</span>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 active:scale-95 transition"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
