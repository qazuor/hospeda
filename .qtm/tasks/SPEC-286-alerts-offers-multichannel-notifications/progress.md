# SPEC-286 — Alerts & Offers — Multichannel Notifications

## Task Progress

**Status**: In Progress — Task planning complete, implementation pending  
**Created**: 2026-06-30  
**Total Tasks**: 12 | **Completed**: 0/12 | **Average Complexity**: 3.8

---

## Phase Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| P1 — Rename VIP_PROMOTIONS_ACCESS | T-001 | pending |
| P2 — Alert subscription model + gates | T-002, T-003, T-004, T-005 | pending |
| P3 — Evaluation engine + daily-digest cron | T-006, T-007 | pending |
| P4 — Channel-agnostic delivery + email | T-008, T-009 | pending |
| P5 — Web UI | T-010, T-011 | pending |
| P6 — Owner-promotion event wiring (SPEC-285 dep) | T-012 | pending |

---

## Critical Path

```
T-002 → T-003 → T-004 → T-006 → T-007
                            ↑
                          T-008 (parallel track, must complete before T-007)
```

Longest sequential chain by complexity: T-002(3) + T-003(3) + T-004(5) + T-006(4) + T-007(4) = **19 units**.

---

## Parallel Tracks

```
Track A (Alert Core)   : T-002 → T-003 → T-004 → T-005
                                                ↓
                                               T-006 → T-007
Track B (Delivery)     : T-008 → T-009           ↑ (merge)
Track C (Frontend)     : (T-005 done) → T-010 → T-011
Track D (Rename)       : T-001 (fully independent)
Track E (P6 wiring)    : T-004 + T-007 + T-008 → T-012
```

---

## Dependency Graph

| Task | blockedBy | blocks |
|------|-----------|--------|
| T-001 | — | — |
| T-002 | — | T-003 |
| T-003 | T-002 | T-004 |
| T-004 | T-003 | T-005, T-006, T-012 |
| T-005 | T-004 | T-010, T-011 |
| T-006 | T-004 | T-007 |
| T-007 | T-006, T-008 | T-012 |
| T-008 | — | T-007, T-009, T-012 |
| T-009 | T-008 | — |
| T-010 | T-005 | T-011 |
| T-011 | T-005, T-010 | — |
| T-012 | T-004, T-007, T-008 | — |

**External dependency**: T-012 requires SPEC-285 to be merged to staging.

---

## Task List

### T-001 — Rename VIP_PROMOTIONS_ACCESS to VIP_VISIBILITY_ACCESS

- **Phase**: P1 (setup) | **Complexity**: 5 | **Status**: pending
- **Key files**: packages/billing/src/types/entitlement.types.ts, packages/billing/src/config/entitlements.config.ts, packages/billing/src/config/plans.config.ts, packages/service-core/src/services/accommodation/accommodation.service.ts (6 checks), packages/service-core/src/services/accommodation/accommodation.permissions.ts (1 check), apps/admin/src/features/billing-plans/components/plan-entitlement-groups.ts, packages/i18n/src/types.ts, test files
- **DB**: extras migration to rename 'vip_promotions_access' → 'vip_visibility_access' in billing_entitlements + billing_plans.entitlements JSONB
- **Mandatory regression test**: VIP actor still bypasses visibility filters after rename

### T-002 — Add PriceAlert Zod schemas to @repo/schemas

- **Phase**: P2 (setup) | **Complexity**: 3 | **Status**: pending
- **Key files**: packages/schemas/src/entities/price-alert/price-alert.schema.ts, packages/schemas/src/common/id.schema.ts (PriceAlertIdSchema)

### T-003 — Create tourist_price_alerts DB table, migration, and BaseModel

- **Phase**: P2 (core) | **Complexity**: 3 | **Status**: pending
- **Key files**: packages/db/src/schemas/alert/tourist_price_alerts.dbschema.ts, packages/db/src/models/alert/touristPriceAlert.model.ts, migration 0037_* (structural carril)
- **Design note**: includes base_price_snapshot column (integer centavos) — price at subscription time used for % drop comparison

### T-004 — Implement AlertSubscriptionService in @repo/service-core

- **Phase**: P2 (core) | **Complexity**: 5 | **Status**: pending
- **Key files**: packages/service-core/src/services/alert/alert-subscription.service.ts
- Methods: create, remove, list, countActive

