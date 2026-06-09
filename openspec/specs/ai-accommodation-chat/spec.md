# Delta Spec — SPEC-200 AI Accommodation Chat (tourist)

> **Change**: `SPEC-200-ai-accommodation-chat` · **Parent**: SPEC-173 (shipped) · **Sibling**: SPEC-198 (shipped) · **Status**: DRAFT-3, all Q-1..Q-7 + Q-R1..Q-R7 resolved

## Purpose

Add a tourist-facing AI chat widget to accommodation detail pages in `apps/web` that lets a logged-in user ask natural-language questions about one specific property and receive SSE-streamed, grounded answers (no hallucinated pricing/availability) in a multi-turn conversation. This is **child C of SPEC-173**: zero changes to `@repo/ai-core` or `@repo/db`; it consumes the shipped foundation (`createConfiguredAiService`, `createProtectedStreamingRoute`, `createAiQuotaMiddleware('chat')`, `guardPromptInjection`, `EntitlementKey.AI_CHAT`).

Source spec: `.qtm/specs/SPEC-200-ai-accommodation-chat/spec.md` (DRAFT-2, 1,366 lines, owner-decision-complete). This delta is the formal contract that `sdd-verify` will check against.

---

## Requirements

### REQ-200-1: Protected SSE chat route

**Statement**: The system SHALL expose `POST /api/v1/protected/ai/chat` that streams AI responses via Server-Sent Events for authenticated tourists on a single accommodation.
**Rationale**: Source spec §6.1, §6.6 — fills the protected-AI barrel slot reserved at `apps/api/src/routes/ai/protected/index.ts:45`.
**Acceptance Criteria**:

- **AC-1.1**: Given an unauthenticated request, When the route is hit, Then the response is `401` and NO provider call is made. → `chat-route.test.ts:case-1`.
- **AC-1.2**: Given a valid authenticated request, When the route is hit, Then the response `Content-Type` is `text/event-stream` and at least one `event: token` followed by `event: done` is emitted. → `chat-route.test.ts:case-3`.
- **AC-1.3**: Given the route file, When the file is read, Then it uses `createProtectedStreamingRoute` and its `options.middlewares` array is `[entitlementMiddleware(), ...createAiRateLimitMiddlewares('chat'), createAiQuotaMiddleware('chat')]` in that exact order. → reviewable in `chat.ts`.

### REQ-200-2: Accommodation context assembly

**Statement**: The system SHALL provide `assembleAccommodationContext` + `buildChatSystemMessage` that compose the Markdown accommodation block and a `messages[0].role === 'system'` block from `resolveSystemPrompt({ feature: 'chat' })` + chat-specific grounding instructions.
**Rationale**: Source spec §6.2, §6.3, §8 — scopes the model to the property; prevents hallucination (R-1).
**Acceptance Criteria**:

- **AC-2.1**: Given the context assembler, When the input description exceeds 800 chars, Then the output block truncates it with `…`. → `accommodation-ai-context.test.ts`.
- **AC-2.2**: Given the context assembler, When FAQs are 15, Then the output block contains the first 10. Given amenities 25, then the output block contains the first 20. → same test.
- **AC-2.3**: Given the assembled system message, When the unit test inspects it, Then it contains the literal substrings `---price-disclaimer---` and `unrelated to this specific accommodation` (Q-R5 enforcement). → same test.
- **AC-2.4**: Given `accommodationService.getById` returns `{ error }` or `data: null`, When the route is hit, Then the response is `404` BEFORE the SSE stream opens. → `chat-route.test.ts:case-8` (AC-9).

### REQ-200-3: Persistence helper (fire-and-forget, 1500 ms race)

**Statement**: The system SHALL provide `persistChatTurn` that writes `aiConversations` (first turn only, `contextNote: JSON.stringify({ accommodationId })`) + `aiMessages` rows, racing inside `meta.then` against a 1500 ms timeout. On win, the `done` SSE frame carries `conversationId`; on timeout, it is omitted and `apiLogger.warn` fires.
**Rationale**: Source spec §3 Q-1, §6.4 — no schema change; uses the documented `contextNote` extension point at `ai_conversations.dbschema.ts:62-65`.
**Acceptance Criteria**:

