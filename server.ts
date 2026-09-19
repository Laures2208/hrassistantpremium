import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;
const app = express();

app.use(express.json({ limit: '15mb' }));

// Lazy load Gemini AI instance
function getGeminiClient(customKey?: string): GoogleGenAI {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// SSE Streaming chat endpoint
app.post('/api/chat/stream', async (req, res) => {
  const { query, history = [], model = 'gemini-3.8-flash', temperature = 0.2, maxOutputTokens = 2048, apiKey } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  try {
    const ai = getGeminiClient(apiKey);

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const SYSTEM_INSTRUCTION = `Bạn là Trợ lý Pháp lý Lao động. Nhiệm vụ của bạn là trả lời câu hỏi của người dùng DỰA TẬP TRUNG 100% VÀO BỘ TÀI LIỆU ĐƯỢC CUNG CẤP DƯỚI ĐÂY.

CÁC QUY TẮC BẮT BUỘC TUÂN THỦ:
1. KHÔNG THÊM BỚT, KHÔNG TỰ SUY ĐOÁN: Chỉ sử dụng các thông tin, điều khoản, con số có mặt trong tài liệu. Tuyệt đối không tự sáng tạo hoặc lấy kiến thức ngoài tài liệu.
2. TRẢ LỜI ĐÚNG TRỌNG TÂM: Đi thẳng vào câu trả lời ngắn gọn, rõ ràng, không vòng vèo.
3. TRÍCH DẪN NGUỒN: Chỉ rõ thông tin đó nằm ở File nào, Điều mấy, Mục mấy (nếu trong tài liệu có đề cập).
4. XỬ LÝ KHI THIẾU THÔNG TIN: Nếu câu hỏi của người dùng KHÔNG CÓ trong bộ tài liệu được cung cấp, bạn BẮT BUỘC trả lời chính xác câu sau:
   "Cảm ơn bạn! Thông tin này hiện không được đề cập trong các văn bản/nội quy hiện có của hệ thống. Bạn vui lòng liên hệ bộ phận Quản trị/HR để được hỗ trợ thêm."
   (Tuyệt đối không cố gắng bịa ra câu trả lời).`;

    const contents = [
      ...history,
      {
        role: 'user',
        parts: [{ text: query }],
      },
    ];

    const stream = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature,
        maxOutputTokens,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('Gemini streaming error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Lỗi xử lý yêu cầu AI.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err?.message || 'Lỗi trong quá trình tạo câu trả lời.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Trợ Lý Pháp Lý Lao Động server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
