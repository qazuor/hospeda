# Tasks — SPEC-200 AI Accommodation Chat (tourist)

## Overview

Atomize SPEC-200 into TDD-ordered work units, grouped by the two chained PRs from the proposal. PR 1 lands the backend (schemas → context → persistence → route → barrel → smoke); PR 2 lands the frontend (i18n → SSE client → hook → components → mount → E2E + smoke). Each PR is a self-contained vertical slice; PR 2 depends on PR 1 merged to staging. Owner decisions Q-1..Q-7 + Q-R1..Q-R7 already resolved 2026-06-05; the seven residual Q-R* are adopted as defaults (see delta spec §"Resolved design decisions").

## PR 1 — Backend (target branch: spec/SPEC-200-ai-accommodation-chat, base: staging)

**Estimated lines**: ~790
**Estimated tasks**: 6
**Review budget**: 800 (within budget; PR 2 870 = see forecast)
**Dependencies**: SPEC-173 (shipped), SPEC-198 (shipped)

### T-001: AiChatRequestSchema + SSE event schemas (packages/schemas) ✅

**Type**: feat
**Files**:

- NEW: `packages/schemas/src/entities/ai/ai-chat.schema.ts`
- MODIFIED: `packages/schemas/src/entities/ai/index.ts` (re-export)
**Test file**: NEW `packages/schemas/test/entities/ai/ai-chat.schema.test.ts`
**TDD steps**:

1. RED: schema test (valid request, missing field, invalid type, oversized messages, rejects >20, rejects 0, accepts 20, default 'es', .strict() rejects unknown keys)
2. GREEN: implement Zod schemas (AiChatMessageSchema, AiChatRequestSchema)
3. REFACTOR: extract helpers, add JSDoc
**Verifies**: REQ-200-4 (AC-4.1..4.3)
**Estimated lines**: 80

### T-002: assembleAccommodationContext service (apps/api) ✅

**Type**: feat
**Files**:

- NEW: `apps/api/src/services/accommodation-ai-context.ts`
- NEW: `apps/api/test/services/accommodation-ai-context.test.ts`
**TDD steps**:

1. RED: assert system prompt contains `---price-disclaimer---` instruction (AC-2.3)
2. RED: assert system prompt contains "unrelated to this specific accommodation" (Q-R5/AC-2.3)
3. RED: assert description truncated at 800 chars; FAQs capped at 10; amenities/features at 20 (AC-2.1, AC-2.2)
4. RED: assert NOT_FOUND thrown when `getById` returns null; NO PII substrings
5. GREEN: implement `assembleAccommodationContext(id)` + `buildChatSystemMessage(ctx)` using `accommodationService.getById` + `getFaqs`
**Verifies**: REQ-200-2 (AC-2.1..2.4)
**Estimated lines**: 200

### T-003: persistChatTurn helper (apps/api) ✅

**Type**: feat
**Files**:

- NEW: `apps/api/src/services/ai-chat-persistence.ts`
- NEW: `apps/api/test/services/ai-chat-persistence.test.ts`
**TDD steps**:

1. RED: happy path (first turn inserts aiConversations with contextNote JSON + 2 aiMessages; subsequent turn inserts only aiMessages)
2. RED: title stays null (Q-R1)
3. RED: throws on DB error (caller catches — AC-14 contract)
4. GREEN: implement with Drizzle direct (`getDb()`); provider + tokens from meta
**Verifies**: REQ-200-3 (AC-3.1, AC-3.2, AC-3.4)
**Estimated lines**: 150

### T-004: POST /api/v1/protected/ai/chat SSE route + PostHog (apps/api) ✅

**Type**: feat
**Files**:

- NEW: `apps/api/src/routes/ai/protected/chat.ts`
- NEW: `apps/api/test/integration/ai/chat-route.test.ts`
**TDD steps**:

1. RED: integration tests for AC-1 (401), AC-2 (quota 403 + ai_usage row), AC-3 (SSE token→done), AC-4 (system message), AC-6 (StubProvider [stub:flagged] → SSE error, no done), AC-7 (multi-turn forwarding), AC-8 (locale default 'es'), AC-9 (404 pre-stream), AC-10 (kill-switch 503), AC-11 (>20 msgs → 400), AC-12/13 (persistence row inspection), AC-14 (DB fail → done still emitted, apiLogger.error fires), AC-17 (PostHog capture spy), AC-18 (no PII in events)
2. GREEN: implement route with `createProtectedStreamingRoute` + middleware chain `[entitlementMiddleware(), ...createAiRateLimitMiddlewares('chat'), createAiQuotaMiddleware('chat')]` (entitlement FIRST per ai-quota.ts:11-13)
3. GREEN: assemble context, resolve system prompt, build messages[0].role==='system' (caller-wins injection)
4. GREEN: race `persistChatTurn` vs 1500ms timeout inside `meta.then`; augment done with `conversationId` on win
5. GREEN: PostHog events (ai_chat_opened, ai_chat_message_sent, ai_chat_response_completed, ai_chat_moderation_blocked, ai_chat_cap_reached) — server-side, no message content
**Verifies**: REQ-200-1, REQ-200-3 (AC-3.3), REQ-200-8, REQ-200-10, REQ-200-11
**Estimated lines**: 350

### T-005: Wire protected-AI barrel (apps/api) ✅

**Type**: chore
**Files**:

- MODIFIED: `apps/api/src/routes/ai/protected/index.ts` (uncomment reserved slot at line 45, add import)
**TDD steps**:

1. INSPECT: read existing barrel, verify reserved slot location
2. GREEN: uncomment, add import, register route
3. VERIFY: `pnpm --filter @repo/api test` + `pnpm --filter @repo/api typecheck` green
**Verifies**: REQ-200-1 wiring
**Estimated lines**: 10

### T-006: PR 1 staging smoke (manual + ops)

**Type**: ops
**Files**: none
**Steps**:

1. Merge PR 1 to staging
2. `pnpm env:check:registry` (CI gate)
3. Manual: log in as `tourist-plus@local.test`, POST to `/api/v1/protected/ai/chat` with curl, observe SSE stream + done.conversationId
4. Sign off in `.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md` (AI entitlement gate section)
**Verifies**: AC-1..AC-3, AC-9..AC-14, AC-17, AC-18
**Estimated lines**: 0 (manual)

### PR 1 totals

- Lines: ~790 (within 800-line budget)
- Tasks: 6 (5 code + 1 smoke)
- Review strategy: single PR, 1 reviewer from AI team + 1 from web team (for API contract)

## PR 2 — Frontend (target branch: spec/SPEC-200-ai-accommodation-chat, base: PR 1 merged into staging)

**Estimated lines**: ~870 (slightly over 800; see forecast below)
**Estimated tasks**: 6
**Review budget**: 800 (PR 2 over by 70; acceptable per forecast §budget_800_risk)
**Dependencies**: PR 1 merged

### T-007: i18n keys (packages/i18n)

**Type**: feat
**Files**:

- MODIFIED: `packages/i18n/src/locales/es/accommodations.json` (add `aiChat.*`)
- MODIFIED: `packages/i18n/src/locales/en/accommodations.json` (add `aiChat.*`)
- MODIFIED: `packages/i18n/src/locales/pt/accommodations.json` (add `aiChat.*`)
- NEW: `packages/i18n/test/locales/accommodations-ai-chat.test.ts` (verify all 3 locales have all 11 keys, non-empty)
**TDD steps**:

1. RED: write test asserting all 3 locales have 11 keys each (AC-7.1)
2. GREEN: add keys with owner-approved copy
3. VERIFY: `pnpm --filter @repo/i18n test` green
**Verifies**: REQ-200-7 (AC-7.1, AC-7.2)
**Estimated lines**: 80

### T-008: SSE client (apps/web)

**Type**: feat
**Files**:

- NEW: `apps/web/src/lib/api/ai-chat-stream.ts`
- NEW: `apps/web/test/lib/api/ai-chat-stream.test.ts`
**TDD steps**:

