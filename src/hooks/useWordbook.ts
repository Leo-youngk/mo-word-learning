import { useState, useCallback, useEffect } from 'react';
import type { BookId, WordEntry } from '../types';
import * as db from '../lib/db';

interface UseWordbookReturn {
  bookId: BookId;
  words: WordEntry[];
  loading: boolean;
  error: string;
  currentIndex: number;
  switchBook: (newBookId: BookId) => Promise<void>;
  setCurrentIndex: (index: number) => Promise<void>;
  finished: boolean;
  totalWords: number;
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function hydrateWords(words: WordEntry[]): WordEntry[] {
  return words.map(entry => ({
    ...entry,
    normalizedWord: entry.normalizedWord || normalizeWord(entry.word),
  }));
}

async function fetchWordbook(bookId: BookId): Promise<WordEntry[]> {
  const response = await fetch(`/data/${bookId}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load wordbook: ${bookId}`);
  }
  const words = await response.json();
  return hydrateWords(words);
}

export function useWordbook(initialBookId: BookId): UseWordbookReturn {
  const [bookId, setBookId] = useState<BookId>(initialBookId);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndexState] = useState(0);

  useEffect(() => {
    async function loadWordbook(targetBookId: BookId) {
      setLoading(true);
      setError('');
      try {
        setBookId(targetBookId);
        setCurrentIndexState(0);

        const cached = await db.getWordbook(targetBookId);
        if (cached) {
          const hydratedWords = hydrateWords(cached.words);
          setWords(hydratedWords);
          setLoading(false);
          return;
        }

        const fetchedWords = await fetchWordbook(targetBookId);
        setWords(fetchedWords);
        await db.saveWordbook({ bookId: targetBookId, words: fetchedWords });
        setLoading(false);
      } catch (loadError) {
        console.error('Failed to load wordbook:', loadError);
        setWords([]);
        setError('词库加载失败，请重试。');
        setLoading(false);
      }
    }

    loadWordbook(initialBookId);
  }, [initialBookId]);

  const switchBook = useCallback(async (newBookId: BookId) => {
    setLoading(true);
    setError('');
    try {
      const cached = await db.getWordbook(newBookId);
      if (cached) {
        setWords(hydrateWords(cached.words));
      } else {
        const fetchedWords = await fetchWordbook(newBookId);
        setWords(fetchedWords);
        await db.saveWordbook({ bookId: newBookId, words: fetchedWords });
      }

      setBookId(newBookId);
      setCurrentIndexState(0);
      setLoading(false);
    } catch (loadError) {
      console.error('Failed to switch wordbook:', loadError);
      setWords([]);
      setError('词库加载失败，请重试。');
      setLoading(false);
      throw loadError;
    }
  }, []);

  const setCurrentIndex = useCallback(async (index: number) => {
    setCurrentIndexState(index);
  }, []);

  return {
    bookId,
    words,
    loading,
    error,
    currentIndex,
    switchBook,
    setCurrentIndex,
    finished: currentIndex >= words.length,
    totalWords: words.length,
  };
}
