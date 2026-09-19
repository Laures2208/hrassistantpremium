import { GoogleGenAI } from '@google/genai';
import { ChatMessage, DocumentItem, AppConfig } from '../types';

export const DEFAULT_MODEL = 'gemini-3.8-flash';
export const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-preview-12-2025', 'gemini-1.5-flash'];
export const MAX_DOC_CONTEXT_LENGTH = 15000;
export const SEND_COOLDOWN_SECONDS = 4;

const SYSTEM_INSTRUCTION = `Bạn là "Trợ Lý Pháp Lý Lao Động", một chuyên gia cố vấn pháp lý cao cấp hàng đầu về Pháp luật Lao động Việt Nam (Bộ luật Lao động 2019 số 45/2019/QH14, các Nghị định 145/2020/NĐ-CP, Nghị định 12/2022/NĐ-CP, Luật BHXH, Luật An toàn vệ sinh lao động...).

QUY TẮC PHẢN HỒI:
1. TRẢ LỜI CHÍNH XÁC, RÕ RÀNG, CHUẨN XÁC THEO LUẬT: Luôn dẫn chiếu chính xác tên Điều, Khoản, Văn bản pháp luật liên quan (ví dụ: "Theo Khoản 1 Điều 35 Bộ luật Lao động 2019...").
2. DỰA TRÊN TÀI LIỆU KNOWLEDGE BASE ĐƯỢC CUNG CẤP: Ưu tiên tra cứu nội dung trong các tài liệu, nội quy, hợp đồng lao động đính kèm trong phần "BỘ TRI THỨC PHÁP LÝ & NỘI QUY".
3. TRÌNH BÀY DỄ HIỂU:
   - Dùng gạch đầu dòng, bảng biểu hoặc in đậm các mốc quan trọng (thời hạn, tỷ lệ %, số tiền, ngày nghỉ).
   - Cung cấp ví dụ thực tế hoặc công thức tính toán cụ thể nếu hỏi về tiền lương, trợ cấp thôi việc, lương làm thêm giờ, chế độ thai sản.
4. LƯU Ý PHÁP LÝ: Nếu tình huống cần kiểm tra thêm hồ sơ cụ thể hoặc có nguy cơ tranh chấp pháp lý phức tạp, hãy đưa ra khuyến nghị tham vấn cơ quan quản lý lao động hoặc luật sư có chuyên môn.`;

/**
 * Trims document context to stay under 15,000 characters and removes excessive whitespace.
 */
export function buildDocumentContext(documents: DocumentItem[]): string {
  if (!documents || documents.length === 0) return '';

  let totalChars = 0;
  const sections: string[] = [];

  for (const doc of documents) {
    if (!doc.textContent) continue;
    const cleanText = doc.textContent
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    // Check if adding this document exceeds limit
    const sectionHeader = `\n=== TÀI LIỆU: ${doc.name} (${doc.category || 'Luật/Nội quy'}) ===\n`;
    const availableSpace = MAX_DOC_CONTEXT_LENGTH - totalChars - sectionHeader.length;

    if (availableSpace <= 200) {
      break;
    }

    if (cleanText.length <= availableSpace) {
      sections.push(`${sectionHeader}${cleanText}`);
      totalChars += sectionHeader.length + cleanText.length;
    } else {
      // Truncate to available space
      const truncated = cleanText.substring(0, availableSpace) + '\n...[Đã rút gọn tài liệu do giới hạn độ dài]';
      sections.push(`${sectionHeader}${truncated}`);
      totalChars += sectionHeader.length + truncated.length;
      break;
    }
  }

  return sections.join('\n');
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
  const apiKey =
    config.customApiKey ||
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : '');

  if (!apiKey) {
    throw new Error(
      'Không tìm thấy API Key của Gemini. Quản trị viên vui lòng cấu hình VITE_GEMINI_API_KEY hoặc nhập API Key trong phần "Cài đặt & API Key".'
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
