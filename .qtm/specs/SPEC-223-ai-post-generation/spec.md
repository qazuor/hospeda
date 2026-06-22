---
spec-id: SPEC-223
title: Create post from data with AI
type: feature
complexity: medium-high
status: draft
created: 2026-06-13T12:00:00Z
---

# SPEC-223 — Create post from data with AI

## Overview

**Goal.** Allow admins and editors to supply a topic and a list of key points (plus
optional category, tone, and locale) and receive an AI-generated post draft — title,
summary, and body content — streamed in real time into the post editor for human review
and adjustment before publishing.

**Motivation.** The `posts` entity is fully modelled (title, summary, content, category,
authorId, lifecycle, SEO), the AI infrastructure is production-ready (SPEC-173: providers,
streaming, safety pipeline, cost ceilings, quota middleware), and SPEC-214 made system
prompts editable by SUPER_ADMIN. There is no AI-assisted authoring path today: editors
must hand-write drafts from scratch. Given the platform's editorial workload (news,
destination guides, event coverage) a "Generate with AI" entry point in the post editor
directly reduces authoring time while keeping human review mandatory before any publish.

**Success criteria.**

1. A new `post_generate` value exists in `AiFeatureSchema` with a corresponding entry in
   `DEFAULT_PROMPTS` and `DEFAULT_RULES`, editable by SUPER_ADMIN via the existing prompt
   editor.
2. `POST /api/v1/admin/ai/post-generate` streams a JSON-shaped draft (title, summary,
   content) via SSE. Input is validated against `AiPostGenerateRequestSchema`.
3. The post editor (`/_authed/posts/$id/edit` and `/_authed/posts/new`) renders a
   "Generar con IA" panel (topic + key points) that streams the result and populates the
   title, summary, and content fields.
4. The generated content passes through the existing moderation + injection-guard pipeline
   before streaming to the client.
5. Every AI call is metered via the usage storage and bounded by the existing cost ceiling.

**Locked design decisions (user, 2026-06-13).**

1. **API tier: ADMIN.** Posts are platform editorial content managed exclusively by
   staff; there is no host or tourist write path for posts. The route lives under
   `/api/v1/admin/ai/post-generate` alongside the other admin AI management endpoints. No
   entitlement gate applies (admin routes are permission-gated by `PermissionEnum`, never
   billing-gated). The `ai_quota` and `ai_rate_limit` middlewares are NOT applied here.
2. **Streaming output format.** ~~The SSE stream carries incremental JSON tokens for the
   draft object rather than plain text, following the `generate-object` capability.~~ The
   schema is `{ title: string; summary: string; content: string }`.
   **REVISED (user, 2026-06-19).** `ai-core` exposes no `streamObject`; the `generateObject`
   capability is **buffered** (returns a `Promise`, not a stream), and reliably parsing a
   partial JSON object token-by-token is the spec's own Risk #1. Decision: the route is a
   plain `POST` returning a single JSON body validated against `AiPostGenerateDraftSchema`
   via `aiService.generateObject()` — **not** SSE. The admin panel shows a spinner while
   the request is in flight and populates the three fields once on success. US-1/US-2 are
   reinterpreted accordingly: "spinner + populate-on-complete" instead of "progressive
   token fill". This removes the SSE-POST client risk row entirely and eliminates the
   malformed-partial-JSON risk (the SDK validates the object against the schema).
3. **Human review mandatory.** The UI never auto-publishes; it only populates the editor
   fields. The editor's existing `PostUpdateInputSchema` validation and publish flow are
   unchanged.
4. **Reuse existing safety pipeline.** The moderation pass (`moderation-pass.ts`) and
   injection guard (`injection-guard.ts`) from `packages/ai-core/src/engine/` are applied
   as-is, identical to all other features.
5. **`AiFeature` is a Zod enum — append-only.** Adding `post_generate` is an additive
   change with no migration needed for existing stored `ai_prompt_versions` rows (rows are
   absent for new features until a SUPER_ADMIN creates them; the engine falls back to
   `DEFAULT_PROMPTS`).

**Baseline.** File refs verified against `origin/staging` on 2026-06-13.

---

## User Stories & Acceptance Criteria

### US-1 — Editor generates a post draft from topic + points

