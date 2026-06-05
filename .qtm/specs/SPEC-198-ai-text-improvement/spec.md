---
id: SPEC-198
slug: ai-text-improvement
title: AI Text Improvement for HOST Listings
status: draft
owner: qazuor
created: 2026-06-05
parentSpec: SPEC-173
relatedSpecs:
  - SPEC-173  # AI foundation — this spec consumes it
  - SPEC-154  # admin config-driven entity view/edit — the field UI is in the admin edit page
  - SPEC-168  # admin-editable plans — determines which plan tiers get the entitlement
  - SPEC-145  # billing entitlements enforcement — quota middleware plugs here
tags: [ai, feature, host, text-improvement, streaming, admin]
---

# SPEC-198 — AI Text Improvement for HOST Listings

> ⛔ **DECISION PROTOCOL (read first, applies to the whole spec):** In every
> single case — without exception — if a change or decision is not *extremely*
> clear-cut, if there is even the slightest ambiguity, or if there is more than
> one viable option, **STOP and consult the owner (qazuor)**. Do not decide
> autonomously. See SPEC-173 §12.

## 1. Summary

Add an AI-powered text-improvement capability to the HOST accommodation editing
surface. A HOST who is composing or editing a text field (title, summary,
description, FAQ answers) can invoke "Improve with AI", receive a streaming
suggestion from the AI engine, and then choose to accept or reject it. The
original text is never modified without an explicit accept action.

This spec covers **only the feature layer**: the API route, the frontend
affordance in the admin edit page, and the wiring between them. The entire AI
engine, quota enforcement, streaming primitive, and safety layer are provided
by `@repo/ai-core` and the `apps/api` infrastructure from SPEC-173 — this spec
**does not re-design any of that**.

## 2. Context and Motivation

### 2.1 The problem

Hosts writing accommodation listings in the admin panel frequently produce
low-quality copy: grammatically poor sentences, thin descriptions, and FAQ
answers that do not answer the actual question. This reduces listing quality
and conversion. Hosts lack professional copywriting skills or time to produce
polished text.

### 2.2 What the foundation provides (verified in SPEC-173)

The following are **already shipped** and used as-is by this spec:

- `createConfiguredAiService()` (`apps/api/src/services/ai-service.factory.ts`)
  decrypts vault credentials and returns a fully configured `AiService`.
- `AiService.streamText({ feature, prompt, locale })` — returns
  `{ stream: AsyncIterable<string>, meta }`. The stream emits token deltas;
  `meta` resolves after drain with usage/provider/model info.
- `createProtectedStreamingRoute(options)` — POST-SSE factory in
  `apps/api/src/utils/streaming-route-factory.ts`. Emits named SSE events:
  `token` (delta), `done` (metadata), `error` (structured code + message).
  Maps pre-stream AI engine errors to HTTP status codes automatically.
- `createAiQuotaMiddleware('text_improve')` — enforces the per-plan monthly
  limit for `ai_text_improve` / `max_ai_text_improve_per_month`. Returns 403
  LIMIT_REACHED with an upgrade hint on exhaustion.
- `createAiRateLimitMiddlewares('text_improve')` — burst-control pair
  (per-user + per-IP sliding window) from
  `apps/api/src/middlewares/ai-rate-limit.ts`.
- Prompt resolution: `feature 'text_improve'` already has an in-code default
  fallback prompt in `src/engine/default-prompts.ts`; the admin can override
  it via `ai_prompt_versions` without a redeploy.
- Entitlement gate `ai_text_improve` and limit `max_ai_text_improve_per_month`
  are seeded in `@repo/billing`. Per the SPEC-173 §5.7 matrix, tourists do not
  have this entitlement — it is gated to `owner-*` and `complex-*` plans only.
- Content moderation runs at the engine level (input + output). A blocked
  response surfaces as `MODERATION_BLOCKED → HTTP 422` before the SSE stream
  starts (pre-stream) or as an `error` SSE event (post-drain output check).
- All usage is metered into `ai_usage` automatically by the engine.

