import React from 'react';
import { ShieldCheck, Scale, FileText, Database, Settings, LogOut, KeyRound } from 'lucide-react';
import { QuotaState, AdminModalType } from '../types';

interface HeaderProps {
  quota: QuotaState;
  isAdminLoggedIn: boolean;
  onOpenAdminModal: (type: AdminModalType) => void;
  onAdminLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  quota,
  isAdminLoggedIn,
  onOpenAdminModal,
  onAdminLogout,
}) => {
  // Determine badge color
  let quotaBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  let quotaDotClass = 'bg-emerald-400';
  let quotaText = `Lượt hỏi hôm nay: ${quota.remaining}/${quota.maxQueries}`;

  if (quota.remaining === 0) {
    quotaBadgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    quotaDotClass = 'bg-rose-400';
    quotaText = `Đã hết lượt hỏi: 0/${quota.maxQueries}`;
  } else if (quota.remaining <= 5) {
    quotaBadgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    quotaDotClass = 'bg-amber-400';
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-md shadow-amber-950/40">
            <Scale className="h-5 w-5 text-slate-950 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                Trợ Lý Pháp Lý Lao Động
              </h1>
              <span className="hidden rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300 border border-amber-500/30 sm:inline-block">
                BLLĐ 2019
              </span>
            </div>
            <p className="hidden text-xs text-slate-400 sm:block">
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

          {/* Admin Navigation Buttons */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2 sm:gap-1.5 sm:pl-3">
            <button
              id="admin-btn-files"
              onClick={() => onOpenAdminModal('files')}
              className="group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
              title="Quản lý File Luật & Nội quy"
            >
              <FileText className="h-4 w-4 text-amber-400/90 group-hover:text-amber-300" />
              <span className="hidden md:inline">Tài liệu Luật</span>
            </button>

            <button
              id="admin-btn-memory"
              onClick={() => onOpenAdminModal('memory')}
              className="group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
              title="Bộ nhớ Tri thức AI"
            >
              <Database className="h-4 w-4 text-cyan-400/90 group-hover:text-cyan-300" />
              <span className="hidden md:inline">Bộ nhớ</span>
            </button>

            <button
              id="admin-btn-settings"
              onClick={() => onOpenAdminModal('settings')}
              className="group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
              title="Cài đặt & API Key"
            >
              <Settings className="h-4 w-4 text-slate-400 group-hover:text-white" />
              <span className="hidden md:inline">Cài đặt</span>
            </button>

            {/* Admin Status / Login / Logout */}
            {isAdminLoggedIn ? (
              <div className="flex items-center gap-1.5 pl-1.5">
                <span className="hidden items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-1 text-xs font-medium text-amber-300 lg:flex">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                  Admin
                </span>
                <button
                  id="admin-logout-btn"
                  onClick={onAdminLogout}
                  className="flex items-center gap-1 rounded-lg bg-rose-500/10 border border-rose-500/30 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition"
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
                className="flex items-center gap-1.5 rounded-lg bg-slate-800/80 border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
                title="Đăng nhập Quản trị viên"
              >
                <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