- **AC-3.1**: Given a first turn (`messages.length === 1`, no `conversationId` in request), When the stream completes, Then `ai_conversations` has one row for the user with `feature='chat'` and `contextNote` JSON containing the `accommodationId`, and `done.conversationId` is a UUID. → `chat-route.test.ts:case-10` (AC-12).
- **AC-3.2**: Given a subsequent turn (request includes `conversationId`), When the stream completes, Then `ai_messages` has two new rows (user + assistant) for that conversation, and NO new `ai_conversations` row is created. → same test file:case-11 (AC-13).
- **AC-3.3**: Given a DB-unavailable condition during persistence, When the stream completes, Then the SSE `done` event IS still emitted (no 5xx), `conversationId` is absent from `done`, and `apiLogger.error` fires exactly once. → `chat-route.test.ts:case-12` (AC-14).
- **AC-3.4**: Given the route handler source, When read, Then persistence is invoked with `void` and any throw is caught inside the `meta.then` callback — never propagates. → code review.

### REQ-200-4: Schema additions (`@repo/schemas`)

**Statement**: The system SHALL export `AiChatRequestSchema` and `AiChatMessageSchema` from `packages/schemas/src/entities/ai/ai-chat.schema.ts` (NEW) and re-export them from the AI barrel.
**Rationale**: Source spec §7.1 — single source of truth for the request shape; messages cap 20 (Q-5 resolved).
**Acceptance Criteria**:

- **AC-4.1**: Given `AiChatRequestSchema.safeParse({ accommodationId: 'not-a-uuid', messages: [], locale: 'es' })`, When parsed, Then the result is `.success === false`. → schema unit test.
- **AC-4.2**: Given a body with `messages.length === 21`, When the route validates, Then the response is `400` with `code: 'VALIDATION_ERROR'`. → `chat-route.test.ts:case-9` (AC-11).
- **AC-4.3**: Given the request body omits `locale`, When the route validates, Then the default is `'es'` and the forwarded value to `aiService.streamText` is `'es'`. → `chat-route.test.ts:case-7` (AC-8).

### REQ-200-5: Web chat island (FAB + widget)

**Statement**: The system SHALL mount a React island (`AiChatWidget` + `AiChatFab`) on `apps/web/src/pages/[lang]/alojamientos/[slug].astro` ONLY when `isAuthenticated === true`, using `client:idle` and CSS Modules (NO Tailwind in web).
**Rationale**: Source spec §9.1, §9.4 — `apps/web/CLAUDE.md` mandates CSS Modules for web.
**Acceptance Criteria**:

- **AC-5.1**: Given a guest visitor, When the accommodation detail page is rendered server-side, Then no `<AiChatWidget>` element appears in the HTML. → component test or static render check (AC-16).
- **AC-5.2**: Given an authenticated tourist, When the page hydrates, Then the FAB is visible bottom-right and a click opens the panel overlay. → component test.
- **AC-5.3**: Given the panel is open, When inspected, Then the fixed disclaimer header is visible above the input at all times. → component test (per Q-R7 / Q-7).
- **AC-5.4**: Given the chat source files, When read, Then no file in `apps/web` imports `@repo/ai-core` (boundary R-7). → static check / dep lint.

### REQ-200-6: Streaming client + state machine

**Statement**: The system SHALL provide `ai-chat-stream.ts` (native `fetch` + `ReadableStream` SSE parser) and `useAccommodationChat` (state machine `idle | streaming | error | at_cap`) with `hasPartialContent` tracking for the moderation block UX.
**Rationale**: Source spec §9.2, §9.3, §5.2 — `EventSource` is rejected by dep policy (no POST support).
**Acceptance Criteria**:

- **AC-6.1**: Given `useAccommodationChat` initial render, When read, Then `messages === []`, `conversationId === null`, `status === 'idle'`, `hasPartialContent === false`. → `useAccommodationChat.test.ts`.
- **AC-6.2**: Given the hook receives an `error` event AFTER one or more `token` events for the current turn, When the reducer runs, Then `currentAssistantContent` is cleared and `status === 'error'`, and no message is appended to `messages`. → same test (R-4 / AC-6 contract).
- **AC-6.3**: Given the response stream contains the substring `---price-disclaimer---`, When `done` arrives, Then the marker is stripped from `currentAssistantContent` before append, and `showPriceDisclaimer === true`. → same test.
- **AC-6.4**: Given the SSE client, When the underlying `fetch` returns non-2xx, Then a `stream_error` event is emitted and no parser runs. → `ai-chat-stream.test.ts`.

### REQ-200-7: i18n (11 keys × 3 locales)

**Statement**: The system SHALL add the `aiChat.*` sub-tree to the existing `packages/i18n/src/locales/{es,en,pt}/accommodations.json` files (NOT a new namespace) — 11 keys each, owner-approved copy.
**Rationale**: Source spec §10 — `apps/web/CLAUDE.md` defines es (default) / en / pt.
**Acceptance Criteria**:

