// ============================================================
// CardConfirm — ROUND_4 最终确认卡片
// ============================================================

import { useState } from 'react';
import type { WordEntry } from '../types';
import SpeakButton from './SpeakButton';

interface CardConfirmProps {
  entry: WordEntry;
  onResult: (remembered: boolean) => void;
}

export default function CardConfirm({ entry, onResult }: CardConfirmProps) {
  const [revealed, setRevealed] = useState(false);

  const handleReveal = () => {
    if (!revealed) setRevealed(true);
  };

  if (!revealed) {
    return (
      <div className="card card-confirm" onClick={handleReveal}>
        <div className="card__content card-confirm__hidden">
          <div className="card-confirm__word-row">
            <h2 className="card-confirm__word">{entry.word}</h2>
            <SpeakButton word={entry.word} />
          </div>
          {entry.phoneticUs && (
            <p className="card-confirm__phonetic">{entry.phoneticUs}</p>
          )}
          <p className="card-confirm__tap-hint">点击查看释义</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-confirm">
      <div className="card__content card-confirm__revealed">
        <div className="card-confirm__word-row">
          <h2 className="card-confirm__word">{entry.word}</h2>
          <SpeakButton word={entry.word} />
        </div>
        {entry.phoneticUs && (
          <p className="card-confirm__phonetic">{entry.phoneticUs}</p>
        )}
        <p className="card-confirm__translation">
          {entry.translations.map(t => `${t.type}. ${t.text}`).join('  ')}
        </p>
        <div className="card__actions card__actions--split">
          <button className="btn btn--danger" onClick={() => onResult(false)}>
            模糊
          </button>
          <button className="btn btn--success" onClick={() => onResult(true)}>
            记得
          </button>
        </div>
      </div>
    </div>
  );
}
