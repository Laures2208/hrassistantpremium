import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;
const app = express();

app.use(express.json({ limit: '25mb' }));

// Helper for local data persistence directory
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FIREBASE_CONFIG_FILE = path.join(DATA_DIR, 'firebase-config.json');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Lazy load Gemini AI instance
function getGeminiClient(customKey?: string): GoogleGenAI {
  let apiKey = customKey || process.env.GEMINI_API_KEY;

  if (!apiKey && fs.existsSync(SETTINGS_FILE)) {
    try {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const saved = JSON.parse(raw);
      if (saved?.geminiApiKey && typeof saved.geminiApiKey === 'string' && saved.geminiApiKey.trim()) {
        apiKey = saved.geminiApiKey.trim();
      }
    } catch (_) {}
  }

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

// Firebase config sync endpoint (allows any device to connect to the same Firebase instance)
app.get('/api/firebase-config', (req, res) => {
  try {
    // 1. Check environment variables first
    const envConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY || '',
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.VITE_FIREBASE_APP_ID || '',
    };

    if (envConfig.apiKey && envConfig.projectId) {
      return res.json(envConfig);
    }

    // 2. Check saved config file
    if (fs.existsSync(FIREBASE_CONFIG_FILE)) {
      const raw = fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf-8');
      const saved = JSON.parse(raw);
      if (saved && saved.apiKey && saved.projectId) {
        return res.json(saved);
      }
    }

    return res.json({});
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read Firebase config' });
  }
});

app.post('/api/firebase-config', (req, res) => {
  try {
    const config = req.body;
    if (config && config.apiKey && config.projectId) {
      fs.writeFileSync(FIREBASE_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
      return res.json({ success: true, message: 'Firebase configuration saved successfully' });
    }
    return res.status(400).json({ error: 'apiKey and projectId are required' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to save Firebase config' });
  }
});

// Shared documents persistence across all devices
app.get('/api/documents', (req, res) => {
  try {
    if (fs.existsSync(DOCUMENTS_FILE)) {
      const raw = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
      const docs = JSON.parse(raw);
      return res.json(Array.isArray(docs) ? docs : []);
    }
    return res.json([]);
  } catch (err) {
    return res.json([]);
  }
});

app.post('/api/documents', (req, res) => {
  try {
    const docItem = req.body;
    if (!docItem || !docItem.id) {
      return res.status(400).json({ error: 'Invalid document payload' });
    }

    let existingDocs: any[] = [];
    if (fs.existsSync(DOCUMENTS_FILE)) {
      try {
        const raw = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
        existingDocs = JSON.parse(raw);
        if (!Array.isArray(existingDocs)) existingDocs = [];
      } catch (_) {
        existingDocs = [];
      }
    }

    const index = existingDocs.findIndex((d) => d.id === docItem.id);
    if (index >= 0) {
      existingDocs[index] = docItem;
    } else {
      existingDocs.unshift(docItem);
    }

    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(existingDocs, null, 2), 'utf-8');
    return res.json({ success: true, count: existingDocs.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to persist document' });
  }
});

app.delete('/api/documents/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (fs.existsSync(DOCUMENTS_FILE)) {
      const raw = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
      let existingDocs = JSON.parse(raw);
      if (Array.isArray(existingDocs)) {
        existingDocs = existingDocs.filter((d) => d.id !== id);
        fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(existingDocs, null, 2), 'utf-8');
      }
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete document' });
  }
});

// Shared global settings persistence across all devices
app.get('/api/settings', (req, res) => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const settings = JSON.parse(raw);
      return res.json(settings);
    }
    return res.json({ adminPassword: process.env.VITE_ADMIN_PASSWORD || '123456' });
  } catch (err) {
    return res.json({ adminPassword: process.env.VITE_ADMIN_PASSWORD || '123456' });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const payload = req.body;
    let existingSettings: any = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      try {
        existingSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      } catch (_) {}
    }
    const updated = { ...existingSettings, ...payload, updated_at: new Date().toISOString() };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return res.json({ success: true, settings: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to persist settings' });
  }
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