- **AC-7.1**: Given the locale files at apply time, When inspected, Then each of the 11 keys (`fabLabel`, `panelLabel`, `headerDisclaimer`, `priceDisclaimer`, `placeholder`, `send`, `sending`, `errorDefault`, `atCapMessage`, `newConversation`, `close`) exists in all three locales with non-empty values. → i18n snapshot test.
- **AC-7.2**: Given the widget renders with `locale='pt'`, When the disclaimer is shown, Then the value is the Portuguese string from the table. → component test with `IntlProvider` mock.

### REQ-200-8: PostHog events (server-side, no PII)

**Statement**: The system SHALL emit 5 server-side PostHog events with structural metadata only — never message content.
**Rationale**: Source spec §12 — R-10 privacy risk; AC-17 + AC-18 are the test gates.
**Acceptance Criteria**:

- **AC-8.1**: Given a successful chat request, When the route handler runs, Then `posthog.capture('ai_chat_message_sent', { accommodationId, messageCount, locale, conversationId? })` is called exactly once. → integration test with `posthog.capture` spy (AC-17).
- **AC-8.2**: Given the PostHog capture calls in the test, When asserted, Then NONE of the property values equals the user's submitted query text, the assistant response text, or `---price-disclaimer---`. → same test (AC-18).
- **AC-8.3**: Given a `done` frame resolves with `usage`, When the route handler continues, Then `posthog.capture('ai_chat_response_completed', { provider, model, promptTokens, completionTokens, accommodationId, locale })` fires. → same test.
- **AC-8.4**: Given a moderation block (`error` SSE event with `code: MODERATION_BLOCKED`), When the route handler catches it, Then `posthog.capture('ai_chat_moderation_blocked', { accommodationId, locale })` fires with NO message content. → same test.
- **AC-8.5**: Given a request with `messages.length === 20`, When the route validates, Then `posthog.capture('ai_chat_cap_reached', { accommodationId })` fires (the 21+ case is rejected pre-stream and does not fire). → same test.

### REQ-200-9: Accessibility (WCAG 2.1 AA — full)

**Statement**: The widget SHALL implement focus trap on open, ESC-to-close, and an `aria-live="polite"` region for incoming tokens. The panel SHALL have `role="dialog"` and `aria-label` from the i18n key `aiChat.panelLabel`.
**Rationale**: Q-R2 adopted Option B; aligns with SPEC-136 admin a11y precedent.
**Acceptance Criteria**:

- **AC-9.1**: Given the panel is open, When the user presses `Tab` repeatedly, Then focus cycles only within the panel (no escape to the page behind). → axe + `userEvent.tab()` component test.
- **AC-9.2**: Given the panel is open and focus is inside it, When the user presses `Escape`, Then the panel closes and focus returns to the FAB. → component test.
- **AC-9.3**: Given the message list region, When inspected, Then it has `aria-live="polite"` and `aria-label` from `aiChat.panelLabel`. → axe `jest-axe` assertion.
- **AC-9.4**: Given the open panel, When the axe accessibility audit runs, Then no `wcag2a`/`wcag2aa` violations are reported. → axe smoke test.

### REQ-200-10: Entitlement + safety gate

**Statement**: The route SHALL enforce `EntitlementKey.AI_CHAT` and `LimitKey.MAX_AI_CHAT_PER_MONTH` via the existing middleware chain. The engine SHALL apply `guardPromptInjection` automatically.
**Rationale**: Source spec §2.4, §6.1 — existing seeded plans from SPEC-173 T-030.
**Acceptance Criteria**:

- **AC-10.1**: Given a tourist-free user with 10/10 requests consumed this month, When the 11th request is made, Then the response is `403` with `code: 'LIMIT_REACHED'` and an `ai_usage` row with `status: 'quota_exceeded'` is inserted. → `chat-route.test.ts:case-2` (AC-2).
- **AC-10.2**: Given the chat feature kill-switch is disabled, When the route is hit, Then the response is `503` with `code: 'FEATURE_DISABLED'`. → `chat-route.test.ts:case-10` (AC-10).
- **AC-10.3**: Given a request whose prompt triggers `guardPromptInjection`, When the engine runs, Then the pre-stream response is `422` with `code: 'MODERATION_BLOCKED'`. → integration test (input moderation).
- **AC-10.4**: Given a request with `messages.length === 20`, When processed, Then the response is the SSE stream (allowed, not a 400). → `chat-route.test.ts` (AC-11 happy side).

### REQ-200-11: Cost ceiling + kill-switch (inherited, no new wiring)

