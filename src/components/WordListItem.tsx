import type { WordEntry } from '../types';
import type { WordUserStatus } from '../lib/wordStatus';
import WordStatusBadge from './WordStatusBadge';

interface WordListItemProps {
  entry: WordEntry;
  status: WordUserStatus;
  onClick: () => void;
}

function getFirstTranslation(entry: WordEntry): string {
  const first = entry.translations[0];
  if (!first) return '暂无释义';
  return `${first.type ? `${first.type}. ` : ''}${first.text}`;
}

export default function WordListItem({ entry, status, onClick }: WordListItemProps) {
  return (
    <button className="wordbook-item" onClick={onClick} type="button">
      <div className="wordbook-item__main">
        <div className="wordbook-item__top">
          <span className="wordbook-item__word">{entry.word}</span>
          {(entry.phoneticUs || entry.phoneticUk) && (
            <span className="wordbook-item__phonetic">{entry.phoneticUs || entry.phoneticUk}</span>
          )}
        </div>
        <p className="wordbook-item__translation">{getFirstTranslation(entry)}</p>
      </div>
      <WordStatusBadge status={status} />
    </button>
  );
}
