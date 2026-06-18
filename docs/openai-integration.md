# OpenAI Integration Guide

Arogyamandiram's AI features are built on an OpenAI-compatible HTTP client. Any provider that exposes the OpenAI `/chat/completions` or `/responses` API can be used by setting environment variables — no code changes required.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes (for AI features) | — | API key for your provider |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | Base URL for the API endpoint |
| `OPENAI_ORG_ID` | No | — | OpenAI organization ID (billing / org management) |
| `OPENAI_MODEL_BEST` | No | `gpt-5.4` | Model used for complex reasoning tasks |
| `OPENAI_MODEL_ORCHESTRATOR` | No | `gpt-5.4-mini` | Model used for the AI orchestrator / quick tasks |

---

## Provider Setup Examples

### Official OpenAI (default)

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
# Optional
OPENAI_ORG_ID=org-...
```

### Azure OpenAI

Azure uses a different authentication scheme (`api-key` header instead of `Authorization: Bearer`). The client detects Azure automatically from the base URL.

```bash
OPENAI_BASE_URL=https://<YOUR_RESOURCE>.openai.azure.com/openai/deployments/<YOUR_DEPLOYMENT>
OPENAI_API_KEY=<your-azure-api-key>
```

> **Note:** Azure deployments already have the model baked into the URL, so `OPENAI_MODEL_BEST` / `OPENAI_MODEL_ORCHESTRATOR` should be set to match the deployment name you configured, or left at defaults if your deployment names match.

### Local endpoint — Ollama

```bash
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama        # Ollama ignores the key; any non-empty string works
OPENAI_MODEL_BEST=llama3
OPENAI_MODEL_ORCHESTRATOR=llama3
```

Pull the model first:

```bash
ollama pull llama3
```

### Local endpoint — LM Studio

```bash
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_API_KEY=lm-studio     # LM Studio ignores the key; any non-empty string works
OPENAI_MODEL_BEST=<model-id-shown-in-lm-studio>
OPENAI_MODEL_ORCHESTRATOR=<model-id-shown-in-lm-studio>
```

### Together.ai

```bash
OPENAI_BASE_URL=https://api.together.xyz/v1
OPENAI_API_KEY=<your-together-api-key>
OPENAI_MODEL_BEST=meta-llama/Llama-3-70b-chat-hf
OPENAI_MODEL_ORCHESTRATOR=meta-llama/Llama-3-8b-chat-hf
```

---

## Architecture

```
lib/openaiKey.ts        ← resolves the API key (user-stored key → server env fallback)
lib/openaiConfig.ts     ← builds OpenAIConfig (base URL + key + model + provider detection)
lib/openaiClient.ts     ← openAIFetch() — all HTTP calls flow through here
lib/aiModel.ts          ← OPENAI_BEST_MODEL / OPENAI_ORCHESTRATOR_MODEL constants
```

### Provider Detection

`detectProvider(baseUrl)` in `lib/openaiConfig.ts` classifies the endpoint:

| Detected provider | Condition |
|---|---|
| `openai` | URL contains `api.openai.com` |
| `azure` | URL contains `openai.azure.com` |
| `local` | URL contains `localhost` or `127.0.0.1` |
| `together` | URL contains `together` |
| `custom` | Anything else |

### Auth Header Matrix

| Provider | Auth mechanism |
|---|---|
| `openai` | `Authorization: Bearer <key>` + optional `OpenAI-Organization` |
| `azure` | `api-key: <key>` header only |
| `local` | `Authorization: Bearer <key>` |
| `together` | `Authorization: Bearer <key>` |
| `custom` | `Authorization: Bearer <key>` |

---

## Per-User API Keys

Users can store their own OpenAI API key in **Settings → AI Configuration**. The key is AES-256 encrypted at rest. When a per-user key exists it takes priority over the server-level `OPENAI_API_KEY`.

The `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, and model overrides are always resolved from server environment variables; they cannot be set per-user.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 Unauthorized` | Wrong or missing API key | Check `OPENAI_API_KEY` or the user's stored key |
| `404 Not Found` | Wrong `OPENAI_BASE_URL` or unsupported endpoint | Verify the URL and that your provider supports `/responses` or `/chat/completions` |
| `Connection refused` | Local endpoint not running | Start Ollama / LM Studio before using the app |
| Responses API errors on Azure | Azure deployments may not support `/responses` | Set endpoint to `chat/completions` compatible model; see Azure docs |
| Model not found | Model name mismatch | Set `OPENAI_MODEL_BEST` / `OPENAI_MODEL_ORCHESTRATOR` to a model your provider supports |