**Statement**: The system SHALL inherit the SPEC-173 per-feature USD ceiling and feature kill-switch (`ai_settings`) without new code beyond consuming `aiService.streamText` (which already checks `checkCeiling` before invoking providers).
**Rationale**: Source spec §2.3 — `CEILING_HIT → 503` via `mapAiEngineErrorToHttpStatus`.
**Acceptance Criteria**:

- **AC-11.1**: Given the per-feature USD ceiling is exhausted, When the route is hit, Then the response is `503` with `code: 'CEILING_HIT'`. → integration test (pre-stream guard).
- **AC-11.2**: Given all providers are disabled, When the route is hit, Then the response is `503` with `code: 'NO_ENABLED_PROVIDER'`. → integration test.

---

## Resolved design decisions (Q-R* defaults adopted)

| ID | Question | Adopted option | Enforced by |
|----|----------|----------------|-------------|
| Q-R1 | `aiConversations.title` strategy | **A — always null in V1** (no title set in `persistChatTurn`) | REQ-200-3 + `ai-chat-persistence.ts` test |
| Q-R2 | Widget a11y scope | **B — full AA** (focus trap + ESC + `aria-live="polite"`) | REQ-200-9 |
| Q-R3 | Price-marker split across two tokens | **A — trust the model**; marker strip is best-effort | REQ-200-6 AC-6.3 (client strips only the exact marker substring) |
| Q-R4 | Behaviour on `messages[0].role === 'user'` client misbehaviour | **A — don't validate order**; server prepends system unconditionally | REQ-200-4 (schema permits any role sequence) |
| Q-R5 | Server-side test for the literal `---price-disclaimer---` prompt instruction | **B — add the assertion** | REQ-200-2 AC-2.3 |
| Q-R6 | `aiMessages.content` PII policy | **No action** — stored raw per schema; PostHog events MUST NOT include content | REQ-200-8 AC-8.2 |
| Q-R7 | Conversation re-open on revisit | **A — V1 limitation**; "Nueva conversación" UX on `at_cap`; no localStorage | REQ-200-6 (state machine has `resetConversation` only) |

---

## Out-of-scope (deferred to V2)

1. Cross-property / multi-accommodation chat (Q-2 resolved).
2. Real-time availability + booking integration (Q-6 resolved).
3. Host-side conversation visibility + analytics.
4. Escalation CTA to host contact (Q-4 resolved).
5. Loading prior turns from DB on revisit (V1 limitation).
6. Embeddings / pgvector / semantic search (SPEC-173 excluded).
7. Admin chat-history UI (`aiConversations.title` always-null).
8. localStorage cache of conversation metadata across visits.
9. Any new dependency, package version bump, or DB migration.

---

## Risks (R-1..R-10)

| ID | Risk | Verification step |
|----|------|-------------------|
| R-1 | Hallucinated pricing / availability | REQ-200-2 AC-2.3 (server prompt contains the marker instruction) + REQ-200-6 AC-6.3 (client strips marker) + REQ-200-9 AC-9.3 (visible disclaimer) |
| R-2 | Token cost per call | REQ-200-4 AC-4.2 (20-msg cap → 400) + REQ-200-10 AC-10.1 (per-plan limit) + REQ-200-11 AC-11.1 (USD ceiling) |
| R-3 | Prompt injection via user messages | Engine applies `guardPromptInjection` automatically; REQ-200-2 AC-2.3 (system prompt scopes "ONLY based on …") + REQ-200-10 AC-10.3 (input moderation 422) |
| R-4 | Post-stream moderation UX confusion | REQ-200-6 AC-6.2 (partial content discarded) + REQ-200-8 AC-8.4 (PostHog event fires) + `StubProvider [stub:flagged]` integration test (mandatory per proposal §Test strategy) |
| R-5 | Persistence timeout → duplicate conversation rows | REQ-200-3 AC-3.3 (timeout path is logged) + accepted V1 tradeoff per spec §3 Q-1 |
| R-6 | Stream not drained before `meta` resolves | Inherited from SPEC-173; `streaming-route-factory.ts:255-269` already drains. Verified by existing `streaming-sse.test.ts` |
| R-7 | `apps/web` importing `@repo/ai-core` | REQ-200-5 AC-5.4 (static check — no ai-core import in web) |
| R-8 | Worktree branch state drift | Out of scope for this spec; resolved at apply time by worktree policy |
| R-9 | 800-line review budget exceeded | Chained PRs per proposal §Delivery (PR 1 ~700 lines backend, PR 2 ~600 lines frontend) |
| R-10 | PostHog event PII leakage | REQ-200-8 AC-8.2 (assert no event property equals user query text) |

