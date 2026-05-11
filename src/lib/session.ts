// ============================================================
// 会话验证与恢复 —「默」Mo
// 核心原则：
// 1. 跨天后旧 session 自动失效，需重新生成今日队列
// 2. 会话有效性只看基本结构，不要求每个词都在词库中存在（词库可能已更新）
// 3. 缺失的词会被 useStudySession 自动跳过
// ============================================================

import type { BookId, WordEntry, SessionRecord, StudyPhase } from '../types';
import { validatePhaseValue } from './phase';

/**
 * 验证 session 是否属于今天、词库匹配、结构基本完整。
 * 不会检查词是否在词库中存在（词库可能已更新，缺失词会被跳过）。
 */
export function validateStudySession(
  session: SessionRecord,
  currentBookId: BookId,
  bookWords: WordEntry[],
): { valid: boolean; reason?: string } {
  if (!session.date || !session.phase) {
    return { valid: false, reason: 'session 缺少 date 或 phase' };
  }

  if (!validatePhaseValue(session.phase)) {
    return { valid: false, reason: `未知 phase: ${session.phase}` };
  }

  // 词库不匹配，session 无效
  if (session.bookId && session.bookId !== currentBookId) {
    return { valid: false, reason: '词库已切换，旧 session 失效' };
  }

  // 阶段为 summary 时，结构有效
  if (session.phase === 'summary') {
    return { valid: true };
  }

  // 检查是否有词需要学习
  const hasReviewWords = Array.isArray(session.reviewWords) && session.reviewWords.length > 0;
  const hasNewWords = Array.isArray(session.newWords) && session.newWords.length > 0;

  if (!hasReviewWords && !hasNewWords) {
    return { valid: false, reason: 'session 中没有词需要学习' };
  }

  // 检查 currentIndex 是否合理
  const totalInPhase = session.phase === 'review' ? session.reviewWords.length : session.newWords.length;
  if (typeof session.currentIndex !== 'number' || session.currentIndex < 0) {
    return { valid: false, reason: 'currentIndex 无效' };
  }

  // 即使 currentIndex 超出范围，也视为有效（会自动调整到合理位置）
  return { valid: true };
}

/**
 * 判断 session 是否已经完成了所有词
 */
export function isSessionComplete(session: SessionRecord): boolean {
  const ids = session.phase === 'review' ? session.reviewWords : session.newWords;
  if (!ids || ids.length === 0) return true;
  return session.currentIndex >= ids.length;
}

/**
 * 获取当前阶段需要学习的词 ID 列表
 */
export function getPhaseWordIds(session: SessionRecord): string[] {
  if (session.phase === 'review') return session.reviewWords || [];
  if (session.phase === 'round1') return session.newWords || [];
  return [];
}