### 2.3 What this spec must build

1. A `POST /api/v1/protected/ai/text-improve` route in `apps/api` using the
   above factories.
2. An "Improve with AI" affordance in the admin edit pages where text fields
   appear (scope: which fields exactly is an open question — §9).
3. Accept / reject UX: the suggestion is displayed alongside the original;
   the user must explicitly click accept to overwrite the field value.
4. Locale handling: the request carries the target locale so the model
   responds in the correct language.

## 3. Goals and Non-goals

### Goals

1. HOST (owner/complex plans only) can request AI-improved text for a field
   value, receive the suggestion streamed token-by-token, and accept or reject.
2. The original field text is NEVER silently overwritten — only an explicit
   accept action applies the suggestion.
3. The feature is gated to entitled plans; unentitled users see an upgrade
   prompt, not a broken UI.
4. Streaming provides perceived speed: text appears progressively.
5. Multi-locale: the suggestion is generated in the locale selected by the
   user or the accommodation's configured locale.
6. The quota (monthly call limit per plan) is enforced transparently.

### Non-goals

1. Tourist-facing surfaces — tourists do not have the `ai_text_improve`
   entitlement and this spec does not add one.
2. Web app (`apps/web`) surface — admin-only.
3. Suggestion history / revision trail — open question (§9.Q5), not assumed.
4. Bulk improvement of multiple fields in one request.
5. Any change to the AI engine, safety layer, or billing enforcement —
   those are SPEC-173 territory.
6. Auto-applying suggestions without user confirmation.

## 4. UX Flow Draft

> Note: exact component placement and interaction design are open questions
> (§9.Q2, §9.Q3). This is a draft for discussion.

1. The HOST opens an accommodation edit page in the admin panel.
2. For each eligible text field (see §9.Q1), an "Improve with AI" trigger is
   displayed inline (e.g., a small button/icon in the field toolbar).
3. The HOST clicks the trigger. A suggestion panel appears below (or beside)
   the field, initially showing a skeleton/loading state.
4. The admin frontend sends a `POST /api/v1/protected/ai/text-improve` with
   `{ fieldValue, fieldType, locale }`. The response is `text/event-stream`.
5. As `token` SSE events arrive, the suggestion panel fills with streaming
   text. The original field value remains unchanged and visible.
6. When the `done` event arrives, the streaming stops. The HOST sees:
   - The original text (read-only in this panel, or still in the field above).
   - The AI suggestion (in the panel).
   - Two actions: "Accept" and "Reject/Dismiss".
7. Accept: the field value in the form is replaced with the suggestion text.
   The HOST can continue editing from there.
8. Reject: the suggestion panel closes; the field is untouched.
9. If a quota error (403) or moderation block (422) occurs: the panel shows
   an inline error, never a page-level crash.
10. If the HOST's plan does not have the entitlement: the trigger is not
    rendered (or rendered as disabled with an upgrade tooltip). The 403 from
    the API is a double-safety net.

## 5. Architecture

### 5.1 API route

```
POST /api/v1/protected/ai/text-improve
Content-Type: application/json
Accept: text/event-stream
```

**Mount location**: `apps/api/src/routes/ai/protected/text-improve.ts`

**Route factory**: `createProtectedStreamingRoute` from
`apps/api/src/utils/streaming-route-factory.ts`.

**Middleware stack** (innermost listed first, applied in order by the factory):

1. `protectedAuthMiddleware()` — injected by `createProtectedStreamingRoute`
   automatically; rejects unauthenticated requests with 401.
2. `entitlementMiddleware()` — must already be mounted on the protected router
   (existing pattern; sets `userEntitlements`/`userLimits` in context).
3. `...createAiRateLimitMiddlewares('text_improve')` — burst control (2
   middlewares: per-user + per-IP) from
   `apps/api/src/middlewares/ai-rate-limit.ts`.
4. `createAiQuotaMiddleware('text_improve')` — monthly quota enforcement from
   `apps/api/src/middlewares/ai-quota.ts`.

