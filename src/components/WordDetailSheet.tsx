import type { ProgressRecord, WordEntry } from '../types';
import { getWordUserStatus } from '../lib/wordStatus';
import { STORED_BOOK_LABELS } from '../lib/books';
import SpeakButton from './SpeakButton';
import WordStatusBadge from './WordStatusBadge';

interface WordDetailSheetProps {
  entry: WordEntry | null;
  progress?: ProgressRecord;
  onClose: () => void;
}

export default function WordDetailSheet({ entry, progress, onClose }: WordDetailSheetProps) {
  if (!entry) return null;
  const status = getWordUserStatus(progress);

  return (
    <div className="word-detail-overlay" onClick={onClose}>
      <section className="word-detail" onClick={event => event.stopPropagation()}>
        <div className="word-detail__handle" />
        <header className="word-detail__header">
          <div>
            <h2>{entry.word}</h2>
            {(entry.phoneticUs || entry.phoneticUk) && (
              <p>{entry.phoneticUs || entry.phoneticUk}</p>
            )}
          </div>
          <SpeakButton word={entry.word} />
        </header>

        <div className="word-detail__status">
          <span>当前状态</span>
          <WordStatusBadge status={status} />
        </div>

        <section className="word-detail__section">
          <h3>释义</h3>
          {entry.translations.map((translation, index) => (
            <p key={`${translation.type}-${index}`}>
              <span>{translation.type}</span>
              {translation.text}
            </p>
          ))}
        </section>

        {entry.example && (
          <section className="word-detail__section">
            <h3>例句</h3>
            <p className="word-detail__en">{entry.example.en}</p>
            <p className="word-detail__zh">{entry.example.zh}</p>
          </section>
        )}

        {entry.phrases.length > 0 && (
          <section className="word-detail__section">
            <h3>短语</h3>
            {entry.phrases.map((phrase, index) => (
              <p key={`${phrase.en}-${index}`}>
                <span>{phrase.en}</span>
                {phrase.zh}
              </p>
            ))}
          </section>
        )}

        {(entry.appearsInBooks?.length || entry.canonicalBookId) && (
          <section className="word-detail__meta">
            {entry.appearsInBooks && (
              <p>
                <span>出现词库</span>
                {entry.appearsInBooks.map(id => STORED_BOOK_LABELS[id] || id).join(' / ')}
              </p>
            )}
            {entry.canonicalBookId && (
              <p>
                <span>归属词库</span>
                {STORED_BOOK_LABELS[entry.canonicalBookId]}
              </p>
            )}
          </section>
        )}

        <button className="word-detail__close" onClick={onClose} type="button">关闭</button>
      </section>
    </div>
  );
}
