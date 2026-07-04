# HOS-64: Social Posts — Settings Enforcement Fix

## Progress: 0/43 tasks (0%)

**Average Complexity:** 2.2/3 (max)
**Decomposition:** 3 passes (macro → split → score-and-adjust; all 43 tasks landed at complexity ≤ 3)
**Critical Path:** T-004 -> T-006 -> T-017 -> T-020 -> T-024 -> T-025 -> T-033 -> T-034 -> T-039 -> T-042 -> T-043 (11 steps)
**Parallel Tracks:** 11 dependency levels (0-10); G-1 and G-2 run fully in parallel with the start of G-4

Sequencing note: goals are ordered **G-1 (T-001…T-009, T-036) → G-2 (T-003, T-010…T-013, T-037, T-040) → G-4 (everything else)** per the spec's own Implementation Notes. Within G-4, the critical path enforces R-2: **T-042 (remove legacy env vars) is blocked by both T-038 (staging verified) and T-039 (prod verified)**, which are blocked by T-033/T-034 (migration run per environment), which are blocked by T-025 (migration script) — env var removal is structurally impossible before the migration runs and is verified, in either environment.

---

### Setup Phase

- [ ] **T-001** (complexity: 1) - Decide social credentials vault permission gate
  - Reuse SOCIAL_SETTINGS_MANAGE (default) or add SOCIAL_CREDENTIALS_MANAGE
  - Blocked by: none
  - Blocks: T-017, T-026

- [ ] **T-002** (complexity: 1) - Register HOSPEDA_SOCIAL_VAULT_MASTER_KEY env var
  - Registry + Zod validation + .env.example placeholder
  - Blocked by: none
  - Blocks: T-017, T-033, T-041

- [ ] **T-003** (complexity: 1) - Seed 5 new operational social_settings rows
  - max_retry_count, make_webhook_timeout_ms, download_timeout_ms, social_assets_folder, dispatch_cron_cadence
  - Blocked by: none
  - Blocks: T-010, T-011, T-012

- [ ] **T-004** (complexity: 2) - Create social_credentials Drizzle schema
  - Mirrors ai_provider_credentials.dbschema.ts, partial unique index on key
  - Blocked by: none
  - Blocks: T-006

- [ ] **T-005** (complexity: 2) - Create social_credential_audit Drizzle schema
  - Mirrors ai_credential_audit.dbschema.ts, append-only
  - Blocked by: none
  - Blocks: T-006

- [ ] **T-006** (complexity: 2) - Generate and apply social vault migration
  - pnpm db:generate + db:migrate for both new tables
  - Blocked by: T-004, T-005
  - Blocks: T-017

### Core Phase

- [ ] **T-007** (complexity: 2) - Create pure hashtag-limit validation function
  - New pure util, no DB/IO, exhaustive edge-case unit tests
  - Blocked by: none
  - Blocks: T-008

- [ ] **T-008** (complexity: 3) - Enforce hashtag limits in draft ingestion
  - Regression test first (AC-2), then reject over-limit drafts
  - Blocked by: T-007
  - Blocks: T-009, T-036, T-040

- [ ] **T-009** (complexity: 2) - Surface hashtag-limit errors at the route layer
  - Map VALIDATION_ERROR to HTTP 400 in drafts.ts
  - Blocked by: T-008
  - Blocks: T-036

- [ ] **T-010** (complexity: 3) - Read retry count and webhook timeout from settings
  - Replace MAX_RETRY_COUNT/MAKE_WEBHOOK_TIMEOUT_MS constants, add R-1 bounds
  - Blocked by: T-003
  - Blocks: T-037, T-040

- [ ] **T-011** (complexity: 2) - Read download timeout and assets folder from settings
  - Replace constants in social-image-pipeline.service.ts
  - Blocked by: T-003
  - Blocks: T-037

- [ ] **T-012** (complexity: 3) - Read and validate dispatch cron cadence setting
  - New pattern: settings-driven cron expression, validated + fallback
  - Blocked by: T-003
  - Blocks: T-013

