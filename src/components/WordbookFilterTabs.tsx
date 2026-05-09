import { getWordStatusLabel, type WordUserStatus } from '../lib/wordStatus';

export type WordbookFilter = 'all' | WordUserStatus;

interface WordbookFilterTabsProps {
  value: WordbookFilter;
  onChange: (value: WordbookFilter) => void;
}

const FILTERS: WordbookFilter[] = ['all', 'unlearned', 'fuzzy', 'mastered'];

export default function WordbookFilterTabs({ value, onChange }: WordbookFilterTabsProps) {
  return (
    <div className="wordbook-filters" role="tablist" aria-label="词库状态筛选">
      {FILTERS.map(filter => (
        <button
          key={filter}
          className={`wordbook-filters__tab ${value === filter ? 'wordbook-filters__tab--active' : ''}`}
          onClick={() => onChange(filter)}
          type="button"
        >
          {filter === 'all' ? '全部' : getWordStatusLabel(filter)}
        </button>
      ))}
    </div>
  );
}
