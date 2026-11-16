# AI model and parameter sweep (HOS-2095, HOS-2217)

> Changing the production model? Jump to [Model migration (every AI feature)](#model-migration-every-ai-feature-hos-2217):
> one command compares the candidates across all ten AI features.

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
`--api-key-file <path>` (reads and trims the file; used instead of `apiKeyEnv` only for providers WITHOUT a custom `baseURL`, so a first-party key never reaches a third-party gateway; the key is never logged),
`--blind-export <path>`, `--grades <path>`, `--key <path>`, `--results <path>`.
The script aborts if the matrix exceeds the call cap, and aborts `--execute` if a needed key is missing. Numeric
flags must be positive integers and every value flag needs a value that is not another flag: anything else
(`--max-calls abc`, `--concurrency 0`, `--max-calls --execute`) exits 2 before doing anything (`cli-args.ts`).

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

## Model migration (every AI feature, HOS-2217)

`migration.ts` is the single entry point for a model change. It runs the chat cases above plus 6-12 cases for each
of the eight other features, against every model of `sweep.config.migration.json`, and reports quality, error rate,
cost per answer, projected monthly cost and latency per feature, plus an overall summary.

| model | role | efforts | USD / 1M in / out |
| --- | --- | --- | --- |
| `gpt-5.4-nano` | baseline (production today) | `none` | 0.20 / 1.25 |
| `gpt-6-luna` | candidate: OpenAI's most efficient model for focused, high-volume tasks | `none`, `low` | 0.10 / 0.50 |
| `gpt-5.6-luna` | candidate | `none` | 0.20 / 1.20 |
| `gpt-5.4-mini` | candidate; chat_venue and faq_draft already run on it | `none` | 0.75 / 4.50 |

All four are reasoning models; the luna models accept none/low/medium/high/xhigh/max (no `minimal`). Both luna
models are in `MODEL_RATES` (`src/usage/model-rates.ts`), so production metering is rated the day one is chosen.
`gpt-5-nano` and `gpt-5-mini` were dropped as candidates: OpenAI marks them DEPRECATED (checked 2026-11-15).
**Check OpenAI's deprecations page (<https://platform.openai.com/docs/deprecations>) before choosing candidates.**

### End-to-end run (from `packages/ai-core`)

```bash
# 0. monthlyCalls in sweep.config.migration.json are production 30-day counts measured 2026-11-15
#    (chat 15, chat_answer_classifier 12, search 4, faq_draft 1, the rest 0). Re-measure them, read-only:
#    select feature, count(*) from ai_usage where created_at > now() - interval '30 days' group by 1;

# 1. Dry run (default, no network): calls and worst-case USD per feature and in total.
CI=true pnpm exec tsx scripts/ai-sweep/migration.ts
CI=true pnpm exec tsx scripts/ai-sweep/migration.ts --features translate,faq_draft   # a subset

# 2. Execute (spends money: get the budget approved first). Aborts above maxCalls (or --max-calls).
OPENAI_API_KEY=... CI=true pnpm exec tsx scripts/ai-sweep/migration.ts --execute --blind-export out/blind.jsonl
#    -> out/migration-<stamp>.jsonl (raw), out/migration-<stamp>.md (report), blind.jsonl + blind.jsonl.key.json

# 3. Grade blind.jsonl 1-5 (human or LLM; it carries the input, grounding text, notes and answer, never the model)
#    into grades.json, then merge offline. --results alone re-checks old answers with the current checks.
CI=true pnpm exec tsx scripts/ai-sweep/migration.ts --results out/migration-<stamp>.jsonl \
  --grades grades.json --key out/blind.jsonl.key.json
```

Flags: `--config`, `--features a,b`, `--max-calls`, `--concurrency`, `--out`, `--api-key-file`, `--blind-export`,
`--results`, `--grades`, `--key` (same fail-closed parsing and `--api-key-file` rule as `sweep.ts`). The report also
prints a quota projection, cost per answer x `monthlyQuotas` (default 20/50/100/250/1250, as in the chat sweep),
because the measured volumes are too small to project from. Read the overall table first, then each feature: a candidate that is cheaper
overall but fails one feature (say `accommodation_import` schema validity) is not a drop-in replacement.

### What each feature measures

| feature | production call reproduced | automatic checks |
| --- | --- | --- |
| `chat`, `chat_venue`, `chat_experience` | streamed chat over the real listing context (see above) | rubric facts, unknown handling, decline, language, raw codes, owner voice |
| `search` | two calls: filter extraction (`generateObject`, `SearchIntentOutputSchema`) and the streamed reply (fixed ideal filters, so it is measured alone) | expected field values, no hallucinated filters, schema validity and production parse; reply rubric |
| `translate` | `translateField`: URL placeholders + `buildTranslationPrompt` | proper names verbatim, placeholders intact once, no preamble, language, preserved literals |
| `text_improve` | `buildTextImprovePrompt`, streamed | facts kept, nothing invented, no preamble, voseo, length |
| `post_generate` | `buildPostGeneratePrompt`, `generateObject` | schema + production strict parse, HTML content, requested language, no invented figures |
| `accommodation_import` | `stripHtmlToText` + `buildImportAiPrompt`, `generateObject` (non-strict JSON schema) | field values, values grounded in the page text, no invented coordinates/contacts, reviews never copied |
| `faq_draft` | chat context + `buildFaqDraftRequest`, `generateObject`, `maxTokens` 1024 / temperature 0 fixed | `hasData` right (false on missing data), draft grounded and plain text, language |
| `support` | none: no production route calls it today; engine defaults only | decline off-topic/injection, escalation, no invented policy, language |
| `chat_answer_classifier` | `buildChatAnswerClassifierRequest`: fixed instruction, `maxTokens` 16 / temperature 0 / `reasoningEffort` `none` (wins over the variant effort), on the vertical's chat feature (its configured model); metered under its own key | the one-word output parsed like production (`parseAnswerVerdict` = `parseClassifierVerdict`) equals the expected verdict |

Trap cases per feature: prompt injection, missing data and language mismatch. All data is synthetic: phones are
zero-filled, URLs use `example.com`.

### Production parity

Like the chat contexts, the non-chat requests are never rebuilt in ai-core. `apps/api` renders each stored input
(`task-fixtures/<feature>.json`) with the real route builders into `tasks.generated.json`, together with the output
schemas converted by the AI SDK itself (`zodSchema`, via `sdk-json-schema.ts`):

```bash
# from the repo root, after changing a fixture input, a builder, an output schema or inputs/*.json
CI=true pnpm --filter hospeda-api exec tsx scripts/ai-sweep/generate-sweep-tasks.ts
```

Guards: `apps/api/test/scripts/ai-sweep-tasks-parity.test.ts` fails on a stale file and rebuilds one case per call
kind without the generator; `test/ai-sweep-provider-parity.test.ts` (ai-core) runs every case through the real
`createAiEngine` and `OpenAiAdapter` and compares what reaches the provider and the SDK with what the sweep sends;
`test/ai-sweep-tasks.test.ts` refuses a fixture edited after generation.

### Policy: every AI feature must be covered

Owner rule (2026-11-16): an AI feature does not ship without sweep cases, so the next model change measures it
instead of guessing. It is enforced, not remembered: `apps/api/test/scripts/ai-sweep-feature-coverage.guard.test.ts`
(runs in CI's unit tests) fails when a feature production knows has no cases here or no entry in
`sweep.config.migration.json`. "Known to production" is every value of `AiFeatureSchema` (`@repo/schemas`, the keys
of `ai_settings.features`) plus every exported `*_USAGE_FEATURE` constant (a feature metered in `ai_usage` under its
own key, today `CHAT_ANSWER_CLASSIFIER_USAGE_FEATURE`). Run it with
`cd apps/api && CI=true pnpm exec vitest run test/scripts/ai-sweep-feature-coverage.guard.test.ts`; to satisfy it,
follow "Adding a feature or a case" below.

### Adding a feature or a case

- **A case**: add it to `task-fixtures/<feature>.json` (`id` prefixed with the feature, raw route `input`, `checks`,
  grader `notes`), regenerate `tasks.generated.json`, and run the three tests above.
- **A feature**: export its pure prompt builder from apps/api (a `*.prompt.ts` module if the route file loads env),
  add the call kind to `TASK_CALLS`/`FEATURE_OF_CALL` (`tasks.ts`) and its input schema and `renderTask` branch
  (`apps/api/scripts/ai-sweep/render-sweep-tasks.ts`), plus its output schema to `OUTPUT_SCHEMA_IDS` and
  `OUTPUT_ZOD_SCHEMAS` if structured, then add it to `sweep.config.migration.json` with its monthly volume.

### Results 2026-11-16 (decision: `gpt-6-luna`)

5 variants x 141 cases = 705 calls, about US$0.46. Blind grades 1-5 (`gpt-5.4-nano` / `gpt-6-luna|none` /
`gpt-6-luna|low`):

| feature | nano | luna none | luna low |
| --- | --- | --- | --- |
| chat | 4.66 | 4.53 | 4.71 |
| chat_venue | 4.08 | 4.73 | 4.81 |
| post_generate | 2.86 | 4.71 | 4.71 |
| text_improve | 3.56 | 4.78 | 4.67 |
| support | 3.29 | 4.29 | 4.57 |
| faq_draft | 4.50 | 4.70 | 4.90 |
| translate | 4.70 | 4.80 | 4.80 |
| search reply (n=4) | 4.75 | 4.25 | 4.50 |

`accommodation_import` all-pass: nano 25%, luna none 13%, luna low 100%. `chat_answer_classifier`: luna none 100%,
luna low 44% (5 of 9 empty: reasoning ate the 16-token cap).

Decision: every feature on `gpt-6-luna`; `none` for chat, chat_experience, search, translate and post_generate; `low`
for text_improve, accommodation_import, faq_draft and support. chat_venue stays `none` until the classifier fix
below is deployed, then can move to `low`. Applied by seed data-migration `0177-hos-2217-ai-features-gpt-6-luna`.

**Classifier effort (prod fix).** The engine merges the feature config's `reasoningEffort` under the caller params,
and the classifier runs under the vertical's chat feature, so it inherited that effort (venue chats ran it on
`gpt-5.4-mini|low`). `buildChatAnswerClassifierRequest` now sends `reasoningEffort: 'none'` explicitly; the sweep's
classifier cases send the same `none` whatever the variant effort. Before moving a chat feature to a model WITHOUT
reasoning support, revisit that parameter.

### Caveats (migration)

- `monthlyCalls` are a single 30-day measurement (2026-11-15) of a young production; use the quota projection for
  sizing and re-measure before deciding on the monthly figure.
- `chat_answer_classifier` is billed under its own sweep feature but routed as `chat`/`chat_venue`/`chat_experience`
  (production runs it on that feature's model); its 16-token cap is fixed by production, so the config cap never applies.
- Prompts are the in-code defaults, not DB overrides, and feature configs are not read: the effort is the config's.
- When production sends no `maxTokens`, the sweep caps the call (`maxOutputTokens` / `featureMaxOutputTokens`) so the
  worst case is bounded; a capped answer shows up as finishReason `length` in the "truncated" column.
- `support` has no production caller, so its parity is with the engine defaults only.
- `faq_draft` contexts use every listing section; production may hide sections the owner's plan does not grant.
- The JSON Schema validator supports only the keywords the stored schemas use and throws on any other one.
