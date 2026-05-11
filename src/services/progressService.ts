import { backendPost } from '../lib/backend';
import { getLocalDateString } from '../lib/date';
import type { BookId, ProgressRecord, WordEntry } from '../types';

const optimisticProgressMap = new Map<string, ProgressRecord>();
let progressSyncQueue: Promise<void> = Promise.resolve();
const STATUS_PRIORITY: Record<string, number> = {
  mastered: 3,
  fuzzy: 2,
};

export function normalizeWord(value: string): string {
  return value.trim().toLowerCase();
}

export function getProgressGlobalKey(
  entryOrProgress: Pick<WordEntry, 'word' | 'normalizedWord'> | Pick<ProgressRecord, 'word' | 'normalizedWord'>,
): string {
  return entryOrProgress.normalizedWord || normalizeWord(entryOrProgress.word);
}

function applyOptimisticRecord(record: ProgressRecord) {
  optimisticProgressMap.set(record.wordId, {
    ...record,
    normalizedWord: getProgressGlobalKey(record),
  });
}

function mergeProgressRecord(
  current: ProgressRecord | undefined,
  incoming: ProgressRecord,
): ProgressRecord {
  if (!current) return incoming;

  const currentPriority = STATUS_PRIORITY[current.status ?? ''] ?? 0;
  const incomingPriority = STATUS_PRIORITY[incoming.status ?? ''] ?? 0;
  if (incomingPriority > currentPriority) {
    return incoming;
  }
  if (incomingPriority < currentPriority) {
    return current;
  }

  const currentMarkedAt = current.lastMarkedDate || current.lastReviewDate || current.firstSeenDate || '';
  const incomingMarkedAt = incoming.lastMarkedDate || incoming.lastReviewDate || incoming.firstSeenDate || '';
  if (incomingMarkedAt > currentMarkedAt) {
    return incoming;
  }

  return current;
}

function mergeProgressItems(items: ProgressRecord[]): ProgressRecord[] {
  const merged = new Map<string, ProgressRecord>(
    items.map(item => [
      item.wordId,
      {
        ...item,
        normalizedWord: getProgressGlobalKey(item),
      },
    ]),
  );
  for (const [wordId, record] of optimisticProgressMap.entries()) {
    merged.set(wordId, record);
  }
  return [...merged.values()];
}

export function buildGlobalProgressMap(items: ProgressRecord[]): Map<string, ProgressRecord> {
  const merged = new Map<string, ProgressRecord>();
  for (const item of items) {
    const normalizedWord = getProgressGlobalKey(item);
    const nextRecord = {
      ...item,
      normalizedWord,
    };
    merged.set(normalizedWord, mergeProgressRecord(merged.get(normalizedWord), nextRecord));
  }
  return merged;
}

function enqueueProgressSync(task: () => Promise<void>) {
  progressSyncQueue = progressSyncQueue
    .catch(() => undefined)
    .then(task)
    .catch(error => {
      console.error('Failed to sync word progress:', error);
      // TODO: push failed progress mutations into a retry queue.
    });
}

function getFirstSeenDate(progress: ProgressRecord | null | undefined, today: string): string {
  return progress?.firstSeenDate || progress?.firstLearnDate || today;
}

function buildQuickMasteredProgress(
  entry: Pick<WordEntry, 'id' | 'word' | 'normalizedWord'>,
  bookId: BookId,
  existing?: ProgressRecord | null,
): ProgressRecord {
  const today = getLocalDateString();

  return {
    ...existing,
    wordId: entry.id,
    word: entry.word,
    normalizedWord: getProgressGlobalKey(entry),
    bookId,
    status: 'mastered',
    stage: 5,
    graduated: true,
    nextReviewDate: undefined,
    lastReviewDate: today,
    firstSeenDate: getFirstSeenDate(existing, today),
    firstLearnDate: existing?.firstLearnDate || getFirstSeenDate(existing, today),
    lastMarkedDate: today,
    fuzzyCount: existing?.fuzzyCount ?? 0,
    reviewCount: existing?.reviewCount ?? 0,
    consecutiveCorrect: Math.max(1, existing?.consecutiveCorrect ?? 0),
    consecutiveWrong: 0,
    totalReviews: existing?.totalReviews ?? 0,
    totalCorrect: existing?.totalCorrect ?? 0,
    isStubborn: false,
  };
}

export async function getAllProgress(): Promise<ProgressRecord[]> {
  const data = await backendPost<{ items: ProgressRecord[] }>('/api/data', {
    scope: 'progress',
    action: 'getAll',
  });
  return mergeProgressItems(data.items);
}

export async function getProgress(wordId: string): Promise<ProgressRecord | null> {
  const optimistic = optimisticProgressMap.get(wordId);
  if (optimistic) return optimistic;

  const data = await backendPost<{ item: ProgressRecord | null }>('/api/data', {
    scope: 'progress',
    action: 'getOne',
    payload: { wordId },
  });
  return data.item;
}

export async function getProgressByBook(bookId: string): Promise<ProgressRecord[]> {
  const data = await backendPost<{ items: ProgressRecord[] }>('/api/data', {
    scope: 'progress',
    action: 'getByBook',
    payload: { bookId },
  });
  return mergeProgressItems(data.items).filter(item => item.bookId === bookId);
}

export async function getGlobalProgressMap(): Promise<Map<string, ProgressRecord>> {
  const items = await getAllProgress();
  return buildGlobalProgressMap(items);
}

export async function saveProgress(record: ProgressRecord): Promise<void> {
  applyOptimisticRecord(record);
  await backendPost<{ ok: boolean }>('/api/data', {
    scope: 'progress',
    action: 'save',
    payload: { record },
  });
}

export function markWordAsMasteredFromWordbook(
  entry: Pick<WordEntry, 'id' | 'word' | 'normalizedWord'>,
  bookId: BookId,
  existing?: ProgressRecord | null,
): ProgressRecord {
  const record = buildQuickMasteredProgress(entry, bookId, existing);
  applyOptimisticRecord(record);

  enqueueProgressSync(async () => {
    await backendPost<{ ok: boolean }>('/api/data', {
      scope: 'progress',
      action: 'save',
      payload: { record },
    });
  });

  return record;
}

export async function getReviewDueWords(bookId: string, today: string): Promise<ProgressRecord[]> {
  const data = await backendPost<{ items: ProgressRecord[] }>('/api/data', {
    scope: 'progress',
    action: 'getDueWords',
    payload: { bookId, today },
  });
  return data.items;
}

export async function countMastered(bookId?: string): Promise<number> {
  const data = await backendPost<{ count: number }>('/api/data', {
    scope: 'progress',
    action: 'countMastered',
    payload: { bookId },
  });
  return data.count;
}

export async function countFuzzy(bookId?: string): Promise<number> {
  const data = await backendPost<{ count: number }>('/api/data', {
    scope: 'progress',
    action: 'countFuzzy',
    payload: { bookId },
  });
  return data.count;
}
