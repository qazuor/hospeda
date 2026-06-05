---
id: SPEC-200
slug: ai-accommodation-chat
title: AI Accommodation Chat (Tourist Feature)
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
  - chat
  - tourist
  - streaming
  - rag
---

# SPEC-200 — AI Accommodation Chat (Tourist Feature)

> ⛔ **DECISION PROTOCOL (read first, applies to the whole spec):** In every
> single case — without exception — if a change or decision is not *extremely*
> clear-cut, if there is even the slightest ambiguity, or if there is more than
> one viable option, **STOP and consult the owner (qazuor)**. Do not decide
> autonomously. See SPEC-173 §12.

## 1. Summary

Add a conversational AI widget to accommodation detail pages in `apps/web` that
allows a logged-in tourist to ask natural-language questions about a specific
accommodation. The backend streams answers via SSE; answers are grounded in the
accommodation's structured data (descriptions, amenities, FAQs, pricing tiers,
location). Multi-turn context is maintained within a session.

This is **child C** of SPEC-173 (§4). It consumes the shipped foundation — the
`AiService` from `createConfiguredAiService()`, `createProtectedStreamingRoute`,
`createAiQuotaMiddleware`, `createAiRateLimitMiddlewares`, versioned prompts, and
the `ai_conversations` / `ai_messages` tables already defined in `@repo/db` — and
adds nothing to those layers.

## 2. Context

### 2.1 Foundation surface available (verified, SPEC-173 shipped)

| Foundation export | Used by this feature |
|-------------------|----------------------|
| `createConfiguredAiService()` | Factory for the `AiService` instance; credentials pre-decrypted |
| `aiService.streamText(request)` | Streaming response over SSE (`{ stream, meta }`) |
| `createProtectedStreamingRoute` | Route factory in `apps/api`; emits named SSE events `token` / `done` / `error` |
| `createAiQuotaMiddleware('chat')` | Enforces `ai_chat` entitlement gate + `max_ai_chat_per_month` limit |
| `createAiRateLimitMiddlewares('chat')` | Sliding-window anti-burst rate limit per user + per IP |
| `ai_conversations` table | Stores multi-turn conversation containers |
| `ai_messages` table | Stores individual messages (role, content, tokens, provider) |
| `resolveSystemPrompt('chat')` | Resolves active admin-managed prompt; falls back to in-code default |
| Input/output moderation | Applied automatically inside the engine; post-stream throw on violation |
| PII scrubber | Applied before Sentry/PostHog telemetry |

The `ai_chat` entitlement gate and `max_ai_chat_per_month` limit key are already
seeded across all plans (SPEC-173 §5.7):

| Plan | ai_chat gate | max_ai_chat_per_month |
|------|-------------|-----------------------|
| tourist-free | yes | 10 |
| tourist-plus | yes | 50 |
| tourist-vip | yes | -1 (unlimited) |
| owner-basico | yes | 20 |
| owner-pro | yes | 100 |
| owner-premium | yes | -1 |
| complex-basico | yes | 30 |
| complex-pro | yes | 150 |
| complex-premium | yes | -1 |

### 2.2 What does NOT exist yet

- A chat API route (`/api/v1/protected/ai/chat`).
- Accommodation context assembly logic (fetching the entity + its FAQs and
  injecting them as a system message).
- A client-side chat widget component in `apps/web`.
- Conversation persistence wiring (the tables exist; nothing writes to them yet).

## 3. Goals

1. Let any logged-in tourist ask questions about a single accommodation and get
   streamed, grounded answers.
2. Maintain multi-turn context within a session (messages array sent from the
   client on each turn; context window managed by the caller).
3. Reuse the foundation's safety, metering, moderation, and prompt resolution
   with zero changes to `@repo/ai-core`.
4. Provide a clear in-code default prompt (mandatory per AC-12) that instructs
   the model to answer grounded questions only and decline off-topic requests.

## 4. Non-Goals (V1)

- No embeddings / pgvector / semantic search over accommodation corpora — SPEC-173
  explicitly excludes vector infra in V1. Context is injected as structured text.
- No cross-property chat (this conversation is scoped to **one** accommodation).
- No real-time availability / booking integration — availability data is not part
  of the injected context (see §9 Open Questions).
- No host-side conversation visibility or analytics in V1.
- No unauthenticated (anonymous) usage — explicitly excluded by SPEC-173 §5.7.

## 5. UX Flow (Draft)

1. Tourist navigates to an accommodation detail page in `apps/web` (logged in).
2. A **chat widget** is visible — collapsed by default, expandable inline or as a
   floating overlay (exact placement is an open question; see §9 Q-3).
3. Tourist types a question (e.g. "Is there a pool?" / "How far is the beach?").
4. The widget POSTs to `/api/v1/protected/ai/chat` with the `accommodationId`,
   the current `messages` array, and the user's `locale`.
