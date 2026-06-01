# Managing Billing Plans

This guide is for operators (super-admins) who manage Hospeda's subscription
plans from the admin panel. Since SPEC-168, plans are stored in the database and
are **editable at runtime** — you no longer need a developer or a deploy to
change a price, an entitlement, or a limit.

> **Who can do this**: only super-admins. The whole admin billing surface is
> super-admin-only (SPEC-164). If you do not see the plans page, you do not have
> the required role.

---

## Where plans live

- The catalog of plans is the source of truth in the database (the qzpay
  `billing_plans` table, with prices in `billing_prices`).
- The `@repo/billing` source-code config is read **once, to seed** an empty
  database with the initial plans. After that first seed, every change is made
  from the admin panel and is never overwritten by a re-seed.
- The web pricing pages and the checkout both read from this same database
  catalog, so what a visitor sees is always what they are charged.

You reach the plans page from the admin sidebar under **Comercial → Planes**.

---

## What each field means

| Field | What it is | Editable after creation? |
|---|---|---|
| **Slug** | The stable identifier of the plan (e.g. `host-pro`). Code, the web, and entitlements resolve plans by this slug. | **No — immutable.** It is set on creation and locked afterwards. |
| **Display name** | The human-facing name shown in the UI (e.g. "Host Pro"). | Yes |
| **Description** | Short marketing description shown on pricing pages. | Yes |
| **Monthly price** | Price per month, stored as an **integer in centavos ARS** (e.g. `499000` = ARS 4 990,00). | Yes |
| **Annual price** | Price per year, also in centavos ARS. Leave at `0` to offer monthly billing only. | Yes |
| **Entitlements** | The list of features the plan unlocks (checkbox list in the form). | Yes |
| **Limits** | Numeric caps per feature (e.g. max accommodations), keyed by name. | Yes |
| **Trial** | Whether the plan offers a trial and for how many days (trials are HOST-only — see ADR-009). | Yes |
| **Default** | Marks the plan assigned by default for its role tier. Only one default per tier. | Yes |
| **Sort order** | Controls the order plans appear in on the pricing pages and lists. | Yes |
| **Active** | Whether the plan is offered. Inactive plans disappear from the public pricing pages but existing subscriptions keep working. | Yes |

> **Money is always integer centavos.** A price of ARS 4 990 is stored as
> `499000`, never `4990` and never `4990.00`. The form handles the conversion —
> just be aware of the unit when reading the audit log or the database directly.

---

## Common tasks

### Create a plan

1. Go to **Comercial → Planes** and click **Crear**.
2. Fill in the slug (choose carefully — it cannot be changed later), display
   name, description, prices, entitlements, limits, trial, and sort order.
3. Save. The plan is written to the database and, if `Active` is on, appears on
   the public pricing pages after the cache revalidates (see below).

### Edit a plan

1. Open the plan from the list and click **Editar**.
2. Change any field except the slug (the slug input is disabled on edit).
3. Save. Price changes take effect immediately for new checkouts and surface on
   the web after revalidation.

### Deactivate a plan

Toggle **Active** off (or use **Desactivar**). The plan is removed from the
public pricing pages but is **not deleted**: existing subscriptions on that plan
continue to be billed and served. Re-activate it any time by toggling **Active**
back on.

### Delete a plan

See [Delete semantics](#delete-semantics) below — deletion has two modes and
the destructive one is guarded.

---

## How price changes reach the web

The public pricing pages are served through Cloudflare's cache. When you save a
plan, the admin triggers a **cache revalidation** for the pricing URLs so the new
price shows up without a redeploy. This is automatic and best-effort:

- Allow a few seconds for the cache to refresh after saving.
- If a visitor still sees an old price briefly, it is the stale-while-revalidate
  window; it self-corrects on the next request.
- The revalidation uses the platform's existing revalidation system (not an
  ad-hoc Cloudflare call), so it follows the same path as other content updates.

Checkout always reads the live database value, so a customer is never charged a
stale price even during the cache window.

---

## Audit log

**Every plan mutation is recorded.** Each create, edit, activate/deactivate, and
delete writes an entry to the billing audit log (`billing_audit_logs`) capturing:

- **who** made the change (the acting super-admin's `actor.id`),
- **what** changed, as a **before/after** diff of the affected fields (price,
  entitlements, limits, active, metadata),
- **when** it happened.

This gives you a full, independent history of pricing changes — you do not need
git or a developer to answer "who changed this price and when". Reads are not
audited; only mutations are.

---

## Delete semantics

There are two ways to remove a plan, and they behave very differently.

### Soft-delete (default, reversible)

The standard delete marks the plan inactive (`active: false`) and **keeps the
row** in the database. This is reversible: re-activate the plan and it returns.
Existing subscriptions referencing the plan keep working. Use this in almost all
cases.

### Hard-delete (permanent, guarded)

Hard-delete permanently removes the plan row. It is **blocked** if any
subscription still references the plan: the operation returns a `409 Conflict`
and nothing is deleted. The admin UI hides the hard-delete option when references
exist. Only a plan that no subscription points to can be hard-deleted.

> **Rule of thumb**: prefer deactivation. Reach for hard-delete only to clean up a
> plan that was created by mistake and never sold.

---

## Rolling back a change

If a plan edit was wrong, you have two complementary options:

1. **Re-edit to the previous values.** Open the audit log entry for the change,
   read the **before** side of the diff, and re-enter those values in the edit
   form. Save. Because the audit log records the prior state of every field, you
   always have the exact values to restore.
2. **Reactivate after an accidental deactivation.** If you toggled a plan off by
   mistake, just toggle **Active** back on — soft-delete is non-destructive.

For an accidental **hard-delete**, there is no in-panel undo (the row is gone).
Recreate the plan from the audit log's last-known state — but note the new plan
gets a new internal id, so this is genuinely a last resort. This is why
hard-delete is guarded and discouraged.

---

## Related documentation

- [ADR-020: Billing Plans — Source of Truth](../decisions/ADR-020-billing-plans-source-of-truth.md)
  (superseded by SPEC-168; explains the prior code-only model)
- [ADR-006: Integer Monetary Values](../decisions/ADR-006-integer-monetary-values.md)
- [ADR-009: Trial Host-Only](../decisions/ADR-009-trial-host-only.md)
- [Billing Package](../../packages/billing/CLAUDE.md)
- SPEC-168: `.claude/specs/SPEC-168-admin-plan-management/spec.md`
