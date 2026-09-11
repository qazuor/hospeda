# SPEC-145 Behavior Changes — New 403 Gates

> Generated 2026-06-05. Feeds the PR description and the staging smoke entry
> for SPEC-145 (Billing Entitlements & Limits Enforcement).
>
> **Historical snapshot, not a live reference (HOS-331).** This document
> records the gate wiring as it existed at SPEC-145 time. Some of the specific
> tier assignments below were later changed by HOS-16 / SPEC-216 — e.g. the
> WRITE_REVIEWS host-lockout described under "Key Decisions" was reversed
> (owner/complex plans now inherit `WRITE_REVIEWS` via the tourist-VIP
> entitlement set; see `apps/api/src/routes/accommodation/reviews/protected/create.ts`),
> and `owner-basico` now also carries `CREATE_PROMOTIONS`. For the current
> per-plan entitlement/limit truth, always check
> `packages/billing/src/config/plans.config.ts` rather than this file.

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

## New-403 Inventory (20 routes)

| Route | Required Key | Blocked Tiers | Notes |
|---|---|---|---|
| `POST /api/v1/protected/accommodations` | `PUBLISH_ACCOMMODATIONS` | tourist-free, tourist-plus, tourist-vip | Tourists cannot publish |
| `POST /api/v1/protected/accommodations/draft` | `PUBLISH_ACCOMMODATIONS` | tourist-free, tourist-plus, tourist-vip | Tourists cannot draft |
| `POST /api/v1/protected/host-onboarding/start` | exception | none | Onboarding funnel remains open for authenticated tourists; the owner trial still starts on first publish, not at draft creation |
| `PUT /api/v1/protected/accommodations/{id}` | `EDIT_ACCOMMODATION_INFO` | tourist-free, tourist-plus, tourist-vip | Tourists cannot edit accommodation |
| `PATCH /api/v1/protected/accommodations/{id}` | `EDIT_ACCOMMODATION_INFO` | tourist-free, tourist-plus, tourist-vip | Tourists cannot patch accommodation |
| `POST /api/v1/protected/accommodations/{id}/faqs` | `EDIT_ACCOMMODATION_INFO` | tourist-free, tourist-plus, tourist-vip | Tourists cannot add FAQs |
| `PUT /api/v1/protected/accommodations/{id}/faqs/{faqId}` | `EDIT_ACCOMMODATION_INFO` | tourist-free, tourist-plus, tourist-vip | Tourists cannot update FAQs |
| `POST /api/v1/protected/owner-promotions` | `CREATE_PROMOTIONS` | tourist-*, owner-basico | Only owner-pro+ can create promotions — **REVERSED by HOS-16**: `owner-basico` now grants `CREATE_PROMOTIONS` (`MAX_ACTIVE_PROMOTIONS: 2`) |
| `PATCH /api/v1/protected/owner-promotions/{id}` | `CREATE_PROMOTIONS` | tourist-*, owner-basico | Only owner-pro+ can edit promotions — **REVERSED by HOS-16** (see above) |
| `PUT /api/v1/protected/owner-promotions/{id}` | `CREATE_PROMOTIONS` | tourist-*, owner-basico | Only owner-pro+ can update promotions — **REVERSED by HOS-16** (see above) |
| `POST /api/v1/protected/accommodations/{id}/reviews` | `WRITE_REVIEWS` | owner-basico, owner-pro, owner-premium | **ALL hosts blocked** — intentional, owner decision 2026-06-05 (conflict-of-interest). **REVERSED by SPEC-216**: owner plans inherit `WRITE_REVIEWS` via the tourist-VIP spread |
| `POST /api/v1/protected/destinations/{id}/reviews` | `WRITE_REVIEWS` | owner-basico, owner-pro, owner-premium | **ALL hosts blocked** — intentional, owner decision 2026-06-05 (conflict-of-interest). **REVERSED by SPEC-216** (see above) |
| `GET /api/v1/protected/accommodations/my/favorites-breakdown` | `VIEW_ADVANCED_STATS` | tourist-*, owner-basico | Only owner-pro+ can see advanced stats |
| `GET /api/v1/protected/accommodations/my/market-comparison` | `VIEW_ADVANCED_STATS` | tourist-*, owner-basico | Only owner-pro+ can see advanced stats |
| `GET /api/v1/protected/conversations/me/response-rate` | `VIEW_BASIC_STATS` | tourist-free, tourist-plus, tourist-vip | Tourists cannot see stats |
| `GET /api/v1/protected/conversations/me/monthly-inquiries` | `VIEW_BASIC_STATS` | tourist-free, tourist-plus, tourist-vip | Tourists cannot see stats |
| `POST /api/v1/protected/commerce/listings/gastronomy` | `PUBLISH_GASTRONOMY` | **none in practice** | HOS-1074 — see the note below |
| `POST /api/v1/protected/commerce/listings/experience` | `PUBLISH_EXPERIENCE` | **none in practice** | HOS-1074 — see the note below |
| `PATCH /api/v1/protected/gastronomies/{id}` | `EDIT_GASTRONOMY_INFO` | **none in practice** | HOS-1074 — see the note below |
| `PATCH /api/v1/protected/experiences/{id}` | `EDIT_EXPERIENCE_INFO` | **none in practice** | HOS-1074 — see the note below |

