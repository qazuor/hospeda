import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import { BillingDeadlineValuesSchema, ServiceErrorCode } from '@repo/schemas';
import { and, desc, eq, lte } from 'drizzle-orm';
import { ServiceError } from '../../../types/index.js';
import { composePromoAmount } from './promo-composition.js';

const logger = createLogger('promo-ending-notice');

/** Template key for the last-discounted-charge notice. */
export const PROMO_ENDING_TEMPLATE = 'billing.promo-ending';

/** Resolves PLAZO:14 from the immutable deadline version published at redemption time. */
export async function resolvePromoEndingDeadlines(input: {
    readonly tx: DrizzleClient;
    readonly redeemedAt: Date;
}): Promise<{ readonly version: number; readonly daysBefore: number }> {
    const { billingDeadlineVersions } = await import('@repo/db');
    const [row] = await input.tx
        .select({
            version: billingDeadlineVersions.version,
            values: billingDeadlineVersions.values
        })
        .from(billingDeadlineVersions)
        .where(lte(billingDeadlineVersions.createdAt, input.redeemedAt))
        .orderBy(desc(billingDeadlineVersions.version))
        .limit(1);
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Promo deadline version is missing'
        );
    const parsed = BillingDeadlineValuesSchema.safeParse(row.values);
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Stored billing deadline values are invalid',
            parsed.error.issues
        );
    return { version: row.version, daysBefore: parsed.data['14'].daysBefore };
}

/** Evaluates and enqueues the due notice for one redemption under its subscription lock. */
export async function applyPromoEndingNotice(input: {
    readonly tx: DrizzleClient;
    readonly redemptionId: string;
    readonly now: Date;
}): Promise<{ readonly outcome: 'SKIPPED' | 'NOT_DUE' | 'ENQUEUED' | 'ALREADY_ENQUEUED' }> {
    const db = await import('@repo/db');
    const [row] = await input.tx
        .select({
            redemptionId: db.promoRedemptions.id,
            redeemedAt: db.promoRedemptions.redeemedAt,
            remainingCharges: db.promoRedemptions.remainingCharges,
            userId: db.promoRedemptions.userId,
            subscriptionId: db.subscriptions.id,
            status: db.subscriptions.status,
            class: db.subscriptions.class,
            paymentMethod: db.subscriptions.paymentMethod,
            nextChargeAt: db.subscriptions.nextChargeAt,
            vertical: db.subscriptions.vertical,
            planVersionId: db.subscriptions.planVersionId,
            billingOptionId: db.subscriptions.billingOptionId,
            effectKind: db.promoCodes.effectKind,
            durationKind: db.promoCodes.durationKind,
            email: db.users.email,
            planName: db.plans.name
        })
        .from(db.promoRedemptions)
        .innerJoin(db.promoCodes, eq(db.promoCodes.id, db.promoRedemptions.promoCodeId))
        .innerJoin(db.subscriptions, eq(db.subscriptions.id, db.promoRedemptions.subscriptionId))
        .innerJoin(db.users, eq(db.users.id, db.promoRedemptions.userId))
        .innerJoin(db.planVersions, eq(db.planVersions.id, db.subscriptions.planVersionId))
        .innerJoin(db.plans, eq(db.plans.id, db.planVersions.planId))
        .where(eq(db.promoRedemptions.id, input.redemptionId))
        .limit(1)
        .for('update', { of: db.subscriptions });
    if (
        !row ||
        row.effectKind !== 'DISCOUNT' ||
        row.durationKind !== 'N_CHARGES' ||
        row.remainingCharges !== 1 ||
        row.status !== 'ACTIVE' ||
        row.class !== 'PRINCIPAL' ||
        row.paymentMethod !== 'CARD' ||
        !row.nextChargeAt ||
        row.nextChargeAt <= input.now ||
        !row.subscriptionId
    )
        return { outcome: 'SKIPPED' };
    const [scheduled] = await input.tx
        .select({ id: db.subscriptionScheduledChanges.id })
        .from(db.subscriptionScheduledChanges)
        .where(eq(db.subscriptionScheduledChanges.subscriptionId, row.subscriptionId))
        .limit(1);
    if (scheduled) return { outcome: 'SKIPPED' };

    const deadline = await resolvePromoEndingDeadlines({
        tx: input.tx,
        redeemedAt: row.redeemedAt
    });
    const { resolveDueRenewalMilestone } = await import('../subscription/renewal-notice.js');
    const milestone = resolveDueRenewalMilestone({
        nextChargeAt: row.nextChargeAt,
        now: input.now,
        daysBefore: [deadline.daysBefore]
    });
    if (!milestone) return { outcome: 'NOT_DUE' };
    if (
        !row.userId ||
        !row.email ||
        !row.vertical ||
        !row.planName ||
        !row.planVersionId ||
        !row.billingOptionId
    )
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Promo notice recipient or billing anchor is incomplete'
        );

    const [option] = await input.tx
        .select({ amount: db.billingOptions.amount, currency: db.billingOptions.currency })
        .from(db.billingOptions)
        .where(
            and(
                eq(db.billingOptions.id, row.billingOptionId),
                eq(db.billingOptions.planVersionId, row.planVersionId)
            )
        )
        .limit(1);
    if (!option)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Anchored billing option is missing'
        );
    const { readLivePromos } = await import('./live-promos.js');
    const live = await readLivePromos({ subscriptionId: row.subscriptionId, executor: input.tx });
    const amountAfterMinor = composePromoAmount({
        listAmountMinor: option.amount,
        promos: live
            .filter((promo) => promo.redemptionId !== row.redemptionId)
            .map(({ discountKind, value }) => ({ discountKind, value }))
    }).amountMinor;
    const occurrence = db.buildScheduleOccurrence({
        subjectKind: 'promo',
        subjectId: row.redemptionId,
        milestone: `promo-fin:-${deadline.daysBefore}d`,
        targetDate: milestone.targetDate
    });
    const queued = await db.emailOutboxModel.enqueue(
        {
            recipientUserId: row.userId,
            recipientEmail: row.email,
            template: PROMO_ENDING_TEMPLATE,
            payload: {
                subscriptionId: row.subscriptionId,
                redemptionId: row.redemptionId,
                vertical: row.vertical,
                planName: row.planName,
                lastDiscountedChargeDate: milestone.targetDate,
                amountAfterMinor,
                currency: option.currency,
                daysBefore: deadline.daysBefore,
                deadlinesVersion: deadline.version
            },
            dedupKey: db.buildEmailDedupKey({
                recipient: row.userId,
                template: PROMO_ENDING_TEMPLATE,
                occurrence
            })
        },
        input.tx
    );
    logger.info(
        {
            redemptionId: row.redemptionId,
            subscriptionId: row.subscriptionId,
            enqueued: queued.enqueued
        },
        'Promo ending notice evaluated'
    );
    return { outcome: queued.enqueued ? 'ENQUEUED' : 'ALREADY_ENQUEUED' };
}
