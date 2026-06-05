# SPEC-145: Billing Entitlements & Limits Enforcement

## Progress: 0/29 tasks (0%)

**Average Complexity:** 2.3/10
**Critical Path:** T-001 -> T-004/005/006 -> T-012 -> T-016/018/019/020 -> T-026 -> T-027 -> T-028 -> T-029
**Parallel-eligible (sequential agents, no deps between):** T-002, T-003, T-011 can interleave with the matrix work

---

### Setup Phase

- [ ] **T-001** (3) - Author endpoint-gate-matrix.md — blocks all wiring + snapshot guard
- [ ] **T-002** (3) - Unify gate error contract to ServiceError (INV-2; 12 phantom gates + requireEntitlement/requireLimit)
- [ ] **T-003** (2) - Remove residual as-EntitlementKey/LimitKey casts (ADR-021)

### Core Phase (gate wiring)

- [ ] **T-004** (3) - Accommodation gates: publish + edit — blocked by T-001
- [ ] **T-005** (3) - Promotion + review gates — blocked by T-001
- [ ] **T-006** (3) - Stats + gallery gates — blocked by T-001
- [ ] **T-007** (2) - MAX_PROPERTIES/MAX_STAFF stub resolution — blocked by T-001
- [ ] **T-008** (2) - Favorites matrix decisions — blocked by T-001
- [ ] **T-009** (2) - Phantom gates documented dead code — blocked by T-001
- [ ] **T-011** (3) - Admin customer-entitlement grant/revoke route pair (NEW route)

### Integration Phase (e2e enforcement coverage)

- [ ] **T-010** (2) - Staff bypass JSDoc + e2e (INV-6) — blocked by T-004
- [ ] **T-012** (3) - Block tests per gate (403 ENTITLEMENT_REQUIRED) — blocked by T-002, T-004/005/006
- [ ] **T-013** (2) - Allow tests per gate — blocked by T-004/005/006
- [ ] **T-014** (3) - Limit N+1 tests (LIMIT_REACHED + details) — blocked by T-002
- [ ] **T-015** (3) - Plan-change elevation/restriction e2e — blocked by T-004/005/006
- [ ] **T-016** (2) - Admin override e2e — blocked by T-011, T-012
- [ ] **T-017** (2) - Addon limit elevation e2e — blocked by T-014
- [ ] **T-018** (2) - Refund/cancel revocation route-level e2e — blocked by T-012
- [ ] **T-019** (2) - Trial grant/expiry route-level e2e — blocked by T-012
- [ ] **T-020** (2) - Stale-cache regression guard (INV-1) — blocked by T-012
- [ ] **T-021** (3) - Transversal cache-invalidation test (INV-1 master guard) — blocked by T-011

### Testing Phase

- [ ] **T-022** (3) - Route snapshot guard test (CI gate) — blocked by T-001 + wiring
- [ ] **T-025** (2) - Chunked coverage 100% on 4 enforcement files — blocked by T-002, T-009
- [ ] **T-026** (2) - Mock sweep + typechecks — blocked by all code tasks
- [ ] **T-027** (2) - Quality gate + adversarial review — blocked by T-026

### Docs Phase

- [ ] **T-023** (1) - adding-an-entitlement.md — blocked by T-022
- [ ] **T-024** (1) - CLAUDE.md enforcement model updates — blocked by T-022
- [ ] **T-028** (1) - Smoke registration — blocked by T-027
- [ ] **T-029** (2) - PR + CI + merge + closeout — blocked by T-028

---

## Suggested Start

**T-001** (gate matrix) — it drives every wiring decision and the snapshot guard. T-002/T-003/T-011 have no deps and can interleave.