**Request body** (Zod schema — to be defined in `@repo/schemas`):

```ts
// Proposed: packages/schemas/src/entities/ai/ai-text-improve.schema.ts
const AiTextImproveRequestSchema = z.object({
  fieldValue:  z.string().min(1).max(/* open question §9.Q6 */),
  fieldType:   z.enum(['title', 'summary', 'description', 'faq_answer', /* §9.Q1 */]),
  locale:      LanguageEnumSchema.optional(), // 'es' | 'en' | 'pt'
}).strict();
```

**Handler logic** (thin — no business logic in the route):

1. Parse and validate the request body with the schema above.
2. Obtain `aiService` via `createConfiguredAiService()`.
3. Build the prompt from `fieldValue`, `fieldType`, and `locale`.
4. Call `aiService.streamText({ feature: 'text_improve', prompt, locale })`.
5. Return `{ stream, meta }` to the factory.

The factory handles all SSE lifecycle, pre-stream error mapping, and
post-drain moderation error propagation.

**SSE protocol** (from the foundation — no changes):

```
event: token
data: {"delta":"..."}

event: done
data: {"usage":{...},"provider":"openai","model":"gpt-4o-mini","finishReason":"stop"}

event: error
data: {"code":"MODERATION_BLOCKED","message":"Content policy violation"}
```

**HTTP status codes before stream starts**:

| Condition | HTTP |
|-----------|------|
| Not authenticated | 401 |
| Plan lacks `ai_text_improve` entitlement | 403 ENTITLEMENT_REQUIRED |
| Monthly quota exceeded | 403 LIMIT_REACHED |
| Input moderation blocked | 422 MODERATION_BLOCKED |
| Feature disabled (kill-switch) | 503 FEATURE_DISABLED |
| Cost ceiling hit | 503 CEILING_HIT |
| All providers down | 502 ENGINE_EXHAUSTED |
| Request body invalid | 400 VALIDATION_ERROR |

### 5.2 Schemas (new)

A new schema file is needed in `@repo/schemas`:

- `packages/schemas/src/entities/ai/ai-text-improve.schema.ts`
  - `AiTextImproveRequestSchema` (input validation, per §5.1)
  - `AiTextImproveFieldTypeSchema` (enum of supported field types)
  - Corresponding TypeScript types

The `AiIntentSchema` from SPEC-173 (`packages/schemas/src/entities/ai/`) is
a foundation schema. This spec extends the AI schemas directory, not the
intent schema itself.

### 5.3 Frontend (admin panel)

**Location**: `apps/admin` — the admin accommodation edit page(s) built by
SPEC-154.

**Component structure** (draft — open question §9.Q2):

```
AccommodationEditPage
  └── EntityEditContent
        └── <TextFieldWithAi>         ← wraps existing field
              ├── <ExistingFieldControl />   (TipTap / textarea)
              └── <AiTextImprovePanel />     ← new component
                    ├── <AiTriggerButton />
                    ├── <StreamingTextDisplay />   (skeleton → streaming text)
                    └── <AcceptRejectActions />
```

**State management** (per field, not global):

- `status`: `idle | loading | streaming | done | error`
- `suggestion`: accumulated token string
- `error`: `{ code, message } | null`

**SSE client**: native `fetch` with `ReadableStream` (POST-SSE pattern — not
`EventSource`, which cannot POST). Parse `event:` and `data:` lines from the
stream.

**Entitlement gate**: before rendering the trigger, check the current user's
entitlements (available in admin auth context). If `ai_text_improve` is
absent: either hide the trigger entirely or show it disabled with an upgrade
tooltip. Open question §9.Q7.

**Styling**: Tailwind CSS v4 (admin convention).

### 5.4 Prompt construction

The route handler builds the prompt using `fieldValue`, `fieldType`, and
`locale`. Prompt engineering is the admin's responsibility via
`ai_prompt_versions`; there is a mandatory in-code default in
`src/engine/default-prompts.ts` (per SPEC-173 AC-12). The prompt should
instruct the model to:

