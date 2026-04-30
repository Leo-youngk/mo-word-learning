// ============================================================
// 全局类型定义 —「默」Mo 英语背单词 PWA
// ============================================================

// ---- 词库 ----

export type BookId = 'cet4' | 'cet6' | 'kaoyan' | 'toefl';

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
  phoneticUs: string;
  phoneticUk: string;
  translations: Translation[];
  phrases: Phrase[];             // 最多 3 个
  example: ExampleSentence | null; // 最多 1 个，缺失为 null
}

export interface WordbookRecord {
  bookId: BookId;
  words: WordEntry[];
}

// ---- 学习进度 ----

export interface ProgressRecord {
  wordId: string;
  word: string;
  bookId: BookId;
  stage: number;                // 0-5
  nextReviewDate: string;       // ISO 日期 "2026-05-05"
  lastReviewDate: string;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  totalReviews: number;
  totalCorrect: number;
  isStubborn: boolean;
  firstLearnDate: string;
  graduated: boolean;
}

// ---- 每日日志 ----

export interface DailyLogRecord {
  date: string;                 // "2026-05-01"
  newWordsCount: number;
  reviewWordsCount: number;
  currentBookId: BookId;
}

// ---- 设置 ----

export interface SettingsRecord {
  key: 'settings';
  currentBookId: BookId;
  dailyMinNewWords: number;     // 默认 25
  currentWordIndex: number;
  aiEnabled: boolean;
  streakCount: number;
  lastStudyDate: string;
  autoSpeak: boolean;
  deepseekApiKey?: string;
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
  phase: StudyPhase;
  currentIndex: number;
  newWords: string[];           // wordId[]
  reviewWords: string[];        // wordId[]
  extraNewWords?: string[];     // ROUND_1 中「继续学习」的额外新词
  round2Results: Record<string, boolean>;  // wordId → 记得?
  round4Results: Record<string, boolean>;
  reviewResults: Record<string, boolean>;
}

// ---- 导出/导入 ----

export interface ExportPayload {
  progress: ProgressRecord[];
  dailyLog: DailyLogRecord[];
  settings: SettingsRecord | null;
  exportDate: string;
}

// ---- 间隔重复 ----

export type IntervalStage = 0 | 1 | 2 | 3 | 4 | 5;

export interface DailyQueue {
  reviewQueue: ProgressRecord[];
  newWords: WordEntry[];
}
