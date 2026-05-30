# ADR-020: Billing Plans — Single Source of Truth in Source Code

## Status

Superseded by SPEC-168 (2026-05-30)

Originally Accepted (2026-04-26).

SPEC-168 ("Admin Plan Management — runtime-editable plans on the DB") reverses
the core decision below. Plans are no longer code-only: the qzpay `billing_plans`
table (with prices in `billing_prices`) is now the runtime source of truth, and
the `@repo/billing` config (`ALL_PLANS` / `PlanDefinition`) is read **only once,
to seed** an empty database. After seeding, operators create, edit, deactivate,
and delete plans from the admin panel; a re-seed never overwrites runtime edits.
The display-vs-charge invariant this ADR was written to protect is preserved a
different way: the admin write, checkout, and web pricing pages all read the same
DB store, and the audit log (`billing_audit_logs`) records every mutation with
actor and before/after diff. Web freshness is handled via the public
`/api/v1/public/plans` endpoint plus Cloudflare cache revalidation on save (D3),
replacing the build-time SSG import. See:

- SPEC-168: `.claude/specs/SPEC-168-admin-plan-management/spec.md`
- [Managing Billing Plans guide](../guides/managing-billing-plans.md)

The rest of this ADR is preserved as a historical record of the prior decision
and the audit that motivated it.

## Context

Hospeda's billing system needs an unambiguous source of truth for plan
definitions (slug, name, prices, trial settings, entitlements, limits). What
the user sees on the pricing page MUST equal what the user is charged at
checkout. A mismatch is not a bug, it is a legal exposure under Argentina's
Defensa al Consumidor regulations and a direct trust killer for the product.

A pre-beta audit (2026-04-26, see BBT-12) surfaced an architectural ambiguity
that would have produced exactly this kind of mismatch:

1. **Web pricing pages** had hardcoded prices in the Astro frontmatter
   (4990, 9990, 1990, 3990 ARS) that did not match anything else in the
   system.
2. **`packages/billing/src/config/plans.config.ts`** held the canonical
   definitions used by every billing service in the codebase: addon
   entitlements, addon checkout, addon plan-change, addon limit recalculation,
   the `/api/v1/public/plans` endpoint, and the `/api/v1/admin/billing/plans`
   read-only listing.
3. **`apps/admin/src/features/billing-plans/`** shipped a `PlanDialog.tsx` UI
   that suggested admins could create, edit, and delete plans. Inspection
   showed it called `POST/PUT/DELETE /api/v1/admin/billing/plans`, endpoints
   that do not exist (the admin route file only declares `GET` handlers). The
   UI was zombie code: it appeared functional but had no working backend.
4. **There is no `billing_plans` Drizzle schema** in `packages/db/src/`. The
   only billing-related tables in Hospeda DB are `billing_settings`,
   `billing_addon_purchase`, `billing_subscription_event`,
   `billing_dunning_attempt`, and `billing_notification_log`. Plans live
   exclusively in code.
5. The `@qazuor/qzpay-core` SDK exposes a `QZPayPlanStorage` interface, and
   `apps/admin/src/lib/billing-http-adapter/plan-price-promo-storage.ts`
   provides an HTTP implementation of it. Neither is wired into the API
   server, so the storage is an unused contract.

The net effect: the codebase appeared to have two competing sources of truth
(config + a "QZPay storage" that the admin UI gestured at) but in reality only
one source ever drove behavior.

## Decision

**`packages/billing/src/config/plans.config.ts` is the single, canonical
source of truth for billing plan definitions in Hospeda.** No other component,
schema, table, or external storage may shadow these definitions.

Concretely:

- The web pricing pages (`apps/web/src/pages/[lang]/suscriptores/planes/index.astro`
  and `.../turistas/index.astro`) read plans by importing `ALL_PLANS` from
  `@repo/billing` directly in the Astro frontmatter. Pages render via SSG
  (`prerender = true`).
- The admin "Subscription Plans" page is read-only. The list view stays for
  inspection. Create / edit / delete actions are stubbed and surface a clear
  message pointing the operator to the source file. The `PlanDialog` form and
  associated mutations remain in the codebase but are no-ops triggered behind
  a deliberate `apiRequired` alert.
- The public endpoint `GET /api/v1/public/plans` and admin endpoint
  `GET /api/v1/admin/billing/plans` continue to exist as read-only mirrors of
  the same `ALL_PLANS` data. They are useful for clients that prefer HTTP
  over a direct package import (admin SPA, future mobile clients) but they
  carry no independent state.
