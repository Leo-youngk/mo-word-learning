import { useState, useEffect, useCallback } from 'react';
import type { BookId, ThemeMode } from '../types';
import * as settingsService from '../services/settingsService';
import type { AppSettings } from '../services/settingsService';
import { BOOK_IDS, BOOK_LABELS } from '../lib/books';
import { signOut } from '../lib/auth';
import { setSoundEnabled } from '../lib/sound';

interface SettingsProps {
  onBack: () => void;
  onBookChange: (bookId: BookId) => void;
  onSettingsChange?: (settings: AppSettings) => void;
}

const BOOK_OPTIONS: { id: BookId; label: string }[] = BOOK_IDS.map(id => ({
  id,
  label: BOOK_LABELS[id],
}));

const THEME_OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'zen', label: '禅意' },
  { id: 'quiet', label: '安静' },
  { id: 'intense', label: '激烈' },
  { id: 'night', label: '夜间' },
];

export default function Settings({ onBack, onBookChange, onSettingsChange }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    settingsService.getSettings().then(s => {
      setSettings(s);
      onSettingsChange?.(s);
    });
  }, [onSettingsChange]);

  const updateSetting = useCallback(async (partial: Partial<AppSettings>) => {
    if (!settings) return;
    const updated = { ...settings, ...partial };
    setSettings(updated);
    onSettingsChange?.(updated);
    if (typeof updated.soundEnabled === 'boolean') {
      setSoundEnabled(updated.soundEnabled);
    }
    if (updated.themeMode) {
      document.documentElement.setAttribute('data-theme', updated.themeMode);
    }
    await settingsService.updateSettingsPartial(partial);
  }, [settings, onSettingsChange]);

  const handleBookChange = useCallback(async (bookId: BookId) => {
    await updateSetting({ currentBookId: bookId });
    onBookChange(bookId);
  }, [updateSetting, onBookChange]);

  const handleSignOut = useCallback(async () => {
    if (!confirm('确定要退出登录吗？')) return;
    await signOut();
  }, []);

  if (!settings) {
    return <div className="settings-loading">加载中...</div>;
  }

  return (
    <div className="settings">
      <div className="settings__header">
        <button className="settings__back" onClick={onBack}>返回</button>
        <h2 className="settings__title">设置</h2>
      </div>

      <div className="settings__body">
        <section className="settings__section">
          <h3 className="settings__section-title">词库</h3>
          <div className="settings__book-list">
            {BOOK_OPTIONS.map(opt => (
              <button
                key={opt.id}
                className={`settings__book-item ${settings.currentBookId === opt.id ? 'settings__book-item--active' : ''}`}
                onClick={() => handleBookChange(opt.id)}
              >
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings__section">
          <h3 className="settings__section-title">主题模式</h3>
          <div className="settings__theme-row">
            {THEME_OPTIONS.map(opt => (
              <button
                key={opt.id}
                className={`settings__theme-btn ${(settings.themeMode ?? 'zen') === opt.id ? 'settings__theme-btn--active' : ''}`}
                onClick={() => updateSetting({ themeMode: opt.id })}
              >
                <span className={`settings__theme-mark settings__theme-mark--${opt.id}`} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings__section">
          <h3 className="settings__section-title">每日最少新词</h3>
          <div className="settings__stepper">
            <button
              className="settings__stepper-btn"
              onClick={() => updateSetting({ dailyMinNewWords: Math.max(5, settings.dailyMinNewWords - 5) })}
            >
              -
            </button>
            <span className="settings__stepper-value">{settings.dailyMinNewWords}</span>
            <button
              className="settings__stepper-btn"
              onClick={() => updateSetting({ dailyMinNewWords: Math.min(100, settings.dailyMinNewWords + 5) })}
            >
              +
            </button>
          </div>
        </section>

        <section className="settings__section">
          <h3 className="settings__section-title">学习反馈</h3>
          <label className="settings__toggle">
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={event => updateSetting({ soundEnabled: event.target.checked })}
            />
            <span className="settings__toggle-label">学习音效</span>
          </label>
          <p className="settings__sync-desc">点击“已掌握”或“模糊”时播放轻量提示音</p>
        </section>

        <section className="settings__section">
          <h3 className="settings__section-title">账号</h3>
          <p className="settings__sync-desc">数据已自动同步到云端</p>
          <button className="settings__data-btn" onClick={handleSignOut}>
            退出登录
          </button>
        </section>
      </div>
    </div>
  );
}
