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
OPENAI_API_KEY=... CI=true pnpm exec tsx scripts/ai-sweep/sweep.ts --config scripts/ai-sweep/sweep.config.all.json --execute
```

### Quality: automatic checks, blind export, grades

Each case in `fixtures.json` carries a `rubric`: `mustInclude` and `mustNotClaim` (label + regex), `expectsUnknown`,
`expectsDecline`, `expectedLanguage` and `notes` (what an ideal answer looks like). 55 cases cover chat (accommodation; 22 `acc-real-*` cases are built from the PUBLIC listings of hospeda.com.ar),
chat_venue (restaurant, parrilla, bar, cafe, heladería, boliche, a restaurant that turns into a boliche at night) and
chat_experience, including absent-fact traps (price, hours, pets, duration, a schedule day that is not informed), a scoped
minor rule (lunch with a child at a venue whose 18+ applies only to the night), the HOS-2098 smoke questions at a bar open
21:00-03:00 with the 18+ scoped from 00:00, from 23:30 or all day (a time before the scope, after midnight, no time) and
another area than the scoped dance floor, a price stored in centavos, an amenity
past position 20, venue amenities, three groups over capacity and English/Portuguese group questions (HOS-2100), an English and a Portuguese question, an off-topic question and a prompt injection.

Automatic checks per answer (`quality.ts`) are REGEX HEURISTICS, not a judge: `mustInclude` coverage, `mustNotClaim`
violations, "no se" phrasing when the fact is absent, polite-decline phrasing, answer language (stopword counting),
empty answer and length. Three more run on EVERY case, each with its own summary column:

- `raw code`: the answer leaked an enum code or catalog slug (`MID`, `COUNTRY_HOUSE`, `air_conditioning`). Any
  SCREAMING_CASE token of 3+ letters outside a short acronym allowlist (ARS, USD, DNI, ...) counts, so an all-caps
  emphasis word also trips it.
- `owner voice`: the answer spoke as the owner ("aceptamos", "tenemos", "nuestro", "te esperamos", "we accept").
  "No tenemos información" also trips it.
- `impossible promise`: the answer promised what the assistant cannot do ("te reservo", "chequeo disponibilidad",
  "confirmo tu reserva", "te paso el WhatsApp", "I'll book").

They miss paraphrases and can flag a negated claim; use them to spot trouble, not to rank. Grading note for the
English/Portuguese cases: language is checked automatically, and an answer with correct content in the wrong language
is worth at most 2, not an automatic 1. With `--results`, quality is recomputed with the CURRENT rubrics, so a rubric
fix re-scores old answers.

```bash
# 1. Run and export the blind file in one go (or later, from an existing JSONL with --results)
CI=true pnpm exec tsx scripts/ai-sweep/sweep.ts --config scripts/ai-sweep/sweep.config.all.json --execute \
  --api-key-file ~/.config/hospeda-openai-sweep.key --blind-export scripts/ai-sweep/out/blind.jsonl
# writes blind.jsonl (id, context, question, rubric, answer: NO model/effort/cap)
# and blind.jsonl.key.json (id -> variant). Keep the key away from the grader.

# 2. A human or an LLM grades each id 1-5 into grades.json:
#    {"3fa9c1d20b": {"score": 4, "notes": "correct, a bit long"}, ...}

# 3. Merge grades (offline, no network): avg score and score per $ per 1000 answers per variant
CI=true pnpm exec tsx scripts/ai-sweep/sweep.ts --config scripts/ai-sweep/sweep.config.all.json \
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

The first three configs run the same 8 variants, cap 2048, 2 repetitions, with a per-model `reasoningEfforts` override
(`none`/`low` for gpt-5.4-nano/mini, `minimal`/`low` for gpt-5-nano/mini). `rates` are USD per 1M tokens per model
(OpenAI standard prices; check them before trusting the cost columns).

