import { primeSound } from '../lib/sound';
import type { WordUserStatus } from '../lib/wordStatus';
import type { WordEntry } from '../types';
import WordStatusBadge from './WordStatusBadge';

interface WordListItemProps {
  entry: WordEntry;
  status: WordUserStatus;
  onClick: () => void;
  onQuickMastered?: () => void;
}

function getFirstTranslation(entry: WordEntry): string {
  const first = entry.translations[0];
  if (!first) return '暂无释义';
  return `${first.type ? `${first.type}. ` : ''}${first.text}`;
}

export default function WordListItem({ entry, status, onClick, onQuickMastered }: WordListItemProps) {
  return (
    <div className="wordbook-item">
      <button className="wordbook-item__main" onClick={onClick} type="button">
        <div className="wordbook-item__top">
          <span className="wordbook-item__word">{entry.word}</span>
          {(entry.phoneticUs || entry.phoneticUk) && (
            <span className="wordbook-item__phonetic">{entry.phoneticUs || entry.phoneticUk}</span>
          )}
        </div>
        <p className="wordbook-item__translation">{getFirstTranslation(entry)}</p>
      </button>

      <div className="wordbook-item__aside">
        {onQuickMastered ? (
          <button
            className="wordbook-item__quick-action"
            onPointerDown={primeSound}
            onTouchStart={primeSound}
            onMouseDown={primeSound}
            onClick={event => {
              event.stopPropagation();
              onQuickMastered();
            }}
            type="button"
          >
            已掌握
          </button>
        ) : (
          <WordStatusBadge status={status} />
        )}
      </div>
    </div>
  );
}
