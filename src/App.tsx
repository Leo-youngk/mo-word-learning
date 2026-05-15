import { useState, useCallback, useEffect, useRef } from 'react';
import type { BookId } from './types';
import { useWordbook } from './hooks/useWordbook';
import { useStudySession } from './hooks/useStudySession';
import { getTodayString, generateDailyQueue } from './lib/scheduler';
import { restoreSession, onAuthStateChange, autoAuth, type User } from './lib/auth';
import { setSoundEnabled } from './lib/sound';
import * as progressService from './services/progressService';
import * as settingsService from './services/settingsService';
import * as sessionService from './services/sessionService';
import * as dailyActivityService from './services/dailyActivityService';

import Welcome from './components/Welcome';
import CardDisplay from './components/CardDisplay';
import ReviewCard from './components/ReviewCard';
import DaySummary from './components/DaySummary';
import Settings from './components/Settings';
import ProgressDots from './components/ProgressDots';
import WordbookPage from './components/WordbookPage';
import BottomNav, { type MainTab } from './components/BottomNav';

type ViewState = 'loading' | 'auth' | 'main' | 'study';

const DEFAULT_BOOK_ID: BookId = 'cet6';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return '操作失败，请稍后重试。';
}

export default function App() {
  const authHydratedRef = useRef(false);
  const skipNextMainRefreshRef = useRef(false);
  const [view, setView] = useState<ViewState>('loading');
  const [studyPrefetching, setStudyPrefetching] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>('today');
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<settingsService.AppSettings | null>(null);
  const [totalLearned, setTotalLearned] = useState(0);
  const [totalFuzzy, setTotalFuzzy] = useState(0);
  const [hasSession, setHasSession] = useState(false);
  const [sessionInfo, setSessionInfo] = useState('');
  const [todayProgress, setTodayProgress] = useState({ current: 0, total: 25 });
  const [todayStats, setTodayStats] = useState({ newWords: 0, reviewWords: 0 });
  const [achievement, setAchievement] = useState({ current: 0, nextMilestone: 500, remaining: 500 });
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(600);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [studyLaunchError, setStudyLaunchError] = useState('');

  const bookId = settings?.currentBookId ?? DEFAULT_BOOK_ID;
  const {
    words,
    loading: bookLoading,
    error: wordbookError,
    currentIndex,
    switchBook,
    finished: bookFinished,
  } = useWordbook(bookId);
  const activeCurrentIndex = settings?.currentWordIndexByBook?.[bookId] ?? currentIndex;

  const { state, actions } = useStudySession(
    bookId,
    words,
    activeCurrentIndex,
    settings?.dailyMinNewWords ?? 25,
    (view === 'study' || studyPrefetching) && !bookLoading && !wordbookError && words.length > 0,
  );

  const refreshAppState = useCallback(async () => {
    try {
      const nextSettings = await settingsService.getSettings();
      setSettings(nextSettings);
      document.documentElement.setAttribute('data-theme', nextSettings.themeMode ?? 'zen');

      const mastered = await progressService.countMastered();
      const fuzzy = await progressService.countFuzzy(nextSettings.currentBookId);
      setTotalLearned(mastered);
      setTotalFuzzy(fuzzy);

      const nextMilestone = Math.max(500, Math.ceil((mastered + 1) / 500) * 500);
      setAchievement({
        current: mastered,
        nextMilestone,
        remaining: nextMilestone - mastered,
      });

      const today = getTodayString();
      const session = await sessionService.getActiveSession(today);
      const hasTodaySession = Boolean(session);
      setHasSession(hasTodaySession);

      if (session) {
        const phaseLabels: Record<string, string> = {
          review: '复习',
          round1: '学习',
          summary: '总结',
        };
        const total = session.phase === 'review' ? session.reviewWordIds.length : session.newWordIds.length;
        const completed = session.completedWordIds.length;
        setSessionInfo(`${phaseLabels[session.phase] || '学习'} ${session.currentIndex + 1}/${Math.max(total, 1)}`);
        setTodayProgress({ current: completed, total: Math.max(total, 1) });
        setTodayStats({
          newWords: session.newWordIds.length,
          reviewWords: session.reviewWordIds.length,
        });
      } else {
        setSessionInfo('');
        const activity = await dailyActivityService.getDailyActivity(today);
        const actualNew = activity?.newWordsCount ?? 0;
        const actualReview = activity?.reviewWordsCount ?? fuzzy;
        setTodayProgress({ current: actualNew, total: actualNew + actualReview });
        setTodayStats({ newWords: actualNew, reviewWords: actualReview });
      }
    } catch (error) {
      console.warn('refreshAppState failed:', error);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChange((nextUser) => {
      if (!authHydratedRef.current) return;
      setUser(nextUser);
      if (nextUser) {
        skipNextMainRefreshRef.current = true;
        setView('main');
        refreshAppState();
      } else {
        setView('auth');
      }
    });

    restoreSession().then((nextUser) => {
      if (nextUser) {
        setUser(nextUser);
        skipNextMainRefreshRef.current = true;
        refreshAppState().finally(() => {
          authHydratedRef.current = true;
          setView('main');
        });
      } else {
        authHydratedRef.current = true;
        setView('auth');
      }
    });

    return unsub;
  }, [refreshAppState]);

  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) return;
    const interval = window.setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          setTimerRunning(false);
          setTimerFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, timerSeconds]);

  const startTimer = useCallback(() => {
    setTimerSeconds(600);
    setTimerRunning(true);
    setTimerFinished(false);
  }, []);

  const stopTimer = useCallback(() => {
    setTimerRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    setTimerSeconds(600);
    setTimerRunning(false);
    setTimerFinished(false);
  }, []);

  useEffect(() => {
    if (view !== 'study') resetTimer();
  }, [view, resetTimer]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (settings?.themeMode) {
      document.documentElement.setAttribute('data-theme', settings.themeMode);
    }
  }, [settings?.themeMode]);

  useEffect(() => {
    if (typeof settings?.soundEnabled === 'boolean') {
      setSoundEnabled(settings.soundEnabled);
    }
  }, [settings?.soundEnabled]);

  useEffect(() => {
    if (view !== 'main') return;
    if (skipNextMainRefreshRef.current) {
      skipNextMainRefreshRef.current = false;
      return;
    }
    refreshAppState();
  }, [view, mainTab, refreshAppState]);

  useEffect(() => {
    if (!studyPrefetching) return;
    if (bookLoading || wordbookError) return;
    if (state.startupStatus !== 'ready' && state.startupStatus !== 'error') return;

    setStudyPrefetching(false);
    setView('study');
  }, [bookLoading, wordbookError, state.startupStatus, studyPrefetching]);

  const handleAuth = useCallback(async () => {
    setAuthError('');
    try {
      await autoAuth(authEmail, authPassword);
    } catch (error) {
      setAuthError(getErrorMessage(error));
    }
  }, [authEmail, authPassword]);

  const handleStart = useCallback(async (targetBookId: BookId) => {
    setStudyLaunchError('');
    setHasSession(false);
    setStudyPrefetching(true);

    try {
      const nextSettings = await settingsService.updateSettingsPartial({ currentBookId: targetBookId });
      setSettings(nextSettings);

      if (targetBookId !== bookId) {
        await switchBook(targetBookId);
      }
    } catch (error) {
      console.warn('handleStart failed:', error);
      setStudyPrefetching(false);
      setStudyLaunchError(getErrorMessage(error));
    }
  }, [bookId, switchBook]);

  const handleContinue = useCallback(async () => {
    setStudyLaunchError('');
    setStudyPrefetching(true);
  }, []);

  const handleSwitchBook = useCallback(async (newBookId: BookId) => {
    const nextSettings = await settingsService.updateSettingsPartial({ currentBookId: newBookId });
    setSettings(nextSettings);
    await switchBook(newBookId);
  }, [switchBook]);

  const handleBackToHome = useCallback(() => {
    if (state.phase !== 'summary') {
      setShowExitConfirm(true);
    } else {
      setView('main');
      setMainTab('today');
    }
  }, [state.phase]);

  const handleSaveAndExit = useCallback(async () => {
    await actions.saveAndExit();
    setShowExitConfirm(false);
    setView('main');
    setMainTab('today');
    await refreshAppState();
  }, [actions, refreshAppState]);

  const handleAbandon = useCallback(async () => {
    const confirmed = window.confirm('确定放弃本次 session 吗？已经写入的模糊/已掌握记录会保留。');
    if (!confirmed) return;
    setShowExitConfirm(false);
    setView('main');
    setMainTab('today');
    await refreshAppState();
  }, [refreshAppState]);

  const handleContinueStudy = useCallback(async () => {
    try {
      const today = getTodayString();
      const queue = await generateDailyQueue(
        bookId,
        words,
        activeCurrentIndex,
        settings?.dailyMinNewWords ?? 25,
      );
      if (queue.reviewWords.length === 0 && queue.newWords.length === 0) return;

      await sessionService.createExtraSession(
        today,
        bookId,
        queue.reviewWords.map(p => p.wordId),
        queue.newWords.map(w => w.id),
        queue.plannedNextWordIndex,
      );

      setStudyLaunchError('');
      setStudyPrefetching(true);
    } catch (error) {
      console.warn('handleContinueStudy failed:', error);
      setStudyLaunchError(getErrorMessage(error));
    }
  }, [activeCurrentIndex, bookId, settings?.dailyMinNewWords, words]);

  const handleRetryStudyStartup = useCallback(async () => {
    setStudyLaunchError('');
    try {
      if (wordbookError) {
        await switchBook(bookId);
      }
      setStudyPrefetching(false);
      setView('study');
      await actions.restartSession();
    } catch (error) {
      setStudyLaunchError(getErrorMessage(error));
    }
  }, [actions, bookId, switchBook, wordbookError]);

  if (view === 'loading') {
    return (
      <div className="app">
        <div className="loading-screen">
          <span className="loading-screen__text">默</span>
        </div>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <div className="app">
        <div className="auth-screen">
          <div className="auth-screen__logo">默</div>
          <h2 className="auth-screen__title">登录</h2>
          {authError && <p className="auth-screen__error">{authError}</p>}
          <input
            className="auth-screen__input"
            type="email"
            placeholder="邮箱"
            value={authEmail}
            onChange={e => setAuthEmail(e.target.value)}
          />
          <input
            className="auth-screen__input"
            type="password"
            placeholder="密码"
            value={authPassword}
            onChange={e => setAuthPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
          />
          <button className="home__primary-btn" onClick={handleAuth} style={{ width: '100%', marginTop: '12px' }}>
            登录 / 注册
          </button>
          <p className="settings__sync-desc" style={{ marginTop: '12px', textAlign: 'center' }}>
            首次使用自动注册，已有账号直接登录
          </p>
        </div>
      </div>
    );
  }

  if (view === 'main') {
    return (
      <div className="app app--with-nav">
        {mainTab === 'today' && (
          <Welcome
            bookId={bookId}
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
            bookId={bookId}
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

  const studyErrorMessage = studyLaunchError || wordbookError || (state.startupStatus === 'error' ? state.sessionError : '');
  const isStudyBootstrapping = bookLoading || state.startupStatus === 'bootstrapping' || state.startupStatus === 'idle';

  if (studyErrorMessage) {
    return (
      <div className="app">
        <div className="session-recovery">
          <h2>今日学习暂时无法打开</h2>
          <p>{studyErrorMessage}</p>
          <button className="home__primary-btn" onClick={handleRetryStudyStartup}>
            重新尝试
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

  if (isStudyBootstrapping) {
    return (
      <div className="app">
        <div className="loading-screen">
          <span className="loading-screen__text">正在准备今日学习…</span>
        </div>
      </div>
    );
  }

  if (state.phase === 'summary') {
    return (
      <div className="app">
        <DaySummary
          streakCount={settings?.streakCount ?? 0}
          newWordsCount={state.processedNewWordsCount}
          reviewWordsCount={state.reviewWordsCount}
          totalLearned={totalLearned}
          bookFinished={bookFinished}
          onContinueStudy={!bookFinished ? handleContinueStudy : undefined}
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
          <p>{state.sessionError || '当前单词不存在或学习位置已过期，不会删除已经保存的进度。'}</p>
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

      {(timerRunning || timerFinished) && (
        <div
          className={`study-timer ${timerFinished ? 'study-timer--finished' : ''}`}
          onClick={timerFinished ? resetTimer : (timerRunning ? stopTimer : startTimer)}
        >
          <span className="study-timer__icon">⏱</span>
          <span className="study-timer__text">{formatTimer(timerSeconds)}</span>
        </div>
      )}

      {!timerRunning && !timerFinished && state.phase !== 'review' && (
        <button className="study-timer-btn" onClick={startTimer}>
          ⏱ 开始计时
        </button>
      )}

      {timerFinished && (
        <div className="study-timer-alert" onClick={resetTimer}>
          ⏱ 时间到，休息一下吧
        </div>
      )}

      <div className="study-progress" aria-hidden="true">
        <div className="study-progress__fill" style={{ width: `${studyProgressPercent}%` }} />
      </div>

      {state.phase === 'review' ? (
        <ReviewCard
          entry={state.currentEntry}
          onResult={mastered => mastered ? actions.markMastered() : actions.markFuzzy()}
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