GIVEN an admin/editor on the post create (`/posts/new`) or edit (`/posts/$id/edit`) page,
WHEN they open the "Generar con IA" panel, fill in a topic and at least one key point,
and click "Generar",
THEN the title, summary, and content fields are progressively populated with the streamed
AI draft, and a spinner indicates streaming is in progress.

### US-2 — Generated content replaces field values with explicit confirmation

GIVEN streaming has completed,
WHEN the editor reviews the populated fields,
THEN a "Aplicar borrador" confirmation button finalises the population (fields are editable
at any point); the panel can be dismissed to discard the draft without touching the form.

### US-3 — Optional inputs refine the output

GIVEN the generation panel,
WHEN the editor optionally selects a category, a tone (`formal | informal | neutral`),
and a locale (`es | en | pt`),
THEN the AI draft reflects those constraints (locale drives the output language; tone and
category are included in the user turn sent to the engine).

### US-4 — Moderation blocks harmful output before it reaches the editor

GIVEN the AI draft contains content that fails the moderation pass,
WHEN the engine evaluates the output,
THEN the stream is terminated before any content reaches the client, the endpoint returns
a `422 MODERATION_FAILED` error, and a user-visible error message is shown in the panel.

### US-5 — SUPER_ADMIN can edit the system prompt and rules

GIVEN the existing AI prompt editor at `/_authed/ai/prompts/`,
WHEN the SUPER_ADMIN selects feature `post_generate`,
THEN they can view and update the system prompt content and the hard guardrails (rules),
which take effect immediately on the next generation call.

### US-6 — Graceful degradation on provider failure

GIVEN all configured AI providers are exhausted (e.g. rate-limited, key revoked),
WHEN the editor triggers generation,
THEN the stream terminates with an `AiEngineExhaustedError`-derived 503 response, the
panel shows "El servicio de IA no está disponible temporalmente", and the form fields
are unchanged.

### US-7 — Cost ceiling blocks generation when global ceiling is hit

GIVEN the global AI cost ceiling (`AiCostCeilingsSchema`) has been reached,
WHEN the editor triggers generation,
THEN the endpoint returns `429 AI_CEILING_HIT` before making any provider call, and the
panel shows a clear "Límite de costo alcanzado" message.

---

## Technical Approach

### Part A — Schema additions (`@repo/schemas`)

**`AiFeatureSchema`** — add `'post_generate'` to the Zod enum. This is the only schema
change needed in the AI namespace; all existing consumers iterate over `AiFeature` values
and handle unknown features gracefully.

**`AiPostGenerateRequestSchema`** — new file. Validated at the route boundary.

```ts
// packages/schemas/src/entities/ai/ai-post-generate.schema.ts
export const AiPostGenerateToneSchema = z.enum(['formal', 'informal', 'neutral']);
export type AiPostGenerateTone = z.infer<typeof AiPostGenerateToneSchema>;

export const AiPostGenerateRequestSchema = z.object({
    /** Editorial topic — 3..300 chars. */
    topic: z.string().min(3).max(300),
    /** Key points to cover — 1..10 items, each 1..200 chars. */
    points: z.array(z.string().min(1).max(200)).min(1).max(10),
    /** Optional post category (reuses PostCategorySchema). */
    category: PostCategorySchema.optional(),
    /** Output tone. Defaults to 'neutral'. */
    tone: AiPostGenerateToneSchema.optional(),
    /** Target output locale. Defaults to 'es'. */
    locale: LanguageEnumSchema.optional()
});
export type AiPostGenerateRequest = z.infer<typeof AiPostGenerateRequestSchema>;

export const AiPostGenerateDraftSchema = z.object({
    title:   z.string().min(3).max(150),
    summary: z.string().min(10).max(300),
    content: z.string().min(100).max(50000)
});
export type AiPostGenerateDraft = z.infer<typeof AiPostGenerateDraftSchema>;
```

Bounds match existing `PostSchema` constraints (`title` max 150, `summary` max 300,
`content` min 100 / max 50000).

**Touched files:**

- `packages/schemas/src/entities/ai/ai-provider.schema.ts` — add `'post_generate'` to
  `AiFeatureSchema`.
- `packages/schemas/src/entities/ai/ai-post-generate.schema.ts` — **new** request +
  draft schemas.
