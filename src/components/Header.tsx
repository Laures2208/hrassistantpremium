import React from 'react';
import { ShieldCheck, Scale, FileText, Database, Settings, LogOut, KeyRound, Sun, Moon } from 'lucide-react';
import { QuotaState, AdminModalType, ThemeMode } from '../types';

interface HeaderProps {
  quota: QuotaState;
  isAdminLoggedIn: boolean;
  onOpenAdminModal: (type: AdminModalType) => void;
  onAdminLogout: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  quota,
  isAdminLoggedIn,
  onOpenAdminModal,
  onAdminLogout,
  theme,
  onToggleTheme,
}) => {
  // Determine badge color
  let quotaBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30';
  let quotaDotClass = 'bg-emerald-500 dark:bg-emerald-400';
  let quotaText = `Lượt hỏi hôm nay: ${quota.remaining}/${quota.maxQueries}`;

  if (quota.remaining === 0) {
    quotaBadgeClass = 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30';
    quotaDotClass = 'bg-rose-500 dark:bg-rose-400';
    quotaText = `Đã hết lượt hỏi: 0/${quota.maxQueries}`;
  } else if (quota.remaining <= 5) {
    quotaBadgeClass = 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30';
    quotaDotClass = 'bg-amber-500 dark:bg-amber-400';
  }

  const isDark = theme === 'dark';

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/90 text-slate-800 shadow-xs backdrop-blur-md transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-md shadow-amber-600/20 dark:shadow-amber-950/40">
            <Scale className="h-5 w-5 text-slate-950 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                Trợ Lý Pháp Lý Lao Động
              </h1>
              <span className="hidden rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 sm:inline-block">
                BLLĐ 2019
              </span>
            </div>
            <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              Hệ thống tư vấn & giải đáp Pháp luật Lao động Việt Nam
            </p>
          </div>
        </div>

        {/* Center/Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Daily Quota Badge on Header */}
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${quotaBadgeClass}`}
            title={`Bạn có ${quota.remaining} lượt hỏi miễn phí còn lại trong ngày hôm nay`}
          >
            <span className={`h-2 w-2 rounded-full ${quotaDotClass} animate-pulse`} />
            <span className="font-semibold">{quotaText}</span>
          </div>

          {/* Theme Toggle Button (Requirement 2) */}
          <button
            id="theme-toggle-btn"
            type="button"
            onClick={onToggleTheme}
            className="group relative flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/90 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition-all duration-200 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-900 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-white"
            title={isDark ? 'Chuyển sang Chế độ Sáng' : 'Chuyển sang Chế độ Tối'}
            aria-label={isDark ? 'Chuyển sang Chế độ Sáng' : 'Chuyển sang Chế độ Tối'}
          >
            {isDark ? (
              <>
                <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 group-hover:rotate-45" />
                <span className="font-semibold">Chế độ Sáng</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-indigo-600 transition-transform duration-300 group-hover:-rotate-12" />
                <span className="font-semibold">Chế độ Tối</span>
              </>
            )}
          </button>

          {/* Admin Navigation Buttons */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2 sm:gap-1.5 sm:pl-3 dark:border-slate-800">
            <button
              id="admin-btn-files"
              onClick={() => onOpenAdminModal('files')}
              className="group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Quản lý File Luật & Nội quy"
            >
              <FileText className="h-4 w-4 text-amber-600 group-hover:text-amber-500 dark:text-amber-400/90 dark:group-hover:text-amber-300" />
              <span className="hidden md:inline">Tài liệu Luật</span>
            </button>

            <button
              id="admin-btn-memory"
              onClick={() => onOpenAdminModal('memory')}
              className="group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Bộ nhớ Tri thức AI"
            >
              <Database className="h-4 w-4 text-cyan-600 group-hover:text-cyan-500 dark:text-cyan-400/90 dark:group-hover:text-cyan-300" />
              <span className="hidden md:inline">Bộ nhớ</span>
            </button>

            <button
              id="admin-btn-settings"
              onClick={() => onOpenAdminModal('settings')}
              className="group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Cài đặt & API Key"
            >
              <Settings className="h-4 w-4 text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-white" />
              <span className="hidden md:inline">Cài đặt</span>
            </button>

            {/* Admin Status / Login / Logout */}
            {isAdminLoggedIn ? (
              <div className="flex items-center gap-1.5 pl-1.5">
                <span className="hidden items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 lg:flex">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  Admin
                </span>
                <button
                  id="admin-logout-btn"
                  onClick={onAdminLogout}
                  className="flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 hover:text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20 dark:hover:text-rose-200"
                  title="Đăng xuất quyền Quản trị viên"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Đăng xuất Admin</span>
                </button>
              </div>
            ) : (
              <button
                id="admin-login-trigger-btn"
                onClick={() => onOpenAdminModal('auth')}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                title="Đăng nhập Quản trị viên"
              >
                <KeyRound className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
