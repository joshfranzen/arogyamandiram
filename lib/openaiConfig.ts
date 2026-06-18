// ============================================
// Centralized OpenAI Configuration — Phase 3
// ============================================
// Single source of truth for base URL, API key, model, and provider
// detection. Supports OpenAI, Azure OpenAI, local endpoints (Ollama /
// LM Studio), and any other OpenAI-compatible provider via
// OPENAI_BASE_URL.

import { resolveOpenAIKey } from '@/lib/openaiKey';
import { OPENAI_BEST_MODEL, OPENAI_ORCHESTRATOR_MODEL } from '@/lib/aiModel';

export type ProviderName = 'openai' | 'azure' | 'local' | 'together' | 'custom';

export interface OpenAIConfig {
  /** Detected or inferred provider name. */
  name: ProviderName;
  /** Base URL without trailing slash, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  /**
   * Bearer token used for providers that accept `Authorization: Bearer …`.
   * For Azure this is empty — the key is placed in `headers['api-key']`.
   */
  apiKey: string;
  model: string;
  organizationId?: string;
  /**
   * Additional headers to merge into every request. Used for provider-
   * specific authentication schemes (e.g. Azure's `api-key` header).
   */
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

/**
 * Infer the provider name from the base URL.
 * Callers can still override behaviour by inspecting `config.name`.
 */
export function detectProvider(baseUrl: string): ProviderName {
  if (baseUrl.includes('api.openai.com')) return 'openai';
  if (baseUrl.includes('openai.azure.com')) return 'azure';
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) return 'local';
  if (baseUrl.includes('together')) return 'together';
  return 'custom';
}

// ---------------------------------------------------------------------------
// Config resolvers
// ---------------------------------------------------------------------------

/**
 * Resolve the full OpenAI client configuration for a given user.
 *
 * Key priority:
 *   1. User's encrypted API key (from DB)
 *   2. Server-level OPENAI_API_KEY env var
 *   3. Empty string (caller must handle the missing-key case)
 *
 * Provider-specific adaptations applied here:
 *   - **Azure**: key is placed in `headers['api-key']`; `apiKey` is cleared
 *     so the fetch helper does not also emit an `Authorization` header.
 */
export async function resolveOpenAIConfig(userId: string): Promise<OpenAIConfig> {
  const rawKey = (await resolveOpenAIKey(userId)) ?? '';
  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const name = detectProvider(baseUrl);

  const config: OpenAIConfig = {
    name,
    baseUrl,
    apiKey: rawKey,
    model: OPENAI_BEST_MODEL,
    organizationId: process.env.OPENAI_ORG_ID || undefined,
  };

  // Azure OpenAI authenticates with an `api-key` header instead of Bearer.
  if (name === 'azure') {
    config.headers = { 'api-key': rawKey };
    config.apiKey = ''; // prevent double-auth via Authorization header
  }

  return config;
}

/**
 * Same as resolveOpenAIConfig but uses the orchestrator (mini) model.
 */
export async function resolveOrchestratorConfig(userId: string): Promise<OpenAIConfig> {
  const config = await resolveOpenAIConfig(userId);
  return { ...config, model: OPENAI_ORCHESTRATOR_MODEL };
}
