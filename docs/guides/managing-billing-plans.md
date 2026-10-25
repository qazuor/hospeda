# Managing Billing Plans

This guide is for operators (super-admins) who change Hospeda's subscription
plans. The plan catalog lives in the database and is edited at runtime, with no
deploy. Since HOS-1352 it follows an **immutable version** model: a plan is a
stable identity, and everything that has an effect (entitlements, limits, trial
days, grace days) lives in a **version** that is published, never edited.

For the overall billing model see
[Billing and verticals](../../CLAUDE.md#billing-and-verticals-hos-1352).

> **Who can do this**: only super-admins. The plan-catalog endpoints require
> `PermissionEnum.MAINTENANCE_MODE_WRITE`, which is provisional and held by
> `SUPER_ADMIN` only (see the comment at the top of
> `apps/api/src/routes/plan-catalog/admin/index.ts`).

> **There is no admin screen for plans yet.** `apps/admin/src/routes` has no
> plans page; the catalog is managed through the admin API below. The previous
> "Comercial → Planes" screen belonged to the deleted QZPay stack.

---

## Where plans live

| Table | Holds | Mutable? |
|---|---|---|
| `plan` | Identity and cosmetics: `vertical`, `slug`, `name`, `description`, `pricingOrder`, `role` | Everything except `role` (set at creation only, enforced by a trigger) |
| `plan_version` | One published version: `rank`, `sellable`, `trialDays`, `graceDays`, `allowsPause`, `inheritsTouristVip`, `current` | **Immutable**, except the `current` flag |
| `plan_version_entitlement` | Entitlements a version grants (`key`, `planQuota`, `trialQuota`) | Immutable with its version |
| `plan_version_limit` | Numeric caps a version sets (`key`, `value`) | Immutable with its version |
| `billing_option` | A cycle (`monthly`, `quarterly`, `semiannual`, `annual`) and its ARS price, attached to one version | Immutable with its version |

All of them are defined in `packages/db/src/schemas/vertical/`
(`plan-catalog.dbschema.ts`, `billing-option.dbschema.ts`). There is no
source-code plan config: the database is the only catalog.

Money is always an **integer** (`billing_option.amount`, ARS only), never a float.

---

## Admin API

Mounted at `/api/v1/admin/plan-catalog` (`apps/api/src/routes/plan-catalog/admin/index.ts`):

| Action | Endpoint | Notes |
|---|---|---|
| Create a plan | `POST /plans` | Body: `vertical`, `slug`, `name`, optional `description`, `pricingOrder`, `role`. `role` marks the three non-sellable plans each vertical declares (`trial`, `pre_trial`, `floor`) and is accepted only here. |
| Preview a version | `POST /plans/{planId}/versions/preview` | Writes nothing. Returns the key-by-key diff against the current version and how many customers are anchored to it. |
| Publish a version | `POST /plans/{planId}/versions` | Same body as the preview plus `confirmed: true`. Makes the new version the plan's `current` one, invalidates the effective-set cache, and writes an audit entry. |

The version body (`PlanVersionContentSchema` in
`packages/schemas/src/catalog/plan-publication.schema.ts`) carries `rank`,
`sellable`, `trialDays`, `graceDays`, `allowsPause`, `inheritsTouristVip`,
`entitlements`, `limits` and an optional `cycles` subset. It carries **no
prices**: the price of a cycle is a `billing_option` row of the version.

---

## What each field means

| Field | What it is | Editable after creation? |
|---|---|---|
| **Slug** | Stable identifier of the plan inside its vertical (`UNIQUE(vertical, slug)`). | Cosmetic row, but treat it as stable: code and the web resolve plans by slug. |
| **Name / Description / Pricing order** | What the pricing page shows and the order it shows plans in. | Yes (they have no effect on what a person gets) |
| **Role** | `trial`, `pre_trial`, `floor`, or none for a sellable plan. At most one plan per role per vertical. | **No.** Set at creation only. |
| **Rank** | The plan's position in the ladder, used to tell an upgrade from a downgrade. | Only by publishing a new version |
| **Sellable** | Whether the version can be bought. | Only by publishing a new version |
| **Trial days** | Length of the trial the version grants. | Only by publishing a new version |
| **Grace days** | Grace after a failed payment before coverage ends. | Only by publishing a new version |
| **Allows pause** | Whether a subscription on the version may be paused. | Only by publishing a new version |
| **Inherits tourist VIP** | Whether the version includes the tourist VIP benefits. | Only by publishing a new version |
| **Entitlements / Limits** | Features unlocked and numeric caps. | Only by publishing a new version |

---

## Common tasks

### Create a plan

`POST /plans` with the vertical, slug and name. The plan exists but has no
version, so it grants nothing until a version is published.

### Change what a plan grants (the normal edit)

1. `POST /plans/{planId}/versions/preview` with the new content. Read the
   returned `changes` (each entitlement, limit or setting with its `from` and
   `to`) and `anchoredCustomers`.
2. If the diff and the reach are what you intended, send the same body to
   `POST /plans/{planId}/versions` with `confirmed: true`.

Publishing never rewrites history: the old version stays as it was. The preview
reports how many customers are anchored to the current version
(`anchoredCustomers`) so you can see who the change reaches.

### Retire a plan

Publish a new version with `sellable: false`. There is no delete endpoint: the
old versions are referenced by subscriptions and must stay.

---

## Audit log

Creating a plan and publishing a version each write an audit entry
(`AuditEventType.BILLING_MUTATION`, resource type `plan` or `plan-version`)
with the acting super-admin's id and the key fields of the change. Because
versions are immutable, the version history itself is also a complete record
of what each plan granted and when.

---

## Rolling back a change

You cannot edit or delete a published version. To roll back, publish a **new**
version whose content equals the previous one. Preview it first to see the
reach.

---

## Related documentation

- [Billing and verticals](../../CLAUDE.md#billing-and-verticals-hos-1352)
- [ADR-006: Integer Monetary Values](../decisions/ADR-006-integer-monetary-values.md)
- [ADR-020: Billing Plans — Source of Truth](../decisions/ADR-020-billing-plans-source-of-truth.md)
  (historical; superseded by the versioned catalog)
- [ADR-009: Trial Host-Only](../decisions/ADR-009-trial-host-only.md) — **superseded**; kept as a historical record only
