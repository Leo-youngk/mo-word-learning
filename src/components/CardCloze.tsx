// ============================================================
// CardCloze — ROUND_3 语境填空卡片
// ============================================================

import { useState } from 'react';
import type { WordEntry } from '../types';
import SpeakButton from './SpeakButton';

interface CardClozeProps {
  entry: WordEntry;
  onNext: () => void;
}

export default function CardCloze({ entry, onNext }: CardClozeProps) {
  const [revealed, setRevealed] = useState(false);

  const handleReveal = () => {
    if (!revealed) setRevealed(true);
  };

  // 如果没有例句，降级为完整展示卡片
  const hasExample = entry.example && entry.example.en;

  if (!revealed) {
    if (!hasExample) {
      // 降级：展示完整卡片（同 CardDisplay 简化版）
      return (
        <div className="card card-cloze" onClick={handleReveal}>
          <div className="card__content">
            <div className="card-cloze__word-row">
              <h2 className="card-cloze__word">{entry.word}</h2>
              <SpeakButton word={entry.word} />
            </div>
            {entry.phoneticUs && (
              <p className="card-cloze__phonetic">{entry.phoneticUs}</p>
            )}
            <div className="card-cloze__translations">
              {entry.translations.map((t, i) => (
                <p key={i}>{t.type}. {t.text}</p>
              ))}
            </div>
            <div className="card__actions">
              <button className="btn btn--primary" onClick={() => { setRevealed(true); onNext(); }}>
                下一个
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 正常填空模式
    const blankSentence = entry.example!.en.replace(
      new RegExp(entry.word, 'gi'),
      '______'
    );

    return (
      <div className="card card-cloze" onClick={handleReveal}>
        <div className="card__content">
          <p className="card-cloze__sentence-blank">{blankSentence}</p>
          <p className="card-cloze__hint">
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

  // 揭示态
  if (hasExample) {
    const highlightedSentence = entry.example!.en.replace(
      new RegExp(`(${entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
      '<strong>$1</strong>'
    );
    return (
      <div className="card card-cloze">
        <div className="card__content">
          <p
            className="card-cloze__sentence-full"
            dangerouslySetInnerHTML={{ __html: highlightedSentence }}
          />
          <div className="card-cloze__word-row">
            <h2 className="card-cloze__word">{entry.word}</h2>
            <SpeakButton word={entry.word} />
          </div>
          {entry.phoneticUs && (
            <p className="card-cloze__phonetic">{entry.phoneticUs}</p>
          )}
          <div className="card__actions">
            <button className="btn btn--primary" onClick={onNext}>
              下一个
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
