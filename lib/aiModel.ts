function readEnvModel(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveRequiredModel(keys: string[]): string {
  for (const key of keys) {
    const value = readEnvModel(key);
    if (value) return value;
  }
  throw new Error(`Missing AI model configuration. Set one of: ${keys.join(', ')}`);
}

export const OPENAI_BEST_MODEL = resolveRequiredModel([
  'OPENAI_MODEL_BEST',
  'OPENAI_MODEL',
]);

export const OPENAI_ORCHESTRATOR_MODEL = resolveRequiredModel([
  'OPENAI_MODEL_ORCHESTRATOR',
  'OPENAI_MODEL_MINI',
  'OPENAI_MODEL_BEST',
  'OPENAI_MODEL',
]);
