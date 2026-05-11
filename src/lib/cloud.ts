import type { ProgressRecord, SettingsRecord } from '../types';

interface CloudProgress {
  id: string;
  word_id: string;
  word: string;
  book_id: string;
  status: string | null;
  stage: number | null;
  next_review_date: string | null;
  last_review_date: string | null;
  first_seen_date: string | null;
  first_learn_date: string | null;
  last_marked_date: string | null;
  fuzzy_count: number | null;
  review_count: number | null;
  consecutive_correct: number | null;
  consecutive_wrong: number | null;
  total_reviews: number | null;
  total_correct: number | null;
  is_stubborn: boolean | null;
  graduated: boolean | null;
  updated_at: string;
}

interface CloudSettings {
  id: string;
  current_book_id: string;
  daily_min_new_words: number;
  current_word_index_by_book: Record<string, number>;
  ai_enabled: boolean;
  streak_count: number;
  last_study_date: string;
  auto_speak: boolean;
  theme_mode: string;
  motion_level: string;
  sync_enabled: boolean;
  sync_token: string;
  sync_device_id: string;
  last_sync_at: string;
  last_sync_error: string;
  updated_at: string;
}

let cachedClient: any = null;

function getSupabaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL || 'https://vulhknwigcokyubftpwx.supabase.co';
}

function getSupabaseKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
}

async function getClient() {
  if (cachedClient) return cachedClient;

  const { createClient } = await import('@supabase/supabase-js');
  cachedClient = createClient(getSupabaseUrl(), getSupabaseKey());
  return cachedClient;
}

function normalizeProgress(row: CloudProgress): ProgressRecord {
  return {
    wordId: row.word_id,
    word: row.word,
    bookId: row.book_id as any,
    status: row.status as any,
    stage: row.stage ?? undefined,
    nextReviewDate: row.next_review_date ?? undefined,
    lastReviewDate: row.last_review_date ?? undefined,
    firstSeenDate: row.first_seen_date ?? undefined,
    firstLearnDate: row.first_learn_date ?? undefined,
    lastMarkedDate: row.last_marked_date ?? undefined,
    fuzzyCount: row.fuzzy_count ?? undefined,
    reviewCount: row.review_count ?? undefined,
    consecutiveCorrect: row.consecutive_correct ?? undefined,
    consecutiveWrong: row.consecutive_wrong ?? undefined,
    totalReviews: row.total_reviews ?? undefined,
    totalCorrect: row.total_correct ?? undefined,
    isStubborn: row.is_stubborn ?? undefined,
    graduated: row.graduated ?? undefined,
  };
}

function toCloudProgress(record: ProgressRecord): CloudProgress {
  return {
    id: record.wordId,
    word_id: record.wordId,
    word: record.word,
    book_id: record.bookId,
    status: record.status ?? null,
    stage: record.stage ?? null,
    next_review_date: record.nextReviewDate ?? null,
    last_review_date: record.lastReviewDate ?? null,
    first_seen_date: record.firstSeenDate ?? null,
    first_learn_date: record.firstLearnDate ?? null,
    last_marked_date: record.lastMarkedDate ?? null,
    fuzzy_count: record.fuzzyCount ?? null,
    review_count: record.reviewCount ?? null,
    consecutive_correct: record.consecutiveCorrect ?? null,
    consecutive_wrong: record.consecutiveWrong ?? null,
    total_reviews: record.totalReviews ?? null,
    total_correct: record.totalCorrect ?? null,
    is_stubborn: record.isStubborn ?? null,
    graduated: record.graduated ?? null,
    updated_at: new Date().toISOString(),
  };
}

function normalizeSettings(row: CloudSettings): SettingsRecord {
  return {
    key: 'settings',
    currentBookId: row.current_book_id as any,
    dailyMinNewWords: row.daily_min_new_words,
    currentWordIndexByBook: row.current_word_index_by_book as any,
    aiEnabled: row.ai_enabled,
    streakCount: row.streak_count,
    lastStudyDate: row.last_study_date,
    autoSpeak: row.auto_speak,
    themeMode: row.theme_mode as any,
    motionLevel: row.motion_level as any,
    syncEnabled: row.sync_enabled,
    syncToken: row.sync_token,
    syncDeviceId: row.sync_device_id,
    lastSyncAt: row.last_sync_at,
    lastSyncError: row.last_sync_error,
  };
}

function toCloudSettings(record: SettingsRecord): CloudSettings {
  return {
    id: 'settings',
    current_book_id: record.currentBookId,
    daily_min_new_words: record.dailyMinNewWords,
    current_word_index_by_book: record.currentWordIndexByBook,
    ai_enabled: record.aiEnabled,
    streak_count: record.streakCount,
    last_study_date: record.lastStudyDate,
    auto_speak: record.autoSpeak,
    theme_mode: record.themeMode ?? 'zen',
    motion_level: record.motionLevel ?? 'standard',
    sync_enabled: record.syncEnabled ?? false,
    sync_token: record.syncToken ?? '',
    sync_device_id: record.syncDeviceId ?? '',
    last_sync_at: record.lastSyncAt ?? '',
    last_sync_error: record.lastSyncError ?? '',
    updated_at: new Date().toISOString(),
  };
}

export async function cloudGetAllProgress(): Promise<ProgressRecord[]> {
  const client = await getClient();
  const { data, error } = await client.from('user_progress').select('*');
  if (error || !data) return [];
  return (data as CloudProgress[]).map(normalizeProgress);
}

export async function cloudUpsertProgress(record: ProgressRecord): Promise<void> {
  const client = await getClient();
  const { error } = await client.from('user_progress').upsert(toCloudProgress(record) as any, { onConflict: 'id' });
  if (error) console.warn('Cloud upsert progress failed:', error.message);
}

export async function cloudGetSettings(): Promise<SettingsRecord | null> {
  const client = await getClient();
  const { data, error } = await client.from('user_settings').select('*').eq('id', 'settings').single();
  if (error || !data) return null;
  return normalizeSettings(data as CloudSettings);
}

export async function cloudUpsertSettings(record: SettingsRecord): Promise<void> {
  const client = await getClient();
  const { error } = await client.from('user_settings').upsert(toCloudSettings(record) as any, { onConflict: 'id' });
  if (error) console.warn('Cloud upsert settings failed:', error.message);
}

export async function syncCloudToLocal(): Promise<number> {
  let count = 0;

  const client = await getClient();

  const { data: progressData, error: progressError } = await client.from('user_progress').select('*');
  if (!progressError && progressData) {
    const db = await import('./db');
    for (const row of progressData) {
      await db.saveProgress(normalizeProgress(row as CloudProgress));
      count++;
    }
  }

  const { data: settingsData, error: settingsError } = await client.from('user_settings').select('*').eq('id', 'settings').single();
  if (!settingsError && settingsData) {
    const db = await import('./db');
    await db.saveSettings(normalizeSettings(settingsData as CloudSettings));
    count++;
  }

  return count;
}

export async function syncLocalToCloud(): Promise<number> {
  const client = await getClient();
  const db = await import('./db');
  let count = 0;

  const progress = await db.getAllProgress();
  for (const p of progress) {
    await client.from('user_progress').upsert(toCloudProgress(p) as any, { onConflict: 'id' });
    count++;
  }

  const settings = await db.getSettings();
  if (settings) {
    await client.from('user_settings').upsert(toCloudSettings(settings) as any, { onConflict: 'id' });
    count++;
  }

  return count;
}
