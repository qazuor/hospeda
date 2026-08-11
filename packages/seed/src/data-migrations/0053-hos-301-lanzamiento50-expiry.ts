/**
 * @fileoverview
 * Data migration: 0053-hos-301-lanzamiento50-expiry
 *
 * Gives the `LANZAMIENTO50` launch promo an expiry date (HOS-301, owner
 * decision 2026-08-11): end of 2026-12-31 in Argentina (UTC-3), which is the
 * UTC instant below.
 *
 * ## Why
 *
 * The code was seeded with `expires_at = NULL` — never expires. A launch promo
 * that never expires is not a launch promo: its 100 remaining redemptions stay
 * claimable indefinitely, so a code minted for the opening weeks could still be
 * discounting subscriptions years later.
 *
 * ## Why a migration
 *
 * `billingPromoCodes.seed.ts` is skip-by-key — it matches on `code` and never
 * updates an existing row — so the baseline edit in
 * `packages/billing/src/config/promo-codes.config.ts` reaches fresh databases
 * only. Same reasoning and same shape as
 * `0016-hos-171-freemonth-description.ts`.
 *
 * ## Idempotency
 *
 * Guarded on `expires_at IS NULL`, so a second run affects zero rows and an
 * expiry an operator already set from the admin promo panel is preserved. A
 * missing row is a documented no-op.
 *
 * ## `destructive` flag decision
 *
 * `false`. Sets one nullable column on one row; reversible with a one-line
 * `UPDATE ... SET expires_at = NULL`. No deletes.
 */
import { and, billingPromoCodes, eq, isNull } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0053-hos-301-lanzamiento50-expiry',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The promo code row this migration targets. */
const PROMO_CODE = 'LANZAMIENTO50';

/**
 * End of 2026-12-31 in Argentina (UTC-3), expressed in UTC.
 *
 * Must stay identical to `LANZAMIENTO_50_CODE.expiresAt` in the billing config.
 */
const EXPIRES_AT = new Date('2027-01-01T02:59:59.999Z');

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const updated = await ctx.db
        .update(billingPromoCodes)
        .set({ expiresAt: EXPIRES_AT })
        .where(and(eq(billingPromoCodes.code, PROMO_CODE), isNull(billingPromoCodes.expiresAt)))
        .returning({ id: billingPromoCodes.id });

    return {
        summary:
            updated.length === 0
                ? `Promo code "${PROMO_CODE}" is absent or already carries an expiry — nothing to update.`
                : `Set "${PROMO_CODE}" to expire at ${EXPIRES_AT.toISOString()} (${updated.length} row).`,
        counts: { promoCodeRowsUpdated: updated.length }
    };
}
