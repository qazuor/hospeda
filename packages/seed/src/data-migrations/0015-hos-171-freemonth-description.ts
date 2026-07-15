/**
 * @fileoverview
 * Data migration: 0015-hos-171-freemonth-description
 *
 * Corrects the seeded description of the FREEMONTH promo code, which claimed it
 * granted "30 extra free-trial days on monthly paid subscriptions". Both halves of
 * that are now wrong, and an operator reading the admin promo list would hand the
 * code to the wrong person:
 *
 * - **Not monthly-only.** HOS-171 made annual the same MercadoPago preapproval as
 *   monthly, so the code applies to both intervals.
 * - **Not a standalone gift.** It lengthens the trial the plan already grants; it
 *   never creates one. On a plan that declares no trial it grants nothing, and it
 *   cannot be handed to an existing paying subscriber at all (`applyPromoCode`
 *   rejects a trial_extension unless the subscription is `trialing`). The missing
 *   "gift a free cycle" mechanism is tracked in HOS-180.
 *
 * The promo seed is skip-by-key — it never updates an existing row — so the baseline
 * edit in `packages/billing/src/config/promo-codes.config.ts` reaches fresh databases
 * only. This carries the same delta to already-seeded ones (HOS-25 dual-write rule).
 *
 * The description is NOT a column: the seed folds it into the `config` jsonb
 * alongside `isPermanent`/`durationCycles`, so this rewrites just that one key and
 * leaves the rest of the object intact.
 *
 * Idempotent, and scoped to the exact stale string so an operator who has since
 * reworded the description from the admin panel keeps their wording.
 */
import { and, billingPromoCodes, eq, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0015-hos-171-freemonth-description',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The stale text this migration replaces. Matched exactly — see the note above. */
const STALE_DESCRIPTION = '30 extra free-trial days on monthly paid subscriptions.';

/** Must stay identical to `FREEMONTH_CODE.description` in the billing config. */
const CORRECTED_DESCRIPTION =
    '30 extra free-trial days, added to the plan trial at checkout. New users only.';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const updated = await ctx.db
        .update(billingPromoCodes)
        .set({
            config: sql`jsonb_set(${billingPromoCodes.config}, '{description}', to_jsonb(${CORRECTED_DESCRIPTION}::text))`
        })
        .where(
            and(
                eq(billingPromoCodes.code, 'FREEMONTH'),
                sql`${billingPromoCodes.config}->>'description' = ${STALE_DESCRIPTION}`
            )
        )
        .returning({ id: billingPromoCodes.id });

    const correctedRows = updated.length;

    return {
        summary:
            correctedRows === 0
                ? 'FREEMONTH description already corrected or operator-edited — no change.'
                : `Corrected the FREEMONTH promo-code description (${correctedRows} row).`,
        counts: { correctedRows }
    };
}
