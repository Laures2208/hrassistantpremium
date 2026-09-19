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

    const SYSTEM_INSTRUCTION = `Bạn là "Trợ Lý Pháp Lý Lao Động", chuyên gia cố vấn pháp lý cao cấp về Bộ luật Lao động Việt Nam 2019 và các quy định pháp luật liên quan. Hãy trả lời chuẩn xác, viện dẫn Điều, Khoản chi tiết, văn phong chuyên nghiệp và rõ ràng.`;

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
