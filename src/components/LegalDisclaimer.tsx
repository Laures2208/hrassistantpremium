import React from 'react';
import { Scale, BookCheck, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';

interface WelcomeScreenProps {
  onSelectSuggestion: (question: string) => void;
  documentCount: number;
}

const SAMPLE_QUESTIONS = [
  {
    title: 'Hợp đồng & Thử việc',
    desc: 'Thời gian thử việc tối đa của từng vị trí và mức lương thử việc theo quy định?',
    question: 'Thời gian thử việc tối đa cho từng chức danh công việc là bao lâu và tiền lương thử việc được tính ít nhất bao nhiêu % theo Bộ luật Lao động 2019?',
  },
  {
    title: 'Làm thêm giờ & Ban đêm',
    desc: 'Cách tính tiền lương làm thêm giờ ban ngày, ban đêm, ngày nghỉ hàng tuần, lễ tết?',
    question: 'Hãy hướng dẫn chi tiết cách tính tiền lương làm thêm giờ vào ngày thường, ngày nghỉ hàng tuần, ngày lễ tết và làm thêm giờ vào ban đêm theo Điều 98 Bộ luật Lao động 2019.',
  },
  {
    title: 'Kỷ luật & Sa thải',
    desc: 'Các trường hợp doanh nghiệp được phép sa thải nhân viên đúng trình tự pháp luật?',
    question: 'Doanh nghiệp được phép xử lý kỷ luật sa thải người lao động trong những trường hợp cụ thể nào theo Điều 125 Bộ luật Lao động 2019? Những điều cấm khi kỷ luật lao động là gì?',
  },
  {
    title: 'Chế độ Thai sản & Lao động Nữ',
    desc: 'Thời gian nghỉ thai sản cho lao động nữ, chế độ nghỉ của lao động nam khi vợ sinh con?',
    question: 'Quy định chi tiết về thời gian nghỉ thai sản của lao động nữ, mức trợ cấp thai sản và quyền lợi nghỉ việc của lao động nam khi vợ sinh con theo Luật Lao động và Luật BHXH?',
  },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSelectSuggestion,
  documentCount,
}) => {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-8 text-center sm:py-12">
      {/* Emblem */}
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-xl shadow-amber-600/25 dark:shadow-amber-950/50">
        <Scale className="h-8 w-8 text-slate-950 stroke-[2.2]" />
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-amber-500/50 bg-white text-[10px] font-bold text-amber-600 shadow-xs dark:bg-slate-900 dark:text-amber-400">
          AI
        </span>
      </div>

      <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
        Trợ Lý Pháp Lý Lao Động Việt Nam
      </h2>
      <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-600 dark:text-slate-400 sm:text-sm">
        Hệ thống AI chuyên gia hỗ trợ tra cứu, tư vấn và giải đáp các vấn đề về{' '}
        <strong className="font-semibold text-amber-700 dark:text-amber-300">Bộ luật Lao động 2019 (Luật số 45/2019/QH14)</strong>, hợp đồng lao động, tiền lương, chế độ thai sản, kỷ luật và bảo hiểm xã hội.
      </p>

      {/* Tri thức badge */}
      <div className="mt-4 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1 text-xs text-slate-700 shadow-2xs dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
        <BookCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span>Bộ tri thức đã kích hoạt: <strong>{documentCount} văn bản pháp quy</strong></span>
      </div>

      {/* Suggested question cards */}
      <div className="mt-8 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2">
        {SAMPLE_QUESTIONS.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelectSuggestion(item.question)}
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-amber-500/50 hover:bg-amber-50/40 hover:shadow-md hover:shadow-amber-500/5 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-amber-500/40 dark:hover:bg-slate-800/60 dark:hover:shadow-lg dark:hover:shadow-amber-500/5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 group-hover:text-amber-800 dark:text-amber-400 dark:group-hover:text-amber-300">
                {item.title}
              </span>
              <Sparkles className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-amber-600 dark:text-slate-500 dark:group-hover:text-amber-400" />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white">
              {item.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Legal disclaimer */}
      <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500/80" />
        <p>
          <strong>Lưu ý pháp lý:</strong> Các câu trả lời được tổng hợp tự động từ văn bản pháp luật hiện hành và tài liệu nội quy để hỗ trợ tra cứu tham khảo. Đối với các tranh chấp lao động cụ thể hoặc vụ việc phức tạp, khuyến nghị tham khảo ý kiến trực tiếp của luật sư hoặc cơ quan quản lý lao động có thẩm quyền.
        </p>
      </div>
    </div>
  );
};
