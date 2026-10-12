import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import { getLocalDateString } from '@repo/utils';

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
        emailOutboxModel,
        eq,
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
            firstChargeAt: subscriptions.firstChargeAt,
            email: users.email,
            planName: plans.name
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

    const firstChargeDate = getLocalDateString({ instant: row.firstChargeAt ?? input.activatedAt });
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
                planName: row.planName,
                firstChargeDate
            },
            dedupKey
        },
        input.tx
    );
}