## Key Decisions

### Commerce edit/publish — a new gate that blocks nobody, on purpose (HOS-1074)

Four routes joined the inventory above, and all four list **no blocked tier**.
That is not an oversight, and the reason is the whole reason the issue exists.

Owner decision (2026-09-01): commerce runs on the same entitlement mechanism
accommodation does, rather than on a second mechanism of its own. So both
verticals gained an `EDIT_<VERTICAL>_INFO` / `PUBLISH_<VERTICAL>` pair, granted
on **all three tiers** — exactly as all six accommodation plans grant
`EDIT_ACCOMMODATION_INFO` and `PUBLISH_ACCOMMODATIONS`. A key that is uniform
across a catalogue's tiers refuses nobody who is in that catalogue, which is
the point: editing and publishing your own listing is not a tier
differentiator, the cap is.

Two states would nonetheless have been locked out by a naive reading, and both
are ordinary rather than exotic:

- **The owner mid-funnel.** `commerce/protected/create.ts` makes a listing
  `PRIVATE`/`DRAFT` and the owner fills it in BEFORE paying. They have no
  subscription at that moment by construction, so gating on a live subscription
  would mean nobody could ever reach the checkout — the HOS-687 lockout shape,
  where the only path to a capability is through the thing that capability
  gates.
- **Every existing commerce owner, for the length of a deploy window.**
  `ensureCommercePlan` INSERTS ONLY, so all six commerce plan rows on staging
  and production carry `entitlements: []` until seed data-migration
  `0077-hos-1074-commerce-edit-publish-entitlements` runs.

Both are handled the same way, and it is a deliberate design rather than a
fallback: `commerceVerticalEntitlementMiddleware` resolves the vertical's
entitlement FLOOR from `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — from code, in
the same binary as the gate — and only ever UNIONS the subscription plan row's
own entitlements on top. That is Model C's capability rule (config wins, the
database follows), and it means the grant and the gate ship as ONE artifact.
There is no window in which the gate exists and the grant does not.

The gate is still a real refusal for a plan that genuinely does not grant the
key, and it is the seam every later commerce capability hangs off. What it is
not, today, is a behavior change for any customer — which is what this section
exists to say out loud.

### WRITE_REVIEWS — host lockout is intentional

> **No longer true.** SPEC-216 made every owner/complex plan spread the
> tourist-VIP entitlement set, which includes `WRITE_REVIEWS`, so hosts can
> write reviews today (see the comment in
> `apps/api/src/routes/accommodation/reviews/protected/create.ts`). The
> paragraph below records the SPEC-145 rule.

Hosts on all owner/complex plans (owner-basico, owner-pro, owner-premium)
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

> **No longer true.** HOS-16 granted `CREATE_PROMOTIONS` to `owner-basico` with a
> cap of 2 active promotions. The paragraph below records the SPEC-145 rule.

Owner-basico is an entry-level host plan without promotion capabilities.
Only owner-pro and owner-premium (and staff bypass) can manage promotions.

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
