import { useState, useCallback, useEffect, useRef } from 'react';
import type { BookId, WordEntry, StudyPhase } from '../types';
import { getTodayString, generateDailyQueue, createFuzzyProgress, createMasteredProgress } from '../lib/scheduler';
import { playFuzzySound, playMasteredSound } from '../lib/sound';
import { getWordUserStatus } from '../lib/wordStatus';
import * as progressService from '../services/progressService';
import * as sessionService from '../services/sessionService';
import * as dailyActivityService from '../services/dailyActivityService';
import * as settingsService from '../services/settingsService';
import type { SessionData } from '../services/sessionService';

type StudyStartupStatus = 'idle' | 'bootstrapping' | 'ready' | 'error';

interface StudyState {
  ready: boolean;
  startupStatus: StudyStartupStatus;
  advancing: boolean;
  phase: StudyPhase;
  currentIndex: number;
  totalInPhase: number;
  currentEntry: WordEntry | null;
  newWordsCount: number;
  reviewWordsCount: number;
  processedNewWordsCount: number;
  sessionError: string;
}

interface StudyActions {
  markFuzzy: () => Promise<void>;
  markMastered: () => Promise<void>;
  finishTodayEarly: () => Promise<void>;
  saveAndExit: () => Promise<void>;
  restartSession: () => Promise<void>;
}

function getPhaseWordIds(session: SessionData): string[] {
  if (session.phase === 'review') return session.reviewWordIds;
  if (session.phase === 'round1') return session.newWordIds;
  return [];
}

function findEntry(bookWords: WordEntry[], wordId?: string): WordEntry | null {
  if (!wordId) return null;
  return bookWords.find(w => w.id === wordId) || null;
}

function findNextValidWord(
  ids: string[],
  startIndex: number,
  bookWords: WordEntry[],
): { entry: WordEntry | null; index: number } {
  if (ids.length === 0) return { entry: null, index: -1 };
  for (let offset = 0; offset < ids.length; offset += 1) {
    const idx = (startIndex + offset) % ids.length;
    const entry = findEntry(bookWords, ids[idx]);
    if (entry) return { entry, index: idx };
  }
  return { entry: null, index: -1 };
}

