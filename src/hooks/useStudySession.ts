// ============================================================
// 学习状态机 Hook —「默」Mo
// 只保留两条主流程：复习 fuzzy 词、新词手动标记为模糊/已掌握
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  BookId,
  WordEntry,
  ProgressRecord,
  SessionRecord,
  StudyPhase,
} from '../types';
import * as db from '../lib/db';
import {
  getTodayString,
  generateDailyQueue,
  createFuzzyProgress,
  createMasteredProgress,
} from '../lib/scheduler';
import { validateStudySession } from '../lib/session';

interface StudyState {
  ready: boolean;
  advancing: boolean;
  phase: StudyPhase;
  currentIndex: number;
  totalInPhase: number;
  currentEntry: WordEntry | null;
  currentProgress: ProgressRecord | null;
  newWordsCount: number;
  reviewWordsCount: number;
  processedNewWordsCount: number;
  sessionError: string;
}

interface StudyActions {
  markFuzzy: () => Promise<void>;
  markMastered: () => Promise<void>;
  finishTodayEarly: () => Promise<void>;
  restartSession: () => Promise<void>;
}

function getPhaseWordIds(session: SessionRecord): string[] {
  if (session.phase === 'review') return session.reviewWords;
  if (session.phase === 'round1') return session.newWords;
  return [];
}

function getTotalInPhase(phase: StudyPhase, session: SessionRecord): number {
  if (phase === 'review') return session.reviewWords.length;
  if (phase === 'round1') return session.newWords.length;
  return 0;
}

function findEntry(bookWords: WordEntry[], wordId?: string): WordEntry | null {
  if (!wordId) return null;
  return bookWords.find(w => w.id === wordId) || null;
}

