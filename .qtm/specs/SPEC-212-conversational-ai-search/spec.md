---
id: SPEC-212
slug: conversational-ai-search
title: Conversational AI Accommodation Search (Multi-turn Filter Refinement)
status: draft
owner: qazuor
created: 2026-06-11
parentSpec: SPEC-173
relatedSpecs:
  - SPEC-173  # AI foundation — aiService, quota/rate-limit middleware, provider engine
  - SPEC-199  # NL search (single-shot) — its mapper/schema/prompt are reused; its UI is superseded
  - SPEC-200  # AI Accommodation Chat — chat widget + SSE streaming + ai_conversations/ai_messages reused
  - SPEC-145  # billing entitlements enforcement — ai_search quota gate plugs here
  - SPEC-168  # admin-editable plans — determines plan limits for ai_search
tags: [ai, feature, search, conversational, chat, tourist, web]
---

# SPEC-212 — Conversational AI Accommodation Search (Multi-turn Filter Refinement)

> **DECISION PROTOCOL:** In every single case — without exception — if a change
> or decision is not *extremely* clear-cut, if there is even the slightest
> ambiguity, or if there is more than one viable option, **STOP and consult the
> owner (qazuor)**. Do not decide autonomously. See SPEC-173 §12.

## 1. Summary

Turn the single-shot "natural language → filters" search shipped by SPEC-199 into a
**multi-turn conversational search**. A chat panel lives on the accommodations
listing. Each user message incrementally refines an accumulated filter set; after
every turn the results update inside the panel and the AI replies in natural
language.

Under the hood this remains a **NL → filters translator**, not semantic search. The
actual retrieval is still the deterministic public accommodations endpoint
(`GET /api/v1/public/accommodations`); the AI never retrieves, ranks, or scores
listings. True semantic/embedding search is a **separate future spec (option C)**,
explicitly out of scope here.

The feature is built by **heavy reuse** of two existing features:

- **SPEC-199** — `mapIntentToSearchParams`, `SearchIntentEntitiesSchema` /
  `SearchIntentOutputSchema`, `DEFAULT_PROMPTS['search']`, and the fixed
  accommodation filter set.
- **SPEC-200** — the chat widget pattern, the SSE streaming plumbing
  (`ai-chat-stream.ts`), and the `ai_conversations` / `ai_messages` tables (which
  already accept `feature='search'`).

This spec covers the **feature layer only**: one new protected SSE endpoint that, per
turn, (a) extracts the full updated filter set via `generateObject` and (b) streams a
NL reply via `streamText`; plus the web chat panel that consumes the stream, executes
the public accommodation search on the emitted filters, and renders results in-panel.

## 2. Context and Motivation

SPEC-199 shipped a single-shot translator: the user types one query, the AI extracts
filter slots, the browser navigates to `/alojamientos?type=CABIN&...`, and the normal
listing runs. The owner raised two problems:

1. **Fragile.** One shot, easy to break. If the query doesn't map cleanly to the
   fixed filter set, the result is poor and there is no recovery path — the user has
   to retype the whole query.
2. **Confusing UX.** Telling users "search with AI" sets the expectation of a **chat**
   they interact with message-by-message, not a text box that vanishes into URL
   params and reloads the page.

