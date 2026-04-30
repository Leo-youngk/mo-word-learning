// ============================================================
// IndexedDB 数据层 —「默」Mo
// 使用 idb 库封装，只做存储操作，不含业务逻辑
// ============================================================

import { openDB, type IDBPDatabase } from 'idb';
import type {
  BookId,
  WordEntry,
  WordbookRecord,
  ProgressRecord,
  DailyLogRecord,
  SettingsRecord,
  SessionRecord,
  ExportPayload,
} from '../types';

const DB_NAME = 'mo-db';
const DB_VERSION = 1;

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
  return record ?? null;
}

export async function saveSettings(settings: SettingsRecord): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings);
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

export async function getWordbook(bookId: BookId): Promise<WordbookRecord | null> {
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
export async function saveWordsToBook(bookId: BookId, words: WordEntry[]): Promise<void> {
  await saveWordbook({ bookId, words });
}

/**
 * 检查词库是否已缓存
 */
export async function hasWordbook(bookId: BookId): Promise<boolean> {
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

export async function getProgressByBook(bookId: BookId): Promise<ProgressRecord[]> {
  const all = await getAllProgress();
  return all.filter(p => p.bookId === bookId);
}

export async function clearProgressByBook(bookId: BookId): Promise<void> {
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

export async function getAllBookIds(): Promise<BookId[]> {
  const db = await getDB();
  const all = await db.getAll('wordbooks');
  return all.map((r: WordbookRecord) => r.bookId);
}