- Changing a price, trial, entitlement, or limit requires editing
  `plans.config.ts`, opening a PR, going through code review, and deploying.

## Consequences

### Positive

- **Zero possibility of display vs charge mismatch.** Every consumer
  (web, API, checkout, entitlements, admin viewer) reads the same in-process
  module.
- **Audit trail via git.** Every price change is a commit with author,
  timestamp, reviewer, and rationale. Strictly better than a free-form
  `updated_by` column we would otherwise need to design.
- **No migration coordination.** A price change ships as part of a normal
  deploy. No schema change, no seed update, no QZPay sync handshake.
- **Web SSG performance.** Pricing pages render at build time with no API
  roundtrip and no runtime fallback logic. CDN-served, fast first paint.
- **Honest UX in admin.** The plans page no longer pretends to support
  edits that would silently fail.

### Negative

- **No runtime price changes.** Promotions, A/B testing, region-specific
  pricing, or rapid emergency price adjustments require a code change and
  deploy. For an early-stage product this is fine; once tracking and
  pricing experiments become a recurring need, this constraint is no longer
  acceptable.
- **Operations team depends on developers.** Marketing or finance can not
  adjust pricing without engineering involvement.
- **The QZPay storage interface is dormant.** `createPlanStorage()` in the
  admin adapter and `QZPayPlanStorage` in `@qazuor/qzpay-core` exist but are
  not used. This is acceptable as a known seam for future work, not as
  active dead code to delete (deleting closes off the migration path that
  SPEC-093 will pursue).

### Neutral

- The web `plansApi.list()` client wrapper in
  `apps/web/src/lib/api/endpoints.ts` and the `PlanPublicItem` type stay in
  place. They are unused by the pricing pages after this ADR but remain
  available for any future consumer that prefers HTTP.

## Alternatives Considered

### Alternative 1 — Migrate plans to a `billing_plans` table now

Create a Drizzle schema, model, service, admin CRUD endpoints, seed from the
current config, sync with QZPay if applicable, and rewrite all 6+ readers
(`addon.checkout.ts`, `addon-entitlement.service.ts`, etc.) to query the
service instead of importing the module.

Rejected for now: roughly 30-40 hours of work plus regression risk on the
billing path, with no immediate user-facing benefit before beta. The bug
that surfaced this audit is the display/charge mismatch, which the
current ADR resolves with one commit. Migration to DB is the right move
once the product has tracking and a real demand for runtime pricing
adjustments. Captured as SPEC-093.

### Alternative 2 — Keep SSR on the pricing pages with API fetch

The first remediation pass migrated the pricing pages from
`prerender = true` to `prerender = false` and added an API roundtrip plus
hardcoded fallbacks. Rejected once the audit confirmed that the API
endpoint reads from the same config the pages can import directly: the
extra roundtrip and fallback logic add complexity and runtime cost without
solving any real problem.

### Alternative 3 — Delete the admin plans page entirely

Considered briefly. Rejected because operators benefit from inspecting the
live plan catalog (slug, prices, trial, entitlements, limits) without
reading source code. Read-only retention preserves that value with zero
risk of false editing.

## Migration Path

When SPEC-093 (Admin-editable plans) ships:

1. The `billing_plans` table replaces `plans.config.ts` as the source of
   truth.
2. `ALL_PLANS` becomes a build-time seed loader that hydrates from DB on
   server boot, or a thin compatibility export wrapping the new service.
3. Web pricing pages move back to SSR (or ISR with on-demand revalidation
   tied to a webhook from the admin save) and the public endpoint becomes
   the actual data source again.
4. Admin `PlanDialog` is reactivated, hooked to the new CRUD endpoints,
   alert stubs are removed, and the i18n keys revert to the original
   verbiage.
5. The QZPay sync question is resolved as part of SPEC-093 scope.

This ADR remains in force until SPEC-093 is implemented and accepted.

## References

- BBT-12 audit (2026-04-26)
- `packages/billing/src/config/plans.config.ts`
- `apps/web/src/pages/[lang]/suscriptores/planes/index.astro`
- `apps/web/src/pages/[lang]/suscriptores/turistas/index.astro`
- `apps/admin/src/routes/_authed/billing/plans.tsx`
- `apps/api/src/routes/billing/admin/plans.ts`
- `apps/api/src/routes/billing/public/listPlans.ts`
- SPEC-093: Admin-editable billing plans (post-beta)