The conversational model fixes both: the user refines ("más barata", "saca la pileta,
poné parrilla", "que acepte mascotas") and watches results converge turn by turn,
with the AI acknowledging each change in natural language. The accumulated filter set
becomes a visible, editable artifact (active-filter chips) inside the panel.

This supersedes SPEC-199's **UI** (the single input). SPEC-199's mapper, schema, and
prompt are **not** retired — they are the technical base this spec builds on.

## 3. Resolved Decisions

These were decided with the owner during planning (plan: option A). They are NOT to
be relitigated during implementation.

- **D-1 — This is option A (conversational filter refinement), not option C
  (semantic search).** The AI returns `{filters, reply}`; the search stays the
  deterministic public endpoint. Embeddings/vector search is a future spec.
- **D-2 — Conversation state = client echo + best-effort persistence.** The client
  holds the message history in memory and echoes it on each request. The server
  persists best-effort to `ai_conversations` / `ai_messages` with `feature='search'`
  (same pattern as SPEC-200's `persistChatTurn`). State is lost on page reload in V1;
  server-side reload is out of scope.
- **D-3 — The frontend executes the search, not the AI route.** The AI endpoint
  returns the updated filters (as URL-ready params) + a NL reply. The **frontend**
  calls `GET /api/v1/public/accommodations` with those filters and renders results
  inside the chat panel. The AI route never touches `AccommodationService`.
- **D-4 — The chat replaces SPEC-199's single input.** The chat panel becomes THE
  "search with AI" experience. SPEC-199's one-shot input UI is retired (components
  unmounted / removed); its mapper/schema/prompt live on.
- **D-5 — Filter refinement = LLM returns the full updated set.** Each turn injects
  the current filter set + the new user message into the `generateObject` prompt; the
  LLM returns the **complete updated entity set** (e.g. "saca 2 ambientes, poné 3" →
  it returns the full set with `bedrooms: 3`). The LLM does the merge — this fits
  `generateObject`'s prompt-only V1 constraint, no server-side diff logic.
- **D-6 — One new SSE endpoint** `POST /api/v1/protected/ai/search-chat`, distinct
  from `/ai/chat` (SPEC-200 accommodation chat) and `/ai/search-intent` (SPEC-199,
  retired). It is NOT a modification of either.
- **D-7 — Quota = 1 unit of `ai_search` per turn (per HTTP call)**, even though a
  turn makes 2 LLM calls (`generateObject` + `streamText`). Reuse
  `createAiQuotaMiddleware('search')` + `createAiRateLimitMiddlewares('search')`.
- **D-8 — Reply has no exact result count.** The AI route does not query
  accommodations, so the reply is conversational but does NOT cite "encontré 12". The
  UI shows the count after it searches. A count-aware reply is a documented future
  trade-off (add a cheap COUNT in the backend if wanted).
- **D-9 — Emit `filters` before the reply finishes.** Emit the `filters` SSE event as
  soon as `generateObject` resolves, so results render BEFORE the reply streams. Show
  a "pensando…" per-turn state. Important because the local provider (Ollama) is slow.

## 4. Goals and Non-goals

### Goals

- A multi-turn chat panel on the accommodations listing that refines an accumulated
  filter set and renders results in-panel after each turn.
- One new protected SSE endpoint that extracts updated filters and streams a NL reply.
- Reuse of SPEC-199's mapper/schema/prompt and SPEC-200's chat/SSE/persistence
  patterns — no duplication.
- Best-effort conversation persistence (`feature='search'`), non-fatal on failure.
- Active-filter chips (removable) reflecting the accumulated set.
- Full test coverage (unit + API integration with stub provider + web component + e2e
  - regression for local OpenAI-compatible provider).

### Non-goals (out of scope)

- Semantic / embedding search (future spec C).
- Changing the underlying accommodation filter set or the search service.
- Server-side conversation reload across page reloads (V1 keeps the client-echo model).
- Count-aware AI replies (documented trade-off; can be added later).
- Any change to `/ai/chat` (SPEC-200) behavior.

## 5. Architecture

### 5.1 Per-turn flow (the new endpoint)

`POST /api/v1/protected/ai/search-chat` — SSE response. Middleware chain reuses the
SPEC-173/199 stack: auth → `ai_search` entitlement gate →
`createAiRateLimitMiddlewares('search')` → `createAiQuotaMiddleware('search')` →
handler.

Per turn the handler:

1. `generateObject({ feature: 'search', prompt: buildConversationalSearchPrompt({ currentFilters, history, message, locale }) }, SearchIntentOutputSchema)` → extract the **full updated** entity set.
2. `mapIntentToSearchParams(...)` (+ slug→UUID resolution where needed, as SPEC-199
   already does) → emit SSE event **`filters`** carrying the URL-ready params. The
   frontend reacts immediately (searches + renders).
3. `streamText({ feature: 'search', messages: [...history, assistantContextWithFilters] })`
   → stream SSE **`token`** events for the NL reply. End with **`done`** carrying
   `conversationId`.
4. Best-effort persist the turn to `ai_conversations`/`ai_messages`
   (`feature='search'`), reusing SPEC-200's `persistChatTurn` pattern. Failure is
   logged and non-fatal.

The `generateObject` call and the `streamText` call are sequential within the turn;
`filters` is emitted between them so results render before the reply completes.

### 5.2 SSE event contract

- `filters` — `{ params: <URL-ready accommodation search params>, intent: <extracted entities> }`. Emitted once per turn, after step 1.
- `token` — `{ delta: string }`. Streamed during step 3.
- `done` — `{ conversationId: string }`. Terminal event.
- `error` — `{ code, message }`. On provider failure / validation error; terminal.

Event shapes are defined as Zod schemas in `@repo/schemas` (single source of truth),
consumed by both the route and the web SSE client.

### 5.3 Prompt construction (`buildConversationalSearchPrompt`)

Reuses `DEFAULT_PROMPTS['search']` as the static slot-extraction contract (extended
for the conversational + injected-state framing). The dynamic per-request part
injects:

- The **current filter set** (serialized accumulated entities) so the LLM can apply
  deltas against it.
- The **recent conversation history** (bounded, e.g. last N turns) for context.
- The **new user message**.
- The locale-aware amenity allowlist (as SPEC-199 already does via
  `buildSearchIntentPrompt`).

Contract: the LLM MUST return the **full updated entity set**, not a delta. This is
asserted by the unit tests on the prompt shape + the mapper.

### 5.4 Frontend (web)

- `SearchChatPanel.client.tsx` — adapted from SPEC-200's `AiChatWidget`. Renders the
  thread, the streamed reply, removable active-filter chips, and the results grid
  in-panel.
- `useSearchChat.ts` — hook owning the message history (client echo), the accumulated
  filters, and the per-turn lifecycle (send → on `filters` fire the accommodation
  search → render → stream reply).
- `search-chat-stream.ts` — SSE client emitting `filters` / `token` / `done` / `error`
  (adapted from `ai-chat-stream.ts`).
- On the `filters` event the hook calls `GET /api/v1/public/accommodations` with the
  params and renders results inside the panel (the AI route never does this).

### 5.5 Reuse map (explicit — do not duplicate)

| Concern | Reused from | File |
| --- | --- | --- |
| Intent → params mapper | SPEC-199 | `apps/api/src/routes/ai/protected/search-intent.mapper.ts` |
| Output schema | SPEC-199 | `packages/schemas/src/entities/ai/ai-search-intent.schema.ts` |
| Slot-extraction prompt | SPEC-199 | `packages/ai-core/src/engine/default-prompts.ts` (`DEFAULT_PROMPTS['search']`) |
| Chat widget + SSE pattern | SPEC-200 | `apps/web/src/components/accommodation/AiChatWidget.tsx`, `useAccommodationChat.ts`, `apps/web/src/lib/api/ai-chat-stream.ts` |
| Persistence | SPEC-200 | `ai_conversations` / `ai_messages` (`feature='search'`), `persistChatTurn` |
| Quota / rate-limit middleware | SPEC-173/199 | `createAiQuotaMiddleware('search')`, `createAiRateLimitMiddlewares('search')` |
| Public search | core | `GET /api/v1/public/accommodations` → `AccommodationService.searchWithRelations` |

### 5.6 New files

- `apps/api/src/routes/ai/protected/search-chat.ts` — SSE route (generateObject →
  `filters` event → streamText reply → persist).
- `apps/api/src/routes/ai/protected/search-chat.prompt.ts` —
  `buildConversationalSearchPrompt({ currentFilters, history, message, locale })`.
- `apps/web/src/components/ai-search/SearchChatPanel.client.tsx` (+ module CSS).
- `apps/web/src/components/ai-search/useSearchChat.ts`.
- `apps/web/src/lib/api/search-chat-stream.ts`.
- Schemas in `@repo/schemas`: `AiSearchChatRequestSchema` (messages[], currentFilters,
  locale, conversationId?) + the SSE event shapes.

### 5.7 Retire / migrate (SPEC-199 UI)

- `apps/web/src/components/ai-search/*` (NlSearchInput, AiSearchPanel,
  AiSearchTrigger, IntentChips) — replaced by the chat panel. **Keep the IntentChips
  concept** (active filters as removable chips inside the panel). Stop mounting the
  old components in `apps/web/src/pages/[lang]/alojamientos/index.astro`.
- `apps/api/src/routes/ai/protected/search-intent.ts` — superseded by `search-chat`.
  Recommend **delete once chat ships** (decide at implementation time; consult owner
  if any external consumer still depends on it).

## 6. Data

No schema changes. Reuses existing `ai_conversations` / `ai_messages` with
`feature='search'` (already supported). Best-effort writes only; no new migration, no
new table, no new column.

## 7. Acceptance Criteria (BDD)

```gherkin
Feature: Conversational AI accommodation search

  Background:
    Given an authenticated user with an active ai_search entitlement and remaining quota

  Scenario: First turn extracts filters and streams a reply
    When the user sends "cabaña para 4 con pileta cerca del río"
    Then the endpoint emits a "filters" SSE event with accommodation search params
    And the frontend executes GET /api/v1/public/accommodations with those params
    And results render inside the chat panel
    And a natural-language reply streams via "token" events
    And a terminal "done" event carries a conversationId

  Scenario: Refinement turn updates the accumulated filter set
    Given a prior turn produced filters {type: CABIN, guests: 4, features: [pool]}
    When the user sends "más barata, hasta 50 mil"
    Then the LLM returns the full updated set including the price ceiling
    And a new "filters" event re-renders results
    And the reply acknowledges the change

  Scenario: Active-filter chips reflect the accumulated set
    Then removable chips show the current filters
    And removing a chip re-runs the search without that filter

  Scenario: Unauthenticated request is rejected
    Given no user session
    When a request hits POST /api/v1/protected/ai/search-chat
    Then the response is 401

  Scenario: Entitlement gate blocks users without ai_search
    Given a user whose plan lacks ai_search
    Then the response is 403

  Scenario: Quota exhaustion is enforced per turn
    Given the user has 0 remaining ai_search quota
    Then the response is 403 with a LIMIT_REACHED code
    And no LLM call is made

  Scenario: Rate limit is enforced
    When the user exceeds the search rate limit
    Then the response is 429

  Scenario: Persistence failure is non-fatal
    Given the ai_messages write fails
    Then the turn still emits filters, streams the reply, and returns done

  Scenario: Empty or garbage message is handled gracefully
    When the user sends an empty or nonsensical message
    Then the endpoint does not crash and returns a usable (possibly empty) filter set
```

## 8. Testing Strategy

No tests = not done. Use the `StubProvider` for API integration; guard the
local-OpenAI-compatible regression (no date-regex in the schema — already fixed
in #1569).

- **Unit** — `buildConversationalSearchPrompt` injects current filters + bounded
  history + new message correctly; the full-updated-set contract is asserted via the
  prompt shape + `mapIntentToSearchParams` output.
- **API integration (stub provider)** — happy path (emits `filters`, then streams
  reply, then `done` + conversationId); auth required (401); `ai_search` entitlement
  gate (403); quota exhausted (403 / LIMIT_REACHED, no LLM call); rate limit (429);
  empty/garbage message; persistence best-effort (write failure is non-fatal).
- **Component (web)** — `SearchChatPanel` renders streamed tokens, fires the
  accommodation search on the `filters` event, renders the results grid, shows
  removable active-filter chips, supports a multi-turn refine.
- **E2E** — type → `filters` event → results render → second message refines →
  results update.
- **Regression** — `search-chat` works against a local OpenAI-compatible provider (no
  schema date-regex that crashes the llama.cpp grammar compiler; cf. #1569).

## 9. Risks

- **Latency (Ollama slow).** Mitigated by emitting `filters` before the reply (D-9)
  and a per-turn "pensando…" state. Two LLM calls per turn amplify this.
- **LLM merge drift.** The LLM may drop a previously-set filter when returning the
  full set. Mitigation: the prompt explicitly instructs "return the complete updated
  set, preserving prior filters unless the user changed them"; covered by refinement
  tests.
- **Quota perception.** One turn = 2 LLM calls but 1 quota unit (D-7). Documented;
  acceptable trade-off.
- **Provider-grammar fragility.** Local providers crash on certain schema constructs
  (date regex). Guarded by the regression test and the #1569 fix.
- **Persistence drift.** Best-effort writes can silently fail; logged and non-fatal by
  design — acceptable for V1.

## 10. Dependencies

- SPEC-173 (AI foundation: aiService, quota/rate-limit middleware, provider engine) —
  shipped.
- SPEC-199 (mapper/schema/prompt) — its technical base is reused; its UI is
  superseded by this spec.
- SPEC-200 (chat widget, SSE, persistence) — shipped; patterns reused.
- SPEC-145 / SPEC-168 (entitlements + plan limits for `ai_search`).
- The three open AI-fix PRs (#1567 rename, #1568 moderation opt-in, #1569 Ollama
  compat) should land first so the local-provider regression baseline is stable.

## 11. Migration and Rollback

- No DB migration.
- Rollout: ship the chat panel and the new endpoint; remove/stop mounting SPEC-199's
  single input in the same change so there is one "search with AI" surface.
- Rollback: re-mount SPEC-199's input and stop mounting the chat panel; the
  `search-intent` route can be kept until chat is proven (then deleted). No data to
  roll back (best-effort persistence only).

## 12. Task Breakdown Hint

Suggested phases for `task-from-spec`:

- **Setup** — schemas in `@repo/schemas` (`AiSearchChatRequestSchema` + SSE event
  shapes); extend `DEFAULT_PROMPTS['search']` framing.
- **Core (API)** — `search-chat.prompt.ts` (`buildConversationalSearchPrompt`);
  `search-chat.ts` SSE route (generateObject → `filters` → streamText → `done`);
  best-effort persistence; wire middleware (entitlement + quota + rate limit).
- **Integration (web)** — `search-chat-stream.ts` SSE client; `useSearchChat.ts`
  hook; `SearchChatPanel.client.tsx` + module CSS; mount on the listing; retire
  SPEC-199 UI components.
- **Testing** — unit (prompt + mapper), API integration (stub), web component, e2e,
  local-provider regression.
- **Docs** — update the AI feature docs + SPEC-199 cross-reference (UI superseded);
  note the count-aware-reply trade-off.

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-06-11 | qazuor | Initial spec from owner-approved plan (option A, conversational filter refinement). |