- `packages/schemas/src/entities/ai/index.ts` — export new schema.
- `packages/schemas/src/entities/post/post.schema.ts` — read `PostCategorySchema` to
  import/re-use in the new AI schema (no changes to post schema itself).

### Part B — Default prompt and rules (`packages/ai-core`)

Add `post_generate` to both `DEFAULT_PROMPTS` and `DEFAULT_RULES` in
`packages/ai-core/src/engine/default-prompts.ts`:

```ts
post_generate: `You are an expert content writer for Hospeda, a tourist accommodation
platform in Concepción del Uruguay, Argentina. You generate editorial posts in valid
rich-text HTML suitable for a hospitality blog. Your output MUST be a JSON object with
exactly three fields: "title" (string), "summary" (string, ≤300 chars), and "content"
(string, valid HTML, ≥100 chars). Do not include markdown fences or prose outside the
JSON object.`
```

Rules emphasise: no fabricated statistics, no PII, output must match the requested locale,
rich-text must be well-formed HTML.

**Touched files:**

- `packages/ai-core/src/engine/default-prompts.ts` — add `post_generate` entry to
  `DEFAULT_PROMPTS` and `DEFAULT_RULES`.

### Part C — API route (`apps/api`)

**Route file:** `apps/api/src/routes/ai/admin/post-generate.ts` — **new**.

Follows the same pattern as `text-improve.ts` but:

- Uses `createProtectedStreamingRoute` with **admin** factory variant (or the admin
  equivalent — verify the exact factory; `text-improve.ts` uses
  `createProtectedStreamingRoute`; the admin tier may use a different factory).
- No `entitlementMiddleware`, no `createAiQuotaMiddleware`, no `createAiRateLimitMiddlewares`
  — admin routes are permission-gated only.
- `requiredPermissions: [PermissionEnum.POST_CREATE]` (create permission is the natural
  gate for generating a draft; UPDATE would be equally valid for the edit context — confirm
  at impl).
- Calls `aiService.streamText()` with `feature: 'post_generate'` and a composed user turn.
- Cost ceiling (`assertCeilingNotHit`) is still applied at the engine layer — independent
  of the quota middleware; no extra call needed.

**Prompt builder** (exported for unit testing):

```ts
export function buildPostGeneratePrompt(input: AiPostGenerateRequest): string {
    const points = input.points.map((p, i) => `${i + 1}. ${p}`).join('\n');
    const tone   = input.tone ?? 'neutral';
    const cat    = input.category ? `Category: ${input.category}. ` : '';
    return `${cat}Tone: ${tone}.\n\nTopic: ${input.topic}\n\nKey points:\n${points}`;
}
```

**Barrel registration:** add the route to `apps/api/src/routes/ai/index.ts` (admin AI
barrel) alongside the existing credentials/settings/prompts/usage routes.

**Billing gate matrix row** (mandatory — SPEC-145 guard will reject PRs without it):

```
| POST /api/v1/admin/ai/post-generate | ai/admin/post-generate.ts | none | - | n/a | Admin write; PermissionEnum.POST_CREATE-gated |
```

**Touched files:**

- `apps/api/src/routes/ai/admin/post-generate.ts` — **new** streaming route.
- `apps/api/src/routes/ai/index.ts` — register new route in admin AI barrel.
- `docs/billing/endpoint-gate-matrix.md` — add the new route row.

### Part D — Admin UI (`apps/admin`)

**Panel component:** `apps/admin/src/features/posts/components/AiPostGeneratePanel.tsx`
— **new** React component.

Responsibilities:

- Form fields: topic (text input), points (dynamic list, add/remove), category (select,
  optional), tone (select, optional), locale (select, optional, defaults `es`).
- On submit: opens an SSE connection to `POST /api/v1/admin/ai/post-generate`, streams
  tokens, accumulates `title`, `summary`, `content` strings.
- On stream end: populates the parent form via a callback prop
  `onDraftReady(draft: AiPostGenerateDraft)`.
- On error: shows an inline error banner; never mutates form fields on error.
- Uses Tailwind CSS (admin styling convention), TanStack Form + `AiPostGenerateRequestSchema`
  for field validation.
- SSE client: native `EventSource` (or `fetch` + `ReadableStream` for POST body support,
  since `EventSource` is GET-only — use the same fetch+stream pattern as existing chat
  or text-improve clients in the admin, if any; otherwise implement a minimal fetch-stream
  helper).

