/**
 * @fileoverview
 * Data migration: 0099-hos-1171-retire-hospeda-free
 *
 * Deactivates the `HOSPEDA_FREE` promo code, the only `comp` code that ever
 * existed.
 *
 * ## Why
 *
 * Redeeming it at the self-serve checkout reached `createCompSubscription()` —
 * `status='comp'`, `mp_subscription_id = NULL`, a period end 100 years out — on
 * a route (`POST /protected/billing/subscriptions/start-paid`) that is a
 * `createCRUDRoute` with no `requiredPermissions`. `getPromoCodeByCode` matches
 * on the code alone, so `livemode` never scoped it either, and the row was
 * `active = t` with `max_uses` empty. Anyone who learned the string could issue
 * themselves a permanently free subscription in one request.
 *
 * HOS-1171 makes a complimentary subscription an ADMIN ACTION
 * (`POST /api/v1/admin/billing/subscriptions/grant-comp`, `BILLING_MANAGE`),
 * sibling to `grant-courtesy`, and both doors that used to redeem a comp code
 * now refuse the effect. Retiring the code is the SECOND, independent layer: a
 * gate has to be remembered by whoever adds the next door, whereas the absence
 * of a redeemable comp code does not.
 *
 * ## Deactivated, NOT deleted — deliberately
 *
 * The production row carries `used_count = 2`, and those two redemptions are the
 * two comp subscriptions live in production. That row is the only record of WHY
 * those two accounts are free. Deleting it destroys the audit trail; flipping
 * `active` to false makes it unredeemable while leaving the history readable.
 *
 * **The two existing comp subscriptions are NOT touched.** They stay valid and
 * keep their entitlements. What stops is the code that created them.
 *
 * ## Dual-write (HOS-25)
 *
 * The baseline half is `packages/billing/src/config/promo-codes.config.ts`,
 * where `HOSPEDA_FREE_CODE` was removed from `DEFAULT_PROMO_CODES`, so a fresh
 * database never creates the row. The promo seed is skip-by-key and never
 * updates an existing row, so that edit reaches fresh databases ONLY — this
 * migration carries the same delta to already-seeded ones.
 *
 * Idempotent: scoped to `active = true`, so a second run matches nothing. Also
 * safe on a fresh database, where the row does not exist at all.
 */
import { and, billingPromoCodes, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0099-hos-1171-retire-hospeda-free',
    group: 'required',
    // Nothing is deleted — one boolean column is flipped on at most one row.
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The retired code. Kept as a literal: it is a historical fact, not config. */
const RETIRED_COMP_CODE = 'HOSPEDA_FREE';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const deactivated = await ctx.db
        .update(billingPromoCodes)
        .set({ active: false })
        .where(
            and(
                eq(billingPromoCodes.code, RETIRED_COMP_CODE),
                // Idempotency: a second run finds nothing to change. This is what
                // makes the returned count meaningful rather than merely non-zero.
                eq(billingPromoCodes.active, true)
            )
        )
        .returning({ id: billingPromoCodes.id });

    const deactivatedRows = deactivated.length;

    return {
        summary:
            deactivatedRows === 0
                ? `${RETIRED_COMP_CODE} is already inactive or was never seeded — no change.`
                : `Deactivated the ${RETIRED_COMP_CODE} comp promo code (${deactivatedRows} row). Existing comp subscriptions are untouched.`,
        counts: { deactivatedRows }
    };
}