- [ ] **T-013** (complexity: 3) - Wire settings-driven cadence into dispatch cron job
  - Replace hard-coded schedule literal in social-publish-dispatch.job.ts
  - Blocked by: T-012
  - Blocks: T-037, T-040

- [ ] **T-014** (complexity: 2) - Extract shared secret-vault crypto util
  - New secret-vault-crypto.ts, parameterized master-key, pulled from ai-vault.ts
  - Blocked by: none
  - Blocks: T-015, T-016, T-017

- [ ] **T-015** (complexity: 2) - Reduce ai-vault.ts to a thin wrapper
  - No behavior change; existing AI vault tests must still pass
  - Blocked by: T-014
  - Blocks: none

- [ ] **T-016** (complexity: 2) - Add focused unit tests for shared crypto util
  - First dedicated unit test for this crypto logic (round-trip, tamper, missing key)
  - Blocked by: T-014
  - Blocks: none

- [ ] **T-017** (complexity: 3) - Implement createSocialCredential vault function
  - New social-credential-vault.service.ts, transactional create + audit
  - Blocked by: T-006, T-014, T-001, T-002
  - Blocks: T-018, T-019, T-020, T-025, T-026

- [ ] **T-018** (complexity: 2) - Implement rotateSocialCredential vault function
  - Re-encrypt in place + audit row
  - Blocked by: T-017
  - Blocks: T-027

- [ ] **T-019** (complexity: 3) - Implement updateMetadata and delete vault functions
  - Metadata update + soft-delete, each with audit row
  - Blocked by: T-017
  - Blocks: T-027

- [ ] **T-020** (complexity: 2) - Implement getDecrypted and list vault functions
  - Internal decrypt (never HTTP-exposed) + masked list
  - Blocked by: T-017
  - Blocks: T-021, T-022, T-023, T-024, T-026, T-040

- [ ] **T-021** (complexity: 3) - Migrate operator PIN check to read from vault
  - drafts.ts validateOperatorPin() reads from vault, timingSafeEqual unchanged
  - Blocked by: T-020
  - Blocks: T-038

- [ ] **T-022** (complexity: 2) - Migrate x-make-apikey header send-site to vault
  - social-publish-dispatch.service.ts
  - Blocked by: T-020
  - Blocks: T-038

- [ ] **T-023** (complexity: 3) - Migrate x-hospeda-ai-key inbound check to vault
  - Shared auth code — regression tests for every consuming route
  - Blocked by: T-020
  - Blocks: T-038

- [ ] **T-024** (complexity: 3) - Migrate make_webhook_url read-site and retire the settings row
  - Vault decrypt in dispatchTarget(); remove row from seed
  - Blocked by: T-020
  - Blocks: T-025, T-038

- [ ] **T-025** (complexity: 3) - Write one-time vault data migration script
  - Reads current env vars + make_webhook_url row, seeds vault, idempotent
  - Blocked by: T-017, T-024
  - Blocks: T-033

### Integration Phase

- [ ] **T-026** (complexity: 3) - Create admin routes: list and create social credentials
  - Mirrors AI vault's admin route pattern
  - Blocked by: T-001, T-017, T-020
  - Blocks: T-027, T-028, T-035

- [ ] **T-027** (complexity: 3) - Create admin routes: rotate, update, delete social credentials
  - Same permission gate, one audit row per mutation (AC-5)
  - Blocked by: T-018, T-019, T-026
  - Blocks: T-028, T-035

- [ ] **T-028** (complexity: 2) - Build admin TanStack Query hooks for social credentials
  - Mirrors apps/admin/src/features/ai-settings/
  - Blocked by: T-026, T-027
  - Blocks: T-029

- [ ] **T-029** (complexity: 3) - Build social credentials admin list page
  - Mirrors ai/credentials.tsx card layout, masked list only
  - Blocked by: T-028
  - Blocks: T-030, T-031, T-032

- [ ] **T-030** (complexity: 3) - Add create and rotate dialogs to credentials page
  - Password-type inputs, no plaintext round-trip
  - Blocked by: T-029
  - Blocks: none

- [ ] **T-031** (complexity: 2) - Add edit-metadata and delete dialogs to credentials page
  - Blocked by: T-029
  - Blocks: none

