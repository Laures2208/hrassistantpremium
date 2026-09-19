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
  Eye,
  EyeOff,
  Loader2,
  Cloud,
} from 'lucide-react';
import { AppConfig, QuotaState } from '../types';
import { DEFAULT_MODEL, FALLBACK_MODELS } from '../services/gemini';
import {
  getGlobalConfig,
  updateGlobalConfig,
} from '../services/firestoreService';
import {
  saveCustomFirebaseConfig,
  isFirebaseConfigured,
} from '../services/firebase';
import { getActiveFirebaseConfig } from '../config/firebase';

export interface SettingsModalProps {
  isOpen: boolean;
  config: AppConfig;
  quota: QuotaState;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onResetQuota: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
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
  const [showApiKey, setShowApiKey] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [currentAdminPassword, setCurrentAdminPassword] = useState('123456');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState(false);

  const [firebaseApiKey, setFirebaseApiKey] = useState(() => {
    const active = getActiveFirebaseConfig();
    return active.apiKey || '';
  });
  const [firebaseProjectId, setFirebaseProjectId] = useState(() => {
    const active = getActiveFirebaseConfig();
    return active.projectId || '';
  });

  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string } | null>(
    null
  );

  // Khi mở Modal: Tải cấu hình mới nhất từ Firestore Cloud
  useEffect(() => {
    if (isOpen) {
      setNewAdminPassword('');
      setShowAdminPassword(false);
      setShowApiKey(false);
      setSaveError(null);
      setIsSaving(false);
      setSaveToast(false);

      const active = getActiveFirebaseConfig();
      if (active.apiKey) setFirebaseApiKey(active.apiKey);
      if (active.projectId) setFirebaseProjectId(active.projectId);

      // Nạp từ LocalStorage trước cho nhanh
      const cachedPw =
        localStorage.getItem('admin_password') ||
        localStorage.getItem('tro_ly_phap_ly_custom_admin_password') ||
        config.customAdminPassword ||
        '123456';
      setCurrentAdminPassword(cachedPw);

      const cachedKey =
        localStorage.getItem('GEMINI_API_KEY') ||
        config.customApiKey ||
        '';
      if (cachedKey) setApiKey(cachedKey);

      // Đồng bộ trực tiếp từ Firestore settings/global_config
      getGlobalConfig()
        .then((doc) => {
          if (doc?.adminPassword) {
            setCurrentAdminPassword(doc.adminPassword);
          }
          if (doc?.geminiApiKey) {
            setApiKey(doc.geminiApiKey);
          }
        })
        .catch((err) => {
          console.warn('[SettingsModal] Lỗi nạp cấu hình cloud:', err);
        });
    }
  }, [isOpen, config.customApiKey, config.customAdminPassword]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    const cleanApiKey = apiKey.trim();
    const cleanNewPassword = newAdminPassword.trim();

    try {
      // 1. Gọi updateGlobalConfig({ adminPassword, geminiApiKey }) để đẩy cả Mật khẩu và API Key lên Firestore Cloud
      await updateGlobalConfig({
        adminPassword: cleanNewPassword || undefined,
        geminiApiKey: cleanApiKey,
      });

      if (cleanNewPassword) {
        setCurrentAdminPassword(cleanNewPassword);
      }

      // 2. Cập nhật State cấu hình ứng dụng
      const updatedConfig: AppConfig = {
        ...config,
        model,
        temperature,
        maxOutputTokens: maxTokens,
        customApiKey: cleanApiKey || undefined,
        customAdminPassword: cleanNewPassword || config.customAdminPassword || currentAdminPassword,
      };

      onUpdateConfig(updatedConfig);

      // 3. Nếu có cập nhật kết nối Firebase Custom
      if (firebaseApiKey && firebaseProjectId) {
        saveCustomFirebaseConfig({
          apiKey: firebaseApiKey.trim(),
          projectId: firebaseProjectId.trim(),
          authDomain: `${firebaseProjectId.trim()}.firebaseapp.com`,
        });
      }

      // 4. Bật thông báo Toast thành công
      setSaveToast(true);
      setTimeout(() => {
        setSaveToast(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Lỗi khi lưu cấu hình lên Cloud:', err);
      setSaveError(err?.message || 'Không thể lưu Cấu hình & API Key lên Cloud. Vui lòng kiểm tra lại kết nối!');
    } finally {
      setIsSaving(false);
    }
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
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cài Đặt & Đồng Bộ Cloud</h2>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <Cloud className="h-3 w-3" /> Firestore Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cấu hình API Key, Mật khẩu Quản trị và đồng bộ cho mọi thiết bị
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-y-auto px-6 py-5 space-y-6">
          {/* 1. Gemini API Key Section (Đồng bộ Cloud) */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 dark:bg-emerald-500/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Gemini API Key (Đồng Bộ Đa Thiết Bị)
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Cloud className="h-3 w-3" /> Lưu trên Cloud
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              API Key được lưu trữ trực tiếp trên Firestore (<code className="font-mono text-emerald-600 dark:text-emerald-400">settings/global_config</code>). Khi Admin lưu tại đây, tất cả các thiết bị khác hoặc cửa sổ ẩn danh sẽ tự động nhận diện mà không cần nhập lại.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Google Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-20 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    title={showApiKey ? 'Ẩn API Key' : 'Hiện API Key'}
                  >
                    {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleTestApiKey}
                    disabled={testStatus?.loading}
                    className="rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 transition"
                  >
                    {testStatus?.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Kiểm tra'}
                  </button>
                </div>
              </div>
            </div>

            {testStatus && (
              <div
                className={`flex items-center gap-2 rounded-lg p-2.5 text-xs ${
                  testStatus.success
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                }`}
              >
                {testStatus.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                )}
                <span>{testStatus.message}</span>
              </div>
            )}
          </div>

          {/* 2. Mật khẩu Quản trị (Admin Password) */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 dark:bg-amber-500/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Mật Khẩu Quản Trị Viên (Admin Password)
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                <Shield className="h-3 w-3" /> Bảo mật Cloud
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              <span>Mật khẩu đang hiệu lực:</span>
              <span className="font-mono font-bold bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded">
                {currentAdminPassword}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Đổi mật khẩu Admin mới (để trống nếu không đổi)
              </label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Nhập mật khẩu Admin mới..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  title={showAdminPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              💡 Lưu ý: Mật khẩu mặc định hệ thống <code className="font-mono text-amber-600 dark:text-amber-400">123456</code> luôn là khóa khẩn cấp Master Key không bao giờ bị khóa.
            </p>
          </div>

          {/* 3. Mô hình AI & Tham số suy luận */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Cấu Hình Mô Hình Gemini AI
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Phiên bản Mô hình
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  {FALLBACK_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Số Token Tối Đa (Max Output Tokens)
                </label>
                <input
                  type="number"
                  min="512"
                  max="8192"
                  step="256"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2048)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300">
                <span>Nhiệt độ sáng tạo (Temperature):</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{temperature}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0.0 (Chính xác pháp lý tuyệt đối)</span>
                <span>1.0 (Sáng tạo cao)</span>
              </div>
            </div>
          </div>

          {/* 4. Giới Hạn Sử Dụng & Thống Kê */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Hạn Mức Trò Chuyện Trong Ngày
                </h3>
              </div>
              <button
                type="button"
                onClick={onResetQuota}
                className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 transition"
              >
                <RefreshCw className="h-3 w-3" /> Đặt lại hạn mức
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Số câu hỏi đã sử dụng hôm nay:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {quota.queryCount} / {quota.maxQueries} câu hỏi (Còn lại: {quota.remaining})
              </span>
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Sticky Footer */}
          <div className="sticky bottom-0 -mx-6 -mb-5 mt-auto flex items-center justify-between border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
            {saveToast ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-fadeIn">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ✅ Đã lưu Cấu hình & API Key lên Cloud cho toàn bộ thiết bị!
              </span>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Đồng bộ tự động qua Firebase Firestore
              </span>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang lưu lên Cloud...</span>
                  </>
                ) : (
                  <span>Lưu Thay Đổi</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AdminSettingsModal = SettingsModal;
