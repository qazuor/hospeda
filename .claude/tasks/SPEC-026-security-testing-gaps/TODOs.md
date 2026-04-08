# TODOs: Security Testing Gaps

Spec: SPEC-026 | Status: pending | Progress: 0/18

## Phase 1 - Webhook Route Security Tests (3 tasks)

- [ ] T-001: Analyze webhook route and QZPay integration (complexity: 2)
- [ ] T-002: Write integration tests for webhook signature handling (complexity: 4)
- [ ] T-003: Write integration tests for webhook idempotency with DB verification (complexity: 3)

## Phase 2 - Brute-Force / Account Lockout (5 tasks)

- [ ] T-004: Add lockout env vars to ApiEnvSchema (complexity: 1)
- [ ] T-005: Create auth-lockout store (complexity: 4)
- [ ] T-006: Integrate lockout handler into auth handler (complexity: 4)
- [ ] T-007: Write unit tests for auth-lockout store (complexity: 3)
- [ ] T-008: Write integration test for login lockout flow (complexity: 4)

## Phase 3 - Audit Logging (6 tasks)

- [ ] T-009: Create audit-logger utility (complexity: 3)
- [ ] T-010a: Add audit log calls to authorization middleware (complexity: 2)
- [ ] T-010b: Add audit log calls to billing admin routes (complexity: 3)
- [ ] T-010c: Add audit log calls to user admin routes and signout (complexity: 3)
- [ ] T-011: Write unit tests for audit logger (complexity: 2)
- [ ] T-012: Write integration test for audit log production (complexity: 3)

## Phase 4 - Session Invalidation Tests (2 tasks)

- [ ] T-013: Write integration tests for session invalidation on signout (complexity: 4)
- [ ] T-014: Verify signout flow with multiple sessions (complexity: 3)

## Phase 5 - Verification (2 tasks)

- [ ] T-015: Run full test suite and verify zero regressions (complexity: 2)
- [ ] T-016: Update SPEC-019 notes and close SPEC-026 (complexity: 1)

---

## Cross-Spec References

- **SPEC-019** (Security & Permissions Hardening): This spec closes testing gaps identified in the SPEC-019 exhaustive audit. SPEC-019 hardened the code; SPEC-026 verifies the hardening with tests and adds missing protective mechanisms (account lockout, audit logging).
- **SPEC-024** (Credential Rotation): Independent. Can run in parallel.
- **SPEC-025** (Staging Environment): SPEC-026 tests should pass before staging deployment.

## Dependency Graph

```
Phase 1:
  T-001 ─┬─ T-002
         └─ T-003

Phase 2:
  T-004 ── T-005 ─┬─ T-006 ─┐
                   └─ T-007 ─┤
                              └─ T-008

Phase 3:
  T-009 ─┬─ T-010a ─┐
          ├─ T-010b ─┤
          ├─ T-010c ─┤
          └─ T-011  ─┤
                      └─ T-012

Phase 4:
  T-013 ── T-014

Phase 5:
  All of T-002..T-014 ── T-015 ── T-016
```

## Cross-Phase Dependencies

- T-006 imports from T-009 (audit logger). Recommended: implement T-009 first.
- T-010a, T-010b, T-010c can be implemented in parallel (different files).
- Phases 1, 2, 3, and 4 can be developed in parallel.
- Phase 5 depends on ALL previous phases.

## Complexity Summary

- Total tasks: 18
- Total complexity points: 51
- Average complexity: 2.8
- Max complexity: 4 (T-005, T-002, T-006, T-008, T-013)

## Revision History (spec.md v9, 2026-03-09)

### v9 External Verification Audit (2026-03-09)
- Clarified Better Auth issue #7035 is Elysia.js-specific, not applicable to Hono
- Better Auth returns HTTP 401 for invalid credentials with Hono (confirmed via docs research)
- Defensive body check in T-006 retained as safety net but documented as unlikely to activate
- Risk entry for #7035 reduced: probability Medium→Low, impact High→Medium
- Verified QZPay v1.1.0 source in node_modules: HMAC algorithm, extractId, double verification, sandbox behavior

### v8 Exhaustive Audit (2026-03-10)
- Fixed MercadoPago env vars to use HOSPEDA_ prefix (9 occurrences)
- Added Better Auth 200-with-error-body pattern detection (now documented as Elysia.js-specific)
- Fixed authorization.ts denial count (5→6)
- Fixed signout.ts ip variable scoping

### v7 Cross-Verification Audit (2026-03-09)
- Removed duplicate client-ip.ts creation (getClientIp already exists in rate-limit.ts)
- T-005 complexity reduced 5→4, total 52→51
- Added missing 6th denial point in T-010a (system actor rejection)
- Documented QZPay divergence from official MercadoPago docs
- Fixed all stale line number references
- Fixed signout.ts IP extraction description (uses shared getClientIp, not inline)
- Fixed Known Limitation: getClientIp respects trustProxy config

### v6 Exhaustive Audit and Task Decomposition (2026-03-06)
- Split T-010 (complexity 6) into T-010a/b/c (complexity 2/3/3) per atomic task ceiling
- Pre-documented QZPay HMAC algorithm (signed payload format, rejection status 401, replay window 300s)
- Added: forget-password payload in T-008, getQZPayBilling() note in T-001, section 2.3 cross-refs in T-010a/b/c, cleanup note in T-013, billingWebhookEvents INSERT example in T-003
- Fixed: transformApiInputToDomain description, apiLogger import clarification in T-006
