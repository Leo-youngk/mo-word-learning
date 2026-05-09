import { useEffect, useMemo, useState } from 'react';
import type { BookId, ProgressRecord, WordEntry } from '../types';
import * as db from '../lib/db';
import { getWordUserStatus, type WordUserStatus } from '../lib/wordStatus';
import WordbookStatsCard from './WordbookStatsCard';
import WordbookSearch from './WordbookSearch';
import WordbookFilterTabs, { type WordbookFilter } from './WordbookFilterTabs';
import WordListItem from './WordListItem';
import WordDetailSheet from './WordDetailSheet';

interface WordbookPageProps {
  bookId: BookId;
  words: WordEntry[];
}

function matchesSearch(entry: WordEntry, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (entry.word.toLowerCase().includes(q)) return true;
  if (entry.translations.some(t => `${t.type} ${t.text}`.toLowerCase().includes(q))) return true;
  return entry.phrases.some(p => `${p.en} ${p.zh}`.toLowerCase().includes(q));
}

export default function WordbookPage({ bookId, words }: WordbookPageProps) {
  const [progressMap, setProgressMap] = useState<Map<string, ProgressRecord>>(new Map());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<WordbookFilter>('all');
  const [selectedEntry, setSelectedEntry] = useState<WordEntry | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      const allProgress = await db.getProgressByBook(bookId);
      if (cancelled) return;
      setProgressMap(new Map(allProgress.map(progress => [progress.wordId, progress])));
    }

    loadProgress();

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const stats = useMemo(() => {
    const result: Record<WordUserStatus, number> = {
      unlearned: 0,
      fuzzy: 0,
      mastered: 0,
    };
    for (const word of words) {
      result[getWordUserStatus(progressMap.get(word.id))] += 1;
    }
    return result;
  }, [words, progressMap]);

  const visibleWords = useMemo(() => {
    return words.filter(word => {
      const status = getWordUserStatus(progressMap.get(word.id));
      if (filter !== 'all' && status !== filter) return false;
      return matchesSearch(word, query);
    });
  }, [words, progressMap, filter, query]);

  return (
    <main className="wordbook-page">
      <header className="wordbook-page__header">
        <h1>词库</h1>
        <p>{visibleWords.length} / {words.length} 词</p>
      </header>

      <WordbookStatsCard
        bookId={bookId}
        total={words.length}
        unlearned={stats.unlearned}
        fuzzy={stats.fuzzy}
        mastered={stats.mastered}
      />

      <div className="wordbook-page__tools">
        <WordbookSearch value={query} onChange={setQuery} />
        <WordbookFilterTabs value={filter} onChange={setFilter} />
      </div>

      <section className="wordbook-list" aria-label="完整词库列表">
        {visibleWords.map(entry => (
          <WordListItem
            key={entry.id}
            entry={entry}
            status={getWordUserStatus(progressMap.get(entry.id))}
            onClick={() => setSelectedEntry(entry)}
          />
        ))}
        {visibleWords.length === 0 && (
          <p className="wordbook-list__empty">没有找到匹配的单词</p>
        )}
      </section>

      <WordDetailSheet
        entry={selectedEntry}
        progress={selectedEntry ? progressMap.get(selectedEntry.id) : undefined}
        onClose={() => setSelectedEntry(null)}
      />
    </main>
  );
}
