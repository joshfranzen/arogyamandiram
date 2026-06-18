/**
 * Integration tests for the OpenAI integration layer.
 *
 * These tests verify that:
 *  - API routes call `openAIFetch` (not hardcoded URLs)
 *  - Requests are sent to the correct endpoint path
 *  - Provider-specific headers are applied end-to-end
 *  - Error responses from the API are surfaced correctly
 *
 * The tests mock `fetch` globally and the DB/session helpers,
 * so no real network calls or database connections are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openAIFetch } from '@/lib/openaiClient';

// ---------------------------------------------------------------------------
// Mock DB and key resolver to prevent module-load-time throws
// ---------------------------------------------------------------------------
vi.mock('@/lib/db', () => ({ default: vi.fn() }));
vi.mock('@/lib/openaiKey', () => ({ resolveOpenAIKey: vi.fn() }));

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// End-to-end request routing via openAIFetch
// ---------------------------------------------------------------------------

describe('openAIFetch — provider routing integration', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_ORG_ID;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('routes "responses" endpoint to official OpenAI URL', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { id: 'r1' }));
    await openAIFetch('sk-key', 'responses', { model: 'gpt-4' });
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/responses');
  });

  it('routes "chat/completions" endpoint to official OpenAI URL', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { choices: [] }));
    await openAIFetch('sk-key', 'chat/completions', { model: 'gpt-4' });
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('routes to Ollama local endpoint when OPENAI_BASE_URL is overridden', async () => {
    process.env.OPENAI_BASE_URL = 'http://localhost:11434/v1';
    mockFetch.mockResolvedValue(makeResponse(200, { choices: [] }));
    await openAIFetch('ollama', 'chat/completions', { model: 'llama3' });
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('routes to Azure endpoint and uses api-key header', async () => {
    process.env.OPENAI_BASE_URL =
      'https://myresource.openai.azure.com/openai/deployments/gpt4';
    mockFetch.mockResolvedValue(makeResponse(200, { id: 'r2' }));
    await openAIFetch('azure-secret', 'responses', { model: 'gpt-4' });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://myresource.openai.azure.com/openai/deployments/gpt4/responses'
    );
    const headers = init.headers as Record<string, string>;
    expect(headers['api-key']).toBe('azure-secret');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('routes to Together.ai and uses Bearer auth', async () => {
    process.env.OPENAI_BASE_URL = 'https://api.together.xyz/v1';
    mockFetch.mockResolvedValue(makeResponse(200, { choices: [] }));
    await openAIFetch('together-key', 'chat/completions', { model: 'llama3' });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.together.xyz/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer together-key');
  });

  // ── API error passthrough ────────────────────────────────────────────────

  it('returns a non-2xx Response without throwing', async () => {
    mockFetch.mockResolvedValue(
      makeResponse(401, { error: { message: 'Invalid API key' } })
    );
    const res = await openAIFetch('bad-key', 'responses', {});
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe('Invalid API key');
  });

  it('returns a 429 rate-limit response without throwing', async () => {
    mockFetch.mockResolvedValue(
      makeResponse(429, { error: { message: 'Rate limit exceeded' } })
    );
    const res = await openAIFetch('sk-key', 'responses', {});
    expect(res.status).toBe(429);
  });

  it('propagates network errors thrown by fetch', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(openAIFetch('sk-key', 'responses', {})).rejects.toThrow(
      'Failed to fetch'
    );
  });

  // ── Payload passthrough ─────────────────────────────────────────────────

  it('forwards the entire payload as-is in the request body', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    const payload = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Log 2 eggs' }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    };
    await openAIFetch('sk-key', 'responses', payload);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });
});

// ---------------------------------------------------------------------------
// Organisation header integration
// ---------------------------------------------------------------------------

describe('openAIFetch — OPENAI_ORG_ID integration', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_ORG_ID;
    mockFetch.mockResolvedValue(makeResponse(200, {}));
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('adds OpenAI-Organization header when OPENAI_ORG_ID is set', async () => {
    process.env.OPENAI_ORG_ID = 'org-xyz';
    await openAIFetch('sk-key', 'responses', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['OpenAI-Organization']).toBe('org-xyz');
  });

  it('omits OpenAI-Organization header when OPENAI_ORG_ID is not set', async () => {
    await openAIFetch('sk-key', 'responses', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['OpenAI-Organization']).toBeUndefined();
  });

  it('does not add org header for Azure even when OPENAI_ORG_ID is set', async () => {
    process.env.OPENAI_BASE_URL =
      'https://myresource.openai.azure.com/openai/deployments/gpt4';
    process.env.OPENAI_ORG_ID = 'org-xyz';
    await openAIFetch('azure-secret', 'responses', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['OpenAI-Organization']).toBeUndefined();
  });
});
