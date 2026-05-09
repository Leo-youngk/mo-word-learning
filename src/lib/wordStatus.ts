import type { ProgressRecord, WordStatus } from '../types';

export type WordUserStatus = 'unlearned' | 'fuzzy' | 'mastered';

export function getWordUserStatus(progress?: ProgressRecord | null): WordUserStatus {
  if (!progress) return 'unlearned';
  if (progress.status === 'fuzzy') return 'fuzzy';
  if (progress.status === 'mastered') return 'mastered';
  if (progress.graduated === true) return 'mastered';
  return 'fuzzy';
}

export function getWordStatusLabel(status: WordUserStatus): string {
  if (status === 'fuzzy') return '模糊';
  if (status === 'mastered') return '已掌握';
  return '未学';
}

export function normalizeWordStatus(status: WordUserStatus): WordStatus | undefined {
  if (status === 'fuzzy') return 'fuzzy';
  if (status === 'mastered') return 'mastered';
  return undefined;
}
