---
id: SPEC-200
slug: ai-support-assistant
title: AI Support Assistant
status: draft
owner: qazuor
created: 2026-06-05
parentSpec: SPEC-173
relatedSpecs:
  - SPEC-173
  - SPEC-145
  - SPEC-143
  - SPEC-168
tags:
  - ai
  - feature
  - support
  - rag
  - admin
---

# SPEC-200 — AI Support Assistant

> ⛔ **DECISION PROTOCOL (read first, applies to the whole spec):** In every
> single case — without exception — if a change or decision is not *extremely*
> clear-cut, if there is even the slightest ambiguity, or if there is more than
> one viable option, **STOP and consult the owner (qazuor)**. Do not decide
> autonomously. See SPEC-173 §12.

## 1. Summary

Add an AI assistant that answers questions about Hospeda by retrieving and
injecting relevant documentation as context. This is **child D** of SPEC-173
(§4): "Admin tech-support assistant (RAG over Hospeda docs corpus)."

However, the approved billing matrix in SPEC-173 §5.7 grants the `ai_support`
entitlement to **all plans including tourist-free** (5/month), which implies the
feature may be intended for end-users, not only internal staff. **This tension is
the central unresolved question of this spec and must be resolved by the owner
before any implementation begins** (see §9 Q-1).

This spec is written as a **dual-reading draft**: Section 5 presents the UX flows
for both the admin/internal interpretation (Reading A) and the end-user
interpretation (Reading B). Architecture (§6), schema (§7), and ACs (§8) are
written to be compatible with either reading, calling out where the decision
changes the implementation.

## 2. Context

### 2.1 Foundation surface available (verified, SPEC-173 shipped)

| Foundation export | Used by this feature |
|-------------------|----------------------|
| `createConfiguredAiService()` | Factory for the `AiService` instance |
| `aiService.generateText(request)` or `aiService.streamText(request)` | Response generation (streaming vs. single-shot is open — §9 Q-4) |
| `createProtectedStreamingRoute` | Route factory for SSE streaming (if Q-4 resolves to streaming) |
| `createAiQuotaMiddleware('support')` | Enforces `ai_support` gate + `max_ai_support_per_month` limit |
| `createAiRateLimitMiddlewares('support')` | Sliding-window anti-burst per user + per IP |
| `resolveSystemPrompt('support')` | Resolves admin-managed prompt; falls back to in-code default |
| Input/output moderation | Applied automatically inside the engine |
| PII scrubber | Applied before Sentry/PostHog telemetry |

The `ai_support` entitlement gate and `max_ai_support_per_month` limit key exist
in the enums and `ENTITLEMENT_DEFINITIONS`, but are **NOT currently seeded** in
any plan (removed 2026-06-05 per owner decision — see §9 Q-1 note). Plans are
runtime-editable (SPEC-168); re-granting is a one-line change per plan once the
audience is decided.

The audience ambiguity in §9 Q-1 remains the blocking prerequisite for any
implementation.

### 2.2 What does NOT exist yet

- A support API route (`/api/v1/protected/ai/support` or `/api/v1/admin/ai/support`
  — route tier depends on audience decision, §9 Q-1).
- A docs corpus retrieval mechanism (see §9 Q-2 and Q-3).
- A client-side UI surface (admin panel page vs. web help widget, §5).
- The in-code default prompt for the `'support'` feature.

### 2.3 Docs corpus that exists today (candidate source material)

The following content exists in the repo and is potentially usable as support
corpus:

| Source | Nature | Size estimate |
|--------|--------|---------------|
| `docs/guides/` | Step-by-step developer / operator guides | ~20 Markdown files |
| `apps/*/CLAUDE.md` | App-specific technical notes | 5-6 files |
| `packages/*/CLAUDE.md` | Package-specific notes (dev-facing) | ~12 files |
| `packages/i18n/src/locales/es.json` | User-facing strings | ~1 500 keys |
| FAQ content in the DB (`accommodation_faqs`) | Property-specific (not platform help) | N/A for platform support |

The guides in `docs/guides/` are the most relevant for an admin/operator audience.
For an end-user audience, none of the above is directly suitable — end-user help
content does not yet exist in a structured form (see §9 Q-2).

