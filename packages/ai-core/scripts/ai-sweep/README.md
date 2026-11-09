# AI chat model and parameter sweep (HOS-2095)

Compares models x reasoning effort x `maxOutputTokens` for the AI chat feature:
visible-answer rate, `finishReason`, input/output/reasoning tokens, time to first
token, latency, answer length, estimated cost and two heuristic rule checks.

**It never calls a provider unless you pass `--execute`.** Executing spends real
money: get the budget approved first.

## Run (from `packages/ai-core`)

```bash
# Dry run (default): prints the matrix, call count and a worst-case estimate. No network.
CI=true pnpm exec tsx scripts/ai-sweep/sweep.ts --config scripts/ai-sweep/sweep.config.example.json

# Real run: needs the API key env var named by each provider's `apiKeyEnv`.
OPENAI_API_KEY=... CI=true pnpm exec tsx scripts/ai-sweep/sweep.ts --config my.config.json --execute
```

Flags: `--config <path>`, `--execute`, `--dry-run`, `--max-calls <n>` (default from
config, 150), `--concurrency <n>` (default 2), `--out <dir>` (default `scripts/ai-sweep/out/`, git-ignored).
The script aborts if the matrix exceeds the call cap, and aborts `--execute` if a needed key env var is unset.

Output per run: `sweep-<timestamp>.jsonl` (one raw result per call) and `sweep-<timestamp>.md`
(summary table per model x effort x cap with visible %, p50/p95 latency, TTFT, avg output and
reasoning tokens, reasoning share, avg cost per answer, projected USD/month at each quota, rule pass rate).

## Config

See `sweep.config.example.json`. `reasoningEfforts` (`minimal|low|medium|high`) are applied via
`providerOptions.openai.reasoningEffort` only to models with `reasoning: true`. A model's `rates`
(`inputUsdPerMillion`, `outputUsdPerMillion`) override the repo table `MODEL_RATES`
(`src/usage/model-rates.ts`). A model with no rate anywhere reports cost `null` plus a warning, and the
dry-run worst case is then a lower bound. Check current provider prices before filling rates in.

## Adding a nan.builder (OpenAI-compatible) provider

```json
{ "id": "nan", "baseURL": "https://<gateway-host>/v1", "apiKeyEnv": "NAN_API_KEY" }
```

then point a model at it: `{ "id": "<model>", "provider": "nan", "reasoning": false }`. A provider with a
`baseURL` is called through the chat-completions endpoint (`provider.chat(model)`), like the production adapter.

## Prompts

The system prompt is composed from the REAL `DEFAULT_PROMPTS` + `DEFAULT_RULES`
(`src/engine/default-prompts.ts`) with the same layout as `buildChatSystemMessage`. The context blocks are
static fixtures in `fixtures.json` (the real assemblers need the DB), each with the source builder file:line.

## Caveats

- Production may override prompts through the DB (`resolveSystemPrompt`); this sweep uses the in-code defaults.
- Context blocks are synthetic data in the real builders' format; real listings are longer.
- Rule checks are regex heuristics, not a judge: read the raw JSONL before concluding anything.
- Worst-case input tokens use ~4 chars/token; real counts differ.
- Results are small-sample and non-deterministic; raise `repetitions` within the call cap.
- A reasoning model's reasoning tokens count against `maxOutputTokens`, which is the point of the sweep.
