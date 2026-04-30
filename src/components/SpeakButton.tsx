// ============================================================
// SpeakButton — 极简发音按钮
// ============================================================

import { useState, useCallback } from 'react';
import { useSpeech } from '../hooks/useSpeech';

interface SpeakButtonProps {
  word: string;
  autoSpeak?: boolean;
}

export default function SpeakButton({ word, autoSpeak = false }: SpeakButtonProps) {
  const { speak } = useSpeech();
  const [pressed, setPressed] = useState(false);

  const handleClick = useCallback(() => {
    setPressed(true);
    speak(word);
    setTimeout(() => setPressed(false), 150);
  }, [speak, word]);

  // 自动发音
  // TODO: autoSpeak 逻辑由父组件在 useEffect 中触发

  return (
    <button
      className="speak-btn"
      onClick={handleClick}
      style={{ opacity: pressed ? 0.4 : 1 }}
      aria-label="发音"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    </button>
  );
}
