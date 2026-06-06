# SPEC-173: AI Foundation Package (provider-agnostic @repo/ai-core)

## Progress: 0/42 tasks (0%)

**Average Complexity:** 2.5/3 (max)
**Critical Path (weighted):** T-008 -> T-010 -> T-011 -> T-014 -> T-015 -> T-024 -> T-029 -> T-031 -> T-037 -> T-038 -> T-042 (11 steps, weighted 32)
**Parallel Tracks:** 9 independent starts at Level 0

All 42 tasks have complexity ≤ 3. No tasks flagged for manual review.

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Scaffold @repo/ai-core package skeleton
  - package.json/tsconfig/vitest + empty src module dirs + barrel; workspace+turbo wiring
  - Blocked by: none
  - Blocks: T-002, T-012

- [ ] **T-002** (complexity: 1) - Add Vercel AI SDK dependencies to @repo/ai-core
  - ai + @ai-sdk/openai + @ai-sdk/anthropic (MIT, runs on VPS)
  - Blocked by: T-001
  - Blocks: T-005, T-006

- [ ] **T-003** (complexity: 2) - Register HOSPEDA_AI_VAULT_MASTER_KEY env var
  - @repo/config registry + apps/api env.ts Zod + .env.example; STOP+flag Coolify
  - Blocked by: none
  - Blocks: T-021

### Core Phase

- [ ] **T-004** (complexity: 3) - Create ai_settings + ai_prompt_versions DB schemas
  - Q7 JSONB blob mirroring platform_settings; versioned prompts
  - Blocked by: none
  - Blocks: T-010, T-016

- [ ] **T-005** (complexity: 3) - Create ai_provider_credentials + ai_credential_audit DB schemas
  - Q1 dedicated audit table (append-only); encrypted-key columns
  - Blocked by: T-002
  - Blocks: T-021

- [ ] **T-006** (complexity: 3) - Create ai_usage + ai_request_log DB schemas
  - centavos cost + reporting indexes; PII-scrubbed request log
  - Blocked by: T-002
  - Blocks: T-016

- [ ] **T-007** (complexity: 2) - Create ai_conversations + ai_messages DB schemas
  - generic multi-turn container (used by chat child spec)
  - Blocked by: none
  - Blocks: none

- [ ] **T-008** (complexity: 3) - Author core AI Zod schemas in @repo/schemas
  - Q3 SSoT: ai-settings config blob, provider, prompt schemas
  - Blocked by: none
  - Blocks: T-010, T-016

- [ ] **T-009** (complexity: 2) - Author AI capability + intent Zod schemas in @repo/schemas
  - capability req/res + locale; typed intent for extractIntent
  - Blocked by: none
  - Blocks: T-013

- [ ] **T-010** (complexity: 3) - Implement @repo/ai-core storage module
  - the ONLY module touching @repo/db (AC-4 isolation)
  - Blocked by: T-004, T-008
  - Blocks: T-011, T-016

- [ ] **T-011** (complexity: 3) - Implement AI config resolver + cache invalidation
  - per-feature resolution; explicit invalidate-on-write (R-7)
  - Blocked by: T-010
  - Blocks: T-014

- [ ] **T-012** (complexity: 3) - Define AiProvider interface + StubProvider
  - SDK-free interface; deterministic stub (R-6)
  - Blocked by: T-001
  - Blocks: T-013

- [ ] **T-013** (complexity: 3) - Implement Vercel OpenAI + Anthropic provider adapters
  - wrap SDK behind interface; key-by-param (AC-4); moderate in OpenAI (Q4)
  - Blocked by: T-009, T-012
  - Blocks: T-014, T-019

- [ ] **T-014** (complexity: 3) - Implement engine routing + fallback + retries
  - per-feature primary+fallback (AC-2); V2 routing hook
  - Blocked by: T-011, T-013
  - Blocks: T-015

- [ ] **T-015** (complexity: 3) - Implement AiService public capabilities surface
  - generateText/object/intent/moderate/embed-iface; locale param (FR-13)
  - Blocked by: T-014
  - Blocks: T-024, T-035, T-036, T-039

