import type { BookId, SessionRecord, WordEntry } from '../types';
import { getTodayString } from './scheduler';

const VALID_PHASES = new Set(['review', 'round1', 'summary']);

function getPhaseIds(session: SessionRecord): string[] {
  if (session.phase === 'review') return session.reviewWords;
  if (session.phase === 'round1') return session.newWords;
  return [];
}

export function validateStudySession(
  session: SessionRecord | null,
  bookId: BookId,
  bookWords: WordEntry[],
): { valid: true } | { valid: false; reason: string } {
  if (!session) return { valid: false, reason: '没有可恢复的学习会话' };

  if (session.date !== getTodayString()) {
    return { valid: false, reason: '学习会话已过期' };
  }

  if (session.bookId && session.bookId !== bookId) {
    return { valid: false, reason: '学习会话不属于当前词库' };
  }

  if (!VALID_PHASES.has(session.phase)) {
    return { valid: false, reason: '学习会话阶段已失效' };
  }

  if (session.phase === 'summary') return { valid: true };

  const ids = getPhaseIds(session);
  if (ids.length === 0) {
    return { valid: false, reason: '学习会话没有可学习单词' };
  }

  if (session.currentIndex < 0 || session.currentIndex >= ids.length) {
    return { valid: false, reason: '学习会话位置已失效' };
  }

  const wordIds = new Set(bookWords.map(word => word.id));
  const missingId = ids.find(id => !wordIds.has(id));
  if (missingId) {
    return { valid: false, reason: `学习会话中的单词不存在：${missingId}` };
  }

  return { valid: true };
}
