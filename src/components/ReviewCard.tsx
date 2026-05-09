import { useState } from 'react';
import type { WordEntry, ProgressRecord } from '../types';
import SpeakButton from './SpeakButton';

interface ReviewCardProps {
  entry: WordEntry;
  progress: ProgressRecord;
  onResult: (correct: boolean) => void;
  disabled?: boolean;
}

export default function ReviewCard({ entry, onResult, disabled = false }: ReviewCardProps) {
  const [revealed, setRevealed] = useState(false);
  const translation = entry.translations.map(t => `${t.type}. ${t.text}`).join('  ');

  if (!revealed) {
    return (
      <div className="card card-review card-review--hidden">
        <div className="card__content">
          <div className="card-review__enso" aria-hidden="true" />
          <p className="card-review__zh">{translation}</p>
          <button className="btn btn--secondary card-review__reveal" onClick={() => setRevealed(true)} disabled={disabled}>
            查看答案
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-review card-review--revealed">
      <div className="card__content">
        <div className="card-review__word-row">
          <h2 className="card-review__word">{entry.word}</h2>
          <SpeakButton word={entry.word} />
        </div>

        {entry.phoneticUs && (
          <p className="card-review__phonetic">{entry.phoneticUs}</p>
        )}

        <p className="card-review__translation">{translation}</p>

        {entry.example && (
          <p className="card-review__sentence-full">
            {entry.example.en}
          </p>
        )}
      </div>

      <div className="card__actions card__actions--split">
        <button className="btn btn--danger card__pill-btn" onClick={() => onResult(false)} disabled={disabled}>
          仍然模糊
        </button>
        <button className="btn btn--success card__pill-btn card__pill-btn--primary" onClick={() => onResult(true)} disabled={disabled}>
          已掌握
        </button>
      </div>
    </div>
  );
}
