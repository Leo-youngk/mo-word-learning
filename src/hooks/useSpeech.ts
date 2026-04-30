// ============================================================
// Web Speech API Hook —「默」Mo
// ============================================================

import { useCallback } from 'react';

export function useSpeech() {
  const speak = useCallback((word: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak };
}
