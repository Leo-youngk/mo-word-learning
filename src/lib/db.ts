// ============================================================
// IndexedDB 数据层 —「默」Mo
// 使用 idb 库封装，只做存储操作，不含业务逻辑
// ============================================================

import { openDB, type IDBPDatabase } from 'idb';
import type {
  BookId,
  StoredBookId,
  WordEntry,
  WordbookRecord,
  ProgressRecord,
  DailyLogRecord,
  SettingsRecord,
  SessionRecord,
  ExportPayload,
  SyncEntity,
  SyncQueueRecord,
} from '../types';
import { BOOK_IDS } from './books';

const DB_NAME = 'mo-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // wordbooks: 词库原始数据
        if (!db.objectStoreNames.contains('wordbooks')) {
          db.createObjectStore('wordbooks', { keyPath: 'bookId' });
        }
        // progress: 每个词的学习进度
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'wordId' });
        }
        // dailyLog: 每日学习记录
        if (!db.objectStoreNames.contains('dailyLog')) {
          db.createObjectStore('dailyLog', { keyPath: 'date' });
        }
        // settings: 用户设置
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        // session: 当前会话
        if (!db.objectStoreNames.contains('session')) {
          db.createObjectStore('session', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncQueue = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncQueue.createIndex('status', 'status');
          syncQueue.createIndex('updatedAt', 'updatedAt');
        }
      },
    });
  }
  return dbPromise;
}

// ============================================================
// Settings
// ============================================================

export async function getSettings(): Promise<SettingsRecord | null> {
  const db = await getDB();
  const record = await db.get('settings', 'settings');
  if (!record) return null;
  const migrated = migrateSettings(record);
  if (JSON.stringify(record) !== JSON.stringify(migrated)) {
    await saveSettings(migrated);
  }
  return migrated;
}

export async function saveSettings(settings: SettingsRecord): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings);
}

export function createDefaultSettings(currentBookId: BookId = 'cet6'): SettingsRecord {
  return {
    key: 'settings',
    currentBookId,
    dailyMinNewWords: 25,
    currentWordIndexByBook: createDefaultWordIndexByBook(),
    aiEnabled: false,
    streakCount: 0,
    lastStudyDate: '',
    autoSpeak: false,
    deepseekApiKey: '',
    themeMode: 'zen',
    motionLevel: 'standard',
    syncEnabled: false,
    syncToken: '',
    syncDeviceId: createDeviceId(),
    lastSyncAt: '',
    lastSyncError: '',
  };
}

export function createDefaultWordIndexByBook(): Record<BookId, number> {
  return {
    cet4: 0,
    cet6: 0,
    toefl: 0,
  };
}

function normalizeBookId(bookId: unknown): BookId {
  if (bookId === 'cet4' || bookId === 'cet6' || bookId === 'toefl') {
    return bookId;
  }
  return 'cet4';
}