**Integration into the post editor:**

- `apps/admin/src/features/posts/config/post-consolidated.config.ts` — add an optional
  `ai-generate` section (mode `create` + `edit`, collapsed by default).
- `apps/admin/src/routes/_authed/posts/$id_.edit.tsx` — pass `onDraftReady` callback
  that calls the TanStack Form `setValue` for `title`, `summary`, `content`.
- `apps/admin/src/routes/_authed/posts/new.tsx` — same wiring.

**Touched files:**

- `apps/admin/src/features/posts/components/AiPostGeneratePanel.tsx` — **new**.
- `apps/admin/src/features/posts/config/post-consolidated.config.ts` — add `ai-generate`
  section.
- `apps/admin/src/routes/_authed/posts/$id_.edit.tsx` — wire `onDraftReady`.
- `apps/admin/src/routes/_authed/posts/new.tsx` — wire `onDraftReady`.

### Part E — i18n

Extend locale files with keys for the AI generation panel: panel title, field labels,
placeholder texts, status messages (streaming, done, error variants), and the
"Aplicar borrador" / "Descartar" action labels.

**Touched files:**

- `packages/i18n/src/locales/es/admin.json` — add `posts.aiGenerate.*` keys.
- `packages/i18n/src/locales/en/admin.json` — same namespace, English values.
- `packages/i18n/src/locales/pt/admin.json` — same namespace, Portuguese values.

### Part F — Tests

- **Schema unit tests** (`packages/schemas/src/__tests__/ai-post-generate.schema.test.ts`):
  validate request bounds, refine tone defaults, check that `AiPostGenerateDraftSchema`
  rejects oversized content.
- **Prompt builder unit test** (`apps/api/src/routes/ai/admin/__tests__/post-generate.test.ts`):
  assert `buildPostGeneratePrompt()` output for known inputs (with/without category, with
  different tones, points formatting).
- **Route integration test**: stub the AI service (`stub.provider.ts`), call the endpoint,
  assert SSE stream carries a valid `AiPostGenerateDraft`-shaped payload.
- **Panel component test** (Vitest + testing-library): render `AiPostGeneratePanel`,
  fill topic + one point, mock the fetch stream, assert `onDraftReady` is called with
  the expected draft shape.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI model produces malformed JSON (not a valid draft object) | High | Use `generate-object` capability or parse + validate output against `AiPostGenerateDraftSchema`; retry once on parse failure before 422 |
| Hallucinated facts (invented statistics, fake event dates) | Medium | System prompt instructs model to use only supplied points; `DEFAULT_RULES` prohibit fabricated data; human review is mandatory before publish |
| Content moderation false positives on legitimate editorial content | Low | Moderation pass is applied to AI output, not input; tourism content is low-risk; editors can retry with rephrased points |
| Rich-text format mismatch with the post editor's renderer | Medium | Prompt specifies valid HTML; add a post-processing sanitise step (strip script/style tags) before streaming to client |
| Cost overrun from long content generation | Medium | Cost ceiling is applied at the engine layer; per-call cost is bounded by `maxTokens` (set a conservative default, e.g. 2048 tokens) |
| SSE POST from browser (EventSource is GET-only) | Medium | Use `fetch` + `ReadableStream` client; same pattern needed for any POST SSE; extract a shared `fetchStream()` helper in `apps/admin/src/lib/` |
| Admin role users generating spam/abuse via the route | Low | Route gated by `PermissionEnum.POST_CREATE`; only staff with that permission can call it; audit trail via usage storage |
| `AiFeatureSchema` enum extension breaks existing exhaustive switches | Low | Search codebase for `switch (feature)` before merging; the Zod enum change is additive but TS exhaustive checks may surface new compile errors to fix |

---

## Out of Scope

- Public or host-tier AI post generation (posts are platform editorial content, not host
  content; the `text_improve` feature already covers host accommodation fields).
- Auto-publish: the draft always lands in the editor for human review first.
- Generating images or media for the post (only title / summary / content text).
- Scheduled or background post generation (all generation is on-demand from the editor).
- Translation of existing posts (a separate feature; locale here controls the language of
  the generated draft, not translation of saved content).
- Post quality score integration with the AI panel (the existing `PostQualityScore`
  widget computes its score independently from the saved fields).
