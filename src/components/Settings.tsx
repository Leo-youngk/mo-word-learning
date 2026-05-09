import { useState, useEffect, useCallback } from 'react';
import type { BookId, SettingsRecord, ThemeMode } from '../types';
import * as db from '../lib/db';
import { BOOK_IDS, BOOK_LABELS } from '../lib/books';
import { runCloudSync } from '../lib/cloudSync';

interface SettingsProps {
  onBack: () => void;
  onBookChange: (bookId: BookId) => void;
  onSettingsChange?: (settings: SettingsRecord) => void;
}

const BOOK_OPTIONS: { id: BookId; label: string }[] = BOOK_IDS.map(id => ({
  id,
  label: BOOK_LABELS[id],
}));

const THEME_OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'zen', label: '禅意' },
  { id: 'quiet', label: '安静' },
  { id: 'intense', label: '激进' },
  { id: 'night', label: '夜间' },
];

export default function Settings({ onBack, onBookChange, onSettingsChange }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [syncTokenInput, setSyncTokenInput] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const reloadPendingCount = useCallback(async () => {
    const pendingItems = await db.getPendingSyncItems();
    setPendingSyncCount(pendingItems.length);
  }, []);

  useEffect(() => {
    async function load() {
      const current = await db.getSettings();
      const s = current ?? db.createDefaultSettings();
      if (!current) {
        await db.saveSettings(s);
      }

      setSettings(s);
      onSettingsChange?.(s);
      setApiKeyInput(s.deepseekApiKey ?? '');
      setSyncTokenInput(s.syncToken ?? '');

      for (const opt of BOOK_OPTIONS) {
        const wb = await db.getWordbook(opt.id);
        if (wb) {
          setWordCounts(prev => ({ ...prev, [opt.id]: wb.words.length }));
        }
      }

      await reloadPendingCount();
    }

    load();
  }, [onSettingsChange, reloadPendingCount]);

  const updateSetting = useCallback(async (partial: Partial<Omit<SettingsRecord, 'key'>>) => {
    if (!settings) return;
    const updated = { ...settings, ...partial };
    setSettings(updated);
    onSettingsChange?.(updated);
    if (updated.themeMode) {
      document.documentElement.setAttribute('data-theme', updated.themeMode);
    }
    await db.saveSettings(updated);
    void db.enqueueSync('settings', 'settings', updated);
    await reloadPendingCount();
  }, [settings, onSettingsChange, reloadPendingCount]);

  const handleBookChange = useCallback(async (bookId: BookId) => {
    await updateSetting({ currentBookId: bookId });
    onBookChange(bookId);
  }, [updateSetting, onBookChange]);

  const handleApiKeySave = useCallback(async () => {
    await updateSetting({ deepseekApiKey: apiKeyInput });
  }, [updateSetting, apiKeyInput]);

  const handleSyncTokenSave = useCallback(async () => {
    await updateSetting({ syncToken: syncTokenInput.trim() });
  }, [updateSetting, syncTokenInput]);

  const handleSyncNow = useCallback(async () => {
    if (!settings) return;
    const syncSettings: SettingsRecord = {
      ...settings,
      syncToken: syncTokenInput.trim(),
      syncEnabled: true,
    };

    setSyncMessage('正在同步...');
    try {
      await db.saveSettings(syncSettings);
      const result = await runCloudSync(syncSettings);
      const nextSettings = await db.getSettings();
      setSettings(nextSettings);
      if (nextSettings) {
        onSettingsChange?.(nextSettings);
      }
      await reloadPendingCount();
      setSyncMessage(`同步完成：上传 ${result.pushed} 条，拉取 ${result.pulled} 条`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : '同步失败');
    }
  }, [settings, syncTokenInput, onSettingsChange, reloadPendingCount]);

  const handleReset = useCallback(async () => {
    if (!settings) return;
    if (!confirm('确定要重置所有学习进度吗？此操作不可撤销。')) return;
    await db.resetAllProgress();
    const updated = {
      ...settings,
      currentWordIndexByBook: db.createDefaultWordIndexByBook(),
      streakCount: 0,
      lastStudyDate: '',
    };
    await db.saveSettings(updated);
    await db.enqueueSync('settings', 'settings', updated);
    setSettings(updated);
    onSettingsChange?.(updated);
    await reloadPendingCount();
    alert('进度已重置。');
  }, [settings, onSettingsChange, reloadPendingCount]);

  const handleClearSession = useCallback(async () => {
    await db.clearSession();
    alert('当前学习会话已清除，已保存的单词进度不会删除。');
  }, []);

  const handleExport = useCallback(async () => {
    const data = await db.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `mo-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async event => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        if (!confirm('导入会覆盖当前学习进度，是否继续？')) return;
        await db.importData(payload);
        await db.clearSession();
        const nextSettings = await db.getSettings();
        setSettings(nextSettings);
        if (nextSettings) {
          onSettingsChange?.(nextSettings);
        }
        await reloadPendingCount();
        alert('学习数据已导入。');
      } catch {
        alert('导入失败，请确认文件是默 Mo 的备份 JSON。');
      }
    };
    input.click();
  }, [onSettingsChange, reloadPendingCount]);

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
                <span className="settings__book-count">
                  {wordCounts[opt.id] ?? '...'} 词
                </span>
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

        {settings.aiEnabled && (
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
        )}

        <section className="settings__section">
          <h3 className="settings__section-title">云同步</h3>
          <label className="settings__toggle">
            <input
              type="checkbox"
              checked={Boolean(settings.syncEnabled)}
              onChange={e => updateSetting({ syncEnabled: e.target.checked })}
            />
            <span className="settings__toggle-label">
              {settings.syncEnabled ? '已开启' : '已关闭'}
            </span>
          </label>
          {settings.syncEnabled && (
            <>
              <input
                className="settings__input"
                type="password"
                placeholder="输入云同步令牌"
                value={syncTokenInput}
                onChange={e => setSyncTokenInput(e.target.value)}
                onBlur={handleSyncTokenSave}
              />
              <button className="settings__data-btn" onClick={handleSyncNow}>
                立即同步
              </button>
              <div className="settings__sync-status">
                {syncMessage || (settings.lastSyncAt ? `上次同步 ${new Date(settings.lastSyncAt).toLocaleString()}` : '尚未同步')}
                {settings.lastSyncError ? `；${settings.lastSyncError}` : ''}
              </div>
            </>
          )}
        </section>

        <section className="settings__section">
          <h3 className="settings__section-title">数据</h3>
          <button className="settings__data-btn" onClick={handleExport}>
            导出学习数据
          </button>
          <button className="settings__data-btn" onClick={handleImport}>
            导入学习数据
          </button>
          <button className="settings__data-btn" onClick={handleClearSession}>
            清除当前学习会话
          </button>
          <div className="settings__sync-status">
            待同步记录 {pendingSyncCount} 条
          </div>
          <button className="settings__reset-btn" onClick={handleReset}>
            重置所有进度
          </button>
        </section>
      </div>
    </div>
  );
}
