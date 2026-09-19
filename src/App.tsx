import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from './components/Header';
import { ChatMessageItem } from './components/ChatMessageItem';
import { ChatInput } from './components/ChatInput';
import { WelcomeScreen } from './components/LegalDisclaimer';
import { AdminAuthModal } from './components/AdminAuthModal';
import { AdminFileManagerModal } from './components/AdminFileManagerModal';
import { AdminMemoryModal } from './components/AdminMemoryModal';
import { SettingsModal, AdminSettingsModal } from './components/SettingsModal';
import {
  ChatMessage,
  DocumentItem,
  QuotaState,
  AdminModalType,
  AppConfig,
  ThemeMode,
} from './types';
import { isFirebaseConfigured } from './config/firebase';
import { getGlobalConfig, getDocuments } from './services/firestoreService';
import { getDailyQuota, incrementDailyQuota } from './services/quota';
import { streamGeminiResponse, DEFAULT_MODEL } from './services/gemini';

const STORAGE_CONFIG_KEY = 'tro_ly_phap_ly_app_config';
const STORAGE_CHAT_KEY = 'tro_ly_phap_ly_chat_history';

export default function App() {
  // Theme State: 'dark' | 'light' (Default to 'light' for new visitors)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {
      console.warn('Could not read theme from localStorage:', e);
    }
    return 'light';
  });

  // Sync theme with localStorage and document.documentElement root
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.warn('Could not save theme to localStorage:', e);
    }

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Application State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docSource, setDocSource] = useState<'firestore' | 'sample' | 'local'>('sample');
  const [isDocsLoading, setIsDocsLoading] = useState(true);
  const [isHydrating, setIsHydrating] = useState(true);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamAbortControllerRef = useRef<boolean>(false);

  // Daily Quota State
  const [quota, setQuota] = useState<QuotaState>(() => getDailyQuota());

  // Admin Security State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [activeModal, setActiveModal] = useState<AdminModalType>(null);
  const [pendingTargetModal, setPendingTargetModal] = useState<AdminModalType>(null);

  // AI Configuration State
  const [config, setConfig] = useState<AppConfig>(() => {
    let baseConfig: AppConfig = {
      model: DEFAULT_MODEL,
      temperature: 0.2,
      maxOutputTokens: 2048,
    };
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (saved) {
        baseConfig = { ...baseConfig, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }

    // Ensure persistent GEMINI_API_KEY is prioritized from localStorage
    try {
      const storedKey = localStorage.getItem('GEMINI_API_KEY');
      if (storedKey && storedKey.trim()) {
        baseConfig.customApiKey = storedKey.trim();
      }
    } catch (e) {
      console.warn('Error reading GEMINI_API_KEY:', e);
    }

    return baseConfig;
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // 3. TỰ ĐỘNG NẠP DỮ LIỆU KHI KHỞI CHẠY (APP HYDRATION)
  useEffect(() => {
    async function initAppData() {
      setIsHydrating(true);
      setIsDocsLoading(true);

      try {
        console.log('[App] Bắt đầu initAppData: Đồng bộ dữ liệu cloud từ Firebase Firestore...');

        // 1. Tự động nạp settings/global_config từ Firestore Cloud (Mật khẩu & Gemini API Key)
        const cloudConfig = await getGlobalConfig();

        // 2. Thứ tự ưu tiên lấy API Key:
        // API Key từ Firestore Cloud ➔ Biến môi trường VITE_GEMINI_API_KEY ➔ LocalStorage
        let resolvedApiKey = '';
        if (cloudConfig?.geminiApiKey && cloudConfig.geminiApiKey.trim()) {
          resolvedApiKey = cloudConfig.geminiApiKey.trim();
          console.log('[App] ✅ Đã nạp Gemini API Key dùng chung từ Firestore Cloud cho thiết bị này!');
        } else if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
          resolvedApiKey = import.meta.env.VITE_GEMINI_API_KEY.trim();
          console.log('[App] Sử dụng Gemini API Key từ biến môi trường VITE_GEMINI_API_KEY');
        } else {
          try {
            const localKey = localStorage.getItem('GEMINI_API_KEY');
            if (localKey && localKey.trim()) {
              resolvedApiKey = localKey.trim();
              console.log('[App] Sử dụng Gemini API Key từ bộ nhớ LocalStorage');
            }
          } catch (_) {}
        }

        // Lưu đồng bộ vào LocalStorage để các thư viện client có thể đọc ngay tức thì
        if (resolvedApiKey) {
          try {
            localStorage.setItem('GEMINI_API_KEY', resolvedApiKey);
          } catch (_) {}
        }

        // Cập nhật State cấu hình AI với API Key và Mật khẩu mới nhất
        setConfig((prev) => ({
          ...prev,
          customApiKey: resolvedApiKey || prev.customApiKey,
          customAdminPassword: cloudConfig?.adminPassword || prev.customAdminPassword,
        }));

        // 2. Nạp list file từ collection "documents" trên Firestore ➔ Cập nhật bộ tri thức cho AI
        const result = await getDocuments();

        // Quy tắc đè dữ liệu mẫu: NẾU Firestore có ít nhất 1 file ➔ XÓA HOÀN TOÀN dữ liệu mẫu
        if (result.documents.length > 0 && result.source !== 'sample') {
          console.log(`[App] Nhận ${result.documents.length} tài liệu thực tế từ ${result.source}. Đã loại bỏ 100% dữ liệu mẫu.`);
          setDocuments(result.documents);
          setDocSource(result.source);
        } else {
          console.log('[App] Chưa có tài liệu người dùng tải lên, sử dụng dữ liệu mẫu pháp lý.');
          setDocuments(result.documents);
          setDocSource('sample');
        }
      } catch (err) {
        console.error('[App] Lỗi khi nạp dữ liệu khởi chạy:', err);
      } finally {
        setIsHydrating(false);
        setIsDocsLoading(false);
      }
    }

    initAppData();
  }, []);

  // 2. Load previous chat history from localStorage
  useEffect(() => {
    try {
      const savedChat = localStorage.getItem(STORAGE_CHAT_KEY);
      if (savedChat) {
        const parsed = JSON.parse(savedChat);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not load chat history:', e);
    }
  }, []);

  // 3. Save chat history to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(messages));
      } catch (e) {
        console.warn('Could not save chat history:', e);
      }
    }
  }, [messages]);

  // 4. Smooth scrolling during streaming and message addition
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Handle Admin Access Request
  const handleOpenAdminModal = (type: AdminModalType) => {
    if (type === 'auth') {
      setActiveModal('auth');
      setPendingTargetModal(null);
      return;
    }

    if (isAdminLoggedIn) {
      setActiveModal(type);
    } else {
      // Must authenticate first
      setPendingTargetModal(type);
      setActiveModal('auth');
    }
  };

  const handleAdminAuthSuccess = (target: AdminModalType) => {
    setIsAdminLoggedIn(true);
    setActiveModal(target || 'files');
    setPendingTargetModal(null);
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setActiveModal(null);
  };

  // Handle App Configuration Updates
  const handleUpdateConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(newConfig));
    } catch (e) {
      console.error('Error saving config:', e);
    }
  };

  // Handle Reset Daily Quota (Admin test helper)
  const handleResetQuota = () => {
    localStorage.removeItem('tro_ly_phap_ly_daily_quota');
    const fresh = getDailyQuota();
    setQuota(fresh);
  };

  // Stop Streaming
  const handleStopStreaming = () => {
    streamAbortControllerRef.current = true;
    setIsStreaming(false);
  };

  // Clear Chat History
  const handleClearChat = () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử cuộc trò chuyện hiện tại?')) {
      setMessages([]);
      localStorage.removeItem(STORAGE_CHAT_KEY);
    }
  };

  // Send Message & AI Streaming Pipeline
  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || isStreaming) return;

    // Check & increment quota
    const updatedQuota = incrementDailyQuota();
    setQuota(updatedQuota);

    // Create user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: userText.trim(),
      timestamp: Date.now(),
      status: 'completed',
    };

    // Create placeholder assistant message for streaming
    const assistantMessageId = `msg-${Date.now()}-ai`;
    const initialAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setIsStreaming(true);
    streamAbortControllerRef.current = false;

    try {
      let accumulatedText = '';
      const stream = streamGeminiResponse(
        userText.trim(),
        messages,
        documents,
        config
      );

      for await (const chunk of stream) {
        if (streamAbortControllerRef.current) break;
        accumulatedText += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: accumulatedText, status: 'streaming' }
              : msg
          )
        );
      }

      // Mark completed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: accumulatedText || 'Xin lỗi, không nhận được phản hồi từ mô hình AI.',
                status: 'completed',
              }
            : msg
        )
      );
    } catch (err: any) {
      console.error('Streaming error:', err);
      const errorMessage =
        err?.message ||
        'Đã xảy ra lỗi trong quá trình xử lý. Vui lòng kiểm tra lại kết nối hoặc API Key trong phần Cài đặt.';

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `❌ **Lỗi:** ${errorMessage}`,
                status: 'error',
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-800 font-sans selection:bg-amber-500 selection:text-slate-950 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      {/* 1. Header Navigation Bar with Light/Dark Theme Switcher */}
      <Header
        quota={quota}
        isAdminLoggedIn={isAdminLoggedIn}
        onOpenAdminModal={handleOpenAdminModal}
        onAdminLogout={handleAdminLogout}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Hiệu ứng Loading nhẹ ("Đang đồng bộ dữ liệu cloud...") khi trang web vừa tải xong lần đầu */}
      {isHydrating && (
        <div
          id="cloud-hydration-banner"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-amber-500/40 bg-white/95 px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-xl shadow-amber-500/10 backdrop-blur-md dark:border-amber-500/30 dark:bg-slate-900/95 dark:text-amber-300 transition-all duration-300 animate-pulse"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
          <span>Đang đồng bộ dữ liệu cloud...</span>
        </div>
      )}

      {/* 2. Main Chat Workspace */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-4 sm:px-6">
        {/* Messages Container */}
        <div className="flex-1 space-y-2">
          {messages.length === 0 ? (
            <WelcomeScreen
              documentCount={documents.length}
              onSelectSuggestion={handleSendMessage}
            />
          ) : (
            <div className="space-y-3">
              {/* Optional Clear Chat button */}
              <div className="flex justify-end pb-1">
                <button
                  onClick={handleClearChat}
                  className="text-[11px] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition"
                >
                  Xóa lịch sử đoạn chat
                </button>
              </div>

              {messages.map((message) => (
                <ChatMessageItem key={message.id} message={message} />
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* 3. Sticky Bottom Chat Input Bar with Quota meter */}
      <ChatInput
        quota={quota}
        isStreaming={isStreaming}
        onSendMessage={handleSendMessage}
        onStopStreaming={handleStopStreaming}
      />

      {/* Footer banner when Firebase is not configured */}
      {!isFirebaseConfigured && (
        <div
          id="firebase-status-footer-banner"
          className="w-full border-t border-amber-300/50 bg-amber-50/95 py-1.5 px-4 text-center text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-slate-900/90 dark:text-amber-300 backdrop-blur-xs flex items-center justify-center gap-1.5 z-30"
        >
          <span>⚠️ Firebase chưa được cấu hình. Ứng dụng đang chạy ở chế độ Dữ liệu mẫu cục bộ.</span>
          <button
            type="button"
            onClick={() => handleOpenAdminModal('settings')}
            className="ml-1 text-[11px] underline font-semibold text-amber-950 dark:text-amber-200 hover:text-amber-600 dark:hover:text-amber-100 transition"
          >
            (Cấu hình ngay)
          </button>
        </div>
      )}

      {/* 4. Admin Protected Modals */}
      {/* Auth Modal */}
      <AdminAuthModal
        isOpen={activeModal === 'auth'}
        targetModal={pendingTargetModal}
        customAdminPassword={config.customAdminPassword}
        onSuccess={handleAdminAuthSuccess}
        onClose={() => {
          setActiveModal(null);
          setPendingTargetModal(null);
        }}
      />

      {/* 1. File & Regulation Manager */}
      <AdminFileManagerModal
        isOpen={activeModal === 'files'}
        documents={documents}
        onDocumentsUpdated={(updatedDocs) => {
          setDocuments(updatedDocs);
          setDocSource(updatedDocs.some((d) => d.source !== 'sample') ? 'firestore' : 'sample');
        }}
        onClose={() => setActiveModal(null)}
      />

      {/* 2. AI Memory & Knowledge Base */}
      <AdminMemoryModal
        isOpen={activeModal === 'memory'}
        documents={documents}
        onClose={() => setActiveModal(null)}
      />

      {/* 3. Settings & API Key */}
      <AdminSettingsModal
        isOpen={activeModal === 'settings'}
        config={config}
        quota={quota}
        onUpdateConfig={handleUpdateConfig}
        onResetQuota={handleResetQuota}
        onClose={() => setActiveModal(null)}
      />
    </div>
  );
}
