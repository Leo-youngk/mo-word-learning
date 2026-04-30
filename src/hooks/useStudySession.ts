// ============================================================
// 学习状态机 Hook —「默」Mo
//
// 流程：REVIEW → ROUND_1 → ROUND_2 → ROUND_3 → ROUND_4 → SUMMARY
// 如果没有复习词，跳过 REVIEW 直接进入 ROUND_1
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  BookId,
  WordEntry,
  ProgressRecord,
  StudyPhase,
  SessionRecord,
} from '../types';
import * as db from '../lib/db';
import {
  getTodayString,
  generateDailyQueue,
  handleReviewResult,
  createProgressRecord,
  addDays,
} from '../lib/scheduler';

// ---- 导出的接口 ----

export interface StudyState {
  /** 当前阶段 */
  phase: StudyPhase;
  /** 当前词条（可用于渲染） */
  currentEntry: WordEntry | null;
  /** 当前词的进度记录（review 阶段用） */
  currentProgress: ProgressRecord | null;
  /** 当前阶段内的索引 */
  currentIndex: number;
  /** 当前阶段总词数 */
  totalInPhase: number;
  /** 全局词库索引(currentWordIndex) */
  globalWordIndex: number;
  /** 今日新词数 */
  newWordsCount: number;
  /** 今日复习词数 */
  reviewWordsCount: number;
  /** 是否加载完成 */
  ready: boolean;
}

export interface StudyActions {
  /** 进入下一项或下一轮 */
  advance: (result?: boolean) => Promise<void>;
  /** ROUND_1 中「继续学习」加载更多新词 */
  loadMoreNewWords: (count: number) => Promise<void>;
  /** 跳过当前项（仅 review/round3 使用） */
  skip: () => void;
}

// ---- 内部状态 ----

interface InternalState {
  phase: StudyPhase;
  currentIndex: number;
  newWords: string[];       // wordId[]
  reviewWords: string[];    // wordId[]
  round2Results: Record<string, boolean>;
  round4Results: Record<string, boolean>;
  reviewResults: Record<string, boolean>;
  extraNewWords: string[];  // ROUND_1 中「继续学习」加载的额外新词
}

