import type { BookId, DailyQueue, ProgressRecord, WordEntry } from '../types';
import * as progressService from '../services/progressService';
import { addLocalDays, getLocalDateString } from './date';
import { getWordUserStatus } from './wordStatus';

const REVIEW_INTERVALS = [1, 2, 4, 7, 15];

export function getTodayString(): string {
  return getLocalDateString();
}

export function addDays(dateStr: string, days: number): string {
  return addLocalDays(dateStr, days);
}

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

function sortReviewQueue(queue: ProgressRecord[]): ProgressRecord[] {
  return [...queue].sort((a, b) => {
    if (Boolean(a.isStubborn) !== Boolean(b.isStubborn)) return a.isStubborn ? -1 : 1;
    return (a.stage ?? 1) - (b.stage ?? 1);
  });
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededScore(seed: string, wordId: string): number {
  return hashString(`${seed}:${wordId}`);
}

export async function generateDailyQueue(
  bookId: BookId,
  bookWords: WordEntry[],
  currentWordIndex: number,
  dailyMinNewWords: number,
): Promise<DailyQueue> {
  const today = getTodayString();
  const allProgress = await progressService.getAllProgress();
  const globalProgressMap = progressService.buildGlobalProgressMap(allProgress);
  const bookWordIds = new Set(bookWords.map(word => word.id));

  const reviewWords = sortReviewQueue(
    allProgress.filter(progress => {
      if (!bookWordIds.has(progress.wordId)) return false;
      if (getWordUserStatus(progress) !== 'fuzzy') return false;
      if (progress.nextReviewDate) return progress.nextReviewDate <= today;
      return true;
    }),
  );

  const seed = `${today}:${bookId}`;
  const eligibleWords = bookWords
    .map((word, index) => ({ word, index }))
    .filter(item => {
      const globalProgress = globalProgressMap.get(progressService.getProgressGlobalKey(item.word));
      return getWordUserStatus(globalProgress) === 'unlearned';
    });

  eligibleWords.sort((a, b) => {
    const scoreDiff = seededScore(seed, a.word.id) - seededScore(seed, b.word.id);
    return scoreDiff || a.index - b.index;
  });

  const selected = eligibleWords.slice(0, dailyMinNewWords);
  const newWords = selected.map(item => item.word);
  const maxSelectedIndex = selected.reduce(
    (max, item) => Math.max(max, item.index + 1),
    currentWordIndex,
  );
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
    normalizedWord: progressService.getProgressGlobalKey(word),
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
    normalizedWord: progressService.getProgressGlobalKey(word),
    bookId,
    status: 'mastered',
    stage: 5,
    graduated: true,
    nextReviewDate: undefined,
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
