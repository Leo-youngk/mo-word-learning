import { backendPost } from '../lib/backend';
import type { StoredBookId } from '../types';

export interface DailyActivity {
  date: string;
  bookId: StoredBookId;
  newWordsCount: number;
  reviewWordsCount: number;
  totalWordsStudied: number;
}

export async function getDailyActivity(date: string): Promise<DailyActivity | null> {
  const data = await backendPost<{ activity: DailyActivity | null }>('/api/data', {
    scope: 'activity',
    action: 'getDaily',
    payload: { date },
  });
  return data.activity;
}

export async function getRecentActivities(days: number = 7): Promise<DailyActivity[]> {
  const data = await backendPost<{ activities: DailyActivity[] }>('/api/data', {
    scope: 'activity',
    action: 'getRecent',
    payload: { days },
  });
  return data.activities;
}

export async function upsertDailyActivity(activity: DailyActivity): Promise<void> {
  await backendPost<{ ok: boolean }>('/api/data', {
    scope: 'activity',
    action: 'upsert',
    payload: { activity },
  });
}

export async function incrementDailyCounts(date: string, bookId: StoredBookId, isNew: boolean): Promise<void> {
  await backendPost<{ activity: DailyActivity }>('/api/data', {
    scope: 'activity',
    action: 'increment',
    payload: { date, bookId, isNew },
  });
}
