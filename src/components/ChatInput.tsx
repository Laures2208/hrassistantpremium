import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Clock, AlertCircle, StopCircle, ArrowUp } from 'lucide-react';
import { QuotaState } from '../types';
import { SEND_COOLDOWN_SECONDS } from '../services/gemini';

interface ChatInputProps {
  quota: QuotaState;
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
}

const QUICK_SUGGESTIONS = [
  'Thời gian thử việc tối đa của từng vị trí?',
  'Lương làm thêm giờ ban đêm tính thế nào?',
  'Điều kiện để công ty được sa thải nhân viên?',
  'Quy định nghỉ thai sản cho lao động nữ và nam?',
  'Thủ tục đơn phương chấm dứt hợp đồng lao động?',
  'Quy định về tiền lương và trợ cấp thôi việc?',
];

export const ChatInput: React.FC<ChatInputProps> = ({
  quota,
  isStreaming,
  onSendMessage,
  onStopStreaming,
}) => {
  const [inputText, setInputText] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isQuotaExhausted = quota.remaining <= 0;
  const isSendDisabled = isStreaming || isQuotaExhausted || cooldownRemaining > 0 || !inputText.trim();

  // Cooldown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cooldownRemaining > 0) {
      interval = setInterval(() => {
        setCooldownRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSendDisabled) return;

    const trimmed = inputText.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInputText('');
    setCooldownRemaining(SEND_COOLDOWN_SECONDS);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (isQuotaExhausted || isStreaming || cooldownRemaining > 0) return;
    onSendMessage(suggestion);
    setCooldownRemaining(SEND_COOLDOWN_SECONDS);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  // Determine badge colors above chat input
  let quotaBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30';
  let quotaDot = 'bg-emerald-500 dark:bg-emerald-400';
  let quotaLabel = `Lượt hỏi hôm nay: ${quota.remaining}/${quota.maxQueries}`;

  if (quota.remaining === 0) {
    quotaBadgeClass = 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30';
    quotaDot = 'bg-rose-500 dark:bg-rose-400';
    quotaLabel = `Đã hết lượt hỏi: 0/${quota.maxQueries}`;
  } else if (quota.remaining <= 5) {
    quotaBadgeClass = 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30';
    quotaDot = 'bg-amber-500 dark:bg-amber-400';
    quotaLabel = `Lượt hỏi hôm nay: ${quota.remaining}/${quota.maxQueries}`;
  }

  return (
    <div className="sticky bottom-0 z-20 w-full border-t border-slate-200 bg-white/95 p-3 sm:p-4 backdrop-blur-md transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto max-w-4xl space-y-2.5">
        {/* Top bar above input: Quota Badge & Quick suggestions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Daily Quota UI Badge (Mandatory Requirement) */}
          <div
            id="daily-quota-badge"
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${quotaBadgeClass}`}
          >
            <span className={`h-2 w-2 rounded-full ${quotaDot} animate-pulse`} />
            <span>{quotaLabel}</span>
          </div>

          {/* Cooldown notification */}
          {cooldownRemaining > 0 && (
            <div className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <Clock className="h-3 w-3 animate-spin" />
              <span>Chờ {cooldownRemaining}s để gửi tiếp...</span>
            </div>
          )}

          <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            Shift + Enter để xuống dòng • Enter để gửi
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {QUICK_SUGGESTIONS.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isQuotaExhausted || isStreaming || cooldownRemaining > 0}
              onClick={() => handleSuggestionClick(suggestion)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 shadow-2xs transition hover:border-amber-500/50 hover:bg-amber-50/70 hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-amber-500/40 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Sparkles className="h-3 w-3 text-amber-500 dark:text-amber-400" />
              <span className="whitespace-nowrap">{suggestion}</span>
            </button>
          ))}
        </div>

        {/* Disabled Banner when Quota reaches 0 */}
        {isQuotaExhausted ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500 dark:text-rose-400" />
            <p>
              Bạn đã sử dụng hết <strong>20/20 lượt hỏi miễn phí</strong> hôm nay. Hạn mức sẽ tự động làm mới vào ngày mai!
            </p>
          </div>
        ) : (
          /* Normal Input Form */
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              disabled={isQuotaExhausted || isStreaming}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isStreaming
                  ? 'Trợ lý đang phản hồi...'
                  : 'Hỏi về Bộ luật Lao động, hợp đồng, thử việc, tiền lương, thai sản, nghỉ phép...'
              }
              className="w-full resize-none rounded-2xl border border-slate-300 bg-white py-3.5 pl-4 pr-24 text-sm text-slate-900 placeholder-slate-400 shadow-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950/90 dark:text-white dark:placeholder-slate-500 dark:shadow-inner"
            />

            <div className="absolute right-2.5 flex items-center gap-1.5">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopStreaming}
                  className="flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-rose-500 active:scale-95 transition"
                  title="Dừng phản hồi"
                >
                  <StopCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Dừng</span>
                </button>
              ) : (
                <button
                  id="chat-send-btn"
                  type="submit"
                  disabled={isSendDisabled}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 transition"
                  title={cooldownRemaining > 0 ? `Vui lòng chờ ${cooldownRemaining}s` : 'Gửi câu hỏi'}
                >
                  {cooldownRemaining > 0 ? (
                    <span className="text-xs font-bold text-slate-950">{cooldownRemaining}</span>
                  ) : (
                    <ArrowUp className="h-5 w-5 stroke-[2.5]" />
                  )}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
