const DEFAULT_BEST_MODEL = 'gpt-5.4';
const DEFAULT_ORCHESTRATOR_MODEL = 'gpt-5.4-mini';

function readEnvModel(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const OPENAI_BEST_MODEL =
  readEnvModel('OPENAI_MODEL_BEST') ||
  readEnvModel('OPENAI_MODEL') ||
  DEFAULT_BEST_MODEL;

export const OPENAI_ORCHESTRATOR_MODEL =
  readEnvModel('OPENAI_MODEL_ORCHESTRATOR') ||
  readEnvModel('OPENAI_MODEL_MINI') ||
  DEFAULT_ORCHESTRATOR_MODEL;