- Batch generation of multiple posts in one call.

---

## Suggested Tasks (phased)

### Phase 1 — Schema & engine

- **T-001** Add `'post_generate'` to `AiFeatureSchema` in
  `packages/schemas/src/entities/ai/ai-provider.schema.ts`.
- **T-002** Create `packages/schemas/src/entities/ai/ai-post-generate.schema.ts` with
  `AiPostGenerateRequestSchema`, `AiPostGenerateDraftSchema`, `AiPostGenerateToneSchema`;
  export from `packages/schemas/src/entities/ai/index.ts`.
- **T-003** Add `post_generate` to `DEFAULT_PROMPTS` and `DEFAULT_RULES` in
  `packages/ai-core/src/engine/default-prompts.ts`.
- **T-004** Schema unit tests (`ai-post-generate.schema.test.ts`).

### Phase 2 — API route

- **T-005** Create `apps/api/src/routes/ai/admin/post-generate.ts` with
  `buildPostGeneratePrompt()` + streaming route (permission-gated,
  `PermissionEnum.POST_CREATE`).
- **T-006** Register the route in `apps/api/src/routes/ai/index.ts`.
- **T-007** Add row to `docs/billing/endpoint-gate-matrix.md`.
- **T-008** Prompt builder unit tests + route integration test (stub provider).

### Phase 3 — Admin UI

- **T-009** Create `AiPostGeneratePanel.tsx` with topic/points form, SSE fetch-stream
  client, `onDraftReady` callback.
- **T-010** Add `ai-generate` section to `post-consolidated.config.ts`.
- **T-011** Wire `onDraftReady` into `$id_.edit.tsx` (post edit).
- **T-012** Wire `onDraftReady` into `new.tsx` (post create). Verify `new.tsx` route
  exists and uses the consolidated config.
- **T-013** Panel component tests (Vitest + testing-library, mock fetch stream).

### Phase 4 — i18n & polish

- **T-014** Add `posts.aiGenerate.*` i18n keys to `es/en/pt` admin locale files.
- **T-015** End-to-end manual smoke: generate a draft in the admin, verify fields
  populate, verify moderation error path, verify ceiling-hit path.

---

## Internal Review Notes

- **AiFeature enum is Zod, not TS.** `AiFeatureSchema = z.enum([...])` — adding a value
  is a one-line append to the array. No DB migration needed: `ai_prompt_versions.feature`
  is varchar (not pgEnum), per the SPEC-214 decision. The engine resolves
  `DEFAULT_PROMPTS['post_generate']` as fallback when no `ai_prompt_versions` row is
  active for the new feature.
- **Admin AI barrel structure.** `apps/api/src/routes/ai/` already has a `prompts/`,
  `credentials/`, `settings/`, `usage/` sub-directory structure. There is no `admin/`
  sub-directory today (protected routes live in `protected/`). Verify at impl whether
  to create `ai/admin/post-generate.ts` or place the file directly as
  `ai/post-generate.ts` at the top of the barrel — check how other admin AI routes
  (`prompts/index.ts`, etc.) are structured before deciding the exact path.
- **`generate-object` vs `streamText` for JSON output.** The `generate-object.capability.ts`
  capability exists and is purpose-built for structured JSON output. Evaluate at impl:
  if the Vercel AI SDK's `streamObject` surface is available via the adapter, prefer it
  over `streamText` + manual JSON parsing to avoid partial-JSON edge cases.
- **`new.tsx` route existence.** The file `apps/admin/src/routes/_authed/posts/new.tsx`
  is listed in the directory; verify it follows the same consolidated-config pattern as
  `$id_.edit.tsx` before wiring the panel.
- **Fetch-stream helper.** If no admin-side SSE POST client utility exists yet, extract
  a shared `fetchStream(url, body)` → `AsyncGenerator<string>` helper into
  `apps/admin/src/lib/fetch-stream.ts` so it can be reused by future AI panels.
- **Open question for impl:** confirm whether `PermissionEnum.POST_CREATE` or
  `PermissionEnum.POST_UPDATE` (or both) should be required at the route level, given the
  panel is embedded in both new and edit flows.
- **Billing gate matrix** — every new API route requires a row in
  `docs/billing/endpoint-gate-matrix.md`. The CI SPEC-145 guard will fail the PR
  without it.