- [ ] **T-032** (complexity: 1) - Register social credentials page in admin navigation
  - Blocked by: T-029
  - Blocks: none

- [ ] **T-033** (complexity: 2) - Run vault data migration in staging
  - R-2 step 2 — operational, legacy env vars stay in place
  - Blocked by: T-025, T-002
  - Blocks: T-034, T-038

- [ ] **T-034** (complexity: 2) - Run vault data migration in production
  - R-2 step 2 — only after staging succeeds
  - Blocked by: T-033
  - Blocks: T-039

### Testing Phase

- [ ] **T-035** (complexity: 3) - Write social credentials vault roundtrip integration test
  - Mirrors vault-roundtrip.test.ts; asserts audit-per-mutation + no plaintext leakage
  - Blocked by: T-026, T-027
  - Blocks: T-038

- [ ] **T-036** (complexity: 2) - Write cross-platform hashtag enforcement integration test
  - At-limit, over-limit, zero, multi-platform partial-violation
  - Blocked by: T-008, T-009
  - Blocks: none

- [ ] **T-037** (complexity: 3) - Write settings-driven dispatch behavior integration test
  - All 5 G-2 settings read at runtime + R-1 bounds fallback
  - Blocked by: T-010, T-011, T-013
  - Blocks: none

- [ ] **T-038** (complexity: 2) - Verify vault reads work end-to-end in staging
  - R-2 step 3 — manual smoke, `status-needs-smoke-staging`
  - Blocked by: T-021, T-022, T-023, T-024, T-033, T-035
  - Blocks: T-039, T-042

- [ ] **T-039** (complexity: 2) - Verify vault reads work end-to-end in production
  - R-2 step 3 — manual smoke, `status-needs-smoke-prod`, gates AC-7
  - Blocked by: T-034, T-038
  - Blocks: T-042

### Docs Phase

- [ ] **T-040** (complexity: 1) - Document G-1/G-2/G-4 in relevant CLAUDE.md files
  - Blocked by: T-008, T-010, T-013, T-020
  - Blocks: none

- [ ] **T-041** (complexity: 1) - Document HOSPEDA_SOCIAL_VAULT_MASTER_KEY in env docs
  - Blocked by: T-002
  - Blocks: none

### Cleanup Phase

- [ ] **T-042** (complexity: 2) - Remove legacy plaintext env vars (AC-7)
  - R-2 step 4 — the ONLY task allowed to remove the 4 legacy env vars
  - Blocked by: T-038, T-039
  - Blocks: T-043

- [ ] **T-043** (complexity: 1) - Unset legacy env vars in Coolify
  - Operational, human-executed, both environments
  - Blocked by: T-042
  - Blocks: none

---

## Dependency Graph

```
Level 0:  T-001, T-002, T-003, T-004, T-005, T-007, T-014
Level 1:  T-006, T-008, T-010, T-011, T-012, T-015, T-016, T-041
Level 2:  T-009, T-013, T-017
Level 3:  T-018, T-019, T-020, T-036, T-037
Level 4:  T-021, T-022, T-023, T-024, T-026, T-040
Level 5:  T-025, T-027
Level 6:  T-028, T-033, T-035
Level 7:  T-029, T-034, T-038
Level 8:  T-030, T-031, T-032, T-039
Level 9:  T-042
Level 10: T-043
```

Critical Path: T-004 -> T-006 -> T-017 -> T-020 -> T-024 -> T-025 -> T-033 -> T-034 -> T-039 -> T-042 -> T-043 (11 steps, entirely G-4 — confirms the vault + its R-2 rollout sequencing is the true bottleneck of this spec, not the G-1/G-2 work)

## Suggested Start

Begin with **T-007** (complexity: 2) - Create pure hashtag-limit validation function. It has no dependencies, is the first step of G-1 (the smallest, most independent, fully-speced goal per the spec's own sequencing note), and unblocks T-008 immediately. Alternatively, **T-001/T-002/T-003/T-004/T-005/T-014** are all equally unblocked at level 0 and can run in parallel with T-007 if working across G-1/G-2/G-4 setup simultaneously.
