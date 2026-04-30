// ============================================================
// Settings — 设置页
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { BookId, SettingsRecord } from '../types';
import * as db from '../lib/db';

interface SettingsProps {
  onBack: () => void;
  onBookChange: (bookId: BookId) => void;
}

const BOOK_OPTIONS: { id: BookId; label: string }[] = [
  { id: 'cet4', label: '四级词汇' },
  { id: 'cet6', label: '六级核心' },
  { id: 'kaoyan', label: '考研词汇' },
  { id: 'toefl', label: '托福词汇' },
];

export default function Settings({ onBack, onBookChange }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      const s = await db.getSettings();
      setSettings(s);
      setApiKeyInput(s?.deepseekApiKey ?? '');

      // 加载各词库词数
      for (const opt of BOOK_OPTIONS) {
        const wb = await db.getWordbook(opt.id);
        if (wb) {
          setWordCounts(prev => ({ ...prev, [opt.id]: wb.words.length }));
        }
      }
    }
    load();
  }, []);

  const updateSetting = useCallback(async (partial: Partial<Omit<SettingsRecord, 'key'>>) => {
    if (!settings) return;
    const updated = { ...settings, ...partial };
    setSettings(updated);
    await db.saveSettings(updated);
  }, [settings]);

  const handleBookChange = useCallback(async (bookId: BookId) => {
    await updateSetting({ currentBookId: bookId, currentWordIndex: 0 });
    onBookChange(bookId);
  }, [updateSetting, onBookChange]);

  const handleApiKeySave = useCallback(async () => {
    await updateSetting({ deepseekApiKey: apiKeyInput });
  }, [updateSetting, apiKeyInput]);

  const handleReset = useCallback(async () => {
    if (confirm('确定要重置所有学习进度吗？此操作不可撤销。')) {
      await db.resetAllProgress();
      if (settings) {
        await db.saveSettings({
          ...settings,
          currentWordIndex: 0,
          streakCount: 0,
          lastStudyDate: '',
        });
      }
      alert('进度已重置');
    }
  }, [settings]);

  if (!settings) {
    return <div className="settings-loading">加载中…</div>;
  }

  return (
    <div className="settings">
      <div className="settings__header">
        <button className="settings__back" onClick={onBack}>← 返回</button>
        <h2 className="settings__title">设置</h2>
      </div>

      <div className="settings__body">
        {/* 词库选择 */}
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
                <span className="settings__book-count">
                  {wordCounts[opt.id] ?? '...'} 词
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 每日新词数 */}
        <section className="settings__section">
          <h3 className="settings__section-title">每日最少新词</h3>
          <div className="settings__stepper">
            <button
              className="settings__stepper-btn"
              onClick={() => updateSetting({ dailyMinNewWords: Math.max(5, settings.dailyMinNewWords - 5) })}
            >−</button>
            <span className="settings__stepper-value">{settings.dailyMinNewWords}</span>
            <button
              className="settings__stepper-btn"
              onClick={() => updateSetting({ dailyMinNewWords: Math.min(100, settings.dailyMinNewWords + 5) })}
            >+</button>
          </div>
        </section>

        {/* 自动发音 */}
        <section className="settings__section">
          <h3 className="settings__section-title">自动发音</h3>
          <label className="settings__toggle">
            <input
              type="checkbox"
              checked={settings.autoSpeak}
              onChange={e => updateSetting({ autoSpeak: e.target.checked })}
            />
            <span className="settings__toggle-label">
              {settings.autoSpeak ? '已开启' : '已关闭'}
            </span>
          </label>
        </section>

        {/* DeepSeek API Key */}
        <section className="settings__section">
          <h3 className="settings__section-title">DeepSeek API Key</h3>
          <input
            className="settings__input"
            type="password"
            placeholder="输入 API Key"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            onBlur={handleApiKeySave}
          />
        </section>

        {/* AI 释义开关 */}
        <section className="settings__section">
          <h3 className="settings__section-title">AI 释义</h3>
          <label className="settings__toggle">
            <input
              type="checkbox"
              checked={settings.aiEnabled}
              onChange={e => updateSetting({ aiEnabled: e.target.checked })}
            />
            <span className="settings__toggle-label">
              {settings.aiEnabled ? '已开启' : '已关闭'}
            </span>
          </label>
        </section>

        {/* 重置 */}
        <section className="settings__section">
          <button className="settings__reset-btn" onClick={handleReset}>
            重置所有进度
          </button>
        </section>
      </div>
    </div>
  );
}
