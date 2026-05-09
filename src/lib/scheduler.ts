// ============================================================
// 调度器 — 每日队列生成 + 复习间隔计算
// ============================================================

import type { BookId, WordEntry, ProgressRecord, DailyQueue } from '../types';
import * as db from './db';
import { addLocalDays, getLocalDateString } from './date';
import { getWordUserStatus } from './wordStatus';

// ---- 日期工具 ----

export function getTodayString(): string {
  return getLocalDateString();
}

export function addDays(dateStr: string, days: number): string {
  return addLocalDays(dateStr, days);
}

// ---- 间隔重复调度 ----

const REVIEW_INTERVALS = [1, 2, 4, 7, 15]; // 天

export function getNextReviewDate(stage: number, lastReviewDate: string): string {
  const interval = REVIEW_INTERVALS[Math.min(stage, REVIEW_INTERVALS.length - 1)];
  return addDays(lastReviewDate, interval);
}

export function getNextStage(stage: number, remembered: boolean): number {
  if (remembered) {
    return Math.min(stage + 1, 5);
  }
  return Math.max(stage - 1, 0);
}

// ---- 复习队列排序 ----

function sortReviewQueue(queue: ProgressRecord[]): ProgressRecord[] {
  return [...queue].sort((a, b) => {
    // 顽固词优先
    if (Boolean(a.isStubborn) !== Boolean(b.isStubborn)) return a.isStubborn ? -1 : 1;
    // stage 低的优先（需要更多复习）
    return (a.stage ?? 1) - (b.stage ?? 1);
  });
}

// ---- 随机每日队列 ----

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededScore(seed: string, wordId: string): number {
  return hashString(`${seed}:${wordId}`);
}

/**
 * 从未处理词中按本地日期做稳定随机抽取。
 * 同一天重复生成时顺序稳定；用户处理过的词因已有 progress 会自动排除。
 * 
 * 返回：
 * - reviewWords: 今日需要复习的词
 * - newWords: 今日新学词
 * - plannedNextWordIndex: 兼容旧指针字段，推进到本次抽取词中最靠后的位置
 */
export async function generateDailyQueue(
  bookId: BookId,
  bookWords: WordEntry[],
  currentWordIndex: number,
  dailyMinNewWords: number,
): Promise<DailyQueue> {
  const today = getTodayString();

  // 1. 复习队列：只复习用户手动标记为「模糊」的词
  const allProgress = await db.getProgressByBook(bookId);
  const reviewWords = sortReviewQueue(
    allProgress.filter(p => {
      if (getWordUserStatus(p) !== 'fuzzy') return false;
      if (p.nextReviewDate) return p.nextReviewDate <= today;
      return true;
    })
  );

  // 2. 新词队列：从所有未处理词中稳定随机抽取，避免 A-Z 顺序学习
  const existingWordIds = new Set(allProgress.map(p => p.wordId));
  const seed = `${today}:${bookId}`;
  const eligibleWords = bookWords
    .map((word, index) => ({ word, index }))
    .filter(item => item.word && !existingWordIds.has(item.word.id));

  eligibleWords.sort((a, b) => {
    const scoreDiff = seededScore(seed, a.word.id) - seededScore(seed, b.word.id);
    return scoreDiff || a.index - b.index;
  });

  const selected = eligibleWords.slice(0, dailyMinNewWords);
  const newWords = selected.map(item => item.word);

  const maxSelectedIndex = selected.reduce((max, item) => Math.max(max, item.index + 1), currentWordIndex);
  const plannedNextWordIndex = Math.min(bookWords.length, maxSelectedIndex);

  return {
    reviewWords,
    newWords,
    plannedNextWordIndex,
  };
}

function getFirstSeenDate(progress: ProgressRecord | null | undefined, today: string): string {
  return progress?.firstSeenDate || progress?.firstLearnDate || today;
}

export function createFuzzyProgress(
  word: WordEntry,
  bookId: BookId,
  today: string,
  existing?: ProgressRecord | null,
  fromReview = false,
): ProgressRecord {
  return {
    ...existing,
    wordId: word.id,
    word: word.word,
    bookId,
    status: 'fuzzy',
    stage: 1,
    graduated: false,
    nextReviewDate: addDays(today, 1),
    lastReviewDate: today,
    firstSeenDate: getFirstSeenDate(existing, today),
    firstLearnDate: existing?.firstLearnDate || getFirstSeenDate(existing, today),
    lastMarkedDate: today,
    fuzzyCount: (existing?.fuzzyCount ?? 0) + 1,
    reviewCount: (existing?.reviewCount ?? 0) + (fromReview ? 1 : 0),
    consecutiveCorrect: 0,
    consecutiveWrong: (existing?.consecutiveWrong ?? 0) + 1,
    totalReviews: (existing?.totalReviews ?? 0) + (fromReview ? 1 : 0),
    totalCorrect: existing?.totalCorrect ?? 0,
    isStubborn: false,
  };
}

export function createMasteredProgress(
  word: WordEntry,
  bookId: BookId,
  today: string,
  existing?: ProgressRecord | null,
  fromReview = false,
): ProgressRecord {
  return {
    ...existing,
    wordId: word.id,
    word: word.word,
    bookId,
    status: 'mastered',
    stage: 5,
    graduated: true,
    nextReviewDate: '',
    lastReviewDate: today,
    firstSeenDate: getFirstSeenDate(existing, today),
    firstLearnDate: existing?.firstLearnDate || getFirstSeenDate(existing, today),
    lastMarkedDate: today,
    reviewCount: (existing?.reviewCount ?? 0) + (fromReview ? 1 : 0),
    consecutiveCorrect: (existing?.consecutiveCorrect ?? 0) + 1,
    consecutiveWrong: 0,
    totalReviews: (existing?.totalReviews ?? 0) + (fromReview ? 1 : 0),
    totalCorrect: (existing?.totalCorrect ?? 0) + (fromReview ? 1 : 0),
    isStubborn: false,
  };
}
