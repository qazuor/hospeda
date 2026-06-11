# SPEC-216: Owner = superset of tourist

## Progress: 7/12 tasks (58%)

**Phase A (catalog prune) — DONE & verified.** Phase B (inheritance) + C (seed/docs) pending.

---

### Phase A — Part 0 catalog prune (user-approved, 8 entitlements removed)

- [x] **T-001** Prune 8 entitlements from billing core
- [x] **T-002** Prune i18n labels (es/en/pt) + regenerate types
- [x] **T-003** Prune admin UI + ungate social-link fields
- [x] **T-004** Prune api gates + cross-package tests
- [x] **T-005** Update billing count tests (44->36)
- [x] **T-006** Absence test for the 8 removed keys
- [x] **T-007** Verify prune (build + typecheck + billing/api/admin tests green)

### Phase B — Owner inherits tourist-VIP

- [ ] **T-008** Define TOURIST_VIP_ENTITLEMENTS + TOURIST_VIP_LIMITS; refactor tourist-vip to reuse
- [ ] **T-009** Spread the constants into all 3 owner + 3 complex plans
- [ ] **T-010** Superset / no-dup / owner-preserved unit tests
- [ ] **T-011** Integration test: owner passes a previously-403 tourist gate

### Phase C — Seed + docs

- [ ] **T-012** Re-seed billing_plans + DB cleanup of removed keys + docs (owner-superset rule)

---

## Audit verdict

See `.qtm/specs/SPEC-216-owner-inherits-tourist-entitlements/docs/part0-audit-verdict.md`.
Removed: airport_transfers, concierge_service, white_label, multi_channel_integration,
social_media_integration, early_access_events, dedicated_manager, api_access.