export function useStudySession(
  bookId: BookId,
  bookWords: WordEntry[],
  currentWordIndex: number,
  dailyMinNewWords: number,
  enabled: boolean,
): { state: StudyState; actions: StudyActions } {
  const [state, setState] = useState<StudyState>({
    ready: false,
    advancing: false,
    phase: 'review',
    currentIndex: 0,
    totalInPhase: 0,
    currentEntry: null,
    currentProgress: null,
    newWordsCount: 0,
    reviewWordsCount: 0,
    processedNewWordsCount: 0,
    sessionError: '',
  });

  const stateRef = useRef(state);
  const markingRef = useRef(false);
  stateRef.current = state;

  useEffect(() => {
    if (!enabled) {
      setState(prev => ({ ...prev, ready: false }));
      return;
    }

    let cancelled = false;

    async function init() {
      const today = getTodayString();
      const saved = await db.getSession();

      if (saved && saved.date === today && (!saved.bookId || saved.bookId === bookId)) {
        const validation = validateStudySession(saved, bookId, bookWords);
        if (!validation.valid) {
          await db.clearSession();
          await startNewSession(cancelled);
          return;
        }
        await restoreSession(saved, cancelled);
        return;
      }

      if (saved && saved.date !== today) {
        await db.clearSession();
      }

      await startNewSession(cancelled);
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [enabled, bookId, bookWords, currentWordIndex, dailyMinNewWords]);

  async function setSessionState(session: SessionRecord, cancelled = false) {
    if (cancelled) return;

    const ids = getPhaseWordIds(session);
    const currentWordId = ids[session.currentIndex];
    const currentEntry = findEntry(bookWords, currentWordId);
    setState({
      ready: true,
      advancing: false,
      phase: session.phase,
      currentIndex: session.currentIndex,
      totalInPhase: getTotalInPhase(session.phase, session),
      currentEntry,
      currentProgress: null,
      newWordsCount: session.newWords.length,
      reviewWordsCount: session.reviewWords.length,
      processedNewWordsCount: session.processedNewWordIds?.length || 0,
      sessionError: '',
    });
  }

  async function restoreSession(saved: SessionRecord, cancelled = false) {
    await setSessionState(saved, cancelled);
  }

  async function startNewSession(cancelled = false) {
    const queue = await generateDailyQueue(bookId, bookWords, currentWordIndex, dailyMinNewWords);
    const phase: StudyPhase = queue.reviewWords.length > 0
      ? 'review'
      : queue.newWords.length > 0
        ? 'round1'
        : 'summary';

    const session: SessionRecord = {
      key: 'current',
      date: getTodayString(),
      bookId,
      phase,
      currentIndex: 0,
      reviewWords: queue.reviewWords.map(p => p.wordId),
      newWords: queue.newWords.map(w => w.id),
      extraNewWords: [],
      round2Results: {},
      round4Results: {},
      reviewResults: {},
      plannedNextWordIndex: queue.plannedNextWordIndex,
      consumedNewWordIds: [],
      processedNewWordIds: [],
    };

    await db.saveSession(session);

    if (phase === 'summary') {
      await finalizeDay(session);
      if (!cancelled) {
        setState({
          ready: true,
          advancing: false,
          phase: 'summary',
          currentIndex: 0,
          totalInPhase: 0,
          currentEntry: null,
          currentProgress: null,
          newWordsCount: 0,
          reviewWordsCount: queue.reviewWords.length,
          processedNewWordsCount: 0,
          sessionError: '',
        });
      }
      return;
    }

    await setSessionState(session, cancelled);
  }

  async function advanceSession(session: SessionRecord) {
    const nextIndex = session.currentIndex + 1;

    if (session.phase === 'review') {
      if (nextIndex < session.reviewWords.length) {
        session.currentIndex = nextIndex;
        await db.saveSession(session);
        await setSessionState(session);
        return;
      }

      session.phase = session.newWords.length > 0 ? 'round1' : 'summary';
      session.currentIndex = 0;
      await db.saveSession(session);

      if (session.phase === 'summary') {
        await finalizeDay(session);
        setState(prev => ({
          ...prev,
          phase: 'summary',
          currentIndex: 0,
          totalInPhase: 0,
          currentEntry: null,
          currentProgress: null,
        }));
        return;
      }

      await setSessionState(session);
      return;
    }

    if (session.phase === 'round1') {
      if (nextIndex < session.newWords.length) {
        session.currentIndex = nextIndex;
        await db.saveSession(session);
        await setSessionState(session);
        return;
      }

      session.phase = 'summary';
      session.currentIndex = 0;
      await db.saveSession(session);
      await finalizeDay(session);
      setState(prev => ({
        ...prev,
        phase: 'summary',
        currentIndex: 0,
        totalInPhase: 0,
        currentEntry: null,
        currentProgress: null,
      }));
    }
  }

  function getSessionViewState(session: SessionRecord): Pick<StudyState, 'phase' | 'currentIndex' | 'totalInPhase' | 'currentEntry' | 'currentProgress'> {
    const ids = getPhaseWordIds(session);
    const currentWordId = ids[session.currentIndex];
    const currentEntry = findEntry(bookWords, currentWordId);

    return {
      phase: session.phase,
      currentIndex: session.currentIndex,
      totalInPhase: getTotalInPhase(session.phase, session),
      currentEntry,
      currentProgress: null,
    };
  }

  function getAdvancedSession(session: SessionRecord): { nextSession: SessionRecord; finished: boolean } {
    const nextIndex = session.currentIndex + 1;

    if (session.phase === 'review') {
      if (nextIndex < session.reviewWords.length) {
        return {
          nextSession: { ...session, currentIndex: nextIndex },
          finished: false,
        };
      }

      const nextPhase: StudyPhase = session.newWords.length > 0 ? 'round1' : 'summary';
      return {
        nextSession: { ...session, phase: nextPhase, currentIndex: 0 },
        finished: nextPhase === 'summary',
      };
    }

    if (session.phase === 'round1') {
      if (nextIndex < session.newWords.length) {
        return {
          nextSession: { ...session, currentIndex: nextIndex },
          finished: false,
        };
      }

      return {
        nextSession: { ...session, phase: 'summary', currentIndex: 0 },
        finished: true,
      };
    }

    return {
      nextSession: session,
      finished: true,
    };
  }

  async function markCurrent(status: 'fuzzy' | 'mastered') {
    const s = stateRef.current;
    if (!s.ready || s.advancing || markingRef.current || !s.currentEntry) return;
    markingRef.current = true;
    setState(prev => ({ ...prev, advancing: true }));

    try {
      const session = await db.getSession();
      if (!session) return;

      const today = getTodayString();
      const fromReview = s.phase === 'review';
      const existing = fromReview ? await db.getProgress(s.currentEntry.id) : null;
      const progress = status === 'fuzzy'
        ? createFuzzyProgress(s.currentEntry, bookId, today, existing, fromReview)
        : createMasteredProgress(s.currentEntry, bookId, today, existing, fromReview);

      if (fromReview) {
        session.reviewResults[s.currentEntry.id] = status === 'mastered';
      } else {
        session.processedNewWordIds = [
          ...(session.processedNewWordIds || []),
          s.currentEntry.id,
        ];
        session.consumedNewWordIds = [
          ...(session.consumedNewWordIds || []),
          s.currentEntry.id,
        ];
      }

      const { nextSession, finished } = getAdvancedSession(session);
      const nextProcessedCount = nextSession.processedNewWordIds?.length || 0;

      setState(prev => ({
        ...prev,
        advancing: true,
        processedNewWordsCount: nextProcessedCount,
        ...(finished
          ? {
              phase: 'summary' as StudyPhase,
              currentIndex: 0,
              totalInPhase: 0,
              currentEntry: null,
              currentProgress: null,
            }
          : getSessionViewState(nextSession)),
      }));

      await db.saveProgress(progress);
      void db.enqueueSync('progress', progress.wordId, progress);

      if (finished) {
        await db.saveSession(nextSession);
        await finalizeDay(nextSession);
      } else {
        await db.saveSession(nextSession);
      }
    } catch (error) {
      console.error('Failed to mark current word:', error);
      setState(prev => ({
        ...prev,
        sessionError: '保存学习进度失败，请重试',
      }));
    } finally {
      markingRef.current = false;
      setState(prev => ({ ...prev, advancing: false }));
    }
  }

  async function finalizeDay(session: SessionRecord) {
    const today = getTodayString();
    const processedNewCount = session.processedNewWordIds?.length || 0;

    const dailyLog = await db.getDailyLog(today);
    const newLog = {
      date: today,
      newWordsCount: processedNewCount,
      reviewWordsCount: session.reviewWords.length,
      currentBookId: bookId,
    };
    await db.saveDailyLog(dailyLog ? { ...dailyLog, ...newLog } : newLog);
    void db.enqueueSync('dailyLog', today, newLog);

    const settings = await db.getSettings();
    if (settings) {
      const yesterdayStr = addOneDay(today, -1);
      const isConsecutive = settings.lastStudyDate === yesterdayStr;
      const studiedTodayBefore = settings.lastStudyDate === today;
      const newStreak = studiedTodayBefore
        ? settings.streakCount
        : isConsecutive
          ? settings.streakCount + 1
          : 1;

      const updatedSettings = {
        ...settings,
        lastStudyDate: today,
        streakCount: newStreak,
        currentWordIndexByBook: {
          ...settings.currentWordIndexByBook,
          [bookId]: session.plannedNextWordIndex,
        },
      };
      await db.saveSettings(updatedSettings);
      void db.enqueueSync('settings', 'settings', updatedSettings);
    }

    await db.clearSession();
  }

  const finishTodayEarly = useCallback(async () => {
    const session = await db.getSession();
    if (!session) return;
    await finalizeDay(session);
  }, [bookId]);

  const restartSession = useCallback(async () => {
    await db.clearSession();
    markingRef.current = false;
    setState(prev => ({
      ...prev,
      ready: false,
      advancing: false,
      sessionError: '',
    }));
    await startNewSession(false);
  }, [bookId, bookWords, currentWordIndex, dailyMinNewWords]);

  const markFuzzy = useCallback(async () => {
    await markCurrent('fuzzy');
  }, [bookId]);

  const markMastered = useCallback(async () => {
    await markCurrent('mastered');
  }, [bookId]);

  return {
    state,
    actions: {
      markFuzzy,
      markMastered,
      finishTodayEarly,
      restartSession,
    },
  };
}

function addOneDay(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