---

## Test requirements (strict_tdd=true)

- **Unit (3 packages)**:
  - `apps/api/test/services/accommodation-ai-context.test.ts` — Markdown assembly, all caps (800/10/20/20), NOT_FOUND, system-prompt content assertions (AC-2.1..2.3).
  - `apps/web/src/hooks/__tests__/useAccommodationChat.test.ts` — state machine + `hasPartialContent` (AC-6.1..6.3).
  - `apps/web/src/lib/api/__tests__/ai-chat-stream.test.ts` — SSE parser, AbortSignal, non-2xx (AC-6.4).
- **Integration (1 file)**: `apps/api/test/integration/ai/chat-route.test.ts` — AC-1, AC-2, AC-3, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-17, AC-18.
- **Component (1 file)**: `apps/web/src/components/accommodation/__tests__/AiChatWidget.test.tsx` — FAB + panel + a11y behaviour.
- **Hook (1 file)**: `useAccommodationChat.test.ts` (counted in unit; verified for `StubProvider [stub:flagged]` scenario).
- **E2E (2 scenarios minimum, Playwright)**: (1) happy path (FAB open → streamed token → disclaimer visible); (2) post-stream moderation (`StubProvider [stub:flagged]` env → partial content discarded → neutral error shown).
- **i18n (1 snapshot)**: every `aiChat.*` key present in `es/en/pt` `accommodations.json`, each non-empty.
- **A11y (1 axe run)**: open panel has zero `wcag2a`/`wcag2aa` violations, focus trap + `aria-live` + `aria-label` present.

---

## Dependencies

- **SPEC-173 (AI Foundation) — SHIPPED**. Provides `createConfiguredAiService`, `createProtectedStreamingRoute`, `createAiQuotaMiddleware('chat')`, `createAiRateLimitMiddlewares('chat')`, `resolveSystemPrompt`, `DEFAULT_PROMPTS['chat']`, `guardPromptInjection`, `scrubPii`, `aiConversations` + `aiMessages` tables, `EntitlementKey.AI_CHAT`, `LimitKey.MAX_AI_CHAT_PER_MONTH`, `mapAiEngineErrorToHttpStatus`.
- **SPEC-198 (AI Text Improvement) — SHIPPED**. Pattern reference: barrel wiring convention, `StubProvider` integration-test pattern, `ai-quota.ts` middleware order, `HOSPEDA_ALLOW_MOCK_ACTOR=true` mock-actor headers.
- **SPEC-143 (Billing Testing Coverage) — in scope**. SPEC-200 does NOT touch billing CORE (no checkout, no webhook, no cron, no refund, no admin billing ops). Staging smoke REQUIRED for the AI entitlement gate; prod smoke NOT REQUIRED. Use the 13 dev test users from `pnpm db:fresh-dev`.
- **SPEC-199, SPEC-201** — siblings, DRAFT, no code collision (different routes/audiences).

## File-impact summary (for `sdd-design` to plan)

| Action | Path |
|--------|------|
| NEW | `packages/schemas/src/entities/ai/ai-chat.schema.ts` |
| MODIFIED | `packages/schemas/src/entities/ai/index.ts` (re-export) |
| NEW | `apps/api/src/services/accommodation-ai-context.ts` |
| NEW | `apps/api/src/services/ai-chat-persistence.ts` |
| NEW | `apps/api/src/routes/ai/protected/chat.ts` |
| MODIFIED | `apps/api/src/routes/ai/protected/index.ts` (uncomment SPEC-200 slot at line 45) |
| NEW | `apps/api/test/services/accommodation-ai-context.test.ts` |
| NEW | `apps/api/test/integration/ai/chat-route.test.ts` |
| NEW | `apps/web/src/lib/api/ai-chat-stream.ts` (+ tests) |
| NEW | `apps/web/src/hooks/useAccommodationChat.ts` (+ tests) |
| NEW | `apps/web/src/components/accommodation/AiChatFab.tsx` + `.module.css` |
| NEW | `apps/web/src/components/accommodation/AiChatWidget.tsx` + `.module.css` (+ tests) |
| MODIFIED | `apps/web/src/pages/[lang]/alojamientos/[slug].astro` (mount, gated on `isAuthenticated`) |
| MODIFIED | `packages/i18n/src/locales/{es,en,pt}/accommodations.json` (11 `aiChat.*` keys each) |

No changes to `@repo/ai-core`, `@repo/db` schema, `@repo/billing`, `@repo/service-core`, `apps/admin`, or root `package.json` (no new deps).
