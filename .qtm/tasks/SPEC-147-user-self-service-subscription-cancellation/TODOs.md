# SPEC-147: User self-service subscription cancellation

## Progress: 0/16 tasks (0%)

**Average Complexity:** 2.4/10
**Critical Path:** T-005 → T-006 → T-012 → T-014 → T-015 → T-016 (+ T-001 bump gates the e2e)
**Blocked:** T-001 (qzpay PR #42 publish — owner handles)

---

### Setup Phase

- [ ] **T-001** (cx 1) — Bump qzpay-core@1.12.0 + mercadopago@2.2.0 — BLOCKED on qzpay #42 publish | blocks T-012, T-013
- [ ] **T-002** (cx 1) — USER_CANCELED + FINALIZE_CANCELLED_SUB event types | blocks T-005, T-009
- [ ] **T-003** (cx 2) — HOSPEDA_USER_CANCEL_ENABLED feature flag (opt-in) | blocks T-005

### Core Phase

- [ ] **T-004** (cx 2) — SUBSCRIPTION_CANCEL_CONFIRMED notification + template | blocks T-005
- [ ] **T-005** (cx 3) — subscription-cancel.service.ts soft-cancel (red-first) | blocked by T-002,T-003,T-004 | blocks T-006,T-012
- [ ] **T-006** (cx 3) — POST /subscriptions/:id/cancel for users (behind flag) | blocked by T-005 | blocks T-012
- [ ] **T-007** (cx 3) — Webhook PAUSED collision patch (keep ACTIVE when cancelAtPeriodEnd) | blocked by T-005 | blocks T-012
- [ ] **T-008** (cx 2) — Gate change-plan + start-paid on soft-cancel pending (Q7) | blocked by T-005 | blocks T-012

### Integration Phase

- [ ] **T-009** (cx 3) — finalize-cancelled-subs cron (red-first) | blocked by T-002 | blocks T-013
- [ ] **T-010** (cx 3) — D3 access-ending reminder + scheduling | blocked by T-009 | blocks T-013
- [ ] **T-011** (cx 2) — GET subscription surfaces soft-cancel state | blocked by T-005 | blocks T-012

### Testing Phase

- [ ] **T-012** (cx 3) — e2e: soft-cancel happy + collision + gate | blocked by T-001,T-006,T-007,T-008,T-011 | blocks T-014
- [ ] **T-013** (cx 3) — e2e: finalize cron + idempotency + D3 | blocked by T-001,T-009,T-010 | blocks T-014
- [ ] **T-014** (cx 2) — Verification sweep | blocked by T-012,T-013 | blocks T-015
- [ ] **T-015** (cx 3) — Adversarial review + fixes | blocked by T-014 | blocks T-016

### Docs Phase

- [ ] **T-016** (cx 2) — Smoke entry #7 + PR + CI + merge + closeout | blocked by T-015

---

## Dependency Graph

Level 0: T-001 (blocked), T-002, T-003, T-004
Level 1: T-005, T-009
Level 2: T-006, T-007, T-008, T-010, T-011
Level 3: T-012, T-013
Level 4: T-014
Level 5: T-015
Level 6: T-016

## Suggested Start

T-002, T-003, T-004 (no deps, unblock T-005) can start NOW — they don't need the qzpay bump.
T-001 is BLOCKED on qzpay PR #42 publishing (owner-driven). The e2e tasks (T-012/T-013) need T-001;
the core/integration code can be written and unit-tested before the bump (the cancel call signature
is unchanged — only the provider-pause side effect arrives with the bump).

## Notes

- Backend ships DARK: HOSPEDA_USER_CANCEL_ENABLED stays false until SPEC-203 (UI) ships. Phase 3 (UI) is out of this spec.
- qzpay PR #42 = the B.1 prerequisite (cancel() provider propagation). Owner handles its merge+publish.
