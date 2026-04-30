// ============================================================
// Welcome — 首次使用欢迎页
// ============================================================

import { useState, useEffect } from 'react';
import type { BookId } from '../types';

interface WelcomeProps {
  onStart: (bookId: BookId) => void;
}

const BOOK_OPTIONS: { id: BookId; label: string; desc: string }[] = [
  { id: 'cet6', label: '六级核心', desc: '大学英语六级核心词汇' },
  { id: 'cet4', label: '四级词汇', desc: '大学英语四级全部词汇' },
  { id: 'kaoyan', label: '考研词汇', desc: '全国硕士研究生入学考试词汇' },
  { id: 'toefl', label: '托福词汇', desc: 'TOEFL 考试核心词汇' },
];

export default function Welcome({ onStart }: WelcomeProps) {
  const [showBrand, setShowBrand] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BookId>('cet6');

  useEffect(() => {
    const timer = setTimeout(() => setShowBrand(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (showBrand) {
    return (
      <div className="welcome-brand">
        <h1 className="welcome-brand__title">默</h1>
        <p className="welcome-brand__sub">安静地记单词</p>
      </div>
    );
  }

  return (
    <div className="welcome-select">
      <h2 className="welcome-select__heading">选择词库</h2>
      <div className="welcome-select__options">
        {BOOK_OPTIONS.map(opt => (
          <button
            key={opt.id}
            className={`welcome-select__option ${selectedBook === opt.id ? 'welcome-select__option--selected' : ''}`}
            onClick={() => setSelectedBook(opt.id)}
          >
            <span className="welcome-select__label">{opt.label}</span>
            <span className="welcome-select__desc">{opt.desc}</span>
          </button>
        ))}
      </div>
      <button
        className="welcome-select__start"
        onClick={() => onStart(selectedBook)}
      >
        开始学习
      </button>
    </div>
  );
}
