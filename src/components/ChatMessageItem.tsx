import React, { useState } from 'react';
import { Scale, User, Copy, Check, Sparkles, BookOpen, AlertTriangle } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatMessageItemProps {
  message: ChatMessage;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === 'assistant';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to format text with highlighted legal articles (e.g., Điều 35, Khoản 1, BLLĐ 2019)
  const renderFormattedContent = (content: string) => {
    if (!content) return null;

    // Split by paragraphs
    const paragraphs = content.split('\n');

    return paragraphs.map((paragraph, pIdx) => {
      if (paragraph.trim() === '') {
        return <div key={pIdx} className="h-2" />;
      }

      // Check if it's a heading or section title
      if (paragraph.startsWith('###') || paragraph.startsWith('##') || paragraph.startsWith('#')) {
        const titleText = paragraph.replace(/^#+\s*/, '');
        return (
          <h4 key={pIdx} className="mt-3 mb-1.5 text-sm font-bold text-amber-800 dark:text-amber-300">
            {titleText}
          </h4>
        );
      }

      // Check if it's a bullet point
      if (paragraph.trim().startsWith('- ') || paragraph.trim().startsWith('* ') || paragraph.trim().startsWith('+ ')) {
        const bulletText = paragraph.trim().substring(2);
        return (
          <li key={pIdx} className="ml-4 list-disc text-slate-700 dark:text-slate-200 leading-relaxed text-sm py-0.5">
            {formatInlineLegalText(bulletText)}
          </li>
        );
      }

      return (
        <p key={pIdx} className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 py-1">
          {formatInlineLegalText(paragraph)}
        </p>
      );
    });
  };

  // Inline formatting helper for bolding and legal terms
  const formatInlineLegalText = (text: string) => {
    // Replace **text** with <strong>
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        // Special styling for legal articles like Điều 123
        const isLawArticle = /(Điều\s+\d+|Khoản\s+\d+|Bộ luật|Nghị định|Thông tư)/i.test(inner);
        return (
          <strong
            key={idx}
            className={`font-semibold ${
              isLawArticle
                ? 'text-amber-800 bg-amber-500/15 px-1 py-0.5 rounded border border-amber-500/30 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {inner}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div
      className={`group flex w-full gap-3 py-4 sm:gap-4 transition-colors duration-150 ${
        isAssistant ? 'bg-slate-50/70 dark:bg-slate-900/40 rounded-xl px-2 sm:px-3' : 'bg-transparent px-2 sm:px-3'
      }`}
    >
      {/* Avatar */}
      <div className="shrink-0 pt-0.5">
        {isAssistant ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-md shadow-amber-600/20 dark:shadow-amber-950/40 text-slate-950">
            <Scale className="h-4 w-4 stroke-[2.3]" />
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200 border border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
            <User className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Message Body */}
      <div className="flex-1 overflow-hidden">
        {/* Name and Meta */}
        <div className="flex items-center justify-between pb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-200">
              {isAssistant ? 'Trợ Lý Pháp Lý Lao Động' : 'Bạn'}
            </span>
            {isAssistant && (
              <span className="flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300">
                <Sparkles className="h-3 w-3" />
                Bộ luật Lao động 2019
              </span>
            )}
          </div>

          {/* Action buttons */}
          {isAssistant && message.content && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition"
              title="Sao chép nội dung"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Sao chép</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Content Card */}
        <div className="rounded-2xl rounded-tl-none border border-slate-200 bg-white p-4 text-slate-800 shadow-sm backdrop-blur-sm transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-900/70 dark:text-slate-100">
          {renderFormattedContent(message.content)}

          {/* Typewriter streaming indicator */}
          {message.status === 'streaming' && (
            <span className="inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-amber-500 dark:bg-amber-400 ml-1" />
          )}

          {/* Legal Disclaimer Footer on AI answers */}
          {isAssistant && message.status === 'completed' && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <BookOpen className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400/80 shrink-0 mt-0.5" />
              <span>
                Nội dung tư vấn được đối chiếu từ Bộ luật Lao động 2019 và văn bản pháp luật hiện hành.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