5. The API assembles accommodation context (see §6.2), calls
   `aiService.streamText(...)`, and adapts the async iterable to SSE via
   `createProtectedStreamingRoute`.
6. The widget receives SSE events:
   - `token` — append chunk to the in-progress assistant bubble.
   - `done` — finalize the bubble, display token/cost metadata if desired.
   - `error` — discard the in-progress bubble and show an error message. **Clients
     MUST implement this path** — output moderation can throw `AiModerationBlockedError`
     after tokens were already shown; on `error` event the already-rendered content
     must be replaced with an error message.
7. The exchange is appended to `messages` in client state for the next turn.

### 5.1 Moderation client contract (inherited from foundation)

The SSE `error` event is the canonical signal for a post-stream moderation block.
The client widget must:

- Track whether any `token` events have been rendered for the current turn.
- On receiving `error`, clear any rendered partial content for that turn and
  display a neutral error message ("No se pudo mostrar la respuesta").
- Never persist flagged content on the client.

## 6. Architecture

### 6.1 API Route

```
POST /api/v1/protected/ai/chat
```

- **Auth**: session-required (protected tier — 401 if unauthenticated).
- **Middleware stack** (applied in order):
  1. `createAiRateLimitMiddlewares('chat')` — burst control.
  2. `createAiQuotaMiddleware('chat')` — monthly limit enforcement (403 +
     upgrade hint on exhaustion).
- **Route factory**: `createProtectedStreamingRoute` — wraps the handler, sets
  `Content-Type: text/event-stream`, emits `token` / `done` / `error` events.
- **Route module location**: `apps/api/src/routes/ai/chat/chat.route.ts`.

### 6.2 Context Assembly

The route handler (or a thin service in `apps/api`) fetches:

1. Accommodation record (name, summary, description, type, location, price tiers,
   amenities, features, capacity, check-in / check-out info).
2. Accommodation FAQs (all published FAQs for this property).

This data is serialized to a structured Markdown or JSON string and injected as a
**system message** alongside `resolveSystemPrompt('chat')`. Per the foundation
contract (README §Configuration — Prompt resolution): "System-message injection
from the caller wins over the stored prompt when both are present." In practice
the handler PREPENDS the accommodation context block to the resolved prompt so
both are present in the system message.

### 6.3 Multi-Turn Handling

The request schema includes a `messages` array (`{ role: 'user' | 'assistant',
content: string }[]`) sent by the client. The handler passes this array directly
to `aiService.streamText({ ..., messages })`. There is no server-side session
lookup on the hot path — the client holds the history.

The in-code default prompt includes an instruction to limit context window to the
last N turns to avoid prompt-size abuse (N is an open question; see §9 Q-5).

### 6.4 Conversation Persistence (Open Question)

The `ai_conversations` and `ai_messages` tables exist in `@repo/db` (SPEC-173
§5.4). Whether this feature writes to them in V1 is **unresolved** (see §9 Q-1).
The route implementation must be designed so persistence can be toggled without
changing the SSE contract.

### 6.5 Locale Handling

The request schema includes an optional `locale: 'es' | 'en' | 'pt'` field. When
omitted, the service defaults to `'es'`. The locale is passed to
`aiService.streamText({ ..., locale })`.

## 7. Schema Design (Draft)

### 7.1 Request Schema (in `@repo/schemas`)

```ts
// packages/schemas/src/ai/chat-request.schema.ts
AiChatMessageSchema: {
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
}

AiChatRequestSchema: {
  accommodationId: z.string().uuid(),
  messages: z.array(AiChatMessageSchema).min(1).max(50),
  locale: z.enum(['es', 'en', 'pt']).optional(),
}
```

Max message count (50) and content length (4000) are placeholder limits —
calibrate against actual context-window budgets in implementation.

### 7.2 Response (SSE event shapes, from foundation)

```
event: token
data: { "text": "Sí, la propiedad cuenta" }

event: done
data: { "tokensIn": 412, "tokensOut": 87, "provider": "openai", "model": "gpt-4o-mini" }

event: error
data: { "code": "MODERATION_BLOCKED", "message": "Contenido no permitido" }
```

## 8. Acceptance Criteria (Preliminary)

- **AC-1 (auth wall)** — Unauthenticated request to `/api/v1/protected/ai/chat`
  returns 401; no provider call is made.
- **AC-2 (quota 403)** — A tourist-free user who has consumed their 10-request
  monthly allowance receives a `403` with upgrade hint on the 11th request; the
  attempt is metered to `ai_usage` with status `quota_exceeded`.
- **AC-3 (streaming)** — A successful request emits at least one `token` SSE
  event followed by a `done` event; the `Content-Type` is `text/event-stream`.
- **AC-4 (grounded context)** — The assembled system message contains the
  accommodation name, description, and at least one FAQ (if the property has FAQs).
