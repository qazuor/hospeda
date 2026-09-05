/**
 * @fileoverview
 * Data migration: 0098-hos-1044-menu-qr-scan-metrics-entitlement
 *
 * Dual-write counterpart (HOS-25) for HOS-1044. The baseline gains one
 * `EntitlementKey` member — `menu_qr_scan_metrics`, the venue's table QR plus
 * its scan-analytics panel — and grants it on `gastronomy-premium`; this
 * migration applies the same delta to an already-seeded database.
 *
 * ## Why the migration is required at all
 *
 * `ensureCommercePlan` (`packages/seed/src/required/commercePlan.seed.ts`)
 * INSERTS ONLY — a plan row that already exists is skipped wholesale, its
 * `entitlements` column untouched. So editing `GASTRONOMY_PREMIUM_PLAN` in
 * `plans.config.ts` reaches a fresh `db:fresh` and nothing else. Staging and
 * production keep the array they were seeded with until this runs.
 *
 * ## Why the grant lives on the plan ROW and not in code
 *
 * The same split `0082`/`0084`/`0091` describe. Four commerce keys are
 * resolved from CODE (`ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`), because they
 * are the FLOOR every tier of a vertical receives and a lagging DB row must
 * never be able to lock an owner out of them. This key is the opposite: a
 * TIER differentiator. Put in that map it would be handed to `-basico` and
 * `-pro` as well, which is the precise give-away the premium step exists to
 * prevent. So it is granted on the row and reaches the gate through the
 * union `resolveOwnerGastronomyPlanEntitlementSet` performs over the
 * subscribed plan's `entitlements` column.
 *
 * The window to be honest about: between the deploy and this migration
 * running, a `gastronomy-premium` subscriber is refused the menu QR and its
 * panel. It fails CLOSED, not open, and today it is empty in practice —
 * HOS-818 retired `gastronomy-premium` from sale (`isActive: false`), so
 * nobody can currently be subscribed to a plan this migration is the only
 * source of.
 *
 * ## ONE vertical, like 0084 and 0091, and unlike 0080
 *
 * `experience-premium` is deliberately absent. An experience has no table
 * menu to print a QR for, so there is nothing for this key to gate; granting
 * it there would advertise a capability whose route an experience owner can
 * never reach.
 *
 * ## No column dependency, hence no `meta.requiresColumns`
 *
 * This migration touches `billing_entitlements` and `billing_plans` only —
 * it does not read or write any `qr_codes` / `qr_code_scans` column.
 * Declaring a dependency on columns it never names would make the runner
 * abort for a reason that is not this migration's.
 *
 * ## Idempotency
 *
 * - Lookup row: inserted only when no `billing_entitlements` row holds the key.
 * - Plan grant: the `entitlements` array is rewritten to the UNION of what the
 *   row holds and the key, guarded on the row not already containing it. A
 *   re-run affects zero rows.
 *
 * ## OR-PRESERVE semantics
 *
 * Union, never replacement — same rule as `0077`, `0080`, `0084` and `0091`.
 * An operator who granted an extra key through the SPEC-168 admin editor
 * keeps it, and this migration can only ever add the one key it owes.
 *
 * ## `destructive` flag decision
 *
 * `false`. One additive lookup insert and one additive array union. Nothing is
 * deleted and no row is rewritten to a narrower value.
 */
import { billingEntitlements, billingPlans, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0098-hos-1044-menu-qr-scan-metrics-entitlement',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The lookup row, spelled as a literal.
 *
 * Literal rather than a lookup into `ENTITLEMENT_DEFINITIONS`: a migration
 * records the delta it applied on the day it ran, and must keep describing that
 * delta even after a later baseline change edits the array underneath it.
 */
const NEW_ENTITLEMENT = {
    key: 'menu_qr_scan_metrics',
    name: 'Menu QR with scan analytics',
    description:
        'Allows minting a table QR that opens the venue menu and viewing a scan-analytics panel for it — total scans, a daily series, and a breakdown by device, OS and browser language'
} as const;

/**
 * The plan row that receives the key, by `billing_plans.name` (the slug).
 *
 * Exactly one. See the fileoverview for why `experience-premium` is not here.
 */
const GRANTED_PLAN_NAME = 'gastronomy-premium';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let entitlementsCreated = 0;
    let plansGranted = 0;

    // ── 1. The `billing_entitlements` lookup row ─────────────────────────────
    const existing = await ctx.db
        .select({ id: billingEntitlements.id })
        .from(billingEntitlements)
        .where(eq(billingEntitlements.key, NEW_ENTITLEMENT.key))
        .limit(1);

    if (existing.length === 0) {
        await ctx.db.insert(billingEntitlements).values({
            key: NEW_ENTITLEMENT.key,
            name: NEW_ENTITLEMENT.name,
            description: NEW_ENTITLEMENT.description
        });
        entitlementsCreated += 1;
    }

    // ── 2. The premium gastronomy plan grant ────────────────────────────────
    // Read first rather than issuing a blind UPDATE: `entitlements` is a jsonb
    // array and the union has to be computed against whatever the row actually
    // holds — the keys prior migrations granted, plus anything an operator
    // added through the admin editor.
    const rows = await ctx.db
        .select({
            id: billingPlans.id,
            name: billingPlans.name,
            entitlements: billingPlans.entitlements
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, GRANTED_PLAN_NAME));

    for (const row of rows) {
        const current = Array.isArray(row.entitlements) ? (row.entitlements as string[]) : [];
        if (current.includes(NEW_ENTITLEMENT.key)) {
            continue;
        }

        await ctx.db
            .update(billingPlans)
            .set({
                entitlements: [...current, NEW_ENTITLEMENT.key],
                updatedAt: new Date()
            })
            .where(eq(billingPlans.id, row.id));

        plansGranted += 1;
    }

    const counts = { entitlementsCreated, plansGranted };
    const changed = entitlementsCreated + plansGranted > 0;

    const summary = changed
        ? `HOS-1044: created ${entitlementsCreated} billing_entitlements row(s) and granted menu_qr_scan_metrics on ${plansGranted} gastronomy premium plan row(s).`
        : 'HOS-1044: menu_qr_scan_metrics already granted on gastronomy-premium — no change.';

    return { summary, counts };
}
