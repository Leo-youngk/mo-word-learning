// ============================================================
// Welcome / Home — 首页 Dashboard
// 禅意模式：Apple 圆角 + 动态小组件风格
// ============================================================

import { useState, useEffect } from 'react';
import type { BookId } from '../types';

interface WelcomeProps {
  bookId: BookId;
  streakCount: number;
  totalLearned: number;
  todayProgress: { current: number; total: number };
  todayStats: { newWords: number; reviewWords: number; estimatedMinutes: number };
  achievement: { current: number; nextMilestone: number; remaining: number };
  hasSession: boolean;
  sessionInfo: string;
  onStart: (bookId: BookId) => void;
  onContinue: () => void;
  onBookChange: (bookId: BookId) => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
}

const BOOK_OPTIONS: { id: BookId; label: string }[] = [
  { id: 'cet4', label: '四级' },
  { id: 'cet6', label: '六级' },
  { id: 'toefl', label: '托福' },
];

// 叶子图标
const LeafIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.5C13.5 5 17 7.5 17 12a7 7 0 0 1-6 8Z" />
    <path d="M11 20v-5" />
    <path d="M11 15c-2-1-3-3-3-5" />
  </svg>
);

// 奖杯图标
const TrophyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

// 箭头图标
const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

// 设置图标
const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default function Welcome({
  bookId,
  streakCount,
  totalLearned,
  todayProgress,
  todayStats,
  achievement,
  hasSession,
  sessionInfo,
  onContinue,
  onBookChange,
  onOpenSettings,
  onStart,
}: WelcomeProps) {
  const [selectedBook, setSelectedBook] = useState<BookId>(bookId);

  useEffect(() => {
    setSelectedBook(bookId);
  }, [bookId]);

  const progressPercent = todayProgress.total > 0
    ? (todayProgress.current / todayProgress.total) * 100
    : 0;

  // 模拟近7天柱状图数据
  const weekBars = [0.4, 0.6, 0.3, 0.8, 0.5, 0.7, 0.9];

  return (
    <div className="home">
      {/* Header */}
      <header className="home__header">
        <span className="home__brand">默</span>
        <button className="home__settings-btn" onClick={onOpenSettings} aria-label="设置">
          <SettingsIcon />
        </button>
      </header>

      {/* 主进度卡 */}
      <div className="home__progress-card">
        <div className="home__progress-label">今日进度</div>
        <div className="home__progress-num">
          <span className="home__progress-current">{todayProgress.current}</span>
          <span className="home__progress-total">/ {todayProgress.total} 词</span>
        </div>
        <div className="home__progress-bar-track">
          <div
            className={`home__progress-bar-fill ${progressPercent <= 0 ? 'home__progress-bar-fill--zero' : ''}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="home__progress-stats">
          <div className="home__progress-stat">
            <span className="home__progress-stat-label">连续学习</span>
            <div>
              <span className="home__progress-stat-value">{streakCount}</span>
              <span className="home__progress-stat-unit">天</span>
            </div>
          </div>
          <div className="home__progress-divider" />
          <div className="home__progress-stat">
            <span className="home__progress-stat-label">累计掌握</span>
            <div>
              <span className="home__progress-stat-value">{totalLearned}</span>
              <span className="home__progress-stat-unit">词</span>
            </div>
          </div>
        </div>
      </div>

      {/* 主按钮 */}
      <button className="home__primary-btn" onClick={() => hasSession ? onContinue() : onStart(bookId)}>
        {hasSession ? '继续学习' : '开始学习'}
        <ArrowRightIcon />
      </button>

      {/* 次级继续学习卡片 */}
      {hasSession && (
        <button className="home__continue-card" onClick={onContinue}>
          <div className="home__continue-left">
            <span className="home__continue-title">继续学习</span>
            <span className="home__continue-sub">{sessionInfo}</span>
          </div>
          <span className="home__continue-arrow">›</span>
        </button>
      )}

      {/* 词库 tag */}
      <div className="home__tags-section">
        <span className="home__tags-label">词库</span>
        <div className="home__tags-row">
          {BOOK_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`home__tag ${selectedBook === opt.id ? 'home__tag--active' : 'home__tag--default'}`}
              onClick={() => {
                setSelectedBook(opt.id);
                onBookChange(opt.id);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 小组件区 */}
      <div className="home__widgets">
        {/* 今日状态 */}
        <div className="home__widget">
          <div className="home__widget-header">
            <span className="home__widget-icon" style={{ color: 'var(--c-primary)' }}>
              <LeafIcon />
            </span>
            <span className="home__widget-title">今日状态</span>
          </div>
          <div className="home__widget-body">
            <div className="home__widget-row">
              <span className="home__widget-row-label">新词</span>
              <span className="home__widget-row-value">{todayStats.newWords}</span>
            </div>
            <div className="home__widget-row">
              <span className="home__widget-row-label">复习</span>
              <span className="home__widget-row-value">{todayStats.reviewWords}</span>
            </div>
            <div className="home__widget-row">
              <span className="home__widget-row-label">预计</span>
              <span className="home__widget-row-value">
                {todayStats.estimatedMinutes}
                <span className="home__widget-row-unit">分钟</span>
              </span>
            </div>
          </div>
          <div className="home__widget-bar">
            {weekBars.map((h, i) => (
              <div
                key={i}
                className={`home__widget-bar-item ${i === weekBars.length - 1 ? 'home__widget-bar-item--active' : ''}`}
                style={{ height: `${h * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* 成就提示 */}
        <div className="home__widget">
          <div className="home__widget-header">
            <span className="home__widget-icon" style={{ color: 'var(--c-accent-warm)' }}>
              <TrophyIcon />
            </span>
            <span className="home__widget-title">成就提示</span>
          </div>
          <div className="home__widget-body">
            <div className="home__widget-row">
              <span className="home__widget-row-label">进度</span>
              <span className="home__widget-row-value" style={{ fontSize: '22px' }}>
                {achievement.current} / {achievement.nextMilestone}
              </span>
            </div>
          </div>
          <div className="home__widget-footer">
            距离下个节点 <span style={{ color: 'var(--c-primary)', fontWeight: 500 }}>{achievement.remaining}</span> 词
          </div>
          <div className="home__widget-bar">
            {Array.from({ length: 7 }).map((_, i) => {
              const milestonePercent = achievement.nextMilestone > 0
                ? achievement.current / achievement.nextMilestone
                : 0;
              const isActive = i / 7 < milestonePercent;
              return (
                <div
                  key={i}
                  className={`home__widget-bar-item ${isActive ? 'home__widget-bar-item--active' : ''}`}
                  style={{ height: isActive ? '100%' : '30%' }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
