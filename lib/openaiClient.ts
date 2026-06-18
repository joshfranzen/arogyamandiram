// ============================================
// OpenAI HTTP Client — Phase 3
// ============================================
// Single fetch helper that reads OPENAI_BASE_URL (and optionally
// OPENAI_ORG_ID) from the environment so every route and library
// function can use a custom endpoint without code changes.
//
// Provider-specific authentication is handled automatically:
//   - OpenAI / local / compatible: Authorization: Bearer <key>
//   - Azure OpenAI: api-key: <key>  (no Authorization header)
//
// Usage:
//   const res = await openAIFetch(apiKey, 'responses', payload);
//   const res = await openAIFetch(apiKey, 'chat/completions', payload);

import { detectProvider } from '@/lib/openaiConfig';

/**
 * POST to an OpenAI-compatible endpoint.
 *
 * @param apiKey   API key for the configured provider.
 * @param endpoint Path relative to the base URL — e.g. `'responses'` or
 *                 `'chat/completions'`. Do NOT include a leading slash.
 * @param payload  Request body that will be JSON-serialised.
 * @returns        The raw `Response` object — callers handle status/json as before.
 */
export async function openAIFetch(
  apiKey: string,
  endpoint: string,
  payload: Record<string, unknown>
): Promise<Response> {
  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const url = `${baseUrl}/${endpoint}`;
  const provider = detectProvider(baseUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (provider === 'azure') {
    // Azure OpenAI uses the `api-key` header instead of Bearer auth.
    headers['api-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;

    // OpenAI-specific: optional organisation billing header.
    const orgId = process.env.OPENAI_ORG_ID;
    if (orgId && provider === 'openai') {
      headers['OpenAI-Organization'] = orgId;
    }
  }

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}
