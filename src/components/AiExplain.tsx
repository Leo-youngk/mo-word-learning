// ============================================================
// AI 释义 — DeepSeek AI 扩展解释
// ============================================================

import { useState, useCallback } from 'react';
import { getAiExplanation } from '../lib/ai';

interface AiExplainProps {
  word: string;
  apiKey: string;
}

export default function AiExplain({ word, apiKey }: AiExplainProps) {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleClick = useCallback(async () => {
    if (explanation) {
      setExpanded(!expanded);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getAiExplanation(word, apiKey);
      setExplanation(result);
      setExpanded(true);
    } catch (err: any) {
      setError(err.message || '请求失败');
    } finally {
      setLoading(false);
    }
  }, [word, apiKey, explanation, expanded]);

  return (
    <div className="ai-explain">
      <button className="ai-explain__trigger" onClick={handleClick}>
        {loading ? (
          <span className="ai-explain__loading">· · ·</span>
        ) : (
          'AI 释义'
        )}
      </button>

      {expanded && explanation && (
        <p className="ai-explain__text">{explanation}</p>
      )}

      {expanded && error && (
        <p className="ai-explain__error">{error}</p>
      )}
    </div>
  );
}