export function useStudySession(
  bookId: BookId,
  words: WordEntry[],
  currentWordIndex: number,
  dailyMinNewWords: number,
  ready: boolean
): { state: StudyState; actions: StudyActions } {
  const [internal, setInternal] = useState<InternalState>({
    phase: 'round1',
    currentIndex: 0,
    newWords: [],
    reviewWords: [],
    round2Results: {},
    round4Results: {},
    reviewResults: {},
    extraNewWords: [],
  });

  // 缓存当前词库的词条 map（wordId → WordEntry）
  const wordsMapRef = useRef<Map<string, WordEntry>>(new Map());
  const progressMapRef = useRef<Map<string, ProgressRecord>>(new Map());
  const initializedRef = useRef(false);
  const globalIndexRef = useRef(currentWordIndex);

  // 从 session 恢复或生成新队列
  useEffect(() => {
    if (!ready || words.length === 0) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    async function init() {
      // 构建词条 map
      const wMap = new Map<string, WordEntry>();
      for (const w of words) {
        wMap.set(w.id, w);
      }
      wordsMapRef.current = wMap;

      // 尝试恢复 session（跨天不丢弃，始终从中断处恢复）
      const session = await db.getSession();

      if (session) {
        const newWordIds = [...session.newWords, ...(session.extraNewWords || [])];
        setInternal({
          phase: session.phase,
          currentIndex: session.currentIndex,
          newWords: session.newWords,
          reviewWords: session.reviewWords,
          round2Results: session.round2Results,
          round4Results: session.round4Results,
          reviewResults: session.reviewResults,
          extraNewWords: session.extraNewWords || [],
        });
        return;
      }

      // 无 session → 生成新队列
      const allProgress = await db.getAllProgress();
      const pMap = new Map<string, ProgressRecord>();
      for (const p of allProgress) {
        pMap.set(p.wordId, p);
      }
      progressMapRef.current = pMap;

      const { reviewQueue, newWords: newWordEntries } = generateDailyQueue(
        allProgress,
        words,
        currentWordIndex,
        dailyMinNewWords
      );

      const reviewWordIds = reviewQueue.map(p => p.wordId);
      const newWordIds = newWordEntries.map(w => w.id);

      const phase: StudyPhase = reviewWordIds.length > 0 ? 'review' : 'round1';

      const newState: InternalState = {
        phase,
        currentIndex: 0,
        newWords: newWordIds,
        reviewWords: reviewWordIds,
        round2Results: {},
        round4Results: {},
        reviewResults: {},
        extraNewWords: [],
      };

      setInternal(newState);

      // 持久化 session
      await persistSession(newState);
    }

    init();
  }, [ready, words, currentWordIndex, dailyMinNewWords]);

  // 每次 internal 变化时持久化 session
  const persistSession = useCallback(async (s: InternalState) => {
    const record: SessionRecord = {
      key: 'current',
      date: getTodayString(),
      phase: s.phase,
      currentIndex: s.currentIndex,
      newWords: s.newWords,
      reviewWords: s.reviewWords,
      round2Results: s.round2Results,
      round4Results: s.round4Results,
      reviewResults: s.reviewResults,
    };
    await db.saveSession(record);
  }, []);

  // 持久化包装
  const saveAndPersist = useCallback(async (s: InternalState) => {
    setInternal(s);
    await persistSession(s);
  }, [persistSession]);

  // 获取当前词条
  const getCurrentWordId = useCallback((s: InternalState): string | null => {
    const allNew = [...s.newWords, ...s.extraNewWords];
    switch (s.phase) {
      case 'review':
        return s.reviewWords[s.currentIndex] ?? null;
      case 'round1':
        return allNew[s.currentIndex] ?? null;
      case 'round2':
        return allNew[s.currentIndex] ?? null;
      case 'round3': {
        const difficultIds = allNew.filter(id => s.round2Results[id] === false);
        return difficultIds[s.currentIndex] ?? null;
      }
      case 'round4':
        return allNew[s.currentIndex] ?? null;
      case 'summary':
        return null;
    }
  }, []);

  // ---- ADVANCE ----
  const advance = useCallback(async (result?: boolean) => {
    setInternal(prev => {
      const next = { ...prev };
      const allNew = [...prev.newWords, ...prev.extraNewWords];

      switch (prev.phase) {
        case 'review': {
          // 记录结果
          if (result !== undefined) {
            next.reviewResults = {
              ...prev.reviewResults,
              [prev.reviewWords[prev.currentIndex]]: result,
            };
            // 更新进度到 DB（异步，不阻塞）
            const wordId = prev.reviewWords[prev.currentIndex];
            updateReviewProgress(wordId, result);
          }
          // 前进
          if (prev.currentIndex + 1 < prev.reviewWords.length) {
            next.currentIndex = prev.currentIndex + 1;
          } else {
            // 复习完毕，进入 ROUND_1
            next.phase = allNew.length > 0 ? 'round1' : 'summary';
            next.currentIndex = 0;
          }
          break;
        }

        case 'round1': {
          if (prev.currentIndex + 1 < allNew.length) {
            next.currentIndex = prev.currentIndex + 1;
          } else {
            // ROUND_1 结束，进入 ROUND_2
            next.phase = 'round2';
            next.currentIndex = 0;
          }
          break;
        }

        case 'round2': {
          // 记录结果
          if (result !== undefined) {
            next.round2Results = {
              ...prev.round2Results,
              [allNew[prev.currentIndex]]: result,
            };
          }
          if (prev.currentIndex + 1 < allNew.length) {
            next.currentIndex = prev.currentIndex + 1;
          } else {
            // ROUND_2 结束
            const difficultIds = allNew.filter(id => next.round2Results[id] === false);
            if (difficultIds.length > 0) {
              next.phase = 'round3';
              next.currentIndex = 0;
            } else {
              next.phase = 'round4';
              next.currentIndex = 0;
            }
          }
          break;
        }

        case 'round3': {
          const difficultIds = allNew.filter(id => prev.round2Results[id] === false);
          if (prev.currentIndex + 1 < difficultIds.length) {
            next.currentIndex = prev.currentIndex + 1;
          } else {
            next.phase = 'round4';
            next.currentIndex = 0;
          }
          break;
        }

        case 'round4': {
          // 记录结果
          if (result !== undefined) {
            next.round4Results = {
              ...prev.round4Results,
              [allNew[prev.currentIndex]]: result,
            };
            // 创建 ProgressRecord（异步）
            const wordId = allNew[prev.currentIndex];
            createNewProgress(wordId, result);
          }
          if (prev.currentIndex + 1 < allNew.length) {
            next.currentIndex = prev.currentIndex + 1;
          } else {
            next.phase = 'summary';
            next.currentIndex = 0;
            // 写入 dailyLog 和更新设置（异步）
            finalizeDay(allNew.length, prev.reviewWords.length);
          }
          break;
        }

        case 'summary':
          // 不需要 advance
          break;
      }

      // 持久化
      persistSession(next);
      return next;
    });
  }, [persistSession]);

  // 加载更多新词（ROUND_1 专用）
  const loadMoreNewWords = useCallback(async (count: number) => {
    setInternal(prev => {
      const startIdx = currentWordIndex + prev.newWords.length + prev.extraNewWords.length;
      const moreWords = words.slice(startIdx, startIdx + count).map(w => w.id);
      const next = {
        ...prev,
        extraNewWords: [...prev.extraNewWords, ...moreWords],
      };
      persistSession(next);
      return next;
    });
  }, [words, currentWordIndex, persistSession]);

  const skip = useCallback(() => {
    advance();
  }, [advance]);

  // ---- 构建对外状态 ----
  const currentWordId = getCurrentWordId(internal);
  const currentEntry = currentWordId
    ? wordsMapRef.current.get(currentWordId) ?? null
    : null;
  const currentProgress = currentWordId
    ? progressMapRef.current.get(currentWordId) ?? null
    : null;

  const allNew = [...internal.newWords, ...internal.extraNewWords];
  let totalInPhase = 0;
  switch (internal.phase) {
    case 'review':
      totalInPhase = internal.reviewWords.length;
      break;
    case 'round1':
    case 'round2':
    case 'round4':
      totalInPhase = allNew.length;
      break;
    case 'round3': {
      const difficultIds = allNew.filter(id => internal.round2Results[id] === false);
      totalInPhase = difficultIds.length;
      break;
    }
    case 'summary':
      totalInPhase = 0;
      break;
  }

  const state: StudyState = {
    phase: internal.phase,
    currentEntry,
    currentProgress,
    currentIndex: internal.currentIndex,
    totalInPhase,
    globalWordIndex: currentWordIndex,
    newWordsCount: internal.newWords.length + internal.extraNewWords.length,
    reviewWordsCount: internal.reviewWords.length,
    ready: initializedRef.current,
  };

  const actions: StudyActions = {
    advance,
    loadMoreNewWords,
    skip,
  };

  return { state, actions };
}

