import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ChatMessageItem } from './components/ChatMessageItem';
import { ChatInput } from './components/ChatInput';
import { WelcomeScreen } from './components/LegalDisclaimer';
import { AdminAuthModal } from './components/AdminAuthModal';
import { AdminFileManagerModal } from './components/AdminFileManagerModal';
import { AdminMemoryModal } from './components/AdminMemoryModal';
import { AdminSettingsModal } from './components/AdminSettingsModal';
import {
  ChatMessage,
  DocumentItem,
  QuotaState,
  AdminModalType,
  AppConfig,
} from './types';
import { fetchInitialDocuments } from './services/firebase';
import { getDailyQuota, incrementDailyQuota } from './services/quota';
import { streamGeminiResponse, DEFAULT_MODEL } from './services/gemini';

const STORAGE_CONFIG_KEY = 'tro_ly_phap_ly_app_config';
const STORAGE_CHAT_KEY = 'tro_ly_phap_ly_chat_history';

export default function App() {
  // Application State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docSource, setDocSource] = useState<'firestore' | 'sample' | 'local'>('sample');
  const [isDocsLoading, setIsDocsLoading] = useState(true);

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
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading config:', e);
    }
    return {
      model: DEFAULT_MODEL,
      temperature: 0.2,
      maxOutputTokens: 2048,
    };
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch initial documents ONCE on boot from Firebase Firestore or sample fallback
  useEffect(() => {
    async function loadDocs() {
      setIsDocsLoading(true);
      try {
        const result = await fetchInitialDocuments();
        setDocuments(result.documents);
        setDocSource(result.source);
      } catch (err) {
        console.error('Error loading initial documents:', err);
      } finally {
        setIsDocsLoading(false);
      }
    }
    loadDocs();
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
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* 1. Header Navigation Bar */}
      <Header
        quota={quota}
        isAdminLoggedIn={isAdminLoggedIn}
        onOpenAdminModal={handleOpenAdminModal}
        onAdminLogout={handleAdminLogout}
      />

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
                  className="text-[11px] text-slate-500 hover:text-rose-400 transition"
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
        onDocumentsUpdated={(updatedDocs) => setDocuments(updatedDocs)}
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
