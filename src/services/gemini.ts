import { GoogleGenAI } from '@google/genai';
import { ChatMessage, DocumentItem, AppConfig } from '../types';

export const DEFAULT_MODEL = 'gemini-3.8-flash';
export const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-preview-12-2025', 'gemini-1.5-flash'];
export const MAX_DOC_CONTEXT_LENGTH = 250000;
export const SEND_COOLDOWN_SECONDS = 4;

export const SYSTEM_INSTRUCTION = `Bạn là Trợ lý Pháp lý Lao động. Nhiệm vụ của bạn là trả lời câu hỏi của người dùng DỰA TẬP TRUNG 100% VÀO BỘ TÀI LIỆU ĐƯỢC CUNG CẤP DƯỚI ĐÂY.

CÁC QUY TẮC BẮT BUỘC TUÂN THỦ:
1. KHÔNG THÊM BỚT, KHÔNG TỰ SUY ĐOÁN: Chỉ sử dụng các thông tin, điều khoản, con số có mặt trong tài liệu. Tuyệt đối không tự sáng tạo hoặc lấy kiến thức ngoài tài liệu.
2. TRẢ LỜI ĐÚNG TRỌNG TÂM: Đi thẳng vào câu trả lời ngắn gọn, rõ ràng, không vòng vèo.
3. TRÍCH DẪN NGUỒN: Chỉ rõ thông tin đó nằm ở File nào, Điều mấy, Mục mấy (nếu trong tài liệu có đề cập).
4. XỬ LÝ KHI THIẾU THÔNG TIN: Nếu câu hỏi của người dùng KHÔNG CÓ trong bộ tài liệu được cung cấp, bạn BẮT BUỘC trả lời chính xác câu sau:
   "Cảm ơn bạn! Thông tin này hiện không được đề cập trong các văn bản/nội quy hiện có của hệ thống. Bạn vui lòng liên hệ bộ phận Quản trị/HR để được hỗ trợ thêm."
   (Tuyệt đối không cố gắng bịa ra câu trả lời).`;

/**
 * Resolves the active Gemini API Key following strict priority:
 * 1. API Key từ Firestore Cloud (customApiKey từ State/Config)
 * 2. Biến môi trường VITE_GEMINI_API_KEY
 * 3. LocalStorage ('GEMINI_API_KEY')
 */
export function getStoredApiKey(customApiKey?: string): string {
  // 1. Ưu tiên số 1: API Key từ Firestore Cloud (được nạp vào State/Config)
  if (customApiKey && customApiKey.trim()) {
    return customApiKey.trim();
  }

  // 2. Ưu tiên số 2: Biến môi trường VITE_GEMINI_API_KEY
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY.trim();
    if (envKey) return envKey;
  }

  // 3. Ưu tiên số 3: LocalStorage
  try {
    const fromStorage = localStorage.getItem('GEMINI_API_KEY');
    if (fromStorage && fromStorage.trim()) {
      return fromStorage.trim();
    }
  } catch (e) {
    console.warn('Cannot read GEMINI_API_KEY from localStorage:', e);
  }

  return '';
}

/**
 * Bundles the textContent of ALL active documents into clean context for Gemini RAG.
 * Cleans redundant spaces and excessive line breaks while preserving full document structure.
 */
