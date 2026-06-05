# SPEC-145 Behavior Changes — New 403 Gates

> Generated 2026-06-05. Feeds the PR description and the staging smoke entry
> for SPEC-145 (Billing Entitlements & Limits Enforcement).

## Purpose

This document lists every route that gained a **new 403 response** as a result
of SPEC-145 gate wiring. Before SPEC-145, these routes were ungated and
returned 2xx (or a service-level error) regardless of the caller's plan.
After SPEC-145, callers without the required entitlement receive:

```json
{
  "success": false,
  "error": {
    "code": "ENTITLEMENT_REQUIRED",
    "message": "...",
    "details": { "requiredEntitlement": "<key>" }
  }
}
```

## New-403 Inventory (16 routes)

| Route | Required Key | Blocked Tiers | Notes |
|---|---|---|---|
| `POST /api/v1/protected/accommodations` | `PUBLISH_ACCOMMODATIONS` | tourist-free, tourist-standard, tourist-premium | Tourists cannot publish |
| `POST /api/v1/protected/accommodations/draft` | `PUBLISH_ACCOMMODATIONS` | tourist-free, tourist-standard, tourist-premium | Tourists cannot draft |
| `POST /api/v1/protected/accommodations/start` | `PUBLISH_ACCOMMODATIONS` | tourist-free, tourist-standard, tourist-premium | Host onboarding blocked for tourists |
| `PUT /api/v1/protected/accommodations/{id}` | `EDIT_ACCOMMODATION_INFO` | tourist-free, tourist-standard, tourist-premium | Tourists cannot edit accommodation |
| `PATCH /api/v1/protected/accommodations/{id}` | `EDIT_ACCOMMODATION_INFO` | tourist-free, tourist-standard, tourist-premium | Tourists cannot patch accommodation |
| `POST /api/v1/protected/accommodations/{id}/faqs` | `EDIT_ACCOMMODATION_INFO` | tourist-free, tourist-standard, tourist-premium | Tourists cannot add FAQs |
| `PUT /api/v1/protected/accommodations/{id}/faqs/{faqId}` | `EDIT_ACCOMMODATION_INFO` | tourist-free, tourist-standard, tourist-premium | Tourists cannot update FAQs |
| `POST /api/v1/protected/owner-promotions` | `CREATE_PROMOTIONS` | tourist-*, owner-basico | Only owner-pro+ can create promotions |
| `PATCH /api/v1/protected/owner-promotions/{id}` | `CREATE_PROMOTIONS` | tourist-*, owner-basico | Only owner-pro+ can edit promotions |
| `PUT /api/v1/protected/owner-promotions/{id}` | `CREATE_PROMOTIONS` | tourist-*, owner-basico | Only owner-pro+ can update promotions |
| `POST /api/v1/protected/accommodations/{id}/reviews` | `WRITE_REVIEWS` | owner-basico, owner-pro, owner-complex | **ALL hosts blocked** — intentional, owner decision 2026-06-05 (conflict-of-interest) |
| `POST /api/v1/protected/destinations/{id}/reviews` | `WRITE_REVIEWS` | owner-basico, owner-pro, owner-complex | **ALL hosts blocked** — intentional, owner decision 2026-06-05 (conflict-of-interest) |
| `GET /api/v1/protected/accommodations/my/favorites-breakdown` | `VIEW_ADVANCED_STATS` | tourist-*, owner-basico | Only owner-pro+ can see advanced stats |
| `GET /api/v1/protected/accommodations/my/market-comparison` | `VIEW_ADVANCED_STATS` | tourist-*, owner-basico | Only owner-pro+ can see advanced stats |
| `GET /api/v1/protected/conversations/me/response-rate` | `VIEW_BASIC_STATS` | tourist-free, tourist-standard, tourist-premium | Tourists cannot see stats |
| `GET /api/v1/protected/conversations/me/monthly-inquiries` | `VIEW_BASIC_STATS` | tourist-free, tourist-standard, tourist-premium | Tourists cannot see stats |

## Key Decisions

### WRITE_REVIEWS — host lockout is intentional

Hosts on all owner/complex plans (owner-basico, owner-pro, owner-complex)
intentionally **cannot** write reviews. This is a conflict-of-interest policy:
hosts must not review competitor accommodations. Hosts retain `RESPOND_REVIEWS`
(responding to reviews of their own properties).

Decision recorded: owner sign-off 2026-06-05. Reference: SPEC-145 spec.md
Revision History, `docs/billing/endpoint-gate-matrix.md` review rows,
`enforcement-gates.test.ts` Gate 4 comment.

### PUBLISH / EDIT block tourists

Tourist tiers (free/standard/premium) have no host capabilities. Any route
that modifies accommodation content requires `PUBLISH_ACCOMMODATIONS` or
`EDIT_ACCOMMODATION_INFO`, which are host-only entitlements.

### CREATE_PROMOTIONS blocks basico

Owner-basico is an entry-level host plan without promotion capabilities.
Only owner-pro and owner-complex (and staff bypass) can manage promotions.

### VIEW_ADVANCED / VIEW_BASIC block by tier

Stats are plan-gated:

- `VIEW_BASIC_STATS`: owner-basico+ (tourists have no stats at all).
- `VIEW_ADVANCED_STATS`: owner-pro+ (owner-basico sees basic only).

## Staff Bypass

Staff roles (SUPER_ADMIN, ADMIN, EDITOR, CLIENT_MANAGER) bypass all
entitlement gates unconditionally. None of the 403s above apply to staff.
Reference: `entitlement.ts:290-303`, tested in `enforcement-staff-bypass.test.ts`.

## Staging Smoke Coverage

The enforcement-gates.test.ts e2e suite covers all 16 routes listed above
(one BLOCK + one ALLOW pair per gate). Before merging to staging, run the
relevant sections of `.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md`
to verify 403 behavior against real plan data.
