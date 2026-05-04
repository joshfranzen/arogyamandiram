import { OPENAI_BEST_MODEL } from '@/lib/aiModel';

type OpenAiJsonParams = {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  onDebug?: (debug: OpenAiJsonDebugPayload) => void;
};

export type OpenAiJsonDebugPayload = {
  endpoint: string;
  requestBody: Record<string, unknown>;
  rawResponse: unknown;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  status: number;
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
  model = OPENAI_BEST_MODEL,
  temperature = 0.7,
  maxTokens = 1200,
  onDebug,
}: OpenAiJsonParams): Promise<T> {
  const endpoint = 'https://api.openai.com/v1/chat/completions';
  const requestBody = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    max_completion_tokens: maxTokens,
    response_format: { type: 'json_object' },
  } satisfies Record<string, unknown>;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await res.json().catch(() => ({}));

  onDebug?.({
    endpoint,
    requestBody,
    rawResponse: data,
    usage: (data as { usage?: OpenAiJsonDebugPayload['usage'] })?.usage,
    status: res.status,
  });

  if (!res.ok) {
    const err = data as { error?: { message?: string } };
    throw new Error((err.error?.message as string) || `OpenAI API error: ${res.status}`);
  }

  const rawText = extractJsonText(data?.choices?.[0]?.message?.content);

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error('OpenAI returned malformed JSON.');
  }
}