export function buildDocumentContext(documents: DocumentItem[]): string {
  if (!documents || documents.length === 0) return '';

  let totalChars = 0;
  const sections: string[] = [];

  for (const doc of documents) {
    if (!doc.textContent || !doc.textContent.trim()) continue;

    // Clean redundant spaces and excessive newlines to optimize tokens
    const cleanText = doc.textContent
      .replace(/[ \t]+/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    if (!cleanText) continue;

    const sectionHeader = `\n========================================\n[TÀI LIỆU / VĂN BẢN]: ${doc.name}\n[LOẠI TÀI LIỆU]: ${doc.category || 'Văn bản quy định'}\n========================================\n`;
    const availableSpace = MAX_DOC_CONTEXT_LENGTH - totalChars - sectionHeader.length;

    if (availableSpace <= 100) {
      break;
    }

    if (cleanText.length <= availableSpace) {
      sections.push(`${sectionHeader}${cleanText}`);
      totalChars += sectionHeader.length + cleanText.length;
    } else {
      const truncated = cleanText.substring(0, availableSpace) + '\n...[Đã rút gọn bớt phần cuối tài liệu do giới hạn độ dài]';
      sections.push(`${sectionHeader}${truncated}`);
      totalChars += sectionHeader.length + truncated.length;
      break;
    }
  }

  return sections.join('\n\n');
}

/**
 * Prunes chat history to keep only the last 4 messages (2 user questions + 2 assistant responses).
 */
export function pruneChatHistory(messages: ChatMessage[]): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  // Filter out system or pending error messages
  const validMessages = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  // Take last 4 messages
  const recentMessages = validMessages.slice(-4);

  return recentMessages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));
}

/**
 * Stream chat response from server API route or fallback to client SDK
 */
export async function* streamGeminiResponse(
  userQuery: string,
  history: ChatMessage[],
  documents: DocumentItem[],
  config: AppConfig,
  onCitationFound?: (citation: string) => void
): AsyncGenerator<string, void, unknown> {
  const docContext = buildDocumentContext(documents);
  const prunedHistory = pruneChatHistory(history);

  const fullPrompt = docContext
    ? `[BỘ TRI THỨC PHÁP LÝ & NỘI QUY]\n${docContext}\n\n[CÂU HỎI CỦA NGƯỜI DÙNG]\n${userQuery}`
    : userQuery;

  const activeApiKey = getStoredApiKey(config.customApiKey);

  // 1. Try server-side streaming API first
  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: fullPrompt,
        history: prunedHistory,
        model: config.model || DEFAULT_MODEL,
        temperature: config.temperature || 0.2,
        maxOutputTokens: config.maxOutputTokens || 2048,
        apiKey: activeApiKey || undefined,
      }),
    });

    if (response.ok && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') return;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                yield parsed.text;
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch {
              // Plain text chunk fallback
              if (dataStr && dataStr !== '[DONE]') {
                yield dataStr;
              }
            }
          }
        }
      }
      return;
    }
  } catch (serverErr) {
    console.warn('Server streaming endpoint unavailable or failed, falling back to client SDK:', serverErr);
  }

  // 2. Client-side SDK fallback (for static Vercel SPA deployments or custom key)
  const apiKey = activeApiKey;

  if (!apiKey) {
    throw new Error(
      'Không tìm thấy API Key của Gemini. Quản trị viên vui lòng nhập API Key trong phần "Cài đặt & API Key" hoặc cấu hình VITE_GEMINI_API_KEY.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  // Format contents for @google/genai
  const contents = [
    ...prunedHistory,
    {
      role: 'user' as const,
      parts: [{ text: fullPrompt }],
    },
  ];

  let selectedModel = config.model || DEFAULT_MODEL;
  let responseStream;

  try {
    responseStream = await ai.models.generateContentStream({
      model: selectedModel,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: config.temperature ?? 0.2,
        maxOutputTokens: config.maxOutputTokens ?? 2048,
      },
    });
  } catch (modelErr: any) {
    console.warn(`Error streaming with model ${selectedModel}, trying fallback models:`, modelErr);
    // Try fallback models
    let succeeded = false;
    for (const fbModel of FALLBACK_MODELS) {
      if (fbModel === selectedModel) continue;
      try {
        responseStream = await ai.models.generateContentStream({
          model: fbModel,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: config.temperature ?? 0.2,
            maxOutputTokens: config.maxOutputTokens ?? 2048,
          },
        });
        succeeded = true;
        break;
      } catch (e) {
        console.warn(`Fallback ${fbModel} failed:`, e);
      }
    }
    if (!succeeded || !responseStream) {
      throw new Error(modelErr?.message || 'Không thể kết nối đến mô hình AI. Vui lòng kiểm tra lại API Key hoặc mạng.');
    }
  }

  for await (const chunk of responseStream) {
    const chunkText = chunk.text;
    if (chunkText) {
      yield chunkText;
    }
  }
}
