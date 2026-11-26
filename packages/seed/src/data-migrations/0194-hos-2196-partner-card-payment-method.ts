/**
 * @fileoverview
 * Data migration: 0194-hos-2196-partner-card-payment-method
 *
 * Owner decision (2026-11-26, HOS-2196): the payment methods a plan accepts are declared per plan
 * version (`plan_version.payment_methods`), not per vertical. Partner accepts both: the manual
 * installments the team already records and a recurring Mercado Pago card subscription the team
 * opens with administrative action 6. Every other vertical stays card-only, which is the column's
 * default, so only Partner needs a write.
 *
 * ## What it changes
 *
 * Every `plan_version` of the `partner` vertical whose methods do not yet include both `CARD` and
 * `MANUAL` is set to `{CARD, MANUAL}`. It is an in-place write on published versions because the
 * immutability trigger (extras 041) lets `payment_methods` GROW: a new way to pay never changes
 * what a subscription anchored to the version receives. It never shrinks.
 *
 * ## Why a data migration (dual write)
 *
 * The structural migration `0253` only adds the column (`G18` folds plain INSERTs of the catalog
 * tables and cannot read an UPDATE). `contentOnly` so a fresh database, which applies `0144`
 * first, runs this for real instead of baseline-stamping a catalog that still lacks it.
 *
 * ## Idempotency
 *
 * The WHERE clause skips versions that already accept both, so a second run matches zero rows.
 * `destructive: false`: reverting is setting the column back to `{CARD}` on a fresh version.
 */
import { and, eq, planVersions, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0194-hos-2196-partner-card-payment-method',
    group: 'required',
    destructive: false,
    contentOnly: true,
    requiresColumns: [{ table: 'plan_version', column: 'payment_methods' }]
} as const satisfies SeedMigrationModule['meta'];

/**
 * Makes every Partner plan version accept both card and manual payment.
 *
 * @param ctx - Transaction-scoped migration context.
 * @returns How many Partner versions were updated.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const updated = await ctx.db
        .update(planVersions)
        .set({ paymentMethods: ['CARD', 'MANUAL'] })
        .where(
            and(
                eq(planVersions.vertical, 'partner'),
                sql`NOT (${planVersions.paymentMethods} @> ARRAY['CARD', 'MANUAL']::text[])`
            )
        )
        .returning({ id: planVersions.id });

    return {
        summary: `Partner plan versions now accept card and manual payment (${updated.length} updated)`,
        counts: { updated: updated.length }
    };
}
