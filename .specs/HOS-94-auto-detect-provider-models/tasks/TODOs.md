# HOS-94: Auto-detect provider models (sync model catalog from provider API) — hybrid

## Progress: 0/15 tasks (0%)

**Average Complexity:** 2.6/3 (max)
**Critical Path:** T-001 → T-007 → T-008 → T-010 → T-013 → T-015 (6 steps)
**Parallel Tracks:** 4 identified (fetcher / schemas+logic / shared-catalog / guard)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Add Zod schemas for detected models + sync result in @repo/schemas
  - AiProviderModelSchema + AiSyncModelsResultSchema + tests
  - Blocked by: none
  - Blocks: T-006, T-007, T-008, T-009

- [ ] **T-002** (complexity: 3) - Extract curated provider catalog (KNOWN_PROVIDERS) into a shared module
  - Move inline admin KNOWN_PROVIDERS into a module reachable by api+admin
  - Blocked by: none
  - Blocks: T-007

### Core Phase

- [ ] **T-003** (complexity: 3) - Standalone listProviderModels() fetcher — OpenAI + compatible
  - New ai-core/providers/list-models.ts, plain fetch, no @ai-sdk, no adapter edit (OQ-4)
  - Blocked by: none
  - Blocks: T-004, T-005, T-008, T-014

- [ ] **T-004** (complexity: 3) - Fetcher: Anthropic + Google Gemini cases
  - Anthropic x-api-key headers; Gemini /v1beta/models + models/ prefix strip
  - Blocked by: T-003
  - Blocks: T-013

- [ ] **T-005** (complexity: 2) - Fetcher: Ollama case + per-provider baseURL convention
  - Ollama /api/tags; OQ-5 path convention per providerId
  - Blocked by: T-003
  - Blocks: T-013

- [ ] **T-006** (complexity: 3) - Chat-capability filter (denylist + 'uncertain' bucket)
  - OQ-1: hide embeddings/tts/dall-e/moderation/deprecated; unknown → uncertain
  - Blocked by: T-001
  - Blocks: T-008

- [ ] **T-007** (complexity: 2) - Merge detected ∪ curated (source annotation)
  - detected/curated/both; curated metadata wins; de-dup
  - Blocked by: T-001, T-002
  - Blocks: T-008

- [ ] **T-008** (complexity: 3) - Sync-models orchestration service in apps/api
  - decrypt → fetch → filter → merge; typed errors; secret hygiene
  - Blocked by: T-001, T-003, T-006, T-007
  - Blocks: T-009, T-010

### Integration Phase

- [ ] **T-009** (complexity: 3) - Admin route POST /credentials/{providerId}/sync-models
  - createAdminRoute action-POST, AI_SETTINGS_MANAGE, gate-matrix + OpenAPI
  - Blocked by: T-001, T-008
  - Blocks: T-011, T-013

- [ ] **T-010** (complexity: 3) - Auto-sync on credential create/rotate (fail-open)
  - OQ-2 hard req: sync failure must NOT break credential save
  - Blocked by: T-008
  - Blocks: T-013

- [ ] **T-011** (complexity: 3) - Admin UI — 'Sync models' button + mutation + detected/curated render
  - TanStack Query mutation; source badges; preserve toggle + custom-add; persist to metadata.models
  - Blocked by: T-009
  - Blocks: T-012

- [ ] **T-012** (complexity: 2) - Admin UI — loading / empty / error states for sync
  - Loading, empty ('no models detected'), error banner + retry; i18n
  - Blocked by: T-011
  - Blocks: none

### Testing Phase

- [ ] **T-013** (complexity: 3) - Integration tests — sync-models endpoint across all providers
  - Fixtures per provider; filter + merge + fail-open assertions; no real calls
  - Blocked by: T-004, T-005, T-009, T-010
  - Blocks: T-015

- [ ] **T-014** (complexity: 2) - Isolation guard — fetcher stays SDK-free and env-free
  - ac4 guard: no @ai-sdk / no process.env / no @repo/db in list-models.ts
  - Blocked by: T-003
  - Blocks: none

### Docs Phase

- [ ] **T-015** (complexity: 2) - Docs + gate-matrix + i18n finalization
  - Update api/ai-core docs; gate-matrix row; i18n keys (es/en/pt); no env var
  - Blocked by: T-013
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-003
Level 1: T-004, T-005, T-006, T-007, T-014
Level 2: T-008
Level 3: T-009, T-010
Level 4: T-011, T-013
Level 5: T-012, T-015

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, unblocks 4 tasks (T-006, T-007, T-008, T-009). T-002 and T-003 are also dependency-free and can run in parallel (T-003 unblocks the whole fetcher track).
