type OpenAiJsonParams = {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

function extractJsonText(content: unknown): string {
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text?: unknown }).text ?? '');
        return '';
      })
      .join('\n')
      .trim();
    if (joined) return joined;
  }
  throw new Error('OpenAI returned an empty response.');
}

export async function createOpenAiJson<T extends Record<string, unknown>>({
  apiKey,
  systemPrompt,
  userPrompt,
  model = 'gpt-4o-mini',
  temperature = 0.7,
  maxTokens = 1200,
}: OpenAiJsonParams): Promise<T> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err.error?.message as string) || `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const rawText = extractJsonText(data?.choices?.[0]?.message?.content);

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error('OpenAI returned malformed JSON.');
  }
}
