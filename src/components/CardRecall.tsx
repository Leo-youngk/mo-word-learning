// ============================================================
// CardRecall — ROUND_2 主动回忆卡片（中→英）
// ============================================================

import { useState } from 'react';
import type { WordEntry } from '../types';
import SpeakButton from './SpeakButton';

interface CardRecallProps {
  entry: WordEntry;
  onResult: (remembered: boolean) => void;
}

export default function CardRecall({ entry, onResult }: CardRecallProps) {
  const [revealed, setRevealed] = useState(false);

  const handleReveal = () => {
    if (!revealed) setRevealed(true);
  };

  if (!revealed) {
    return (
      <div className="card card-recall" onClick={handleReveal}>
        <div className="card__content card-recall__hidden">
          <p className="card-recall__hint-zh">
            {entry.translations.map(t => t.text).join('；')}
          </p>
          <p className="card-recall__hint-type">
            {entry.translations.map(t => t.type).join(' · ')}
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

  return (
    <div className="card card-recall">
      <div className="card__content card-recall__revealed">
        <div className="card-recall__word-row">
          <h2 className="card-recall__word">{entry.word}</h2>
          <SpeakButton word={entry.word} />
        </div>
        {entry.phoneticUs && (
          <p className="card-recall__phonetic">{entry.phoneticUs}</p>
        )}
        <p className="card-recall__translation">
          {entry.translations.map(t => `${t.type}. ${t.text}`).join('  ')}
        </p>
        <div className="card__actions card__actions--split">
          <button className="btn btn--danger" onClick={() => onResult(false)}>
            不记得
          </button>
          <button className="btn btn--success" onClick={() => onResult(true)}>
            记得
          </button>
        </div>
      </div>
    </div>
  );
}