1. RED: happy path (parses `open` + `data` + `done` events, multi-line SSE)
2. RED: abort (signal between events → silent return, no stream_error)
3. RED: non-2xx → typed `stream_error` event, no parser runs
4. RED: malformed JSON line → swallowed, does not crash
5. GREEN: implement native `fetch` + `ReadableStream` + SSE envelope parser (~30 LoC)
**Verifies**: REQ-200-6 (AC-6.4)
**Estimated lines**: 120

### T-009: useAccommodationChat hook (apps/web)

**Type**: feat
**Files**:

- NEW: `apps/web/src/hooks/useAccommodationChat.ts`
- NEW: `apps/web/test/hooks/useAccommodationChat.test.ts`
**TDD steps**:

1. RED: initial state (`messages: []`, `conversationId: null`, `status: 'idle'`, `hasPartialContent: false`) — AC-6.1
2. RED: `sendMessage` → streaming transition
3. RED: token accumulation + `hasPartialContent: true`
4. RED: `done` → strip `---price-disclaimer---` marker, append assistant msg, store conversationId, transition to idle or at_cap (AC-6.3)
5. RED: `error` with `hasPartialContent` → clear `currentAssistantContent`, no append, status=error (AC-6.2 / R-4)
6. RED: `at_cap` when `messages.length === 20`; `reset` clears state
7. GREEN: implement state machine
**Verifies**: REQ-200-6 (AC-6.1..6.3)
**Estimated lines**: 200

### T-010: AiChatFab + AiChatWidget components (apps/web)

**Type**: feat
**Files**:

- NEW: `apps/web/src/components/accommodation/AiChatFab.tsx`
- NEW: `apps/web/src/components/accommodation/AiChatFab.module.css`
- NEW: `apps/web/src/components/accommodation/AiChatWidget.tsx`
- NEW: `apps/web/src/components/accommodation/AiChatWidget.module.css`
- NEW: `apps/web/test/components/accommodation/AiChatWidget.test.tsx`
**TDD steps**:

1. RED: render tests for all states (idle, sending, streaming, error, at_cap)
2. RED: a11y tests: focus trap (Tab cycles within panel), ESC closes + returns focus to FAB, role=dialog, aria-modal, aria-live="polite" (AC-9.1, 9.2, 9.3)
3. RED: axe a11y test — no `wcag2a`/`wcag2aa` violations (AC-9.4)
4. GREEN: implement FAB (presentation, fixed bottom-right, tokens only)
5. GREEN: implement Widget (focus trap + ESC + return focus; MessageList with `aria-live`; Composer; at-cap banner; error bubble; price notice)
6. GREEN: CSS Modules (NO Tailwind, per web/CLAUDE.md); verify z-index above Astro sticky header
**Verifies**: REQ-200-5, REQ-200-9 (AC-9.1..9.4)
**Estimated lines**: 250

### T-011: Mount in accommodation detail page (apps/web)

**Type**: chore
**Files**:

- MODIFIED: `apps/web/src/pages/[lang]/alojamientos/[slug].astro`
**TDD steps**:

1. INSPECT: read existing page, identify mount point + `isAuthenticated` extraction
2. GREEN: add `{isAuthenticated && <AiChatWidget client:idle accommodationId={accommodation.id} locale={locale} apiUrl={getApiUrl()} />}` after main content
3. VERIFY: page renders, island visible only when authenticated (AC-5.1, AC-5.2); NO `@repo/ai-core` import in web (AC-5.4)
**Verifies**: REQ-200-5 (AC-5.1, AC-5.2, AC-5.4)
**Estimated lines**: 20

### T-012: PR 2 staging smoke (manual) + E2E

**Type**: ops
**Files**:

- NEW: `apps/e2e/tests/ai/chat.spec.ts` (Playwright)
- NEW: `apps/e2e/tests/ai/chat-moderation.spec.ts` (Playwright)
**Steps**:

