import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import { getLocalDateString } from '@repo/utils';
import { resolvePlanDisplayName } from '../plan-display-name';

const logger = createLogger('signup-confirmed-notice');

export const SIGNUP_CONFIRMED_TEMPLATE = 'billing.signup-confirmed';

export interface EnqueueSignupConfirmedNoticeInput {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly activatedAt: Date;
}

/** Enqueues the provider-payment heads-up in the same transaction as S2. */
export async function enqueueSignupConfirmedNotice(
    input: EnqueueSignupConfirmedNoticeInput
): Promise<void> {
    const {
        buildEmailDedupKey,
        buildEventOccurrence,
        and,
        desc,
        emailOutboxModel,
        eq,
        payments,
        plans,
        planVersions,
        subscriptions,
        users
    } = await import('@repo/db');
    const [row] = await input.tx
        .select({
            subscriptionId: subscriptions.id,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            nextChargeAt: subscriptions.nextChargeAt,
            email: users.email,
            planName: plans.name,
            planSlug: plans.slug
        })
        .from(subscriptions)
        .leftJoin(users, eq(users.id, subscriptions.userId))
        .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .leftJoin(plans, eq(plans.id, planVersions.planId))
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);

    if (!row?.userId || !row.email) {
        logger.warn(
            { subscriptionId: input.subscriptionId },
            'No user found for activated subscription'
        );
        return;
    }

    // The signup IS the first charge (HOS-1012): when MercadoPago already reported it paid, the
    // notice states it as done; otherwise it says the charge is still being processed.
    const [credited] = await input.tx
        .select({ amount: payments.amount, currency: payments.currency })
        .from(payments)
        .where(
            and(eq(payments.subscriptionId, row.subscriptionId), eq(payments.status, 'SUCCEEDED'))
        )
        .orderBy(desc(payments.factAt))
        .limit(1);
    const todayDate = getLocalDateString({ instant: input.activatedAt });
    const nextChargeDate = row.nextChargeAt
        ? getLocalDateString({ instant: row.nextChargeAt })
        : null;
    const dedupKey = buildEmailDedupKey({
        recipient: row.userId,
        template: SIGNUP_CONFIRMED_TEMPLATE,
        occurrence: buildEventOccurrence({ eventId: row.subscriptionId })
    });

    await emailOutboxModel.enqueue(
        {
            recipientUserId: row.userId,
            recipientEmail: row.email,
            template: SIGNUP_CONFIRMED_TEMPLATE,
            payload: {
                subscriptionId: row.subscriptionId,
                vertical: row.vertical,
                planName: row.planSlug
                    ? resolvePlanDisplayName({
                          vertical: row.vertical,
                          plan: { slug: row.planSlug, name: row.planName ?? '' }
                      })
                    : row.planName,
                firstPayment: credited
                    ? { amountMinor: credited.amount, currency: credited.currency }
                    : null,
                nextChargeDate:
                    credited && nextChargeDate && nextChargeDate > todayDate ? nextChargeDate : null
            },
            dedupKey
        },
        input.tx
    );
}