## 3. Goals

1. Give the target audience (to be decided — see §9 Q-1) a natural-language
   interface to ask questions about Hospeda and get answers grounded in relevant
   documentation.
2. Reuse the foundation's safety, metering, moderation, and prompt resolution
   with zero changes to `@repo/ai-core`.
3. Restrict answers to Hospeda-specific content; the in-code default prompt must
   include an explicit directive to decline general-knowledge questions (inherited
   from SPEC-173 R-3 prompt injection / off-brand output risk).
4. Provide a clear escalation path to human support when the assistant cannot
   answer (see §9 Q-5).

## 4. Non-Goals (V1)

- No embeddings / pgvector / semantic search over a vector corpus — SPEC-173
  explicitly excludes vector infra in V1. Corpus retrieval in V1 is structured
  text injection (see §9 Q-3).
- No anonymous (logged-out) usage — explicitly excluded by SPEC-173 §5.7.
- No live content ingestion pipeline — corpus is static or admin-maintained
  (see §9 Q-3).
- No ticket / issue creation from within the assistant in V1.

## 5. UX Flow (Draft — two readings)

### 5A. Reading A: Internal admin / staff assistant

**Assumption**: the assistant is for SUPER_ADMIN / ADMIN / EDITOR staff who need
quick answers about platform configuration, billing settings, deployment, and
operational procedures.

**Surface**: a dedicated page in the admin panel (`apps/admin`) — e.g.
`/platform/support` under the Plataforma section.

**Flow**:

1. Staff navigates to the support page (requires `ACCESS_PANEL_ADMIN` permission
   or a new `AI_SUPPORT_USE` permission — to be decided, §9 Q-6).