function createInitialState(): StudyState {
  return {
    ready: false,
    startupStatus: 'idle',
    advancing: false,
    phase: 'review',
    currentIndex: 0,
    totalInPhase: 0,
    currentEntry: null,
    newWordsCount: 0,
    reviewWordsCount: 0,
    processedNewWordsCount: 0,
    sessionError: '',
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return '今日学习初始化失败，请稍后重试。';
}

export function useStudySession(
  bookId: BookId,
  bookWords: WordEntry[],
  currentWordIndex: number,
  dailyMinNewWords: number,
  enabled: boolean,
): { state: StudyState; actions: StudyActions } {
  const [state, setState] = useState<StudyState>(createInitialState);

  const stateRef = useRef(state);
  const markingRef = useRef(false);
  const sessionRef = useRef<SessionData | null>(null);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  stateRef.current = state;

  useEffect(() => {
    if (!enabled) {
      setState(prev => ({
        ...prev,
        ready: false,
        startupStatus: 'idle',
      }));
      return;
    }

    let cancelled = false;
    setState(prev => ({
      ...prev,
      ready: false,
      startupStatus: 'bootstrapping',
      sessionError: '',
    }));

    async function init() {
      try {
        const today = getTodayString();
        const saved = await sessionService.getActiveSession(today);

        if (saved && saved.status === 'active') {
          sessionRef.current = saved;
          await applySessionToUI(saved, cancelled);
          return;
        }

        await startNewSession(cancelled);
      } catch (error) {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            ready: false,
            startupStatus: 'error',
            currentEntry: null,
            totalInPhase: 0,
            sessionError: getErrorMessage(error),
          }));
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [enabled, bookId, bookWords.length, currentWordIndex, dailyMinNewWords]);

  async function pruneMasteredWordsFromSession(session: SessionData): Promise<SessionData> {
    const allProgress = await progressService.getAllProgress();
    const globalProgressMap = progressService.buildGlobalProgressMap(allProgress);
    const masteredGlobalKeys = new Set(
      [...globalProgressMap.entries()]
        .filter(([, progress]) => getWordUserStatus(progress) === 'mastered')
        .map(([globalKey]) => globalKey),
    );

    if (masteredGlobalKeys.size === 0) {
      return session;
    }

    const masteredWordIds = new Set(
      bookWords
        .filter(word => masteredGlobalKeys.has(progressService.getProgressGlobalKey(word)))
        .map(word => word.id),
    );

    if (masteredWordIds.size === 0) {
      return session;
    }

    const nextReviewWordIds = session.reviewWordIds.filter(wordId => !masteredWordIds.has(wordId));
    const nextNewWordIds = session.newWordIds.filter(wordId => !masteredWordIds.has(wordId));

    if (
      nextReviewWordIds.length === session.reviewWordIds.length
      && nextNewWordIds.length === session.newWordIds.length
    ) {
      return session;
    }

    const nextSession: SessionData = {
      ...session,
      reviewWordIds: nextReviewWordIds,
      newWordIds: nextNewWordIds,
      completedWordIds: session.completedWordIds.filter(wordId => !masteredWordIds.has(wordId)),
      wordResults: Object.fromEntries(
        Object.entries(session.wordResults).filter(([wordId]) => !masteredWordIds.has(wordId)),
      ),
      currentIndex: 0,
    };

    const saved = await sessionService.saveSession(nextSession);
    sessionRef.current = saved;
    return saved;
  }

  async function applySessionToUI(session: SessionData, cancelled = false) {
    if (cancelled) return;

    const sanitizedSession = await pruneMasteredWordsFromSession(session);
    session = sanitizedSession;

    if (session.phase === 'summary') {
      setState({
        ready: true,
        startupStatus: 'ready',
        advancing: false,
        phase: 'summary',
        currentIndex: 0,
        totalInPhase: 0,
        currentEntry: null,
        newWordsCount: session.newWordIds.length,
        reviewWordsCount: session.reviewWordIds.length,
        processedNewWordsCount: session.completedWordIds.filter(id => session.newWordIds.includes(id)).length,
        sessionError: '',
      });
      return;
    }

    const ids = getPhaseWordIds(session);
    if (session.currentIndex >= ids.length) {
      await advanceToNextPhase(session);
      return;
    }

    const { entry, index: correctedIndex } = findNextValidWord(ids, session.currentIndex, bookWords);

    if (correctedIndex >= 0 && correctedIndex !== session.currentIndex) {
      session.currentIndex = correctedIndex;
      await sessionService.saveSession(session);
      sessionRef.current = session;
    }

    if (!entry) {
      await finalizeDay(session);
      setState({
        ready: true,
        startupStatus: 'ready',
        advancing: false,
        phase: 'summary',
        currentIndex: 0,
        totalInPhase: 0,
        currentEntry: null,
        newWordsCount: session.newWordIds.length,
        reviewWordsCount: session.reviewWordIds.length,
        processedNewWordsCount: session.completedWordIds.filter(id => session.newWordIds.includes(id)).length,
        sessionError: '',
      });
      return;
    }

    setState({
      ready: true,
      startupStatus: 'ready',
      advancing: false,
      phase: session.phase,
      currentIndex: session.currentIndex,
      totalInPhase: ids.length,
      currentEntry: entry,
      newWordsCount: session.newWordIds.length,
      reviewWordsCount: session.reviewWordIds.length,
      processedNewWordsCount: session.completedWordIds.filter(id => session.newWordIds.includes(id)).length,
      sessionError: '',
    });
  }

  async function advanceToNextPhase(session: SessionData) {
    if (session.phase === 'review') {
      if (session.newWordIds.length > 0) {
        session.phase = 'round1';
        session.currentIndex = 0;
        const saved = await sessionService.saveSession(session);
        sessionRef.current = saved;
        await applySessionToUI(saved);
      } else {
        session.phase = 'summary';
        session.currentIndex = 0;
        const saved = await sessionService.saveSession(session);
        sessionRef.current = saved;
        await finalizeDay(session);
        setState(prev => ({
          ...prev,
          ready: true,
          startupStatus: 'ready',
          phase: 'summary',
          currentIndex: 0,
          totalInPhase: 0,
          currentEntry: null,
        }));
      }
      return;
    }

    if (session.phase === 'round1') {
      session.phase = 'summary';
      session.currentIndex = 0;
      const saved = await sessionService.saveSession(session);
      sessionRef.current = saved;
      await finalizeDay(session);
      setState(prev => ({
        ...prev,
        ready: true,
        startupStatus: 'ready',
        phase: 'summary',
        currentIndex: 0,
        totalInPhase: 0,
        currentEntry: null,
      }));
    }
  }

  async function startNewSession(cancelled = false) {
    const queue = await generateDailyQueue(bookId, bookWords, currentWordIndex, dailyMinNewWords);
    const phase: StudyPhase = queue.reviewWords.length > 0
      ? 'review'
      : queue.newWords.length > 0
        ? 'round1'
        : 'summary';

    const session: SessionData = {
      date: getTodayString(),
      bookId,
      sessionType: 'daily',
      batchIndex: 0,
      status: 'active',
      phase,
      currentIndex: 0,
      reviewWordIds: queue.reviewWords.map(p => p.wordId),
      newWordIds: queue.newWords.map(w => w.id),
      completedWordIds: [],
      wordResults: {},
      plannedNextWordIndex: queue.plannedNextWordIndex,
    };

    const saved = await sessionService.saveSession(session);
    sessionRef.current = saved;

    if (phase === 'summary') {
      await finalizeDay(saved);
      if (!cancelled) {
        setState({
          ready: true,
          startupStatus: 'ready',
          advancing: false,
          phase: 'summary',
          currentIndex: 0,
          totalInPhase: 0,
          currentEntry: null,
          newWordsCount: 0,
          reviewWordsCount: queue.reviewWords.length,
          processedNewWordsCount: 0,
          sessionError: '',
        });
      }
      return;
    }

    await applySessionToUI(saved, cancelled);
  }

  function cloneSession(session: SessionData): SessionData {
    return {
      ...session,
      reviewWordIds: [...session.reviewWordIds],
      newWordIds: [...session.newWordIds],
      completedWordIds: [...session.completedWordIds],
      wordResults: { ...session.wordResults },
    };
  }

  function getProcessedNewWordsCount(session: SessionData): number {
    return session.completedWordIds.filter(id => session.newWordIds.includes(id)).length;
  }

  function buildStateFromSession(session: SessionData): StudyState {
    const processedNewWordsCount = getProcessedNewWordsCount(session);

    if (session.phase === 'summary') {
      return {
        ready: true,
        startupStatus: 'ready',
        advancing: false,
        phase: 'summary',
        currentIndex: 0,
        totalInPhase: 0,
        currentEntry: null,
        newWordsCount: session.newWordIds.length,
        reviewWordsCount: session.reviewWordIds.length,
        processedNewWordsCount,
        sessionError: '',
      };
    }

    const ids = getPhaseWordIds(session);
    const { entry, index } = findNextValidWord(ids, session.currentIndex, bookWords);

    if (!entry) {
      session.phase = 'summary';
      session.currentIndex = 0;
      return {
        ready: true,
        startupStatus: 'ready',
        advancing: false,
        phase: 'summary',
        currentIndex: 0,
        totalInPhase: 0,
        currentEntry: null,
        newWordsCount: session.newWordIds.length,
        reviewWordsCount: session.reviewWordIds.length,
        processedNewWordsCount,
        sessionError: '',
      };
    }

    session.currentIndex = index;
    return {
      ready: true,
      startupStatus: 'ready',
      advancing: false,
      phase: session.phase,
      currentIndex: session.currentIndex,
      totalInPhase: ids.length,
      currentEntry: entry,
      newWordsCount: session.newWordIds.length,
      reviewWordsCount: session.reviewWordIds.length,
      processedNewWordsCount,
      sessionError: '',
    };
  }

  function enqueueSync(task: () => Promise<void>) {
    syncQueueRef.current = syncQueueRef.current
      .catch(() => undefined)
      .then(task)
      .catch(error => {
        console.error('Failed to sync study progress:', error);
        // TODO: push failed mutations into a retry queue instead of dropping them.
      });
  }

  async function markCurrent(status: 'fuzzy' | 'mastered') {
    const currentState = stateRef.current;
    if (!currentState.ready || currentState.advancing || markingRef.current || !currentState.currentEntry) return;
    markingRef.current = true;
    setState(prev => ({ ...prev, advancing: true }));

    try {
      const session = sessionRef.current;
      if (!session) {
        console.error('Missing active session during markCurrent');
        setState(prev => ({ ...prev, advancing: false, sessionError: '学习会话已失效，请重新开始今日学习。' }));
        return;
      }

      const optimisticSession = cloneSession(session);
      optimisticSession.phase = currentState.phase;
      optimisticSession.currentIndex = currentState.currentIndex;

      const today = getTodayString();
      const fromReview = currentState.phase === 'review';
      const ids = getPhaseWordIds(optimisticSession);
      const nextIndex = optimisticSession.currentIndex + 1;

      if (nextIndex >= ids.length) {
        if (optimisticSession.phase === 'review' && optimisticSession.newWordIds.length > 0) {
          optimisticSession.phase = 'round1';
          optimisticSession.currentIndex = 0;
        } else {
          optimisticSession.phase = 'summary';
          optimisticSession.currentIndex = 0;
        }
      } else {
        optimisticSession.currentIndex = nextIndex;
      }

      optimisticSession.completedWordIds = [...optimisticSession.completedWordIds, currentState.currentEntry.id];
      optimisticSession.wordResults[currentState.currentEntry.id] = status;

      const nextState = buildStateFromSession(optimisticSession);
      sessionRef.current = optimisticSession;
      setState(nextState);
      if (status === 'mastered') {
        playMasteredSound();
      } else {
        playFuzzySound();
      }
      markingRef.current = false;

      const sessionSnapshot = cloneSession(optimisticSession);
      const currentEntry = currentState.currentEntry;
      enqueueSync(async () => {
        const existing = fromReview ? await progressService.getProgress(currentEntry.id) : null;
        const progress = status === 'fuzzy'
          ? createFuzzyProgress(currentEntry, bookId, today, existing, fromReview)
          : createMasteredProgress(currentEntry, bookId, today, existing, fromReview);

        await progressService.saveProgress(progress);
        await sessionService.saveSession(sessionSnapshot);
        await dailyActivityService.incrementDailyCounts(today, bookId, !fromReview);

        if (sessionSnapshot.phase === 'summary') {
          await finalizeDay(sessionSnapshot);
        }
      });
    } catch (error) {
      console.error('Failed to mark current word:', error);
      setState(prev => ({ ...prev, sessionError: '保存学习进度失败，请重试' }));
    } finally {
      markingRef.current = false;
    }
  }

  async function finalizeDay(session: SessionData) {
    const today = getTodayString();
    const newCount = session.completedWordIds.filter(id => session.newWordIds.includes(id)).length;
    const reviewCount = session.completedWordIds.filter(id => session.reviewWordIds.includes(id)).length;
    const existingActivity = await dailyActivityService.getDailyActivity(today);

    await dailyActivityService.upsertDailyActivity({
      date: today,
      bookId: session.bookId,
      newWordsCount: Math.max(existingActivity?.newWordsCount ?? 0, newCount),
      reviewWordsCount: Math.max(existingActivity?.reviewWordsCount ?? 0, reviewCount),
      totalWordsStudied: Math.max(existingActivity?.totalWordsStudied ?? 0, session.completedWordIds.length),
    });

    const settings = await settingsService.getSettings();
    const yesterdayStr = addOneDay(today, -1);
    const isConsecutive = settings.lastStudyDate === yesterdayStr;
    const studiedTodayBefore = settings.lastStudyDate === today;
    const newStreak = studiedTodayBefore
      ? settings.streakCount
      : isConsecutive
        ? settings.streakCount + 1
        : 1;

    await settingsService.updateSettingsPartial({
      lastStudyDate: today,
      streakCount: newStreak,
      currentWordIndexByBook: {
        ...settings.currentWordIndexByBook,
        [bookId]: session.plannedNextWordIndex,
      },
    });

    await sessionService.completeSession(session.id!);
  }

  const finishTodayEarly = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    await finalizeDay(session);
  }, [bookId]);

  const saveAndExit = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    await sessionService.saveSession(cloneSession(session));
  }, []);

  const restartSession = useCallback(async () => {
    try {
      const session = sessionRef.current;
      if (session?.id) {
        await sessionService.completeSession(session.id);
      }
      markingRef.current = false;
      sessionRef.current = null;
      setState(prev => ({
        ...prev,
        ready: false,
        startupStatus: 'bootstrapping',
        advancing: false,
        sessionError: '',
      }));
      await startNewSession(false);
    } catch (error) {
      setState(prev => ({
        ...prev,
        ready: false,
        startupStatus: 'error',
        currentEntry: null,
        totalInPhase: 0,
        sessionError: getErrorMessage(error),
      }));
    }
  }, [bookId, bookWords.length, currentWordIndex, dailyMinNewWords]);

  const markFuzzy = useCallback(async () => { await markCurrent('fuzzy'); }, [markCurrent]);
  const markMastered = useCallback(async () => { await markCurrent('mastered'); }, [markCurrent]);

  return {
    state,
    actions: { markFuzzy, markMastered, finishTodayEarly, saveAndExit, restartSession },
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
