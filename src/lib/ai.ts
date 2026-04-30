// ============================================================
// DeepSeek API 调用 —「默」Mo
// ============================================================

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PROMPT = `You are a concise English vocabulary tutor for a Chinese learner at upper-intermediate level. Explain the given word in 3 parts:
1. A one-sentence explanation in simple English (no Chinese)
2. One vivid, memorable example sentence using the word in a real-life context
3. A brief note on common usage patterns or easily confused words (in Chinese, within 20 characters)

Keep your total response under 80 words. Do not use bullet points or labels.`;

export async function getAiExplanation(word: string, apiKey: string): Promise<string> {
  if (!apiKey) {
    throw new Error('未配置 API Key');
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: word },
      ],
      stream: false,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API 请求失败 (${response.status})`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