2. Types a question (e.g. "How do I rotate a provider API key?" / "What does the
   exchange-rate cron do?").
3. The admin app POSTs to `/api/v1/admin/ai/support` (admin tier).
4. The API assembles the relevant docs context, calls `aiService.generateText` or
   `aiService.streamText`, and returns the answer.
5. The admin panel displays the answer inline. Multi-turn optional (Q-4).

**Corpus**: `docs/guides/` Markdown + `packages/*/CLAUDE.md` + `apps/*/CLAUDE.md`.
These are authoritative, dev-maintained, and already describe operational
procedures. No end-user concerns.

### 5B. Reading B: End-user help assistant

**Assumption**: the assistant is for tourists and hosts who need help using the
Hospeda platform — how to list a property, how to manage a booking, how to update
their profile, what each plan includes.

**Surface**: a help widget in `apps/web` (e.g. floating "?" button, or a dedicated
`/help` page), accessible to any logged-in user.

**Flow**:

1. User clicks the help widget from any page.
2. Types a question (e.g. "How do I add photos to my listing?" / "What's included
   in the Pro plan?").
3. `apps/web` POSTs to `/api/v1/protected/ai/support` (protected tier).
4. The API assembles user-facing help content, calls `aiService.generateText` or
   `aiService.streamText`, and returns the answer.
5. The widget displays the answer; optionally shows a "Contact support" link if the
   assistant expresses low confidence.

**Corpus**: user-facing help content (does NOT exist yet — see §9 Q-2 and Q-3).
The `docs/guides/` files and `CLAUDE.md` files are developer-facing and
inappropriate for end-user responses.

### 5C. Reading C: Both audiences, separate corpora

Two instances of the same underlying capability, each with its own:

- Route tier (admin vs. protected).
- Corpus source.
- System prompt.
- Quota key (currently a single `ai_support` key — would need splitting or the
  same key used for both, accepting shared quota).

This is the highest-complexity option and requires the most corpus investment.

## 6. Architecture

### 6.1 API Route

Route tier and path depend on audience decision (§9 Q-1):

| Reading | Route | Auth tier |
|---------|-------|-----------|
| A (admin) | `POST /api/v1/admin/ai/support` | Admin session + `AI_SUPPORT_USE` or `AI_SETTINGS_MANAGE` |
| B (end-user) | `POST /api/v1/protected/ai/support` | User session |
| C (both) | One of each | Both |

**Middleware stack** (applied in order, same for all readings):

1. `createAiRateLimitMiddlewares('support')` — burst control.
2. `createAiQuotaMiddleware('support')` — monthly limit enforcement.

**Route factory**: `createProtectedStreamingRoute` if streaming (§9 Q-4);
otherwise a standard Hono route returning a JSON response via `ResponseFactory`.

**Route module location**: `apps/api/src/routes/ai/support/support.route.ts`.

### 6.2 Corpus Retrieval (V1)

Per the SPEC-173 non-goals, no vector embeddings in V1. Three candidate approaches
for V1 corpus retrieval — the choice is an open question (§9 Q-3):

#### Option A — Static curated Markdown bundle

One or more Markdown files (e.g. `packages/ai-core/src/corpus/support-admin.md`,
`support-user.md`) hand-curated to contain the most commonly needed answers. The
route reads the file at startup (or imports it as a string literal). The entire
bundle is injected as context on every request.
Pros: zero DB dependency; trivial to implement; easy to review and update via PR.
Cons: no per-query relevance ranking; large bundles inflate token cost; updating
requires a deploy.

**Option B — DB table of help articles**
A new `ai_help_articles` table with columns `(id, audience, title, content,
tags, is_active)`. Admin can CRUD articles from the admin panel. The route fetches
all active articles for the relevant audience and injects them.
Pros: admin-editable without a deploy; supports future keyword/tag filtering.
Cons: requires a new migration + model + admin CRUD UI; more scope.

**Option C — Hybrid (static fallback + admin DB overlay)**
Ship with a static bundle; add admin DB articles that override or supplement.
Pros: works on day one; evolves over time.
Cons: two retrieval paths to maintain; merge logic needed.

**Note**: any of these options is a structured-text injection into the system
message. The "caller-wins" prompt injection contract (README §Configuration) means
the route can prepend the corpus block to `resolveSystemPrompt('support')` without
conflict.

### 6.3 Locale Handling

Same as SPEC-199: optional `locale: 'es' | 'en' | 'pt'` in the request,
defaulting to `'es'`. Forwarded to `aiService.generateText` or
`aiService.streamText`.

### 6.4 Permission Model

If Reading A (admin), a new `AI_SUPPORT_USE` permission entry in `PermissionEnum`
may be needed, or the feature may reuse `ACCESS_PANEL_ADMIN`. Decision depends on
whether support use should be independently grantable (see §9 Q-6).

## 7. Schema Design (Draft)

### 7.1 Request Schema (in `@repo/schemas`)

```ts
// packages/schemas/src/ai/support-request.schema.ts
AiSupportRequestSchema: {
  query: z.string().min(1).max(2000),
  locale: z.enum(['es', 'en', 'pt']).optional(),
  // conversationId is optional if multi-turn is supported (see Q-4)
  conversationId: z.string().uuid().optional(),
}
```

### 7.2 Response

If single-shot (`generateText`):

```ts
// Standard JSON via ResponseFactory
{
  success: true,
  data: {
    answer: string,
    tokensIn: number,
    tokensOut: number,
    provider: string,
    model: string,
  }
}
```

If streaming (`streamText`):
Same named SSE events as SPEC-199: `token` / `done` / `error`.

### 7.3 Optional: Help Articles Table (Option B corpus)

If §9 Q-3 resolves to Option B, a new migration adds:

```
ai_help_articles
  id            uuid PK
  audience      text  -- 'admin' | 'user' | 'both'
  title         text NOT NULL
  content       text NOT NULL  -- Markdown
  tags          text[]
  is_active     boolean DEFAULT true
  created_at    timestamptz
  updated_at    timestamptz
  deleted_at    timestamptz  -- soft delete per project convention
```

This table does NOT exist yet; implementation depends on Q-3.

## 8. Acceptance Criteria (Preliminary)

- **AC-1 (auth wall)** — Unauthenticated request to the support endpoint returns
  401; no provider call is made.
- **AC-2 (quota 403)** — A tourist-free user who has consumed their 5-request
  monthly allowance receives a `403` with upgrade hint on the 6th request; the
  attempt is metered.
- **AC-3 (grounded answer)** — The assembled context contains at least one
  relevant corpus entry; this is verifiable in tests by inspecting the system
  message passed to `StubProvider`.
- **AC-4 (off-topic refusal instruction)** — The in-code default prompt contains
  an explicit instruction to decline questions outside the Hospeda domain; verified
  by asserting the prompt text in tests with `StubProvider`.
- **AC-5 (locale passthrough)** — When `locale: 'en'` is in the request, it is
  forwarded to the AI service; when omitted, `'es'` is used.
- **AC-6 (kill-switch)** — When the `ai_support` feature flag is disabled in admin
  settings, the endpoint returns `503` immediately.
- **AC-7 (moderation path, if streaming)** — Same as SPEC-199 AC-6: a flagged
  output emits an `error` SSE event; no `done` event follows.
- **AC-8 (permission, if Reading A)** — A request from a user without the required
  admin permission returns `403`; a request from SUPER_ADMIN succeeds.

## 9. Open Questions

> These are unresolved product/technical decisions. The top question (Q-1) is a
> blocking prerequisite for ALL other sections. Do not implement any part of this
> feature until Q-1 is resolved.

### Q-1 (BLOCKING) — Audience: internal admin, end-user, or both?

> **2026-06-05 owner decision (seed grants removed as safe default):** The
> `ai_support` entitlement and `max_ai_support_per_month` limit have been
> **removed from all plan seed configs** in `packages/billing/src/config/plans.config.ts`
> pending resolution of this question. The keys remain defined in the enums and
> `ENTITLEMENT_DEFINITIONS` — re-granting is a trivial one-line change per plan
> once the audience is decided. Plans are runtime-editable from the admin panel
> (SPEC-168) so the grant can also be toggled without a code deploy.

**This is the central design fork.** SPEC-173 §4 describes this as an
"Admin tech-support assistant (RAG over Hospeda docs corpus)," which reads as
internal/staff. However, SPEC-173 §5.7 originally granted `ai_support` to
tourist-free users (5/month), which implied end-user scope (now removed — see
note above).

The two readings are not compatible in one important dimension: **corpus source**.
Internal staff need answers about deployment, billing configuration, and operational
procedures. End-users need answers about how to use the product. These are
different documents.

#### Option A — Internal admin/staff assistant (literal §4 scope)

- Route: admin tier (`/api/v1/admin/ai/support`).
- Corpus: `docs/guides/` + operator/developer CLAUDE.md files.
- UI: admin panel page (Plataforma section).
- Tourist entitlement (`ai_support` with 5/month) would be unused / a mistake.
  If A is chosen, the seed matrix for tourist plans should be reconsidered.

#### Option B — End-user help assistant

- Route: protected tier (`/api/v1/protected/ai/support`).
- Corpus: user-facing help content (DOES NOT EXIST YET — requires authoring).
- UI: web app help widget.
- The tourist entitlement grants make sense.
- The admin panel has no AI support surface.

#### Option C — Both, with separate corpora

- Two routes (admin + protected).
- Two corpora (operator docs + user help content).
- Shared `ai_support` quota key (tourists and staff consume the same monthly
  bucket) — OR two separate entitlement keys (requires billing schema change).
- Highest scope; most flexible.

**Impact summary**:

| Dimension | Option A | Option B | Option C |
|-----------|----------|----------|----------|
| Route tier | admin | protected | both |
| Corpus exists today? | Partially (docs/guides) | No | Partially |
| Tourist entitlement used? | No (waste) | Yes | Yes |
| New permission needed? | Possibly | No | Possibly |
| Implementation scope | Medium | Medium-High (corpus authoring) | High |

**Owner must decide.** This decision gates every other section.

### Q-2 — User-facing help content: does it exist?

If Option B or C is chosen (§9 Q-1), user-facing help articles do not currently
exist in a structured form. The `@repo/i18n` locale files contain UI strings, not
explanatory help content. Authoring this corpus is a product/content effort, not
purely an engineering task.

**Impact**: if user-facing content is required, the spec must include a corpus
authoring workstream or defer to a follow-up task. Engineering can build the
framework, but the content needs to come from somewhere.

### Q-3 — V1 corpus retrieval strategy: static bundle, DB table, or hybrid?

See §6.2 for the three options (A/B/C) with pros/cons. The owner must decide
before implementation:

- Option A (static Markdown bundle) is the fastest to ship and simplest.
- Option B (DB table + admin CRUD) enables non-deploy updates but expands scope.
- Option C (hybrid) is the safest long-term but the most complex.

**Recommendation**: start with Option A (static bundle) and migrate to Option B
in a follow-up spec once the corpus content is validated.

### Q-4 — Streaming vs. single-shot response

Support queries are typically question-answer exchanges, not conversational flows.
Single-shot `generateText` may be simpler and more appropriate than SSE streaming.

#### Option A — Single-shot (`generateText` → JSON response)

Pros: simpler client; no SSE event handling; JSON cacheable.
Cons: user sees nothing until the full answer arrives; feels slow for long answers.

**Option B — Streaming (`streamText` → SSE)**
Pros: perceived responsiveness; consistent with SPEC-199 (chat).
Cons: more complex client and server code; requires `createProtectedStreamingRoute`.

**Recommendation**: Single-shot for V1 (Option A) unless the corpus context +
response length justifies streaming. The default prompt should aim for concise
answers to keep latency low.

### Q-5 — Escalation path when the assistant cannot answer

When the model cannot answer from the available corpus, what should happen?

**Option A — Model declines politely** (default prompt handles this)
Simplest. The in-code prompt instructs the model to say "I don't have information
on that" and suggest contacting support manually.

**Option B — "Contact support" CTA appended to low-confidence answers**
Requires a signal from the API (a `low_confidence` flag in the response) and
frontend handling.

**Option C — Automatic ticket creation from the assistant**
Out of scope for V1 (§4 Non-Goals).

**Recommendation**: Option A for V1; Option B as a V2 polish.

### Q-6 — Permission model for admin reading

If Reading A (admin assistant), should the support feature require a dedicated
`AI_SUPPORT_USE` permission, or is `ACCESS_PANEL_ADMIN` (which all admin-panel
users have) sufficient?

#### Option A — `ACCESS_PANEL_ADMIN` is sufficient

Any staff member who can log into the admin panel can use it. No new permission.
Simplest.

**Option B — New `AI_SUPPORT_USE` permission**
Granular control (e.g. exclude billing-only staff from AI support).
Adds a new PermissionEnum entry and role-permission seed row.

If Reading B (end-user), no admin permission is needed — the protected middleware
plus the `ai_support` entitlement is the gate.

### Q-7 — Multi-turn conversation for the support assistant

Should the support assistant support follow-up questions within a session (like
SPEC-199 chat), or is it single-query?

#### Option A — Single-query (stateless)

Simpler; support questions are often self-contained.

**Option B — Multi-turn (client-held or server-persisted history)**
Same tradeoffs as SPEC-199 §9 Q-1. More useful for diagnostic walkthroughs.

This decision affects whether `ai_conversations` / `ai_messages` are used, and
whether the request schema needs a `messages` array (like SPEC-199) or just a
`query` string.

### Q-8 — Corpus update workflow

How will the corpus be kept up to date as Hospeda evolves?

- Option A (static bundle): update by opening a PR. Fast but requires a deploy.
- Option B (DB articles): admin CRUD — no deploy needed, but requires someone to
  maintain the articles.

The update cadence and ownership (engineering vs. product) needs a decision before
committing to a corpus strategy.

## 10. Risks

### R-1 — Stale corpus answers

**Probability**: High over time. **Impact**: Medium (user gets outdated info).
**Mitigation**: static bundles are reviewed on schema/config changes; DB articles
have `is_active` for deprecation. An explicit "last reviewed" timestamp per
article is a V2 improvement.

### R-2 — Scope creep into general LLM chat

**Probability**: Medium. **Impact**: Medium (cost and off-brand output).
**Mitigation**: the in-code default prompt for `'support'` must include an
explicit restriction directive. The foundation's prompt fallback guarantees this
directive is always active (AC-12 contract from SPEC-173). Even if an admin
overrides the prompt, the in-code default applies if the override is empty/invalid.

### R-3 — Corpus authoring gap (if end-user audience chosen)

**Probability**: High (the content doesn't exist). **Impact**: High (feature
cannot ship without content).
**Mitigation**: resolve Q-1 early. If Option B or C is chosen, plan the content
authoring workstream separately before the engineering spec advances to tasks.

### R-4 — Wrong audience assumption baked into route tier

**Probability**: Low (it's an open question). **Impact**: High (wrong auth tier
means either tourists can't use it or internal staff need separate auth).
**Mitigation**: this is exactly why Q-1 is blocking. The route tier choice is the
single most load-bearing decision in this spec.

### R-5 — Shared `ai_support` quota key if both audiences coexist

**Probability**: Low (only relevant if Reading C). **Impact**: Medium (staff and
tourist usage compete for the same monthly bucket).
**Mitigation**: if Reading C is chosen, evaluate splitting into two keys
(`ai_support_admin` + `ai_support_user`) — requires a billing schema change.

## 11. Implementation Order (Sketch — subject to Q-1 decision)

1. Resolve §9 Q-1 (audience) and §9 Q-3 (corpus strategy). No code until these
   are answered.
2. `@repo/schemas` — `AiSupportRequestSchema` + response types.
3. If corpus = Option B: migration for `ai_help_articles` + model + admin CRUD.
4. Corpus assembly utility (reads static bundle or DB articles, returns context
   string).
5. In-code default prompt for `'support'` feature (in foundation's
   `src/engine/default-prompts.ts`).
6. `apps/api` — support route with middleware stack.
7. `apps/api` — route tests with `StubProvider` (all ACs).
8. Frontend surface (admin panel page OR web widget — depends on Q-1).

## 12. Dependencies

### Internal

- `@repo/ai-core` — `createConfiguredAiService`, `generateText` or `streamText`,
  foundation safety (all shipped, SPEC-173).
- `@repo/db` — potential `ai_help_articles` table (new, if corpus = Option B);
  `ai_usage`, `ai_conversations`, `ai_messages` (shipped).
- `@repo/schemas` — new `AiSupportRequestSchema` (to be added).
- `@repo/billing` — `ai_support` entitlement key, `max_ai_support_per_month`
  limit key (seeded, SPEC-173 T-030).
- `apps/api` — `createAiQuotaMiddleware`, `createAiRateLimitMiddlewares` (shipped);
  `createProtectedStreamingRoute` (if streaming chosen, §9 Q-4).

### External

None. All provider calls are routed through the foundation.

## 13. Decisions Checklist

- [ ] Q-1 (BLOCKING): Audience chosen — A (admin) / B (end-user) / C (both).
- [ ] Q-2: Corpus content source confirmed or authoring workstream planned.
- [ ] Q-3: Corpus retrieval strategy — static bundle / DB table / hybrid.
- [ ] Q-4: Response mode — single-shot or streaming.
- [ ] Q-5: Escalation path — model-decline only, or CTA.
- [ ] Q-6: Permission model for admin reading (if Reading A).
- [ ] Q-7: Multi-turn support — yes or no.
- [ ] Q-8: Corpus update ownership and cadence.

## Key Learnings

1. The core tension in this spec is a direct contradiction between SPEC-173 §4 (admin/internal framing) and §5.7 (tourist entitlements seeded with non-zero limits) — both are source-of-truth claims from the same parent spec. Resolving Q-1 is the single most important prerequisite.
2. No user-facing help content exists today in a structured form. If the end-user reading (B or C) is chosen, corpus authoring is a blocking non-engineering prerequisite before the feature can ship.
3. The `docs/guides/` files are valid admin corpus candidates today but are developer/operator-facing and unsuitable for tourist-facing answers.
4. The `ai_support` quota key is already seeded in all plans (SPEC-173 T-030); if Reading C (both) is chosen and separate keys are needed (`ai_support_admin` vs. `ai_support_user`), that requires a billing schema change outside this spec.
5. Single-shot `generateText` is likely more appropriate than streaming for question-answer support interactions (lower client complexity, cacheable JSON), unless the corpus context is large enough that streaming meaningfully reduces perceived latency.
