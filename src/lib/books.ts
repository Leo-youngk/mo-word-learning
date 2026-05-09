import type { BookId, StoredBookId } from '../types';

export const BOOK_IDS: BookId[] = ['cet4', 'cet6', 'toefl'];

export const BOOK_LABELS: Record<BookId, string> = {
  cet4: '四级词汇',
  cet6: '六级核心',
  toefl: '托福词汇',
};

export const BOOK_SHORT_LABELS: Record<BookId, string> = {
  cet4: '四级',
  cet6: '六级',
  toefl: '托福',
};

export const STORED_BOOK_LABELS: Record<StoredBookId, string> = {
  daily: '日常高频',
  kaoyan: '考研词汇',
  cet4: '四级词汇',
  cet6: '六级核心',
  toefl: '托福词汇',
};