- **AC-5 (off-topic refusal)** — The in-code default prompt instructs the model
  to decline questions unrelated to the specific accommodation; this is tested
  with `StubProvider` by verifying the prompt text contains the refusal instruction.
- **AC-6 (moderation error frame)** — When `StubProvider` is configured to flag
  output (prompt contains `'[stub:flagged]'`), the route emits an `error` SSE
  event (not a 5xx HTTP error), and no `done` event follows.
- **AC-7 (multi-turn)** — A request with `messages` containing prior turns
  passes the full array to `aiService.streamText`; the handler does not truncate
  history below the configured max turns.
- **AC-8 (locale passthrough)** — When `locale: 'pt'` is in the request, it is
  forwarded to `aiService.streamText`; when omitted, `'es'` is used.
- **AC-9 (missing accommodation)** — A request with a non-existent `accommodationId`
  returns a `404` before any provider call is made.
- **AC-10 (kill-switch)** — When the `ai_chat` feature flag is disabled in admin
  settings, the route returns `503` immediately (engine throws `FEATURE_DISABLED`).

## 9. Open Questions

> These are unresolved product/technical decisions. Present options to the owner;
> do not implement past an unresolved question.

### Q-1 — Conversation persistence: server-side vs. stateless

**Context**: The foundation has `ai_conversations` and `ai_messages` tables ready
to use. The client can alternatively hold the full message history in component
state and send it on every turn (stateless server path).

**Option A — Stateless (client holds history)**
Pros: zero DB writes on the hot path; simplest server code; no retention risk.
Cons: history is lost on page refresh; no server-side audit of what was asked;
history limit relies on client honesty.

**Option B — Server-side persistence (write to `ai_conversations`/`ai_messages`)**
Pros: history survives refresh; enables future features (host analytics, moderation
audit, personalization); admin can inspect flagged conversations.
Cons: adds DB writes to the streaming hot path; retention policy needed (GDPR?);
increases implementation scope.

**Option C — Hybrid (persist after stream closes, not during)**
Stream is stateless; after `done` event, a follow-up PATCH persists the turn.
Pros: streaming path stays simple; persistence is best-effort.
Cons: turns can be lost on client disconnect; complicates the client contract.

**Recommendation**: decide before implementation. The schema design in §7.1 is
compatible with all three options.

### Q-2 — Scope: single accommodation vs. cross-property

V1 spec assumes single-accommodation scope (the `accommodationId` in the request).
Should the chat be able to compare properties or answer general regional questions?

**Option A — Single-accommodation only (current draft)**
Simpler context assembly; lower token cost; clearer grounding.

**Option B — Cross-property**
Higher token cost; context assembly becomes complex (which accommodations to include?);
requires a search/ranking step before assembly.

**Recommendation**: start with Option A. Cross-property can be V2.

### Q-3 — Web UI placement

Where should the chat widget live on the accommodation detail page in `apps/web`?

**Option A — Inline expandable section** (in the page body, after FAQs)
Consistent with page flow; no z-index/overlay concerns; less intrusive.

**Option B — Floating action button + overlay**
Always accessible regardless of scroll position; familiar chat UX pattern;
requires overlay/z-index management.

**Option C — Dedicated sub-page** (`/accommodations/[slug]/chat`)
Clean separation; shareable URL; no overlay complexity.

This decision affects the frontend implementation scope significantly.

### Q-4 — Escalation path to host contact

When a tourist's question cannot be answered from available data (e.g. availability,
custom deals), should the widget offer a CTA to contact the host directly?

**Option A — No escalation in V1**
Out of scope; keep the feature focused on AI answers.

**Option B — "Contact host" CTA at end of flagged low-confidence answers**
Requires the API to include a `low_confidence` signal in the `done` event;
adds complexity.

**Recommendation**: V1 = Option A; revisit in V2.

### Q-5 — Multi-turn context window limit

What is the maximum number of prior turns to include in the messages array?

Tradeoffs: more turns = more context = better answers but higher token cost per
call. The current draft schema allows `messages.max(50)` as a placeholder.

Needs a concrete number tied to the target model's context window and the cost
ceiling per chat call. **Owner must decide before implementation.**

### Q-6 — Availability / pricing data inclusion in context

Should the context assembly include real-time pricing tiers and availability
calendar data?

**Option A — Static structured data only** (descriptions, amenities, FAQs, base
prices). Simpler; no risk of stale availability data.

**Option B — Include current pricing tiers + availability window**
More accurate for booking-intent queries; requires fetching availability data;
risk: model may confidently answer about future availability that changes after
the conversation.

**Recommendation**: Option A for V1; availability is a V2 integration concern.

### Q-7 — Disclaimer wording

