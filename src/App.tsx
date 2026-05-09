// ============================================================
// App 根组件 —「默」Mo
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import type { BookId, SettingsRecord } from './types';
import * as db from './lib/db';
import { useWordbook } from './hooks/useWordbook';
import { useStudySession } from './hooks/useStudySession';
import { getTodayString } from './lib/scheduler';
import { getWordUserStatus } from './lib/wordStatus';
import { validateStudySession } from './lib/session';
import { runCloudSync } from './lib/cloudSync';

import Welcome from './components/Welcome';
import CardDisplay from './components/CardDisplay';
import ReviewCard from './components/ReviewCard';
import DaySummary from './components/DaySummary';
import Settings from './components/Settings';
import ProgressDots from './components/ProgressDots';
import AiExplain from './components/AiExplain';
import WordbookPage from './components/WordbookPage';
import BottomNav, { type MainTab } from './components/BottomNav';

type ViewState = 'loading' | 'main' | 'study';

const DEFAULT_BOOK_ID: BookId = 'cet6';

export default function App() {
  const [view, setView] = useState<ViewState>('loading');
  const [mainTab, setMainTab] = useState<MainTab>('today');
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [totalLearned, setTotalLearned] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasSession, setHasSession] = useState(false);
  const [sessionInfo, setSessionInfo] = useState('');
  const [todayProgress, setTodayProgress] = useState({ current: 0, total: 25 });
  const [todayStats, setTodayStats] = useState({ newWords: 25, reviewWords: 0, estimatedMinutes: 12 });
  const [achievement, setAchievement] = useState({ current: 0, nextMilestone: 500, remaining: 500 });
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pwaUpdate, setPwaUpdate] = useState<(() => void) | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);

  const {
    bookId,
    words,
    loading: bookLoading,
    currentIndex,
    switchBook,
    finished: bookFinished,
  } = useWordbook(settings?.currentBookId ?? DEFAULT_BOOK_ID);
  const activeCurrentIndex = settings?.currentWordIndexByBook?.[bookId] ?? currentIndex;

  const { state, actions } = useStudySession(
    bookId,
    words,
    activeCurrentIndex,
    settings?.dailyMinNewWords ?? 25,
    view === 'study' && !bookLoading && words.length > 0,
  );

  const refreshAppState = useCallback(async () => {
    const s = await db.getSettings();
    setSettings(s);
    document.documentElement.setAttribute('data-theme', s?.themeMode ?? 'zen');

    const progress = await db.getAllProgress();
    const masteredCount = progress.filter(p => getWordUserStatus(p) === 'mastered').length;
    setTotalLearned(masteredCount);

    const nextMilestone = Math.max(500, Math.ceil((masteredCount + 1) / 500) * 500);
    setAchievement({
      current: masteredCount,
      nextMilestone,
      remaining: nextMilestone - masteredCount,
    });

    const today = getTodayString();
    const session = await db.getSession();
    const sessionValidation = session && words.length > 0
      ? validateStudySession(session, s?.currentBookId ?? bookId, words)
      : null;
    const hasTodaySession = Boolean(session && session.date === today && (!sessionValidation || sessionValidation.valid));
    setHasSession(hasTodaySession);

    if (session && hasTodaySession) {
      const phaseLabels: Record<string, string> = {
        review: '复习',
        round1: '学习',
        summary: '总结',
      };
      const total = session.phase === 'review' ? session.reviewWords.length : session.newWords.length;
      setSessionInfo(`${phaseLabels[session.phase] || '学习'} ${session.currentIndex + 1}/${Math.max(total, 1)}`);
      setTodayProgress({ current: session.currentIndex, total: Math.max(total, 1) });
      setTodayStats({
        newWords: session.newWords.length,
        reviewWords: session.reviewWords.length,
        estimatedMinutes: Math.ceil((session.newWords.length + session.reviewWords.length) * 0.5),
      });
    } else {
      setSessionInfo('');
      const dailyMin = s?.dailyMinNewWords ?? 25;
      setTodayProgress({ current: 0, total: dailyMin });
      setTodayStats({
        newWords: dailyMin,
        reviewWords: progress.filter(p => p.bookId === (s?.currentBookId ?? bookId) && getWordUserStatus(p) === 'fuzzy').length,
        estimatedMinutes: Math.ceil(dailyMin * 0.5),
      });
    }
  }, [bookId, words]);

  useEffect(() => {
    refreshAppState().finally(() => setView('main'));
  }, [refreshAppState]);

  useEffect(() => {
    if (settings?.themeMode) {
      document.documentElement.setAttribute('data-theme', settings.themeMode);
    }
  }, [settings?.themeMode]);

  useEffect(() => {
    if (!settings?.syncEnabled || !settings.syncToken || !isOnline || view !== 'main') return;
    let cancelled = false;
    runCloudSync(settings)
      .then(async () => {
        if (cancelled) return;
        const next = await db.getSettings();
        if (!cancelled) {
          setSettings(next);
        }
      })
      .catch(error => {
        console.warn('Cloud sync failed:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [settings?.syncEnabled, settings?.syncToken, isOnline, view]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleUpdateReady = (event: Event) => {
      const custom = event as CustomEvent<{ update?: () => void }>;
      setPwaUpdate(() => custom.detail?.update ?? (() => window.location.reload()));
    };
    const handleOfflineReady = () => setOfflineReady(true);

    window.addEventListener('mo:pwa-update-ready', handleUpdateReady);
    window.addEventListener('mo:pwa-offline-ready', handleOfflineReady);
    return () => {
      window.removeEventListener('mo:pwa-update-ready', handleUpdateReady);
      window.removeEventListener('mo:pwa-offline-ready', handleOfflineReady);
    };
  }, []);

  useEffect(() => {
    if (view === 'main') {
      refreshAppState();
    }
  }, [view, mainTab, refreshAppState]);

  const ensureSettings = useCallback(async (targetBookId: BookId): Promise<SettingsRecord> => {
    const existing = await db.getSettings();
    const base = existing ?? db.createDefaultSettings(targetBookId);
    const next: SettingsRecord = {
      ...base,
      currentBookId: targetBookId,
      dailyMinNewWords: base.dailyMinNewWords ?? 25,
      currentWordIndexByBook: base.currentWordIndexByBook ?? db.createDefaultWordIndexByBook(),
      aiEnabled: base.aiEnabled ?? false,
      streakCount: base.streakCount ?? 0,
      lastStudyDate: base.lastStudyDate ?? '',
      autoSpeak: base.autoSpeak ?? false,
      deepseekApiKey: base.deepseekApiKey ?? '',
      themeMode: base.themeMode ?? 'zen',
      motionLevel: base.motionLevel ?? 'standard',
    };
    await db.saveSettings(next);
    setSettings(next);
    return next;
  }, []);

  const handleStart = useCallback(async (targetBookId: BookId) => {
    await ensureSettings(targetBookId);
    if (targetBookId !== bookId) {
      await switchBook(targetBookId);
    }
    await db.clearSession();
    setHasSession(false);
    setView('study');
  }, [bookId, ensureSettings, switchBook]);

  const handleContinue = useCallback(async () => {
    const today = getTodayString();
    const session = await db.getSession();
    if (session && session.date === today) {
      const validation = validateStudySession(session, bookId, words);
      if (!validation.valid) {
        await db.clearSession();
        await handleStart(bookId);
        return;
      }
      setView('study');
      return;
    }
    await handleStart(bookId);
  }, [bookId, handleStart, words]);

  const handleSwitchBook = useCallback(async (newBookId: BookId) => {
    await ensureSettings(newBookId);
    await switchBook(newBookId);
    const next = await db.getSettings();
    setSettings(next);
  }, [ensureSettings, switchBook]);

  const handleBackToHome = useCallback(() => {
    if (state.phase !== 'summary') {
      setShowExitConfirm(true);
    } else {
      setView('main');
      setMainTab('today');
    }
  }, [state.phase]);

  const handleSaveAndExit = useCallback(async () => {
    await actions.finishTodayEarly();
    setShowExitConfirm(false);
    setView('main');
    setMainTab('today');
    await refreshAppState();
  }, [actions, refreshAppState]);

  const handleAbandon = useCallback(async () => {
    const confirmed = window.confirm('确定放弃本次 session 吗？已经写入的模糊 / 已掌握记录会保留。');
    if (!confirmed) return;
    await db.clearSession();
    setShowExitConfirm(false);
    setView('main');
    setMainTab('today');
    await refreshAppState();
  }, [refreshAppState]);

  if (view === 'loading') {
    return (
      <div className="app">
        <div className="loading-screen">
          <span className="loading-screen__text">默</span>
        </div>
      </div>
    );
  }

  if (view === 'main') {
    return (
      <div className="app app--with-nav">
        {pwaUpdate && (
          <div className="app-toast app-toast--action">
            <span>发现新版本</span>
            <button onClick={() => pwaUpdate()} type="button">刷新</button>
          </div>
        )}
        {!pwaUpdate && offlineReady && (
          <div className="app-toast">
            已可离线使用
          </div>
        )}
        {mainTab === 'today' && (
          <Welcome
            bookId={settings?.currentBookId ?? bookId}
            streakCount={settings?.streakCount ?? 0}
            totalLearned={totalLearned}
            todayProgress={todayProgress}
            todayStats={todayStats}
            achievement={achievement}
            hasSession={hasSession}
            sessionInfo={sessionInfo}
            onStart={handleStart}
            onContinue={handleContinue}
            onBookChange={handleSwitchBook}
            onOpenSettings={() => setMainTab('settings')}
            onOpenStats={() => setMainTab('wordbook')}
          />
        )}

        {mainTab === 'wordbook' && (
          <WordbookPage
            bookId={settings?.currentBookId ?? bookId}
            words={words}
          />
        )}

        {mainTab === 'settings' && (
          <Settings
            onBack={() => setMainTab('today')}
            onBookChange={handleSwitchBook}
            onSettingsChange={setSettings}
          />
        )}

        <BottomNav active={mainTab} onChange={setMainTab} />
      </div>
    );
  }

  if (view === 'study' && state.ready) {
    if (state.phase === 'summary') {
      return (
        <div className="app">
          <DaySummary
            streakCount={settings?.streakCount ?? 0}
            newWordsCount={state.processedNewWordsCount}
            reviewWordsCount={state.reviewWordsCount}
            totalLearned={totalLearned}
            bookFinished={bookFinished}
          />
          <div className="card__actions">
            <button className="btn btn--primary card__pill-btn card__pill-btn--primary" onClick={() => {
              setView('main');
              setMainTab('today');
              refreshAppState();
            }}>
              回到今日
            </button>
          </div>
        </div>
      );
    }

    if (!state.currentEntry) {
      return (
        <div className="app">
          <div className="session-recovery">
            <h2>学习会话已失效</h2>
            <p>{state.sessionError || '当前单词不存在或学习位置已过期。不会删除已经保存的进度。'}</p>
            <button className="home__primary-btn" onClick={actions.restartSession}>
              重新生成今日学习
            </button>
            <button className="btn btn--secondary" onClick={() => {
              setView('main');
              setMainTab('today');
              refreshAppState();
            }}>
              回到今日
            </button>
          </div>
        </div>
      );
    }

    const showAiExplain =
      isOnline &&
      settings?.aiEnabled &&
      settings?.deepseekApiKey &&
      settings.deepseekApiKey.length > 0;
    const studyProgressPercent = state.totalInPhase > 0
      ? ((state.currentIndex + 1) / state.totalInPhase) * 100
      : 0;

    return (
      <div className="app">
        <div className="study-header">
          <button className="back-btn" onClick={handleBackToHome}>×</button>
          <span className="study-header__center">{state.phase === 'review' ? '复习' : '学习'}</span>
          <span className="study-header__progress">{state.currentIndex + 1} / {state.totalInPhase}</span>
        </div>
        <div className="study-progress" aria-hidden="true">
          <div className="study-progress__fill" style={{ width: `${studyProgressPercent}%` }} />
        </div>

        {state.phase === 'review' ? (
          <ReviewCard
            entry={state.currentEntry}
            progress={state.currentProgress!}
            onResult={(mastered) => mastered ? actions.markMastered() : actions.markFuzzy()}
            disabled={state.advancing}
          />
        ) : (
          <CardDisplay
            entry={state.currentEntry}
            onFuzzy={actions.markFuzzy}
            onMastered={actions.markMastered}
            disabled={state.advancing}
          />
        )}

        {showAiExplain && (
          <AiExplain
            word={state.currentEntry.word}
            apiKey={settings!.deepseekApiKey!}
          />
        )}

        <ProgressDots
          total={state.totalInPhase}
          current={state.currentIndex}
        />

        {showExitConfirm && (
          <div className="stats-overlay" onClick={() => setShowExitConfirm(false)}>
            <div className="stats-panel" onClick={event => event.stopPropagation()}>
              <div className="stats-panel__handle" />
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <p style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>
                  今天先到这里？
                </p>
                <p style={{ fontSize: '14px', color: 'var(--c-text-tertiary)' }}>
                  已处理 {state.processedNewWordsCount} 个新词
                </p>
              </div>
              <button className="home__primary-btn" onClick={handleSaveAndExit} style={{ marginBottom: '12px' }}>
                保存进度并结束
              </button>
              <button
                className="home__primary-btn"
                onClick={() => setShowExitConfirm(false)}
                style={{
                  background: 'var(--c-surface)',
                  color: 'var(--c-text-primary)',
                  boxShadow: 'none',
                  marginBottom: '12px',
                }}
              >
                继续学习
              </button>
              <button className="btn btn--danger" onClick={handleAbandon} style={{ width: '100%' }}>
                放弃本次进度
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="loading-screen">
        <span className="loading-screen__text">…</span>
      </div>
    </div>
  );
}
