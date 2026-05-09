import type { BookId } from '../types';
import { BOOK_LABELS } from '../lib/books';

interface WordbookStatsCardProps {
  bookId: BookId;
  total: number;
  unlearned: number;
  fuzzy: number;
  mastered: number;
}

export default function WordbookStatsCard({
  bookId,
  total,
  unlearned,
  fuzzy,
  mastered,
}: WordbookStatsCardProps) {
  return (
    <section className="wordbook-stats">
      <div>
        <p className="wordbook-stats__label">当前词库</p>
        <h2 className="wordbook-stats__title">{BOOK_LABELS[bookId]}</h2>
        <p className="wordbook-stats__total">
          <span className="wordbook-stats__total-number">{total}</span>
          <span className="wordbook-stats__total-unit">词</span>
        </p>
      </div>
      <div className="wordbook-stats__grid">
        <div>
          <span className="wordbook-stats__num">{unlearned}</span>
          <span className="wordbook-stats__name">未学</span>
        </div>
        <div>
          <span className="wordbook-stats__num">{fuzzy}</span>
          <span className="wordbook-stats__name">模糊</span>
        </div>
        <div>
          <span className="wordbook-stats__num">{mastered}</span>
          <span className="wordbook-stats__name">已掌握</span>
        </div>
      </div>
    </section>
  );
}
