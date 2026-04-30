// ============================================================
// 词库加载与管理 Hook —「默」Mo
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import type { BookId, WordEntry, WordbookRecord } from '../types';
import * as db from '../lib/db';

interface UseWordbookReturn {
  /** 当前词库 ID */
  bookId: BookId;
  /** 当前词库的全部词条 */
  words: WordEntry[];
  /** 是否正在加载 */
  loading: boolean;
  /** 当前学到第几个词 */
  currentIndex: number;
  /** 切换词库 */
  switchBook: (newBookId: BookId) => Promise<void>;
  /** 更新当前进度索引 */
  setCurrentIndex: (index: number) => Promise<void>;
  /** 本词库是否已学完 */
  finished: boolean;
  /** 总词数 */
  totalWords: number;
}

/**
 * 从 public/data/ 加载 JSON 词库文件
 */
async function fetchWordbook(bookId: BookId): Promise<WordEntry[]> {
  const response = await fetch(`/data/${bookId}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load wordbook: ${bookId}`);
  }
  return response.json();
}

export function useWordbook(initialBookId: BookId): UseWordbookReturn {
  const [bookId, setBookId] = useState<BookId>(initialBookId);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndexState] = useState(0);
  const initialized = useRef(false);

  // 初始化：从 IndexedDB 加载设置，再从缓存或网络加载词库
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      try {
        // 1. 加载设置
        const settings = await db.getSettings();
        const targetBookId = settings?.currentBookId ?? initialBookId;
        const targetIndex = settings?.currentWordIndex ?? 0;

        setBookId(targetBookId);
        setCurrentIndexState(targetIndex);

        // 2. 尝试从 IndexedDB 缓存加载
        const cached = await db.getWordbook(targetBookId);
        if (cached) {
          setWords(cached.words);
          setLoading(false);
          return;
        }

        // 3. 从网络加载并缓存
        const fetchedWords = await fetchWordbook(targetBookId);
        setWords(fetchedWords);
        await db.saveWordbook({ bookId: targetBookId, words: fetchedWords });
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize wordbook:', err);
        setLoading(false);
      }
    }

    init();
  }, [initialBookId]);

  const switchBook = useCallback(async (newBookId: BookId) => {
    setLoading(true);
    try {
      // 检查缓存
      const cached = await db.getWordbook(newBookId);
      if (cached) {
        setWords(cached.words);
      } else {
        const fetchedWords = await fetchWordbook(newBookId);
        setWords(fetchedWords);
        await db.saveWordbook({ bookId: newBookId, words: fetchedWords });
      }
      setBookId(newBookId);
      setCurrentIndexState(0);
      // 更新设置
      await db.updateSettings({ currentBookId: newBookId, currentWordIndex: 0 });
      setLoading(false);
    } catch (err) {
      console.error('Failed to switch wordbook:', err);
      setLoading(false);
    }
  }, []);

  const setCurrentIndex = useCallback(async (index: number) => {
    setCurrentIndexState(index);
    await db.updateSettings({ currentWordIndex: index });
  }, []);

  const finished = currentIndex >= words.length;
  const totalWords = words.length;

  return {
    bookId,
    words,
    loading,
    currentIndex,
    switchBook,
    setCurrentIndex,
    finished,
    totalWords,
  };
}
