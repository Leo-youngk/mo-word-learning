// ============================================================
// ReviewCard — 复习卡片（REVIEW 阶段）
// 随机交替使用模式 A（中文回忆英文）和模式 B（例句填空）
// ============================================================

import { useState } from 'react';
import type { WordEntry, ProgressRecord } from '../types';
import SpeakButton from './SpeakButton';

interface ReviewCardProps {
  entry: WordEntry;
  progress: ProgressRecord;
  onResult: (correct: boolean) => void;
}

export default function ReviewCard({ entry, progress, onResult }: ReviewCardProps) {
  const [revealed, setRevealed] = useState(false);
  // 随机决定模式：有例句时 50% 概率使用模式 B
  const useModeB = entry.example && Math.random() > 0.5;

  const handleReveal = () => {
    if (!revealed) setRevealed(true);
  };

  if (!revealed) {
    if (useModeB) {
      // 模式 B：例句填空
      const blankSentence = entry.example!.en.replace(
        new RegExp(entry.word, 'gi'),
        '______'
      );
      return (
        <div className="card card-review" onClick={handleReveal}>
          <div className="card__content">
            <p className="card-review__blank">{blankSentence}</p>
            <p className="card-review__hint">
              {entry.translations.map(t => t.text).join('；')}
            </p>
            <div className="card__actions">
              <button className="btn btn--secondary" onClick={handleReveal}>
                查看答案
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 模式 A：中文回忆英文
    return (
      <div className="card card-review" onClick={handleReveal}>
        <div className="card__content">
          <p className="card-review__zh">
            {entry.translations.map(t => `${t.type}. ${t.text}`).join('  ')}
          </p>
          <div className="card__actions">
            <button className="btn btn--secondary" onClick={handleReveal}>
              查看答案
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 揭示态
  return (
    <div className="card card-review">
      <div className="card__content">
        {useModeB && (
          <p
            className="card-review__sentence-full"
            dangerouslySetInnerHTML={{
              __html: entry.example!.en.replace(
                new RegExp(`(${entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                '<strong>$1</strong>'
              )
            }}
          />
        )}
        <div className="card-review__word-row">
          <h2 className="card-review__word">{entry.word}</h2>
          <SpeakButton word={entry.word} />
        </div>
        {entry.phoneticUs && (
          <p className="card-review__phonetic">{entry.phoneticUs}</p>
        )}
        <p className="card-review__translation">
          {entry.translations.map(t => `${t.type}. ${t.text}`).join('  ')}
        </p>
        <div className="card__actions card__actions--split">
          <button className="btn btn--danger" onClick={() => onResult(false)}>
            忘了
          </button>
          <button className="btn btn--success" onClick={() => onResult(true)}>
            记得
          </button>
        </div>
      </div>
    </div>
  );
}