// ---- 辅助函数（异步，不阻塞 UI） ----

async function updateReviewProgress(wordId: string, correct: boolean) {
  try {
    const progress = await db.getProgress(wordId);
    if (!progress) return;
    const updated = handleReviewResult(progress, correct);
    await db.saveProgress(updated);
  } catch (err) {
    console.error('updateReviewProgress failed:', err);
  }
}

async function createNewProgress(wordId: string, remembered: boolean) {
  try {
    const wordsMap = await loadWordsMapForProgress();
    const word = wordsMap.get(wordId);
    if (!word) return;

    // 确定 bookId
    const parts = wordId.split('-');
    const bookId = parts[0] as BookId;

    const progress = createProgressRecord(wordId, word.word, bookId);
    // 模糊 → 标记为优先复习（更早复习日期）
    if (!remembered) {
      progress.nextReviewDate = addDays(getTodayString(), 0); // 明天就复习
    }
    await db.saveProgress(progress);
  } catch (err) {
    console.error('createNewProgress failed:', err);
  }
}

async function loadWordsMapForProgress(): Promise<Map<string, WordEntry>> {
  const allBooks = await db.getAllBookIds();
  const map = new Map<string, WordEntry>();
  for (const bookId of allBooks) {
    const wb = await db.getWordbook(bookId);
    if (wb) {
      for (const w of wb.words) {
        map.set(w.id, w);
      }
    }
  }
  return map;
}

async function finalizeDay(newWordsCount: number, reviewWordsCount: number) {
  try {
    const today = getTodayString();
    const settings = await db.getSettings();

    // 计算连续打卡天数
    let streakCount = 1;
    if (settings) {
      const lastDate = settings.lastStudyDate;
      const yesterday = addDays(today, -1);
      if (lastDate === yesterday) {
        streakCount = (settings.streakCount || 0) + 1;
      } else if (lastDate === today) {
        streakCount = settings.streakCount || 1;
      }
    }

    // 写入 dailyLog
    const dailyLog = {
      date: today,
      newWordsCount,
      reviewWordsCount,
      currentBookId: settings?.currentBookId ?? 'cet6' as BookId,
    };
    await db.saveDailyLog(dailyLog);

    // 更新 settings
    if (settings) {
      const newIndex = settings.currentWordIndex + newWordsCount;
      await db.saveSettings({
        ...settings,
        currentWordIndex: newIndex,
        streakCount,
        lastStudyDate: today,
      });
    }

    // 清除 session
    await db.clearSession();
  } catch (err) {
    console.error('finalizeDay failed:', err);
  }
}