function migrateSettings(raw: any): SettingsRecord {
  const currentBookId = normalizeBookId(raw.currentBookId);
  const currentWordIndexByBook = createDefaultWordIndexByBook();
  const existingIndexes = raw.currentWordIndexByBook || {};

  for (const id of BOOK_IDS) {
    const value = Number(existingIndexes[id]);
    currentWordIndexByBook[id] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  if (!raw.currentWordIndexByBook && typeof raw.currentWordIndex === 'number') {
    currentWordIndexByBook[currentBookId] = Math.max(0, Math.floor(raw.currentWordIndex));
  }

  const themeMode = raw.themeMode === 'aggressive' ? 'intense' : raw.themeMode;

  return {
    key: 'settings',
    currentBookId,
    dailyMinNewWords: typeof raw.dailyMinNewWords === 'number' ? raw.dailyMinNewWords : 25,
    currentWordIndexByBook,
    currentWordIndex: raw.currentWordIndex,
    aiEnabled: Boolean(raw.aiEnabled),
    streakCount: typeof raw.streakCount === 'number' ? raw.streakCount : 0,
    lastStudyDate: typeof raw.lastStudyDate === 'string' ? raw.lastStudyDate : '',
    autoSpeak: Boolean(raw.autoSpeak),
    deepseekApiKey: typeof raw.deepseekApiKey === 'string' ? raw.deepseekApiKey : '',
    themeMode: themeMode === 'quiet' || themeMode === 'intense' || themeMode === 'night' ? themeMode : 'zen',
    motionLevel: raw.motionLevel === 'low' || raw.motionLevel === 'rich' ? raw.motionLevel : 'standard',
    syncEnabled: Boolean(raw.syncEnabled),
    syncToken: typeof raw.syncToken === 'string' ? raw.syncToken : '',
    syncDeviceId: typeof raw.syncDeviceId === 'string' && raw.syncDeviceId ? raw.syncDeviceId : createDeviceId(),
    lastSyncAt: typeof raw.lastSyncAt === 'string' ? raw.lastSyncAt : '',
    lastSyncError: typeof raw.lastSyncError === 'string' ? raw.lastSyncError : '',
  };
}

function createDeviceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function updateSettings(
  partial: Partial<Omit<SettingsRecord, 'key'>>
): Promise<void> {
  const current = await getSettings();
  if (!current) return;
  await saveSettings({ ...current, ...partial });
}

// ============================================================
// Wordbooks
// ============================================================

export async function getWordbook(bookId: StoredBookId): Promise<WordbookRecord | null> {
  const db = await getDB();
  const record = await db.get('wordbooks', bookId);
  return record ?? null;
}

export async function saveWordbook(record: WordbookRecord): Promise<void> {
  const db = await getDB();
  await db.put('wordbooks', record);
}

/**
 * 批量保存词条到 wordbook。如果该词库已存在，会覆盖。
 */
export async function saveWordsToBook(bookId: StoredBookId, words: WordEntry[]): Promise<void> {
  await saveWordbook({ bookId, words });
}

/**
 * 检查词库是否已缓存
 */
export async function hasWordbook(bookId: StoredBookId): Promise<boolean> {
  const db = await getDB();
  const count = await db.count('wordbooks');
  // count doesn't support key filtering directly, so get and check
  const record = await db.get('wordbooks', bookId);
  return !!record;
}

// ============================================================
// Progress
// ============================================================

export async function getProgress(wordId: string): Promise<ProgressRecord | null> {
  const db = await getDB();
  const record = await db.get('progress', wordId);
  return record ?? null;
}

export async function saveProgress(record: ProgressRecord): Promise<void> {
  const db = await getDB();
  await db.put('progress', record);
}

export async function getAllProgress(): Promise<ProgressRecord[]> {
  const db = await getDB();
  return db.getAll('progress');
}

export async function getProgressByBook(bookId: StoredBookId): Promise<ProgressRecord[]> {
  const all = await getAllProgress();
  return all.filter(p => p.bookId === bookId);
}

export async function clearProgressByBook(bookId: StoredBookId): Promise<void> {
  const all = await getAllProgress();
  const db = await getDB();
  const tx = db.transaction('progress', 'readwrite');
  for (const p of all) {
    if (p.bookId === bookId) {
      await tx.store.delete(p.wordId);
    }
  }
  await tx.done;
}

export async function resetAllProgress(): Promise<void> {
  const db = await getDB();
  await db.clear('progress');
}

// ============================================================
// DailyLog
// ============================================================

export async function getDailyLog(date: string): Promise<DailyLogRecord | null> {
  const db = await getDB();
  const record = await db.get('dailyLog', date);
  return record ?? null;
}

export async function saveDailyLog(record: DailyLogRecord): Promise<void> {
  const db = await getDB();
  await db.put('dailyLog', record);
}

export async function getAllDailyLogs(): Promise<DailyLogRecord[]> {
  const db = await getDB();
  return db.getAll('dailyLog');
}

// ============================================================
// Session
// ============================================================

export async function getSession(): Promise<SessionRecord | null> {
  const db = await getDB();
  const record = await db.get('session', 'current');
  return record ?? null;
}

export async function saveSession(record: SessionRecord): Promise<void> {
  const db = await getDB();
  await db.put('session', record);
}

export async function clearSession(): Promise<void> {
  const db = await getDB();
  await db.delete('session', 'current');
}

// ============================================================
// SyncQueue：Supabase 接入前的本地同步队列
// ============================================================

function createSyncId(entity: SyncEntity, entityId: string): string {
  return `${entity}:${entityId}`;
}

export async function enqueueSync(
  entity: SyncEntity,
  entityId: string,
  payload: unknown,
  operation: 'upsert' | 'delete' = 'upsert',
): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  const id = createSyncId(entity, entityId);
  const existing = await db.get('syncQueue', id) as SyncQueueRecord | undefined;

  const record: SyncQueueRecord = {
    id,
    entity,
    entityId,
    operation,
    payload,
    status: 'pending',
    attempts: existing?.attempts ?? 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.put('syncQueue', record);
}

export async function getPendingSyncItems(): Promise<SyncQueueRecord[]> {
  const db = await getDB();
  const all = await db.getAll('syncQueue') as SyncQueueRecord[];
  return all
    .filter(item => item.status === 'pending' || item.status === 'failed')
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

export async function markSyncItemSynced(id: string): Promise<void> {
  const db = await getDB();
  const record = await db.get('syncQueue', id) as SyncQueueRecord | undefined;
  if (!record) return;
  await db.put('syncQueue', {
    ...record,
    status: 'synced',
    updatedAt: new Date().toISOString(),
    lastError: '',
  });
}

export async function markSyncItemFailed(id: string, error: string): Promise<void> {
  const db = await getDB();
  const record = await db.get('syncQueue', id) as SyncQueueRecord | undefined;
  if (!record) return;
  await db.put('syncQueue', {
    ...record,
    status: 'failed',
    attempts: record.attempts + 1,
    updatedAt: new Date().toISOString(),
    lastError: error,
  });
}

export async function clearSyncedItems(): Promise<void> {
  const db = await getDB();
  const all = await db.getAll('syncQueue') as SyncQueueRecord[];
  const tx = db.transaction('syncQueue', 'readwrite');
  for (const item of all) {
    if (item.status === 'synced') {
      await tx.store.delete(item.id);
    }
  }
  await tx.done;
}

// ============================================================
// 数据导入导出
// ============================================================

export async function exportData(): Promise<ExportPayload> {
  const progress = await getAllProgress();
  const dailyLog = await getAllDailyLogs();
  const settings = await getSettings();
  return {
    progress,
    dailyLog,
    settings,
    exportDate: new Date().toISOString(),
  };
}

export async function importData(payload: ExportPayload): Promise<void> {
  const db = await getDB();

  // 清空现有数据
  await db.clear('progress');
  await db.clear('dailyLog');

  // 写入导入数据
  const tx = db.transaction(['progress', 'dailyLog', 'settings'], 'readwrite');

  for (const p of payload.progress) {
    await tx.objectStore('progress').put(p);
  }
  for (const d of payload.dailyLog) {
    await tx.objectStore('dailyLog').put(d);
  }
  if (payload.settings) {
    await tx.objectStore('settings').put(payload.settings);
  }

  await tx.done;
}

// ============================================================
// 获取所有词库 ID 列表（用于统计）
// ============================================================

export async function getAllBookIds(): Promise<StoredBookId[]> {
  const db = await getDB();
  const all = await db.getAll('wordbooks');
  return all.map((r: WordbookRecord) => r.bookId);
}
