# SPEC-194: Billing Lifecycle Robustness & Bug Fixes

## Progress: 0/30 tasks (0%)

**Average Complexity:** 2.2/10
**Critical Path:** T-001 -> T-002 -> T-006 -> T-007 -> T-019 -> T-027 -> T-028 -> T-029 -> T-030 (9 steps)
**Parallel Tracks:** 5+ (trial chain T-004..T-005..T-016; addon chain T-012..T-013, T-014..T-015; independents T-010/T-017/T-018/T-020/T-023/T-025/T-026)

---

### Setup Phase (state-machine foundation)

- [ ] **T-001** (3) - Design subscription status transition table + guard helper — blocks T-002, T-003
- [ ] **T-002** (3) - Migrate the 6 free-form status-write sites onto the guard — blocked by T-001
- [ ] **T-003** (3) - Canonicalize ABANDONED vocab (incomplete_expired → abandoned) — blocked by T-001

### Core Phase (CRITICAL + HIGH + MEDIUM bugs)

- [ ] **T-004** (2) - Red regression test: trial-expiry advisory lock guards nothing
- [ ] **T-005** (3) - Fix blockExpiredTrials lock structure (ADR-019) — blocked by T-004
- [ ] **T-006** (2) - Red regression tests: refund revokes nothing (admin + webhook) — blocked by T-002
- [ ] **T-007** (3) - Refund (admin) revokes access + clears cache + transitions state — blocked by T-006
- [ ] **T-008** (3) - Refund (MP webhook) applies the same policy — blocked by T-006, T-007
- [ ] **T-009** (1) - Dunning non-payment cancellation clears entitlement cache — blocked by T-002
- [ ] **T-010** (2) - Trial-expiry notifications fire (inject sender)
- [ ] **T-011** (3) - Scheduled-change apply is idempotent — blocked by T-002
- [ ] **T-012** (3) - Addon split-state reconciliation (re-apply missing grants)
- [ ] **T-013** (2) - Polling treats ADDON_ALREADY_ACTIVE as terminal success — blocked by T-012
- [ ] **T-014** (2) - Addon-expiry notification not skipped between queries
- [ ] **T-015** (2) - Batch/paginate addon-expiry processing — blocked by T-014
- [ ] **T-016** (2) - Paginate blockExpiredTrials trialing load — blocked by T-005
- [ ] **T-017** (2) - Align downgrade price comparison to normalized intervals
- [ ] **T-018** (1) - Add idempotencyKeyMiddleware to /change-plan

### Integration Phase (LOW / hardening)

- [ ] **T-019** (3) - Partial-refund modeling + refund audit trail — blocked by T-007
- [ ] **T-020** (2) - Advisory lock for exchange-rate cron
- [ ] **T-021** (2) - Stop writing deprecated addonAdjustments metadata — blocked by T-012
- [ ] **T-022** (2) - Abandoned-sub user notification — blocked by T-003
- [ ] **T-023** (2) - Guard annual-sub pause behavior
- [ ] **T-024** (1) - Pin scheduled-change CronJobResult error contract — blocked by T-011
- [ ] **T-025** (2) - Thread customer locale into return URLs
- [ ] **T-026** (2) - Dispute manual-contract pinning test + runbook

### Testing Phase

- [ ] **T-027** (2) - Post-change mock sweep + per-package typecheck — blocked by all code tasks
- [ ] **T-028** (2) - Quality gate + adversarial review — blocked by T-027

### Docs Phase

- [ ] **T-029** (1) - Register deferred smoke sections + docs — blocked by T-028
- [ ] **T-030** (2) - PR(s) to staging (chained-PR decision with owner), CI green, merge — blocked by T-029

---

## Suggested Start

**T-001** (state-machine table + guard) — foundation for refund/dunning/cancel/trial chains. T-004, T-010, T-012, T-014, T-017, T-018 can interleave (no deps).