### T-005 — Mount /protected/price-alerts API routes with gateAlerts() gate

- **Phase**: P2 (integration) | **Complexity**: 4 | **Status**: pending
- **Key files**: apps/api/src/routes/price-alert/protected/{create,remove,list}.ts, apps/api/src/routes/index.ts, docs/billing/endpoint-gate-matrix.md
- Context pre-population: countActive → set 'currentActiveAlertsCount' before gateAlerts()

### T-006 — Implement PriceDropEvaluator service

- **Phase**: P3 (core) | **Complexity**: 4 | **Status**: pending
- **Key files**: packages/service-core/src/services/alert/price-drop-evaluator.service.ts
- Env var: HOSPEDA_ALERT_PRICE_DROP_THRESHOLD_PCT (default 5); register in @repo/config + apps/api/src/utils/env.ts

### T-007 — Create alerts-digest daily cron job

- **Phase**: P3 (core) | **Complexity**: 4 | **Status**: pending
- **Key files**: apps/api/src/cron/jobs/alerts-digest.job.ts
- Schedule: '0 8 ** *' | Mirror: trial-expiry.ts pattern | Includes promo-offer stub until T-012

### T-008 — Channel-agnostic delivery abstraction in @repo/notifications

- **Phase**: P4 (core) | **Complexity**: 4 | **Status**: pending
- **Key files**: packages/notifications/src/services/alert-delivery.service.ts, packages/notifications/src/services/channels/email-alert.channel.ts, packages/notifications/src/types/alert.types.ts
- NotificationChannel interface is the extension point for future WhatsApp/push transports

### T-009 — Alert email templates (AlertDigestEmail + i18n keys)

- **Phase**: P4 (core) | **Complexity**: 3 | **Status**: pending
- **Key files**: packages/notifications/src/templates/alerts/{AlertDigestEmail,PriceDropItem,PromoOfferItem}.tsx, packages/i18n (notifications.alerts.digest.* keys)

### T-010 — Web alert management page (/cuenta/alertas)

- **Phase**: P5 (integration) | **Complexity**: 4 | **Status**: pending
- **Key files**: apps/web/src/pages/[lang]/cuenta/alertas.astro, apps/web/src/components/alerts/{AlertList,AlertItem,AlertEmptyState}.astro

### T-011 — 'Alert me for price drops' button on accommodation detail page

- **Phase**: P5 (integration) | **Complexity**: 3 | **Status**: pending
- **Key files**: apps/web/src/components/accommodation/PriceAlertButton.tsx, apps/web/src/pages/[lang]/alojamientos/[slug].astro (SSR prop wiring)

### T-012 — PromoOfferEvaluator + wire into digest cron + close SPEC-285 TODO stub

- **Phase**: P6 (integration) | **Complexity**: 4 | **Status**: pending
- **Key files**: packages/service-core/src/services/alert/promo-offer-evaluator.service.ts, apps/api/src/cron/jobs/alerts-digest.job.ts (update), packages/service-core/src/services/owner-promotion/ownerPromotion.lifecycle-events.ts (close TODO)
- **External dependency**: SPEC-285 must be merged to staging before deploy

---

## Key Decisions (locked — do not re-open)

- **D-1** Triggers: price drop (% threshold) + new owner promo (from SPEC-285 event)
- **D-2** Per-plan limits: free=0 alerts, plus=5, vip=20 (MAX_ACTIVE_ALERTS)
- **D-3** Cadence: daily digest at 8 AM, one email per user
- **D-4** Email-only in v1; channel-agnostic abstraction built to accept WhatsApp/push later
- **D-5** VIP_PROMOTIONS_ACCESS renamed to VIP_VISIBILITY_ACCESS (behavior unchanged)

---

## Notes

- T-001 is fully independent of T-002..T-012 — can be implemented in a separate PR first.
- T-008 (delivery abstraction) is also fully independent — can be parallelized with Track A.
- T-012 is the last task and depends on SPEC-285 being merged; it is safe to implement the code but the deploy must wait.
- The `gateAlerts()` function in apps/api/src/middlewares/tourist-entitlements.ts already exists as a phantom gate — T-005 is the first consumer to actually mount it.
