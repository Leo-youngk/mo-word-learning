// ============================================================
// 全局类型定义 —「默」Mo 英语背单词 PWA
// ============================================================

// ---- 词库 ----

export type BookId = 'cet4' | 'cet6' | 'toefl';
export type LegacyBookId = 'daily' | 'kaoyan';
export type StoredBookId = BookId | LegacyBookId;

export interface Translation {
  type: string;   // 词性，如 "v" "n" "adj"
  text: string;
}

export interface Phrase {
  en: string;
  zh: string;
}

export interface ExampleSentence {
  en: string;
  zh: string;
}

export interface WordEntry {
  id: string;                    // "cet6-abandon"
  word: string;
  normalizedWord?: string;
  phoneticUs: string;
  phoneticUk: string;
  translations: Translation[];
  phrases: Phrase[];             // 最多 3 个
  example: ExampleSentence | null; // 最多 1 个，缺失为 null
  appearsInBooks?: StoredBookId[];     // 该词出现在哪些词库中（用于跨词库去重）
  canonicalBookId?: BookId;
}

export interface WordbookRecord {
  bookId: StoredBookId;
  words: WordEntry[];
}

// ---- 学习进度 ----

export type WordStatus = 'fuzzy' | 'mastered';

export interface ProgressRecord {
  wordId: string;
  word: string;
  normalizedWord?: string;
  bookId: StoredBookId;
  status?: WordStatus;
  stage?: number;                // legacy 0-5
  nextReviewDate?: string;       // 本地日期 "2026-05-05"
  lastReviewDate?: string;
  firstSeenDate?: string;
  firstLearnDate?: string;       // legacy
  lastMarkedDate?: string;
  fuzzyCount?: number;
  reviewCount?: number;
  consecutiveCorrect?: number;
  consecutiveWrong?: number;
  totalReviews?: number;
  totalCorrect?: number;
  isStubborn?: boolean;
  graduated?: boolean;
}

// ---- 每日日志 ----

export interface DailyLogRecord {
  date: string;                 // "2026-05-01"
  newWordsCount: number;
  reviewWordsCount: number;
  currentBookId: StoredBookId;
}

// ---- 设置 ----

export type ThemeMode = 'zen' | 'quiet' | 'intense' | 'night';
export type LegacyThemeMode = 'aggressive';
export type MotionLevel = 'low' | 'standard' | 'rich';

export interface SettingsRecord {
  key: 'settings';
  currentBookId: BookId;
  dailyMinNewWords: number;     // 默认 25
  currentWordIndexByBook: Record<BookId, number>;
  currentWordIndex?: number;    // legacy
  aiEnabled: boolean;
  streakCount: number;
  lastStudyDate: string;
  autoSpeak: boolean;
  deepseekApiKey?: string;
  themeMode?: ThemeMode;        // 默认 'zen'
  motionLevel?: MotionLevel;
  syncEnabled?: boolean;
  syncToken?: string;
  syncDeviceId?: string;
  lastSyncAt?: string;
  lastSyncError?: string;
}

// ---- 会话 ----

export type StudyPhase =
  | 'review'
  | 'round1'
  | 'round2'
  | 'round3'
  | 'round4'
  | 'summary';

export interface SessionRecord {
  key: 'current';
  date: string;
  bookId?: BookId;
  phase: StudyPhase;
  currentIndex: number;
  newWords: string[];           // wordId[]
  reviewWords: string[];        // wordId[]
  extraNewWords?: string[];     // ROUND_1 中「继续学习」的额外新词
  round2Results: Record<string, boolean>;  // wordId → 记得?
  round4Results: Record<string, boolean>;
  reviewResults: Record<string, boolean>;
  plannedNextWordIndex: number; // 本次学习计划扫描到的词库位置
  consumedNewWordIds: string[]; // 已消耗的新词（包含已掌握、已学习）
  processedNewWordIds?: string[];
}

// ---- 导出/导入 ----

export interface ExportPayload {
  progress: ProgressRecord[];
  dailyLog: DailyLogRecord[];
  settings: SettingsRecord | null;
  exportDate: string;
}

// ---- 后续云同步队列 ----

export type SyncEntity = 'settings' | 'progress' | 'dailyLog';
export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface SyncQueueRecord {
  id: string;
  entity: SyncEntity;
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: unknown;
  status: SyncStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

// ---- 间隔重复 ----

export type IntervalStage = 0 | 1 | 2 | 3 | 4 | 5;

export interface DailyQueue {
  reviewWords: ProgressRecord[];
  newWords: WordEntry[];
  plannedNextWordIndex: number; // 扫描结束位置，用于推进 currentWordIndex
}
