import { primeSound, playMasteredSound, playFuzzySound } from '../lib/sound';
import type { WordEntry } from '../types';
import SpeakButton from './SpeakButton';

interface CardDisplayProps {
  entry: WordEntry;
  onFuzzy: () => void;
  onMastered: () => void;
  disabled?: boolean;
}

const soundPrimingProps = {
  onPointerDown: primeSound,
  onTouchStart: primeSound,
  onMouseDown: primeSound,
};

export default function CardDisplay({
  entry,
  onFuzzy,
  onMastered,
  disabled = false,
}: CardDisplayProps) {
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
          {entry.translations.map((translation, index) => (
            <p key={index} className="card-display__trans">
              <span className="card-display__type">{translation.type}</span>
              <span className="card-display__text">{translation.text}</span>
            </p>
          ))}
        </div>

        <div className="card__divider" />

        {entry.example && (
          <div className="card-display__example">
            <p className="card-display__example-en">{entry.example.en}</p>
            <p className="card-display__example-zh">{entry.example.zh}</p>
          </div>
        )}

        {entry.phrases.length > 0 && (
          <div className="card-display__phrases">
            {entry.phrases.map((phrase, index) => (
              <p key={index} className="card-display__phrase">
                <span className="card-display__phrase-en">{phrase.en}</span>
                <span className="card-display__phrase-zh">{phrase.zh}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="card__actions card__actions--split">
        <button
          className="btn btn--danger card__pill-btn"
          onClick={() => { playFuzzySound(); onFuzzy(); }}
          disabled={disabled}
          {...soundPrimingProps}
        >
          模糊
        </button>
        <button
          className="btn btn--success card__pill-btn card__pill-btn--primary"
          onClick={() => { playMasteredSound(); onMastered(); }}
          disabled={disabled}
          {...soundPrimingProps}
        >
          已掌握
        </button>
      </div>
    </div>
  );
}
