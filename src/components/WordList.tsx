// ============================================================
// WordList — 当前词库全部单词列表（含学习状态标签）
// ============================================================

import { useState, useEffect } from 'react';
import type { BookId, WordEntry, ProgressRecord } from '../types';
import * as db from '../lib/db';

interface WordListProps {
  bookId: BookId;
  onBack: () => void;
}

function getStatusTag(entry: WordEntry, progress: ProgressRecord | undefined): {
  label: string;
  className: string;
} {
  if (!progress) {
    return { label: '未学', className: 'wordlist__tag--new' };
  }
  if (progress.graduated) {
    return { label: '已毕业', className: 'wordlist__tag--graduated' };
  }
  if (progress.stage >= 2) {
    return { label: '已学', className: 'wordlist__tag--learned' };
  }
  // stage = 1 且有答错记录 → 模糊
  if (progress.stage === 1 && progress.consecutiveWrong > 0) {
    return { label: '模糊', className: 'wordlist__tag--fuzzy' };
  }
  if (progress.stage === 1) {
    return { label: '初学', className: 'wordlist__tag--newly' };
  }
  // stage = 0 (刚创建) → 初学
  return { label: '初学', className: 'wordlist__tag--newly' };
}

export default function WordList({ bookId, onBack }: WordListProps) {
  const [entries, setEntries] = useState<WordEntry[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressRecord>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const wb = await db.getWordbook(bookId);
      const allProgress = await db.getAllProgress();

      const pMap = new Map<string, ProgressRecord>();
      for (const p of allProgress) {
        pMap.set(p.wordId, p);
      }

      setEntries(wb?.words ?? []);
      setProgressMap(pMap);
      setLoading(false);
    }
    load();
  }, [bookId]);

  if (loading) {
    return (
      <div className="wordlist">
        <p className="wordlist__loading">…</p>
      </div>
    );
  }

  return (
    <div className="wordlist">
      <div className="wordlist__header">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <h2 className="wordlist__title">词库 ({entries.length} 词)</h2>
      </div>

      <div className="wordlist__body">
        {entries.map(entry => {
          const progress = progressMap.get(entry.id);
          const tag = getStatusTag(entry, progress);
          return (
            <div key={entry.id} className="wordlist__item">
              <div className="wordlist__item-left">
                <span className="wordlist__word">{entry.word}</span>
                <span className="wordlist__trans">
                  {entry.translations.slice(0, 2).map(t => `${t.type}. ${t.text}`).join('  ')}
                </span>
              </div>
              <span className={`wordlist__tag ${tag.className}`}>{tag.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
