import { QuotaState } from '../types';

export const MAX_DAILY_QUERIES = 20;
const QUOTA_STORAGE_KEY = 'tro_ly_phap_ly_daily_quota';

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyQuota(): QuotaState {
  const today = getTodayString();
  try {
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!raw) {
      const initial: QuotaState = {
        queryCount: 0,
        lastQueryDate: today,
        maxQueries: MAX_DAILY_QUERIES,
        remaining: MAX_DAILY_QUERIES,
      };
      localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    const data = JSON.parse(raw);
    // If date changed, reset query_count to 0
    if (data.lastQueryDate !== today) {
      const reset: QuotaState = {
        queryCount: 0,
        lastQueryDate: today,
        maxQueries: MAX_DAILY_QUERIES,
        remaining: MAX_DAILY_QUERIES,
      };
      localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(reset));
      return reset;
    }

    const queryCount = Number(data.queryCount) || 0;
    const remaining = Math.max(0, MAX_DAILY_QUERIES - queryCount);
    return {
      queryCount,
      lastQueryDate: today,
      maxQueries: MAX_DAILY_QUERIES,
      remaining,
    };
  } catch (error) {
    console.error('Error reading quota from localStorage:', error);
    return {
      queryCount: 0,
      lastQueryDate: today,
      maxQueries: MAX_DAILY_QUERIES,
      remaining: MAX_DAILY_QUERIES,
    };
  }
}

export function incrementDailyQuota(): QuotaState {
  const current = getDailyQuota();
  const newCount = current.queryCount + 1;
  const remaining = Math.max(0, MAX_DAILY_QUERIES - newCount);
  const updated: QuotaState = {
    queryCount: newCount,
    lastQueryDate: current.lastQueryDate,
    maxQueries: MAX_DAILY_QUERIES,
    remaining,
  };
  try {
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving quota to localStorage:', error);
  }
  return updated;
}

export function canSubmitQuery(): boolean {
  const quota = getDailyQuota();
  return quota.remaining > 0;
}