Should the chat widget display a permanent disclaimer ("Las respuestas son
generadas por IA y pueden contener errores")?

Wording and placement (below input, in first message, tooltip) is a product
decision. Needs owner input before frontend implementation.

## 10. Risks

### R-1 — Hallucinated pricing or availability

**Probability**: Medium. **Impact**: High (user books based on wrong info).
**Mitigation**: grounding instructions in the system prompt must include an
explicit directive to answer only from provided context and to state when
information is unavailable. A disclaimer (§9 Q-7) reduces user trust risk.
This is the highest-impact content-accuracy risk for this feature.

### R-2 — Token cost per call (highest-cost V1 feature)

**Probability**: High (it will happen). **Impact**: Medium (cost, not breakage).
**Context**: streaming RAG chat involves the accommodation context block (hundreds
of tokens) + conversation history + response. Per-user monthly quota (SPEC-173
§5.7) + per-feature USD ceiling (SPEC-173 §5.8) are the two enforcement layers.
**Mitigation**: configure a conservative per-feature ceiling; monitor `ai_usage`
in the first week after launch; tighten quotas if needed.

### R-3 — Context size abuse (large FAQs, long conversation history)

**Probability**: Low. **Impact**: Medium (high token cost per call).
**Mitigation**: cap the context assembly (max FAQ count, max characters per
description field, max conversation turns — see §9 Q-5).

### R-4 — Prompt injection via user messages

**Probability**: Low-Medium. **Impact**: Medium (model produces off-brand output).
**Mitigation**: `guardPromptInjection` from the foundation applies automatically
at the engine chokepoint. The system prompt scopes the model to accommodation-only
topics.

### R-5 — Post-stream moderation block UX confusion

**Probability**: Low. **Impact**: Medium (user sees partial content then error).
**Mitigation**: client must implement the `error` SSE event handler as specified
in §5.1. Include explicit unit tests for this path using `StubProvider`'s
`'[stub:flagged]'` trigger.

## 11. Implementation Order (Sketch)

1. `@repo/schemas` — `AiChatRequestSchema` + `AiChatMessageSchema` + types.
2. `apps/api` — accommodation context assembler utility (fetch entity + FAQs).
3. `apps/api` — in-code default prompt (`src/engine/default-prompts.ts` — already
   exists in foundation; add the `'chat'` feature entry).
4. `apps/api` — `/api/v1/protected/ai/chat` route with middleware stack.
5. `apps/api` — route tests with `StubProvider` (all ACs above).
6. `apps/web` — chat widget component (React island with `client:idle`; vanilla
   CSS / CSS Modules per web styling policy — NO Tailwind).
7. `apps/web` — SSE client (native `fetch` + `ReadableStream` — no axios per dep policy).
8. `apps/web` — integration test / Playwright smoke.

## 12. Dependencies

### Internal

- `@repo/ai-core` — `createConfiguredAiService`, `streamText`, foundation safety
  (all shipped, SPEC-173).
- `@repo/db` — `ai_conversations`, `ai_messages` tables (shipped); accommodation +
  FAQ model queries (existing, used by current routes).
- `@repo/schemas` — new `AiChatRequestSchema` (to be added).
- `@repo/billing` — `ai_chat` entitlement key, `max_ai_chat_per_month` limit key
  (seeded, SPEC-173 T-030).
- `apps/api` — `createProtectedStreamingRoute`, `createAiQuotaMiddleware`,
  `createAiRateLimitMiddlewares` (all shipped, SPEC-173).

### External

None. All provider calls are routed through the foundation; this feature adds no
new provider dependencies.

## 13. Open Decisions Checklist

- [ ] Q-1: Conversation persistence model chosen (A / B / C).
- [ ] Q-2: Cross-property scope confirmed as out-of-scope V1.
- [ ] Q-3: Web UI placement decided (inline / floating / sub-page).
- [ ] Q-4: Escalation CTA confirmed as out-of-scope V1.
- [ ] Q-5: Multi-turn context window limit (number of turns).
- [ ] Q-6: Availability data inclusion decision (static-only for V1?).
- [ ] Q-7: Disclaimer wording and placement approved.

## Key Learnings

1. The `ai_conversations` / `ai_messages` tables are already defined in the foundation (SPEC-173 §5.4) — this feature does not need to add DB schema, only decide whether to write to them.
2. Post-stream moderation throws `AiModerationBlockedError` from within the async generator AFTER tokens were emitted; the client `error` SSE handler is the only way to discard already-shown content — this is a non-obvious contract that must be explicitly tested.
3. The "caller-wins" system message injection (README §Configuration) means context assembly can prepend the accommodation data block without conflict with the admin-managed prompt.
4. Quota limits for `ai_chat` are already seeded per plan (SPEC-173 T-030); this feature adds no billing configuration, only consumes what exists.
5. `apps/web` styling rule: vanilla CSS / CSS Modules only — no Tailwind on the chat widget.
