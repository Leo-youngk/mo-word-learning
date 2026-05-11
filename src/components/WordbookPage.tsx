import { useEffect, useMemo, useState } from 'react';
import type { BookId, ProgressRecord, WordEntry } from '../types';
import { playMasteredSound } from '../lib/sound';
import { getWordUserStatus, type WordUserStatus } from '../lib/wordStatus';
import * as progressService from '../services/progressService';
import WordbookStatsCard from './WordbookStatsCard';
import WordbookSearch from './WordbookSearch';
import WordbookFilterTabs, { type WordbookFilter } from './WordbookFilterTabs';
import WordListItem from './WordListItem';
import WordDetailSheet from './WordDetailSheet';

interface WordbookPageProps {
  bookId: BookId;
  words: WordEntry[];
}

const INITIAL_RENDER_COUNT = 120;
const LOAD_MORE_COUNT = 120;

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
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_COUNT);
  const [quickMarkNotice, setQuickMarkNotice] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      setProgressLoading(true);
      setProgressError('');
      try {
        const allProgress = await progressService.getAllProgress();
        if (cancelled) return;
        setProgressMap(progressService.buildGlobalProgressMap(allProgress));
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load wordbook progress:', error);
        setProgressMap(new Map());
        setProgressError('词库进度加载失败，已先展示单词列表。');
      } finally {
        if (!cancelled) {
          setProgressLoading(false);
        }
      }
    }

    loadProgress();

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    setVisibleCount(INITIAL_RENDER_COUNT);
  }, [bookId, filter, query]);

  useEffect(() => {
    if (!quickMarkNotice) return undefined;
    const timeout = window.setTimeout(() => setQuickMarkNotice(''), 1800);
    return () => window.clearTimeout(timeout);
  }, [quickMarkNotice]);

  const stats = useMemo(() => {
    const result: Record<WordUserStatus, number> = {
      unlearned: 0,
      fuzzy: 0,
      mastered: 0,
    };

    for (const word of words) {
      result[getWordUserStatus(progressMap.get(progressService.getProgressGlobalKey(word)))] += 1;
    }

    return result;
  }, [words, progressMap]);

  const visibleWords = useMemo(() => {
    return words.filter(word => {
      const status = getWordUserStatus(progressMap.get(progressService.getProgressGlobalKey(word)));
      if (filter !== 'all' && status !== filter) return false;
      return matchesSearch(word, query);
    });
  }, [words, progressMap, filter, query]);

  const displayedWords = useMemo(
    () => visibleWords.slice(0, visibleCount),
    [visibleWords, visibleCount],
  );

  const hasMore = displayedWords.length < visibleWords.length;

  const handleQuickMastered = (entry: WordEntry) => {
    const globalKey = progressService.getProgressGlobalKey(entry);
    const existing = progressMap.get(globalKey);
    const record = progressService.markWordAsMasteredFromWordbook(entry, bookId, existing);

    setProgressMap(prev => {
      const next = new Map(prev);
      next.set(globalKey, record);
      return next;
    });
    playMasteredSound();
    setQuickMarkNotice('已标记为已掌握');
  };

  return (
    <main className="wordbook-page">
      <header className="wordbook-page__header">
        <h1>词库</h1>
        <p>
          {displayedWords.length} / {visibleWords.length} 词
        </p>
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

      {quickMarkNotice && <p className="wordbook-page__notice">{quickMarkNotice}</p>}
      {progressLoading && <p className="wordbook-list__empty">正在加载词库进度…</p>}
      {progressError && <p className="wordbook-list__empty">{progressError}</p>}

      <section className="wordbook-list" aria-label="完整词库列表">
        {displayedWords.map(entry => {
          const status = getWordUserStatus(progressMap.get(progressService.getProgressGlobalKey(entry)));
          return (
            <WordListItem
              key={entry.id}
              entry={entry}
              status={status}
              onClick={() => setSelectedEntry(entry)}
              onQuickMastered={
                filter === 'unlearned' && status === 'unlearned'
                  ? () => handleQuickMastered(entry)
                  : undefined
              }
            />
          );
        })}

        {visibleWords.length === 0 && (
          <p className="wordbook-list__empty">没有找到匹配的单词。</p>
        )}

        {hasMore && (
          <button
            className="btn btn--secondary wordbook-list__more"
            type="button"
            onClick={() => setVisibleCount(prev => prev + LOAD_MORE_COUNT)}
          >
            继续加载 {Math.min(LOAD_MORE_COUNT, visibleWords.length - displayedWords.length)} 个单词
          </button>
        )}
      </section>

      <WordDetailSheet
        entry={selectedEntry}
        progress={selectedEntry ? progressMap.get(progressService.getProgressGlobalKey(selectedEntry)) : undefined}
        onClose={() => setSelectedEntry(null)}
      />
    </main>
  );
}
