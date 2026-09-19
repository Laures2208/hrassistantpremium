import React, { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, AlertCircle, X, ShieldCheck, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { AdminModalType } from '../types';
import { verifyAdminPassword, updateGlobalSettings, DEFAULT_ADMIN_PASSWORD } from '../services/firebase';

interface AdminAuthModalProps {
  isOpen: boolean;
  targetModal: AdminModalType;
  customAdminPassword?: string;
  onSuccess: (target: AdminModalType) => void;
  onClose: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  targetModal,
  customAdminPassword,
  onSuccess,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setError(null);
      setIsVerifying(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const performLogin = async (inputPass: string) => {
    const cleanPassword = inputPass.trim();
    if (!cleanPassword) {
      setError('Vui lòng nhập mật khẩu Admin');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // 1. Mật khẩu mặc định 123456 luôn được chấp nhận tuyệt đối
      if (cleanPassword === '123456' || cleanPassword === DEFAULT_ADMIN_PASSWORD) {
        // Đồng bộ lại 123456 lên Firestore và LocalStorage nếu trước đó bị sai lệch
        updateGlobalSettings({ adminPassword: '123456' }).catch(() => {});
        setError(null);
        onSuccess(targetModal);
        return;
      }

      // 2. Kiểm tra trực tiếp với Firestore settings/global_config
      const isValid = await verifyAdminPassword(cleanPassword);
      if (isValid) {
        setError(null);
        onSuccess(targetModal);
        return;
      }

      // 3. Fallback kiểm tra customAdminPassword từ state/env
      const envPassword =
        typeof import.meta !== 'undefined' && import.meta.env
          ? import.meta.env.VITE_ADMIN_PASSWORD
          : undefined;
      const expected = customAdminPassword || envPassword;
      if (expected && cleanPassword === expected.trim()) {
        setError(null);
        onSuccess(targetModal);
        return;
      }

      setError('Mật khẩu Admin không chính xác!');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
    } catch (err) {
      // Trong trường hợp lỗi mạng, nếu nhập 123456 vẫn cho phép vào
      if (cleanPassword === '123456') {
        setError(null);
        onSuccess(targetModal);
      } else {
        setError('Lỗi kết nối xác thực mật khẩu. Vui lòng thử lại!');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 600);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(password);
  };

  const handleQuickFillDefault = () => {
    setPassword('123456');
    setError(null);
    performLogin('123456');
  };

  const getTargetTitle = () => {
    switch (targetModal) {
      case 'files':
        return 'Quản lý File Luật & Nội quy';
      case 'memory':
        return 'Bộ nhớ & Tri thức AI';
      case 'settings':
        return 'Cài đặt Hệ thống & API Key';
      default:
        return 'Khu vực Quản trị viên';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm dark:bg-slate-950/80">
      <div
        className={`w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-700/80 dark:bg-slate-900 ${
          isShaking ? 'animate-bounce text-rose-500 dark:text-rose-400' : ''
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Xác thực Quản trị viên</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{getTargetTitle()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-300">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>
                Khu vực quản lý văn bản luật, bộ nhớ và API Key được bảo vệ. Vui lòng nhập mật khẩu Admin để tiếp tục.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Mật khẩu mặc định:</span>
                <button
                  type="button"
                  onClick={handleQuickFillDefault}
                  className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-800 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900 transition"
                  title="Bấm để tự động điền 123456 và đăng nhập ngay"
                >
                  <span>123456</span>
                  <span className="text-[10px] font-normal underline">(Bấm để dùng ngay)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Mật khẩu Admin
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Nhập 123456..."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:placeholder-slate-500"
                autoComplete="current-password"
              />
              <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={handleQuickFillDefault}
                className="w-full text-center text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline py-1"
              >
                👉 Nhấp vào đây để đăng nhập bằng mật khẩu mặc định: <strong>123456</strong>
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isVerifying}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Xác nhận Đăng nhập</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
