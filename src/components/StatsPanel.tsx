// ============================================================
// StatsPanel — 底部上滑统计面板
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { BookId, DailyLogRecord } from '../types';
import * as db from '../lib/db';

interface StatsPanelProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenWordList: () => void;
  onSwitchBook: (bookId: BookId) => void;
}

const BOOK_LABELS: Record<BookId, string> = {
  cet4: '四级词汇',
  cet6: '六级核心',
  kaoyan: '考研词汇',
  toefl: '托福词汇',
};

export default function StatsPanel({ open, onClose, onOpenSettings, onOpenWordList, onSwitchBook }: StatsPanelProps) {
  const [stats, setStats] = useState({
    streak: 0,
    learned: 0,
    graduated: 0,
    stubborn: 0,
    total: 0,
    currentBook: 'cet6' as BookId,
  });
  const [dailyLogs, setDailyLogs] = useState<DailyLogRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    async function load() {
      const settings = await db.getSettings();
      const progress = await db.getAllProgress();
      const learned = progress.length;
      const graduated = progress.filter(p => p.graduated).length;
      const stubborn = progress.filter(p => p.isStubborn).length;

      // 获取当前词库总词数
      const bookId = settings?.currentBookId ?? 'cet6';
      const wb = await db.getWordbook(bookId);
      const total = wb?.words.length ?? 0;

      setStats({
        streak: settings?.streakCount ?? 0,
        learned,
        graduated,
        stubborn,
        total,
        currentBook: bookId,
      });

      // 加载学习历史
      const logs = await db.getAllDailyLogs();
      logs.sort((a, b) => b.date.localeCompare(a.date)); // 最新在前
      setDailyLogs(logs.slice(0, 14)); // 最近 14 天
    }
    load();
  }, [open]);

  const handleExport = useCallback(async () => {
    try {
      const data = await db.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出失败');
    }
  }, []);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (confirm('导入将覆盖当前所有学习进度，是否继续？')) {
          await db.importData(data);
          alert('数据已恢复');
          onClose();
        }
      } catch {
        alert('导入失败，文件格式不正确');
      }
    };
    input.click();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="stats-overlay" onClick={onClose}>
      <div className="stats-panel" onClick={e => e.stopPropagation()}>
        <div className="stats-panel__handle" />

        <div className="stats-panel__grid">
          <div className="stats-panel__item">
            <span className="stats-panel__num">{stats.streak}</span>
            <span className="stats-panel__label">连续打卡</span>
          </div>
          <div className="stats-panel__item">
            <span className="stats-panel__num">{stats.learned}</span>
            <span className="stats-panel__label">已学单词</span>
          </div>
          <div className="stats-panel__item">
            <span className="stats-panel__num">{stats.graduated}</span>
            <span className="stats-panel__label">已毕业</span>
          </div>
          <div className="stats-panel__item">
            <span className="stats-panel__num">{stats.stubborn}</span>
            <span className="stats-panel__label">顽固词</span>
          </div>
        </div>

        <div className="stats-panel__menu">
          <div className="stats-panel__menu-group">
            <span className="stats-panel__menu-label">词库</span>
            <span className="stats-panel__menu-value">{BOOK_LABELS[stats.currentBook]}</span>
          </div>

          <button className="stats-panel__menu-item" onClick={onOpenWordList}>
            查看词库 ▸
          </button>
          <button className="stats-panel__menu-item" onClick={onOpenSettings}>
            设置 ▸
          </button>
          <button className="stats-panel__menu-item" onClick={handleExport}>
            导出数据 ▸
          </button>
          <button className="stats-panel__menu-item" onClick={handleImport}>
            导入数据 ▸
          </button>
        </div>

        {dailyLogs.length > 0 && (
          <div className="stats-panel__history">
            <h3 className="stats-panel__history-title">学习记录</h3>
            <div className="stats-panel__history-list">
              {dailyLogs.map(log => (
                <div key={log.date} className="stats-panel__history-item">
                  <span className="stats-panel__history-date">{log.date.slice(5)}</span>
                  <span className="stats-panel__history-bar" style={{
                    flex: (log.newWordsCount + log.reviewWordsCount) / 2
                  }} />
                  <span className="stats-panel__history-count">
                    新学{log.newWordsCount} 复习{log.reviewWordsCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="stats-panel__close" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