- Improve grammar, clarity, and persuasion.
- Preserve the factual content — never invent features.
- Respond in the requested locale.
- Return only the improved text, no preamble.

The default prompt wording is a product decision not fixed here (open
question §9.Q8).

## 6. Data

### 6.1 New database tables

None expected. Every aspect of this feature relies on existing SPEC-173
tables:

- `ai_usage`: every call is metered automatically by the engine.
- `ai_request_log`: every call is logged (PII-scrubbed for telemetry).
- `ai_prompt_versions`: admin can manage the `text_improve` system prompt.

### 6.2 Suggestion persistence (open question)

Whether accepted or rejected suggestions are stored in a
`ai_text_improve_history` table is an **open question** (§9.Q5). The minimal
V1 answer is: no persistence — the suggestion is ephemeral in the frontend
until accept. If the user closes the browser the suggestion is gone. A
history table is not assumed by this spec.

## 7. Acceptance Criteria (Preliminary BDD)

- **AC-1 (gate)** — *Given* a HOST on `owner-basico` plan (which lacks
  `ai_text_improve` per the §5.7 matrix), *when* they call
  `POST /api/v1/protected/ai/text-improve`, *then* they receive 403
  ENTITLEMENT_REQUIRED before any model call is made.

  > Note: The SPEC-173 §5.7 matrix shows `owner-basico` has 20 `text_improve`
  > uses per month, so the gate IS present. This AC should use a tourist plan
  > (which has `—` in the matrix) as the blocked example. To be confirmed in
  > §9.Q1 discussion.

- **AC-2 (streaming)** — *Given* an entitled HOST, *when* they call the
  endpoint, *then* the response is `text/event-stream`, `token` events arrive
  incrementally, and a `done` event closes the stream.
- **AC-3 (accept-only mutation)** — *Given* a streaming suggestion is shown
  in the UI, *when* the HOST clicks "Reject", *then* the field value in the
  form is unchanged. *When* the HOST clicks "Accept", *then* the field value
  is replaced by the suggestion text.
- **AC-4 (quota)** — *Given* an `owner-basico` HOST who has consumed all 20
  monthly `text_improve` calls, *when* they invoke the feature, *then* they
  receive 403 LIMIT_REACHED with an upgrade hint, and the UI shows an inline
  error.
- **AC-5 (moderation)** — *Given* a request body containing content that
  triggers moderation, *then* the endpoint returns 422 before streaming
  begins; the UI shows an inline error, never a page crash.
- **AC-6 (locale)** — *Given* a request with `locale: 'en'`, *then* the AI
  suggestion is in English.
- **AC-7 (no silent overwrite)** — At no point in the UI flow does the form
  field value change without an explicit "Accept" user action.

## 8. Testing Strategy

### Unit tests

- Schema validation: `AiTextImproveRequestSchema` happy path + invalid
  `fieldType` + empty `fieldValue` + unknown locale.
- Route handler: with `StubProvider` (from SPEC-173), verify `streamText` is
  called with correct `feature = 'text_improve'` and the request body fields.
- Quota middleware: already tested in SPEC-173; verify correct wiring (the
  `'text_improve'` feature key flows through).

### Integration tests (`apps/api/test/integration/ai/`)

- Entitled HOST can call the endpoint and receive SSE stream.
- Tourist plan holder receives 403 ENTITLEMENT_REQUIRED.
- At-quota HOST receives 403 LIMIT_REACHED (meter row is written).
- Moderation-blocked input returns 422, no stream.
- Unauthenticated request returns 401.

### Frontend component tests (`apps/admin`)

- `AiTextImprovePanel` renders trigger button; clicking dispatches fetch.
- Accept action updates form field value.
- Reject action leaves form field value unchanged.
- Error state displayed on 403 / 422 responses.
- Streaming tokens accumulate in the display area.

### Coverage requirement

Minimum 90% on new code paths. 100% on the middleware wiring.

## 9. Open Questions (blocking before implementation)

