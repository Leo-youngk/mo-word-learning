// ============================================================
// CardDisplay — ROUND_1 首次相遇卡片
// ============================================================

import { useState } from 'react';
import type { WordEntry } from '../types';
import SpeakButton from './SpeakButton';

interface CardDisplayProps {
  entry: WordEntry;
  onNext: () => void;
  showContinueOption: boolean;
  onContinueLearning: () => void;
}

export default function CardDisplay({
  entry,
  onNext,
  showContinueOption,
  onContinueLearning,
}: CardDisplayProps) {
  const [revealed, setRevealed] = useState(true);

  return (
    <div className="card card-display">
      <div className="card__content">
        <div className="card-display__word-row">
          <h2 className="card-display__word">{entry.word}</h2>
          <SpeakButton word={entry.word} />
        </div>

        {entry.phoneticUs && (
          <p className="card-display__phonetic">{entry.phoneticUs}</p>
        )}

        <div className="card-display__translations">
          {entry.translations.map((t, i) => (
            <p key={i} className="card-display__trans">
              <span className="card-display__type">{t.type}</span>
              <span className="card-display__text">{t.text}</span>
            </p>
          ))}
        </div>

        <div className="card__divider" />

        {entry.example && (
          <div className="card-display__example">
            <p className="card-display__example-en">
              {entry.example.en}
            </p>
            <p className="card-display__example-zh">
              {entry.example.zh}
            </p>
          </div>
        )}

        {entry.phrases.length > 0 && (
          <div className="card-display__phrases">
            {entry.phrases.map((p, i) => (
              <p key={i} className="card-display__phrase">
                <span className="card-display__phrase-en">{p.en}</span>
                <span className="card-display__phrase-zh">{p.zh}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="card__actions">
        <button className="btn btn--primary" onClick={onNext}>
          下一个
        </button>
        {showContinueOption && (
          <button className="btn btn--secondary" onClick={onContinueLearning}>
            继续学习
          </button>
        )}
      </div>
    </div>
  );
}
