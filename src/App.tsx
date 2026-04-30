// ============================================================
// App 根组件 —「默」Mo
// 视图状态路由、学习流程调度
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import type { BookId, SettingsRecord } from './types';
import * as db from './lib/db';
import { useWordbook } from './hooks/useWordbook';
import { useStudySession } from './hooks/useStudySession';
import { getTodayString } from './lib/scheduler';

import Welcome from './components/Welcome';
import CardDisplay from './components/CardDisplay';
import CardRecall from './components/CardRecall';
import CardCloze from './components/CardCloze';
import CardConfirm from './components/CardConfirm';
import ReviewCard from './components/ReviewCard';
import DaySummary from './components/DaySummary';
import StatsPanel from './components/StatsPanel';
import Settings from './components/Settings';
import ProgressDots from './components/ProgressDots';
import AiExplain from './components/AiExplain';

type ViewState =
  | 'loading'
  | 'welcome'
  | 'study'
  | 'summary'
  | 'settings';

const DEFAULT_BOOK_ID: BookId = 'cet6';

export default function App() {
  const [view, setView] = useState<ViewState>('loading');
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [showContinueOption, setShowContinueOption] = useState(false);
  const [totalLearned, setTotalLearned] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // 初始化
  useEffect(() => {
    async function init() {
      const s = await db.getSettings();
      if (s) {
        setSettings(s);
        setView('study');
      } else {
        setView('welcome');
      }
    }
    init();
  }, []);

  // 网络状态监听
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

  // 词库
  const {
    bookId,
    words,
    loading: bookLoading,
    currentIndex,
    switchBook,
    setCurrentIndex,
    finished: bookFinished,
    totalWords,
  } = useWordbook(settings?.currentBookId ?? DEFAULT_BOOK_ID);

  // 学习状态机
  const { state, actions } = useStudySession(
    bookId,
    words,
    currentIndex,
    settings?.dailyMinNewWords ?? 25,
    !bookLoading && words.length > 0
  );

  // 学习总数
  useEffect(() => {
    async function loadTotal() {
      const progress = await db.getAllProgress();
      setTotalLearned(progress.length);
    }
    loadTotal();
  }, [view]);

  // Welcome → 开始学习
  const handleStart = useCallback(async (bookId: BookId) => {
    const today = getTodayString();
    const newSettings: SettingsRecord = {
      key: 'settings',
      currentBookId: bookId,
      dailyMinNewWords: 25,
      currentWordIndex: 0,
      aiEnabled: false,
      streakCount: 1,
      lastStudyDate: today,
      autoSpeak: false,
      deepseekApiKey: '',
    };
    await db.saveSettings(newSettings);
    setSettings(newSettings);
    setView('study');
  }, []);

  // 学习流程中 advance 回调
  const handleAdvance = useCallback(async (result?: boolean) => {
    await actions.advance(result);

    // 检查是否需要显示「继续学习」选项
    // ROUND_1 且有额外学习空间
  }, [actions]);

  // ROUND_1 「继续学习」
  const handleContinueLearning = useCallback(async () => {
    await actions.loadMoreNewWords(10);
    setShowContinueOption(false);
  }, [actions]);

  // ROUND_1 「进入下一轮」
  const handleEnterNextRound = useCallback(async () => {
    // 关闭继续学习选项，advance 到 ROUND_2
    setShowContinueOption(false);
    // ROUND_1 结束后 advance 会进入 ROUND_2
    // 但我们需要快速遍历完当前 ROUND_1
    // 实际上 advance 在 ROUND_1 每词后才前进
  }, []);

  // 切换词库
  const handleSwitchBook = useCallback(async (newBookId: BookId) => {
    setStatsOpen(false);
    await switchBook(newBookId);
  }, [switchBook]);

  // 统计面板
  const handlePanelToggle = useCallback(() => {
    setStatsOpen(prev => !prev);
  }, []);

  // 设置
  const handleOpenSettings = useCallback(() => {
    setView('settings');
    setStatsOpen(false);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setView(settings ? 'study' : 'welcome');
  }, [settings]);

  // 触控手势
  useEffect(() => {
    let touchStartY = 0;
    let touchStartX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const dy = e.changedTouches[0].clientY - touchStartY;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // 底部上滑 → StatsPanel
      if (dy < -80 && absDy > absDx && touchStartY > window.innerHeight * 0.6) {
        setStatsOpen(true);
        return;
      }

      // 左右滑动
      if (absDx > 50 && absDx > absDy) {
        if (state.phase === 'review' || state.phase === 'round2' || state.phase === 'round4') {
          if (dx > 0) {
            // 右滑 = 记得
            actions.advance(true);
          } else {
            // 左滑 = 忘了/不记得/模糊
            actions.advance(false);
          }
        }
        if (state.phase === 'round1' || state.phase === 'round3') {
          actions.advance();
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [state.phase, actions]);

  // ---- 渲染 ----

  if (view === 'loading') {
    return (
      <div className="app">
        <div className="loading-screen">
          <span className="loading-screen__text">默</span>
        </div>
      </div>
    );
  }

  if (view === 'welcome') {
    return (
      <div className="app">
        <Welcome onStart={handleStart} />
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className="app">
        <Settings
          onBack={handleCloseSettings}
          onBookChange={handleSwitchBook}
        />
      </div>
    );
  }

  // 学习流程
  if (view === 'study' && state.ready) {
    // SUMMARY 阶段独立渲染
    if (state.phase === 'summary') {
      return (
        <div className="app">
          <DaySummary
            streakCount={settings?.streakCount ?? 0}
            newWordsCount={state.newWordsCount}
            reviewWordsCount={state.reviewWordsCount}
            totalLearned={totalLearned}
            bookFinished={bookFinished}
          />
          <div className="card__actions">
            <button className="btn btn--secondary" onClick={handlePanelToggle}>
              {statsOpen ? '收起' : '统计'}
            </button>
          </div>
          <StatsPanel
            open={statsOpen}
            onClose={() => setStatsOpen(false)}
            onOpenSettings={handleOpenSettings}
            onSwitchBook={handleSwitchBook}
          />
        </div>
      );
    }

    // 学习阶段
    if (!state.currentEntry) {
      return (
        <div className="app">
          <div className="loading-screen">
            <span className="loading-screen__text">…</span>
          </div>
        </div>
      );
    }

    const renderCard = () => {
      switch (state.phase) {
        case 'review':
          return state.currentProgress ? (
            <ReviewCard
              entry={state.currentEntry!}
              progress={state.currentProgress!}
              onResult={(correct) => actions.advance(correct)}
            />
          ) : (
            <CardDisplay
              entry={state.currentEntry!}
              onNext={() => actions.advance()}
              showContinueOption={false}
              onContinueLearning={() => {}}
            />
          );

        case 'round1':
          return (
            <CardDisplay
              entry={state.currentEntry!}
              onNext={() => actions.advance()}
              showContinueOption={
                state.currentIndex >= (settings?.dailyMinNewWords ?? 25) - 1 &&
                !bookFinished
              }
              onContinueLearning={handleContinueLearning}
            />
          );

        case 'round2':
          return (
            <CardRecall
              entry={state.currentEntry!}
              onResult={(remembered) => actions.advance(remembered)}
            />
          );

        case 'round3':
          return (
            <CardCloze
              entry={state.currentEntry!}
              onNext={() => actions.advance()}
            />
          );

        case 'round4':
          return (
            <CardConfirm
              entry={state.currentEntry!}
              onResult={(remembered) => actions.advance(remembered)}
            />
          );

        default:
          return null;
      }
    };

    const showAiExplain =
      isOnline &&
      settings?.aiEnabled &&
      settings?.deepseekApiKey &&
      settings.deepseekApiKey.length > 0;

    return (
      <div className="app">
        {renderCard()}

        {showAiExplain && state.currentEntry && (
          <AiExplain
            word={state.currentEntry.word}
            apiKey={settings!.deepseekApiKey!}
          />
        )}

        <ProgressDots
          total={state.totalInPhase}
          current={state.currentIndex}
        />

        {/* 底部统计入口 */}
        <div className="card__actions" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <button className="btn btn--secondary" onClick={handlePanelToggle} style={{ fontSize: '14px' }}>
            统计
          </button>
        </div>

        <StatsPanel
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          onOpenSettings={handleOpenSettings}
          onSwitchBook={handleSwitchBook}
        />
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