| Config | Cases | Calls (cap) | Worst case |
| --- | --- | --- | --- |
| `sweep.config.all.json` | all 55 | 880 (900) | ~$4.65 |
| `sweep.config.example.json` | the 33 synthetic venue/experience/accommodation cases | 528 (540) | ~$2.84 |
| `sweep.config.accommodation.json` | the 22 `acc-real-*` cases | 352 (360) | ~$1.72 |
| `sweep.config.age-scope.json` | the 16 `chat_venue` minimum-age cases (HOS-2098 smoke), gpt-5.4-nano / none, 3 repetitions | 48 (60) | ~$0.16 |

Since the HOS-2098 root fix the venue contexts carry the age scope already resolved against the opening hours
("Edad mínima por horario y sector": one line per window, "sin edad mínima informada" or "edad mínima N"), so these
cases measure whether the model looks a time up, not whether it can do the arithmetic. Their "permission" rubrics
match "sí" as `s[ií](?![a-záéíóúñ])`: the regexes run without the `u` flag, where `\b` after "í" never matches.

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

## Contexts and system messages: production parity

The sweep sends EXACTLY the system message production sends (with the in-code prompts). ai-core may not depend on
apps/api, so the rendering is a generation step that lives in apps/api:

- `fixtures.json` holds the hand-written part of each case: question, rubric, the `entity` it runs against and the
  page `locale`.
- `inputs/accommodation-snapshots.json` holds 5 PUBLIC listing snapshots (GET
  `https://api.hospeda.com.ar/api/v1/public/accommodations/slug/<slug>`), reduced to the fields
  `buildMarkdownContext` reads. No contact data is stored (phones, emails, WhatsApp, URLs, owner). The public payload
  has no `policies` or `iaData`, so those blocks are absent.
- `inputs/catalog-curation.json` holds the public amenity/feature catalog curation (`isFeatured`, `displayWeight`),
  which the builder uses to order amenities before capping, as production does with the DB columns.
- `inputs/synthetic-entities.json` holds the synthetic venues, experiences and accommodations as entity rows with real
  enum codes, money in centavos where the column stores centavos, and real `OpeningHoursSchema` schedules
  (`heladeria-dia-sin-cargar` lacks `sun` on purpose).
- `apps/api/scripts/ai-sweep/generate-sweep-contexts.ts` renders every case with the REAL builders
  (`buildMarkdownContext`, `buildVenueMarkdownContext` + `toVenueNightContext`, `buildExperienceMarkdownContext`) and
  writes `contexts.generated.json`: each case's context plus one `systemSuffixes[feature][locale]` table, which is
  `buildChatSystemMessage('', composeSystemPrompt(DEFAULT_PROMPTS + DEFAULT_RULES), locale)`. The generator verifies,
  for every case, that `context + suffix` is byte-identical to `buildChatSystemMessage(context, ...)`.
- The sweep only concatenates `context + suffix`; it re-implements nothing.

Regenerate after changing a builder, a default prompt or rule, an input entity, or a case's entity/feature/locale:

```bash
# from the repo root
CI=true pnpm --filter hospeda-api exec tsx scripts/ai-sweep/generate-sweep-contexts.ts
```

Guards: `apps/api/test/scripts/ai-sweep-contexts-parity.test.ts` rebuilds one case per feature straight from the
builders and compares it byte for byte with what the sweep sends, and fails while the committed file is stale.
`test/ai-sweep-fixtures.test.ts` (ai-core) fails when a system message does not carry the current in-code prompt and
rules, or when a case's entity/feature/locale changed since generation.

## Caveats

- Production may override prompts through the DB (`resolveSystemPrompt`); this sweep uses the in-code defaults.
- The synthetic cases are synthetic DATA rendered by the real builders; real listings are longer.
- Rule and rubric checks are regex heuristics, not a judge: read the raw JSONL, and grade blind, before concluding anything.
- The English and Portuguese cases run with page locale `es`, which production now states only as a fallback. The unknown-handling check is Spanish-only.
- Worst-case input tokens use ~4 chars/token; real counts differ.
- Results are small-sample and non-deterministic; raise `repetitions` within the call cap.
- A reasoning model's reasoning tokens count against `maxOutputTokens`, which is the point of the sweep.