- [ ] **T-016** (complexity: 3) - Implement usage metering recorder + cost calculator
  - ai_usage rows (AC-7) + tokens→centavos
  - Blocked by: T-004, T-006, T-008, T-010
  - Blocks: T-017, T-018, T-031

- [ ] **T-017** (complexity: 3) - Implement cost ceiling + kill-switch tracking
  - hard-stop on breach (AC-8); kill-switch (AC-9)
  - Blocked by: T-016
  - Blocks: T-025

- [ ] **T-018** (complexity: 2) - Implement usage reporting query helpers
  - aggregate per user/feature/month (FR-7)
  - Blocked by: T-006, T-016
  - Blocks: T-023, T-033

- [ ] **T-019** (complexity: 3) - Implement prompt-injection guard + PII scrubber
  - injection detect; PII redact before Sentry/PostHog (AC-11)
  - Blocked by: T-013
  - Blocks: T-020, T-035

- [ ] **T-020** (complexity: 2) - Wire moderation pass into AiService flow
  - input/output moderation via AiProvider.moderate (Q4)
  - Blocked by: T-019
  - Blocks: none

- [ ] **T-021** (complexity: 3) - Implement AES-256-GCM vault crypto util in apps/api
  - encrypt/decrypt with master key (§5.5), only in apps/api (AC-4)
  - Blocked by: T-003, T-005
  - Blocks: T-022

- [ ] **T-022** (complexity: 3) - Implement credential vault service + audit writes
  - create/rotate/delete + ai_credential_audit row each (Q1, AC-3 store half)
  - Blocked by: T-021
  - Blocks: T-023, T-026

- [ ] **T-023** (complexity: 2) - Add AI_SETTINGS_MANAGE permission + seed wiring
  - SUPER_ADMIN-only (SPEC-164 pattern)
  - Blocked by: T-018, T-022
  - Blocks: T-026, T-027, T-028

- [ ] **T-024** (complexity: 3) - Implement streamText capability in @repo/ai-core
  - async-iterable tokens (FR-10); fallback on stream path
  - Blocked by: T-015
  - Blocks: T-029, T-036

- [ ] **T-025** (complexity: 3) - Implement cost threshold alerts via @repo/notifications
  - 50/80/100% alerts to SUPER_ADMIN (AC-8 alert half)
  - Blocked by: T-017
  - Blocks: T-037

- [ ] **T-030** (complexity: 3) - Add AI entitlement + limit keys in @repo/billing
  - Q2 snake_case gates + max_ai_<feature>_per_month limits + per-plan defaults
  - Blocked by: none
  - Blocks: T-031

- [ ] **T-034** (complexity: 2) - Wire prompt resolution with in-code default fallback
  - in-code default when admin prompt empty/invalid (AC-12)
  - Blocked by: T-011, T-028
  - Blocks: none

### Integration Phase

- [ ] **T-026** (complexity: 3) - Create admin AI credential vault routes
  - /admin/ai/credentials* guarded by AI_SETTINGS_MANAGE; masked responses
  - Blocked by: T-022, T-023
  - Blocks: T-033, T-037

- [ ] **T-027** (complexity: 3) - Create admin AI settings routes
  - /admin/ai/settings* get/update blob; schema-validate + cache-invalidate (AC-1)
  - Blocked by: T-011, T-023
  - Blocks: T-033, T-038

- [ ] **T-028** (complexity: 2) - Create admin AI prompt-version routes
  - /admin/ai/prompts* list/create/activate versioned prompts
  - Blocked by: T-023
  - Blocks: T-034

- [ ] **T-029** (complexity: 3) - Implement createStreamingRoute() SSE factory
  - text/event-stream factory + ResponseFactory SSE path (AC-10)
  - Blocked by: T-024
  - Blocks: T-031, T-038

- [ ] **T-031** (complexity: 3) - Wire AI quota enforcement into apps/api
  - login-required (AC-5) + per-feature 403 (AC-6); reuse entitlementMiddleware
  - Blocked by: T-016, T-029, T-030
  - Blocks: T-032, T-037