1. RED: Playwright test for happy path (open FAB → send message → see streamed response + disclaimer)
2. RED: Playwright test for moderation block (StubProvider [stub:flagged] via env → partial content discarded → neutral error)
3. GREEN: implement test fixtures (auth as `tourist-plus@local.test`)
4. VERIFY: `pnpm --filter @repo/e2e test:spec -- ai/` green
5. Manual: open staging detail page, verify FAB + chat end-to-end
6. Sign off in staging checklist
**Verifies**: AC-5, AC-6, AC-9, full E2E
**Estimated lines**: 200

### PR 2 totals

- Lines: ~870 (slightly over 800; see forecast §budget_800_risk — orchestrator may split T-010 off if reviewer pushback)
- Tasks: 6 (5 code + 1 smoke + E2E)
- Review strategy: single PR, 1 reviewer from web team

## Review Workload Forecast

| Field | Value |
|-------|-------|
| PR 1 (backend) | 790 lines, 6 tasks |
| PR 2 (frontend) | 870 lines, 6 tasks |
| Total change | 1660 lines across 2 PRs |
| Review budget | 800 (per PR) |
| 400-line budget risk | Medium (both PRs exceed 400; both fit 800) |
| 800-line budget risk | PR 2 slightly over (870) — flag for orchestrator |
| Chained PRs recommended | Yes (auto-forecast) |
| Chain strategy | stacked-to-main |
| Decision needed before apply | No (chained PRs accepted; PR 2 over-budget is the only flag) |

## Guard contract (literal, plain text — required by review workload guard)

```
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium
```

## Open implementation decisions (sdd-tasks → sdd-apply level)

- **T-004 SSE done-payload shape**: adopt design §3.1 — `{ ...StreamTextFinalMeta, conversationId?: string }`. The factory `JSON.stringify`s the metaValue, so plain-object extension is backward compatible.
- **T-009 aria-live timing**: announce on `done` arrival, not on every token (avoids screen-reader spam per Q-R2).
- **T-010 widget z-index**: above the Astro sticky header. Verify `var(--z-modal)` exists in web tokens; define in tokens.css if missing.
- **T-010 PostHog import path**: grep `text-improve.ts` for the existing `posthog.capture` import; mirror it. Likely `apps/api/src/utils/posthog.ts`.
- **T-010 `apiUrl` prop**: pass as a string from the SSR `getApiUrl()` helper — do NOT read `import.meta.env` client-side (per apps/web/CLAUDE.md env rule).
- **T-012 E2E seed data**: verify `packages/seed/src/data/accommodations.ts` has an accommodation with at least one FAQ for the E2E flow; add if missing.
- **T-008 SSE parser**: 30 LoC is fine (YAGNI per D-1); do not add `eventsource-parser` dependency.

## Dependencies (external)

- SPEC-173 (@repo/ai-core): shipped, no action
- SPEC-198 (text-improve, pattern ref): shipped, no action
- SPEC-143 (billing testing coverage, staging smoke gate): in scope for the staging sign-off (entitlement gate only — not billing CORE; prod smoke NOT required)

## Task ordering (TDD RED-first)

1. T-001 (schemas first, since everything depends on the types)
2. T-002 (context assembly, depends on schemas)
3. T-003 (persistence, depends on schemas)
4. T-004 (route + integration tests, depends on T-001, T-002, T-003)
5. T-005 (barrel wiring, depends on T-004)
6. T-006 (PR 1 staging smoke)
7. T-007 (i18n, parallel-safe with T-008..T-010)
8. T-008 (SSE client)
9. T-009 (hook, depends on T-008)
10. T-010 (components, depends on T-009)
11. T-011 (mount, depends on T-010)
12. T-012 (PR 2 smoke + E2E)

## Work-unit commits

- Each task = 1 work-unit commit (RED + GREEN + REFACTOR + verify in one)
- Conventional-commits style (per CLAUDE.md); git-commit-helper available
- Per SPEC-143: AI-entitlement surface change requires staging smoke sign-off in `.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md` before merge to staging