### Q1 — Which fields exactly?

**Question**: Which accommodation fields should have the AI trigger? The
obvious candidates are: `title`/`name`, `summary`, `description`,
`faq_answer`. Are there others (e.g. `seo_title`, `seo_description`,
`review_response`)? Should FAQ answer improvement be in scope for V1?

**Impact**: drives `fieldType` enum values in `AiTextImproveRequestSchema`
and which form controls need to be wired.

**Why not decided here**: product scope decision. The owner must confirm the
V1 field set before implementation starts.

### Q2 — UX surface: inline vs. side-by-side diff

**Question**: Should the suggestion appear in a panel below the field
("stacked"), in a side-by-side diff view (original left, suggestion right),
or as an overlay/modal? For rich-text fields (TipTap), the interaction model
is more complex.

**Impact**: drives component architecture and the TipTap integration pattern.

**Why not decided here**: UX/product decision. Options carry different
implementation complexity (side-by-side diff is significantly harder).

### Q3 — Is the trigger always visible or only when the field is focused/dirty?

**Question**: Should the "Improve with AI" trigger be always visible on
eligible fields, or only appear when the HOST has focused or modified the
field?

**Impact**: affects the field wrapper component's event handling.

### Q4 — Plan gating visibility

**Question**: For a HOST whose plan lacks `ai_text_improve` (tourists, or
plans without the entitlement): should the trigger be hidden entirely, shown
as disabled, or shown with an upgrade tooltip?

**Impact**: frontend entitlement check logic and UX copy.

### Q5 — Persist suggestion history?

**Question**: Should accepted/rejected suggestions be stored in a
`ai_text_improve_history` table (for analytics, undo, or audit purposes)?

**Impact**: if yes, adds a new table (`ai_text_improve_history` with
`userId`, `accommodationId`, `fieldType`, `originalText`, `suggestedText`,
`action: 'accepted' | 'rejected'`, timestamps) and a service write on every
accept/reject action. If no, the feature is stateless on the server side.

**Why not decided here**: cost/value tradeoff. A history table is useful for
analytics on AI adoption but adds schema + migration work. V1 could start
without it.

### Q6 — Maximum input length

**Question**: What is the maximum `fieldValue` character length the API
should accept? Description fields can be several thousand characters; sending
a very large prompt has token cost implications and may exceed model context
limits.

**Impact**: drives the `.max(N)` constraint on `AiTextImproveRequestSchema`.

**Suggested starting point**: 5,000 characters for description, 500 for
title/summary. To be confirmed by the owner.

### Q7 — Accept counts as a content edit for audit/moderation?

**Question**: When the HOST accepts an AI suggestion and saves the
accommodation, should the audit log distinguish "AI-assisted edit" from a
manual edit? Should the accepted text pass through a final moderation check
before saving?

**Impact**: if yes, the accept action might need an additional server-side
step (save suggestion + trigger moderation + flag as AI-assisted). If no, the
accept is purely a frontend action that populates the form field and the
normal accommodation save flow handles it.

### Q8 — Default prompt wording

**Question**: What should the mandatory in-code default system prompt say for
`text_improve`? The model must know it should improve, not fabricate.

**Impact**: quality of suggestions. Needs product approval before merging the
in-code default.

### Q9 — Admin-only or also web app?