- [ ] **T-032** (complexity: 2) - Apply sliding-window rate-limit to AI endpoints
  - reuse createSlidingWindowPerUserRateLimit() (Q6 — no new counter)
  - Blocked by: T-031
  - Blocks: none

- [ ] **T-033** (complexity: 2) - Create admin AI usage reporting routes
  - /admin/ai/usage* aggregates guarded by AI_SETTINGS_MANAGE
  - Blocked by: T-018, T-026, T-027
  - Blocks: none

- [ ] **T-035** (complexity: 2) - Wire Sentry + PostHog observability
  - errors/fallbacks + per-feature usage events; PII-scrubbed (AC-11)
  - Blocked by: T-015, T-019
  - Blocks: none

### Testing Phase

- [ ] **T-036** (complexity: 2) - Write AC-4 no-env/no-vault static guard test
  - scan src/** for process.env + @repo/db outside storage/ (AC-4)
  - Blocked by: T-015, T-024
  - Blocks: none

- [ ] **T-037** (complexity: 3) - Write vault round-trip + enforcement integration tests
  - AC-3 ciphertext+audit; AC-5/AC-6 enforcement; AC-8 ceiling
  - Blocked by: T-025, T-026, T-031
  - Blocks: T-038

- [ ] **T-038** (complexity: 3) - Write streaming + provider-swap E2E tests
  - AC-10 SSE; AC-1 provider swap; AC-2 fallback; ≥90% coverage (AC-13)
  - Blocked by: T-027, T-029, T-037
  - Blocks: T-042

### Docs Phase

- [ ] **T-039** (complexity: 1) - Write @repo/ai-core README + usage guide
  - public API, config, locale, credential-by-param (FR-14)
  - Blocked by: T-015
  - Blocks: none

- [ ] **T-040** (complexity: 2) - Write ADR for AI foundation architecture
  - architecture + Q1-Q7 resolved decisions
  - Blocked by: none
  - Blocks: none

- [ ] **T-041** (complexity: 1) - Write packages/ai-core/CLAUDE.md
  - package conventions + add-a-provider recipe
  - Blocked by: none
  - Blocks: none

### Cleanup Phase

- [ ] **T-042** (complexity: 2) - Final coverage + lint/typecheck verification pass
  - green across touched packages; ≥90% coverage (AC-13); no forbidden patterns
  - Blocked by: T-038
  - Blocks: none

---

## Dependency Graph (execution levels)

```
Level 0:  T-001, T-003, T-004, T-007, T-008, T-009, T-030, T-040, T-041
Level 1:  T-002, T-010, T-012
Level 2:  T-005, T-006, T-011, T-013
Level 3:  T-014, T-016, T-019, T-021
Level 4:  T-015, T-017, T-018, T-020, T-022
Level 5:  T-023, T-024, T-025, T-035, T-039
Level 6:  T-026, T-027, T-028, T-029, T-036
Level 7:  T-031, T-033, T-034
Level 8:  T-032, T-037
Level 9:  T-038
Level 10: T-042
```

## Parallel Tracks (independent starts)

- Track A (package/engine): T-001 -> T-002 -> T-012 -> T-013 -> T-014 -> T-015 -> T-024 -> T-029 (critical)
- Track B (db schemas): T-004, T-005, T-006, T-007 (independent of each other)
- Track C (schemas SSoT): T-008, T-009 (@repo/schemas)
- Track D (billing keys): T-030 (independent until T-031)
- Track E (docs): T-040, T-041 (anytime)
- Track F (vault): T-003 -> T-021 -> T-022 (joins at T-023)

## Suggested Start

Begin with **T-008** (complexity: 3) — it has no dependencies and sits at the head of the
weighted critical path (unblocks the storage module → resolver → engine chain). In parallel,
kick off **T-004** (db schemas), **T-001** (package skeleton), and **T-030** (billing keys) —
all Level-0 with no dependencies, feeding distinct tracks.

```
