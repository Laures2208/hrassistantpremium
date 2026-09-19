export type ThemeMode = 'dark' | 'light';

export type DocumentCategory = 'law' | 'regulation' | 'contract' | 'guide' | 'custom';

export interface DocumentItem {
  id: string;
  name: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'md' | 'other';
  size: number;
  uploadedAt: string;
  textContent: string;
  category?: DocumentCategory;
  summary?: string;
  source: 'firestore' | 'sample' | 'local';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: 'streaming' | 'completed' | 'error';
  citations?: string[];
  tokensUsed?: number;
}

export interface QuotaState {
  queryCount: number;
  lastQueryDate: string;
  maxQueries: number;
  remaining: number;
}

export type AdminModalType = 'files' | 'memory' | 'settings' | 'auth' | null;

export interface AppConfig {
  model: string;
  temperature: number;
  maxOutputTokens: number;
  customApiKey?: string;
  customAdminPassword?: string;
}

export interface FirebaseConnectionStatus {
  isConnected: boolean;
  isConfigured: boolean;
  message: string;
  project?: string;
}
