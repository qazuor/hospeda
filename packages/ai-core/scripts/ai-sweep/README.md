# AI chat model and parameter sweep (HOS-2095)

Compares models x reasoning effort x `maxOutputTokens` for the AI chat feature:
visible-answer rate, `finishReason`, input/output/reasoning tokens, time to first
token, latency, answer length, estimated cost, heuristic rule checks and answer QUALITY:
automatic rubric checks plus a blind human/LLM grading step. A cheap model is useless if its answers
are bad, so read cost and quality together.

**It never calls a provider unless you pass `--execute`.** Executing spends real
money: get the budget approved first.

## Run (from `packages/ai-core`)

```bash
# Dry run (default): prints the matrix, call count and a worst-case estimate. No network.
CI=true pnpm exec tsx scripts/ai-sweep/sweep.ts --config scripts/ai-sweep/sweep.config.example.json

# Real run: needs the API key env var named by each provider's `apiKeyEnv`.
OPENAI_API_KEY=... CI=true pnpm exec tsx scripts/ai-sweep/sweep.ts --config my.config.json --execute
```

### Quality: automatic checks, blind export, grades

Each case in `fixtures.json` carries a `rubric`: `mustInclude` and `mustNotClaim` (label + regex), `expectsUnknown`,
`expectsDecline`, `expectedLanguage` and `notes` (what an ideal answer looks like). 14 cases cover chat (accommodation),
chat_venue (restaurant, bar, cafe, nightclub) and chat_experience, including absent-fact traps (price, hours, pets,
duration), an English question, an off-topic question and a prompt injection.

Automatic checks per answer (`quality.ts`) are REGEX HEURISTICS, not a judge: `mustInclude` coverage, `mustNotClaim`
violations, "no se" phrasing when the fact is absent, polite-decline phrasing, answer language (stopword counting),
empty answer and length. They miss paraphrases and can flag a negated claim; use them to spot trouble, not to rank.

```bash
# 1. Run and export the blind file in one go (or later, from an existing JSONL with --results)
CI=true pnpm exec tsx scripts/ai-sweep/sweep.ts --config my.config.json --execute \
  --api-key-file ~/.secrets/openai.key --blind-export scripts/ai-sweep/out/blind.jsonl
# writes blind.jsonl (id, context, question, rubric, answer: NO model/effort/cap)
# and blind.jsonl.key.json (id -> variant). Keep the key away from the grader.

# 2. A human or an LLM grades each id 1-5 into grades.json:
#    {"3fa9c1d20b": {"score": 4, "notes": "correct, a bit long"}, ...}

# 3. Merge grades (offline, no network): avg score and score per $ per 1000 answers per variant
CI=true pnpm exec tsx scripts/ai-sweep/sweep.ts --config my.config.json \
  --results scripts/ai-sweep/out/sweep-<stamp>.jsonl \
  --grades grades.json --key scripts/ai-sweep/out/blind.jsonl.key.json
```

`--results <jsonl>` switches to offline mode: it never calls a provider and never needs a key. Without
`--grades` it just re-renders the summary; with `--blind-export` it only exports. Errored calls are not exported.

Flags: `--config <path>`, `--execute`, `--dry-run`, `--max-calls <n>` (default from
config, 150), `--concurrency <n>` (default 2), `--out <dir>` (default `scripts/ai-sweep/out/`, git-ignored),
`--api-key-file <path>` (reads and trims the file; used for every provider instead of its `apiKeyEnv`; the key is never logged),
`--blind-export <path>`, `--grades <path>`, `--key <path>`, `--results <path>`.
The script aborts if the matrix exceeds the call cap, and aborts `--execute` if a needed key env var is unset.

Output per run: `sweep-<timestamp>.jsonl` (one raw result per call) and `sweep-<timestamp>.md`
(summary table per model x effort x cap with visible %, p50/p95 latency, TTFT, avg output and
reasoning tokens, reasoning share, avg cost per answer, projected USD/month at each quota, rule pass rate).

## Config

The example config compares `gpt-5.4-nano`, `gpt-5-nano`, `gpt-5-mini` and `gpt-5.4-mini` at efforts
`minimal` and `low`, cap 2048, 2 repetitions: 224 calls (cap 250). `rates` are USD per 1M tokens per model
(OpenAI standard prices; check them before trusting the cost columns).

**gpt-5.4 models may not accept `minimal` effort.** A provider error never aborts the sweep: the call is recorded
with its error, the sweep continues, and the summary ends with a per-variant error list (count and first message).
Errored calls are excluded from the quality columns and count in `errors`.

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
- Rule and rubric checks are regex heuristics, not a judge: read the raw JSONL, and grade blind, before concluding anything.
- The English-question case expects an English answer (the prompt says to use the user's language) while the sweep also appends a `locale "es"` line: a Spanish answer there is worth noting. Its unknown-handling check is Spanish-only.
- Worst-case input tokens use ~4 chars/token; real counts differ.
- Results are small-sample and non-deterministic; raise `repetitions` within the call cap.
- A reasoning model's reasoning tokens count against `maxOutputTokens`, which is the point of the sweep.
