# SPEC-212: Conversational AI Accommodation Search

## Progress: 0/18 tasks (0%)

**Average Complexity:** 2.4/3 (max)
**Critical Path:** T-001 -> T-008 -> T-009 -> T-010 -> T-011 -> T-012 -> T-016 (7 steps)
**Parallel Tracks:** API track (T-003..T-007) and Web track (T-008..T-011) run in parallel after setup.

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Add AiSearchChatRequestSchema + SSE event schemas to @repo/schemas
  - Zod schemas: request + filters/token/done/error events. Single source of truth.
  - Blocked by: none
  - Blocks: T-003, T-004, T-008

- [ ] **T-002** (complexity: 2) - Extend DEFAULT_PROMPTS['search'] for conversational + injected-state framing
  - Full-updated-set framing; preserve SPEC-199 single-shot behavior.
  - Blocked by: none
  - Blocks: T-003

### Core Phase

- [ ] **T-003** (complexity: 3) - Implement buildConversationalSearchPrompt in search-chat.prompt.ts
  - Inject current filters + bounded history + message + amenity allowlist.
  - Blocked by: T-001, T-002
  - Blocks: T-005, T-017

- [ ] **T-004** (complexity: 3) - Scaffold POST /ai/search-chat SSE route + middleware chain
  - Auth + entitlement + rate-limit + quota; body validation.
  - Blocked by: T-001
  - Blocks: T-005, T-006, T-007

- [ ] **T-005** (complexity: 3) - generateObject -> mapIntentToSearchParams -> emit 'filters' event
  - Emit filters BEFORE the reply (D-9).
  - Blocked by: T-003, T-004
  - Blocks: T-006, T-009, T-017

- [ ] **T-006** (complexity: 3) - streamText reply -> 'token' events -> terminal 'done'
  - No exact result count in reply (D-8).
  - Blocked by: T-004, T-005
  - Blocks: T-007, T-014

- [ ] **T-007** (complexity: 2) - Best-effort turn persistence (feature='search')
  - Reuse persistChatTurn; failure non-fatal.
  - Blocked by: T-004, T-006
  - Blocks: T-014

### Integration Phase

- [ ] **T-008** (complexity: 3) - search-chat-stream.ts SSE client (web)
  - Adapt from ai-chat-stream.ts; emit filters/token/done/error.
  - Blocked by: T-001
  - Blocks: T-009

- [ ] **T-009** (complexity: 3) - useSearchChat.ts hook (client-echo + accumulated filters + lifecycle)
  - On filters event -> GET public/accommodations.
  - Blocked by: T-005, T-008
  - Blocks: T-010

- [ ] **T-010** (complexity: 3) - SearchChatPanel.client.tsx + module CSS
  - Thread + streamed reply + results grid in-panel; 'pensando...' state.
  - Blocked by: T-009
  - Blocks: T-011, T-012, T-015

- [ ] **T-011** (complexity: 2) - Active-filter chips (removable)
  - Removing a chip re-runs the search.
  - Blocked by: T-010
  - Blocks: T-012, T-015

- [ ] **T-012** (complexity: 2) - Mount panel on listing; retire SPEC-199 single-input UI
  - One AI search surface only.
  - Blocked by: T-010, T-011
  - Blocks: T-013, T-016, T-018

- [ ] **T-013** (complexity: 1) - Retire SPEC-199 search-intent route (consult owner)
  - Delete after confirming no external consumer.
  - Blocked by: T-012
  - Blocks: none

### Testing Phase

- [ ] **T-014** (complexity: 3) - API integration suite (stub provider)
  - Happy path + auth/entitlement/quota/rate-limit + empty/garbage + persistence non-fatal.
  - Blocked by: T-006, T-007
  - Blocks: none

- [ ] **T-015** (complexity: 3) - Web component + multi-turn refine test
  - Tokens, search-on-filters, results grid, chips, refine.
  - Blocked by: T-010, T-011
  - Blocks: none

- [ ] **T-016** (complexity: 3) - E2E: type -> filters -> results -> refine -> results update
  - Blocked by: T-012
  - Blocks: none

- [ ] **T-017** (complexity: 2) - Local OpenAI-compatible provider regression guard
  - No grammar-breaking date-regex (cf. #1569).
  - Blocked by: T-003, T-005
  - Blocks: none

### Docs Phase

- [ ] **T-018** (complexity: 1) - AI feature docs + SPEC-199 cross-reference + count trade-off
  - Blocked by: T-012
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002
Level 1: T-003, T-004, T-008
Level 2: T-005
Level 3: T-006, T-009, T-017
Level 4: T-007, T-010
Level 5: T-011, T-014
Level 6: T-012, T-015
Level 7: T-013, T-016, T-018

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, unblocks T-003, T-004, and T-008 (both the API and web tracks).
