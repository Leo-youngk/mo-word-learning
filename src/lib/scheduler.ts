// ============================================================
// 间隔重复调度算法 —「默」Mo
// 纯函数，不依赖任何外部状态，可直接单元测试
// ============================================================

import type { ProgressRecord, WordEntry, DailyQueue } from '../types';

/**
 * 间隔定义 (天数)
 * stage 0 = 当天
 * stage 1 = 1 天后
 * stage 2 = 3 天后
 * stage 3 = 7 天后
 * stage 4 = 14 天后
 * stage 5 = 毕业，不再复习
 */
export const INTERVALS: Record<number, number> = {
  0: 0,
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: -1,
};

/**
 * 获取今天的本地日期字符串 YYYY-MM-DD
 */
export function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 给日期加 N 天
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 处理复习结果，返回更新后的 ProgressRecord
 */
export function handleReviewResult(
  progress: ProgressRecord,
  correct: boolean
): ProgressRecord {
  const today = getTodayString();

  if (correct) {
    const newStage = Math.min(progress.stage + 1, 5) as ProgressRecord['stage'];
    const interval = INTERVALS[newStage];
    const graduated = newStage === 5;
    return {
      ...progress,
      stage: newStage,
      consecutiveCorrect: progress.consecutiveCorrect + 1,
      consecutiveWrong: 0,
      totalReviews: progress.totalReviews + 1,
      totalCorrect: progress.totalCorrect + 1,
      isStubborn: false,
      graduated,
      lastReviewDate: today,
      nextReviewDate: interval === -1 ? '' : addDays(today, interval),
    };
  } else {
    const newConsecutiveWrong = progress.consecutiveWrong + 1;
    return {
      ...progress,
      stage: 1,
      consecutiveCorrect: 0,
      consecutiveWrong: newConsecutiveWrong,
      totalReviews: progress.totalReviews + 1,
      isStubborn: newConsecutiveWrong >= 2,
      graduated: false,
      lastReviewDate: today,
      nextReviewDate: addDays(today, 1),
    };
  }
}

/**
 * 创建新的 ProgressRecord（首次学习某词时使用）
 */
export function createProgressRecord(
  wordId: string,
  word: string,
  bookId: ProgressRecord['bookId']
): ProgressRecord {
  const today = getTodayString();
  return {
    wordId,
    word,
    bookId,
    stage: 0,
    nextReviewDate: addDays(today, 1), // 明天首次复习
    lastReviewDate: today,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    totalReviews: 0,
    totalCorrect: 0,
    isStubborn: false,
    firstLearnDate: today,
    graduated: false,
  };
}

/**
 * 生成每日学习队列
 *
 * @param allProgress - 所有学习进度记录
 * @param bookWords - 当前词库的全部词条
 * @param currentIndex - 当前词库学到第几个词
 * @param minNewWords - 每日最少新词数
 * @returns 复习队列 + 新词队列
 */
export function generateDailyQueue(
  allProgress: ProgressRecord[],
  bookWords: WordEntry[],
  currentIndex: number,
  minNewWords: number
): DailyQueue {
  const today = getTodayString();

  // 1. 复习队列：nextReviewDate <= today 且未毕业
  const reviewQueue = allProgress
    .filter(p => {
      // 已毕业的不复习
      if (p.graduated) return false;
      // nextReviewDate 为空表示已毕业
      if (!p.nextReviewDate) return false;
      return p.nextReviewDate <= today;
    })
    .sort((a, b) => {
      // 优先级：顽固词 > 阶段低的 > 阶段高的
      if (a.isStubborn !== b.isStubborn) return a.isStubborn ? -1 : 1;
      return a.stage - b.stage;
    });

  // 2. 新词队列：从 currentIndex 开始取
  const newWords = bookWords.slice(currentIndex, currentIndex + minNewWords);

  return { reviewQueue, newWords };
}