**Question**: Should this feature ever appear in `apps/web` (e.g. a "host
dashboard" in the web app)? Or is it strictly admin-panel-only?

**Impact**: if admin-only, the API route and frontend live entirely in
`apps/api` and `apps/admin`. If the web app needs it, the route tier changes
(it is already `/protected/` so it can serve both, but the frontend component
would need to be added to `apps/web` too — and web does not use TanStack Form
or Tailwind).

## 10. Risks

### R-1 — Rich text field complexity (TipTap)

**Probability**: High
**Impact**: Medium
**Description**: The `description` field uses TipTap (a rich-text editor).
Replacing its content with streamed plain text may lose formatting. Accepting
an AI suggestion into a rich-text field requires either: (a) treating the
suggestion as plain text and converting to TipTap document format, or (b)
requesting the model to output Markdown and rendering it in TipTap.

**Mitigation**: Explicitly define in Q1 whether `description` is in scope for
V1. If it is, decide the Markdown/HTML approach before implementation. This
is a non-trivial integration.

### R-2 — Token cost per improvement call

**Probability**: Medium
**Impact**: Medium
**Description**: If `description` fields with several thousand characters are
in scope, each improvement call consumes significant tokens (input + output).
The monthly limit per plan (e.g. 20 calls for `owner-basico`) may be
exhausted quickly.

**Mitigation**: Cap input length (Q6), set conservative monthly limits, and
ensure the quota/cost ceiling from SPEC-173 fires correctly.

### R-3 — Network interruption during streaming

**Probability**: Medium
**Impact**: Low
**Description**: The SSE connection may drop mid-stream. The frontend must
handle partial suggestions gracefully (show what arrived, indicate
interruption, offer retry).

**Mitigation**: Frontend error boundary in the streaming state machine; the
partial suggestion should be discardable.

### R-4 — Quota middleware entitlement check for tourist plans

**Probability**: Low
**Impact**: High
**Description**: The SPEC-173 §5.7 matrix shows tourists have no
`ai_text_improve` entitlement (column is `—`). If the entitlement check
fails open during a billing outage, a tourist could invoke text improvement.
The ai-quota middleware already handles `billingLoadFailed` with a 503, so
this is covered. Verify the 503 path in integration tests.

**Mitigation**: Integration test covering the `billingLoadFailed=true` path.

## 11. Dependencies

### Internal (upstream, must exist before implementation)

- SPEC-173 (completed) — all foundation exports used in §5.1 are shipped.
- SPEC-154 — accommodation edit page architecture. The frontend components
  must slot into that page's field layout.
- `@repo/schemas` — new `ai-text-improve.schema.ts` is a new file in an
  existing package; no breaking changes expected.

### External packages

No new external packages expected. All SSE, streaming, and AI primitives are
provided by the SPEC-173 foundation.

## 12. Migration and Rollback

### Database migrations

None expected (no new tables for V1 minimal path; see Q5 for optional history
table).

### Rollback

Because the feature is a new route + new frontend component with no schema
migrations, rollback is straightforward: revert the route file and remove
the frontend component. The admin prompt in `ai_prompt_versions` would need
to be deleted if one was seeded — soft-delete is sufficient.

## 13. Technical Debt

### Known trade-offs

- V1 does not persist suggestion history (Q5). This reduces analytics
  insight into AI adoption. A `ai_text_improve_history` table could be added
  in a V2 without breaking changes.
- TipTap rich-text handling is deferred to Q1/R-1 resolution. V1 may
  initially support only plain-text fields.

### Future improvements

- Batch field improvement (improve all eligible fields at once).
- Suggestion history with undo.
- A/B testing on prompt variants via the admin versioned-prompts system.

## Key Learnings

1. The SPEC-173 §5.7 plan matrix shows `owner-basico` with 20 `text_improve`
   calls/month — tourists have the gate absent (`—`), not a zero limit; the
   entitlement key itself is missing. This distinction matters for how AC-1
   should be written (403 ENTITLEMENT_REQUIRED, not LIMIT_REACHED).
2. `createProtectedStreamingRoute` auto-injects `protectedAuthMiddleware` and
   handles SSE lifecycle, error mapping, and body validation — the route
   handler only needs to call `aiService.streamText` and return `{stream, meta}`.
3. `AiIntentSchema` is a foundation primitive for child specs B and C only
   (extractIntent path). Text improvement uses `streamText`, not
   `extractIntent` — it does not consume `AiIntentSchema`.
4. The accommodation search schema (`AccommodationSearchHttpSchema`) is the
   ground truth for which filter dimensions exist for SPEC-199 intent mapping.
5. `ai_text_improve_history` is a genuine open question — not a foregone
   conclusion. V1 can be stateless server-side.
