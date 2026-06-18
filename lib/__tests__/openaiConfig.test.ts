import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectProvider, resolveOpenAIConfig, resolveOrchestratorConfig } from '@/lib/openaiConfig';
import type { ProviderName } from '@/lib/openaiConfig';

// ---------------------------------------------------------------------------
// Mock dependencies that touch DB / network
// ---------------------------------------------------------------------------
vi.mock('@/lib/openaiKey', () => ({
  resolveOpenAIKey: vi.fn(),
}));
vi.mock('@/lib/aiModel', () => ({
  OPENAI_BEST_MODEL: 'gpt-test-best',
  OPENAI_ORCHESTRATOR_MODEL: 'gpt-test-mini',
}));

import { resolveOpenAIKey } from '@/lib/openaiKey';

const mockResolveKey = vi.mocked(resolveOpenAIKey);

// ---------------------------------------------------------------------------
// detectProvider
// ---------------------------------------------------------------------------

describe('detectProvider', () => {
  const cases: Array<[string, ProviderName]> = [
    ['https://api.openai.com/v1', 'openai'],
    ['https://myresource.openai.azure.com/openai/deployments/gpt4/', 'azure'],
    ['http://localhost:11434/v1', 'local'],
    ['http://127.0.0.1:8080/v1', 'local'],
    ['https://api.together.xyz/v1', 'together'],
    ['https://my-proxy.example.com/v1', 'custom'],
  ];

  it.each(cases)('detects %s as %s', (url, expected) => {
    expect(detectProvider(url)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// resolveOpenAIConfig
// ---------------------------------------------------------------------------

describe('resolveOpenAIConfig', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    // Reset env vars to a known state
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_ORG_ID;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('defaults to official OpenAI endpoint when OPENAI_BASE_URL is not set', async () => {
    mockResolveKey.mockResolvedValue('sk-testkey');
    const config = await resolveOpenAIConfig('user-1');
    expect(config.baseUrl).toBe('https://api.openai.com/v1');
    expect(config.name).toBe('openai');
  });

  it('respects OPENAI_BASE_URL override', async () => {
    process.env.OPENAI_BASE_URL = 'http://localhost:11434/v1';
    mockResolveKey.mockResolvedValue('sk-testkey');
    const config = await resolveOpenAIConfig('user-1');
    expect(config.baseUrl).toBe('http://localhost:11434/v1');
    expect(config.name).toBe('local');
  });

  it('strips trailing slash from base URL', async () => {
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1/';
    mockResolveKey.mockResolvedValue('sk-testkey');
    const config = await resolveOpenAIConfig('user-1');
    expect(config.baseUrl).toBe('https://api.openai.com/v1');
  });

  it('falls back to empty string when user key and env key are both missing', async () => {
    mockResolveKey.mockResolvedValue(null);
    const config = await resolveOpenAIConfig('user-1');
    expect(config.apiKey).toBe('');
  });

  it('uses the resolved key as apiKey for OpenAI provider', async () => {
    mockResolveKey.mockResolvedValue('sk-userkey');
    const config = await resolveOpenAIConfig('user-1');
    expect(config.apiKey).toBe('sk-userkey');
  });

  it('includes organizationId when OPENAI_ORG_ID is set', async () => {
    process.env.OPENAI_ORG_ID = 'org-abc123';
    mockResolveKey.mockResolvedValue('sk-testkey');
    const config = await resolveOpenAIConfig('user-1');
    expect(config.organizationId).toBe('org-abc123');
  });

  it('omits organizationId when OPENAI_ORG_ID is not set', async () => {
    mockResolveKey.mockResolvedValue('sk-testkey');
    const config = await resolveOpenAIConfig('user-1');
    expect(config.organizationId).toBeUndefined();
  });

  it('uses the model from aiModel constants', async () => {
    mockResolveKey.mockResolvedValue('sk-testkey');
    const config = await resolveOpenAIConfig('user-1');
    expect(config.model).toBe('gpt-test-best');
  });

  // Azure-specific
  describe('Azure provider', () => {
    beforeEach(() => {
      process.env.OPENAI_BASE_URL =
        'https://myresource.openai.azure.com/openai/deployments/gpt4';
    });

    it('detects azure provider', async () => {
      mockResolveKey.mockResolvedValue('azure-key-xyz');
      const config = await resolveOpenAIConfig('user-1');
      expect(config.name).toBe('azure');
    });

    it('places the key in headers["api-key"] for Azure', async () => {
      mockResolveKey.mockResolvedValue('azure-key-xyz');
      const config = await resolveOpenAIConfig('user-1');
      expect(config.headers?.['api-key']).toBe('azure-key-xyz');
    });

    it('clears apiKey for Azure to prevent double-auth', async () => {
      mockResolveKey.mockResolvedValue('azure-key-xyz');
      const config = await resolveOpenAIConfig('user-1');
      expect(config.apiKey).toBe('');
    });
  });
});

// ---------------------------------------------------------------------------
// resolveOrchestratorConfig
// ---------------------------------------------------------------------------

describe('resolveOrchestratorConfig', () => {
  beforeEach(() => {
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_ORG_ID;
    vi.resetAllMocks();
  });

  it('uses the orchestrator model instead of best model', async () => {
    mockResolveKey.mockResolvedValue('sk-testkey');
    const config = await resolveOrchestratorConfig('user-1');
    expect(config.model).toBe('gpt-test-mini');
  });

  it('inherits all other config fields from resolveOpenAIConfig', async () => {
    mockResolveKey.mockResolvedValue('sk-testkey');
    const config = await resolveOrchestratorConfig('user-1');
    expect(config.baseUrl).toBe('https://api.openai.com/v1');
    expect(config.apiKey).toBe('sk-testkey');
  });
});
