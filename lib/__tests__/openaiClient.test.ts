import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openAIFetch } from '@/lib/openaiClient';

// ---------------------------------------------------------------------------
// Mock detectProvider so we can test header logic without real URL matching
// ---------------------------------------------------------------------------
vi.mock('@/lib/openaiConfig', () => ({
  detectProvider: vi.fn(),
}));

import { detectProvider } from '@/lib/openaiConfig';

const mockDetectProvider = vi.mocked(detectProvider);

// ---------------------------------------------------------------------------
// Capture fetch calls via global mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeOkResponse(body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('openAIFetch', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_ORG_ID;
    mockFetch.mockResolvedValue(makeOkResponse({ id: 'resp-1' }));
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  // ── URL construction ──────────────────────────────────────────────────────

  it('uses the official OpenAI base URL by default', async () => {
    mockDetectProvider.mockReturnValue('openai');
    await openAIFetch('sk-key', 'responses', { model: 'gpt-4' });
    const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://api.openai.com/v1/responses');
  });

  it('uses OPENAI_BASE_URL when set', async () => {
    process.env.OPENAI_BASE_URL = 'http://localhost:11434/v1';
    mockDetectProvider.mockReturnValue('local');
    await openAIFetch('sk-key', 'chat/completions', { model: 'llama2' });
    const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('strips trailing slash from base URL before joining endpoint', async () => {
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1/';
    mockDetectProvider.mockReturnValue('openai');
    await openAIFetch('sk-key', 'responses', {});
    const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://api.openai.com/v1/responses');
  });

  // ── OpenAI auth ───────────────────────────────────────────────────────────

  it('sends Authorization: Bearer header for OpenAI provider', async () => {
    mockDetectProvider.mockReturnValue('openai');
    await openAIFetch('sk-mykey', 'responses', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-mykey');
    expect(headers['api-key']).toBeUndefined();
  });

  it('adds OpenAI-Organization header when OPENAI_ORG_ID is set and provider is openai', async () => {
    process.env.OPENAI_ORG_ID = 'org-abc123';
    mockDetectProvider.mockReturnValue('openai');
    await openAIFetch('sk-key', 'responses', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['OpenAI-Organization']).toBe('org-abc123');
  });

  it('omits OpenAI-Organization header when OPENAI_ORG_ID is not set', async () => {
    mockDetectProvider.mockReturnValue('openai');
    await openAIFetch('sk-key', 'responses', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['OpenAI-Organization']).toBeUndefined();
  });

  it('does not send OpenAI-Organization header for non-openai providers even when env is set', async () => {
    process.env.OPENAI_ORG_ID = 'org-abc123';
    mockDetectProvider.mockReturnValue('together');
    await openAIFetch('sk-key', 'chat/completions', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['OpenAI-Organization']).toBeUndefined();
  });

  // ── Azure auth ────────────────────────────────────────────────────────────

  it('sends api-key header instead of Authorization for Azure', async () => {
    mockDetectProvider.mockReturnValue('azure');
    await openAIFetch('azure-secret', 'responses', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['api-key']).toBe('azure-secret');
    expect(headers['Authorization']).toBeUndefined();
  });

  // ── Local / compatible providers ──────────────────────────────────────────

  it('sends Authorization: Bearer for local provider', async () => {
    mockDetectProvider.mockReturnValue('local');
    await openAIFetch('ollama-key', 'chat/completions', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer ollama-key');
  });

  it('sends Authorization: Bearer for custom provider', async () => {
    mockDetectProvider.mockReturnValue('custom');
    await openAIFetch('custom-key', 'chat/completions', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer custom-key');
  });

  // ── Request format ────────────────────────────────────────────────────────

  it('sets Content-Type: application/json', async () => {
    mockDetectProvider.mockReturnValue('openai');
    await openAIFetch('sk-key', 'responses', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('serializes payload as JSON body', async () => {
    mockDetectProvider.mockReturnValue('openai');
    const payload = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hi' }] };
    await openAIFetch('sk-key', 'responses', payload);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it('uses POST method', async () => {
    mockDetectProvider.mockReturnValue('openai');
    await openAIFetch('sk-key', 'responses', {});
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
  });

  // ── Return value ──────────────────────────────────────────────────────────

  it('returns the raw Response object', async () => {
    mockDetectProvider.mockReturnValue('openai');
    const mockRes = makeOkResponse({ id: 'test-resp' });
    mockFetch.mockResolvedValue(mockRes);
    const result = await openAIFetch('sk-key', 'responses', {});
    expect(result).toBe(mockRes);
  });
});
