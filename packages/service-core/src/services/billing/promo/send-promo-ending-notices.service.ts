import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { and, asc, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';
import { applyPromoEndingNotice } from './promo-ending-notice.js';

const logger = createLogger('send-promo-ending-notices');
const runInputSchema = z.strictObject({ limit: z.number().int().positive().max(10_000) });

/** Enqueues due promo-ending notices independently so one bad row cannot stop the batch. */
export async function sendPromoEndingNotices(
    input: { readonly limit: number; readonly db?: DrizzleClient },
    ports: { readonly clock: Clock }
): Promise<{
    readonly enqueued: number;
    readonly alreadyEnqueued: number;
    readonly notDue: number;
    readonly skipped: number;
    readonly failed: number;
}> {
    const parsed = runInputSchema.safeParse({ limit: input.limit });
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid promo ending notice run limit',
            parsed.error.issues
        );
    const dbPackage = await import('@repo/db');
    const db = input.db ?? dbPackage.getDb();
    const now = ports.clock.now();
    const selected = await db
        .select({ id: dbPackage.promoRedemptions.id })
        .from(dbPackage.promoRedemptions)
        .innerJoin(
            dbPackage.promoCodes,
            eq(dbPackage.promoCodes.id, dbPackage.promoRedemptions.promoCodeId)
        )
        .innerJoin(
            dbPackage.subscriptions,
            eq(dbPackage.subscriptions.id, dbPackage.promoRedemptions.subscriptionId)
        )
        .where(
            and(
                eq(dbPackage.promoCodes.effectKind, 'DISCOUNT'),
                eq(dbPackage.promoCodes.durationKind, 'N_CHARGES'),
                eq(dbPackage.promoRedemptions.remainingCharges, 1),
                eq(dbPackage.subscriptions.class, 'PRINCIPAL'),
                eq(dbPackage.subscriptions.status, 'ACTIVE'),
                eq(dbPackage.subscriptions.paymentMethod, 'CARD'),
                gt(dbPackage.subscriptions.nextChargeAt, now)
            )
        )
        .orderBy(asc(dbPackage.subscriptions.nextChargeAt), asc(dbPackage.promoRedemptions.id))
        .limit(parsed.data.limit);
    const counts = { enqueued: 0, alreadyEnqueued: 0, notDue: 0, skipped: 0, failed: 0 };
    for (const { id } of selected) {
        try {
            const result = await db.transaction((tx) =>
                applyPromoEndingNotice({ tx, redemptionId: id, now })
            );
            counts[
                result.outcome === 'ENQUEUED'
                    ? 'enqueued'
                    : result.outcome === 'ALREADY_ENQUEUED'
                      ? 'alreadyEnqueued'
                      : result.outcome === 'NOT_DUE'
                        ? 'notDue'
                        : 'skipped'
            ] += 1;
        } catch (error) {
            counts.failed += 1;
            logger.error(
                { redemptionId: id, error },
                'Promo ending notice row failed; run continues'
            );
        }
    }
    if (selected.length === parsed.data.limit)
        logger.warn({ limit: parsed.data.limit }, 'Promo ending notice page is full');
    logger.info(counts, 'Promo ending notice run finished');
    return counts;
}
