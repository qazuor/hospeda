import type { DrizzleClient, SelectSubscription } from '@repo/db';
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutboxModel,
    eq,
    plans,
    planVersions,
    users
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { resolvePlanDisplayName } from '../plan-display-name';

const logger = createLogger('signup-declined-notice');

/** Template identifier for the declined-signup notice. */
export const SIGNUP_DECLINED_TEMPLATE = 'billing.signup-declined';

export interface EnqueueSignupDeclinedInput {
    readonly tx: DrizzleClient;
    readonly subscription: SelectSubscription;
    readonly declineReason: string | null;
    readonly successionPredecessor: boolean;
}

/**
 * Reads the display name of the plan the signup tried to buy, through the subscription's plan
 * version. Null when the row carries no plan version (the mail then names only the vertical).
 */
async function readAttemptPlanName(input: {
    readonly tx: DrizzleClient;
    readonly subscription: SelectSubscription;
}): Promise<string | null> {
    const { tx, subscription } = input;
    if (!subscription.planVersionId) return null;
    const [plan] = await tx
        .select({ slug: plans.slug, name: plans.name })
        .from(planVersions)
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(eq(planVersions.id, subscription.planVersionId))
        .limit(1);
    if (!plan) return null;
    return resolvePlanDisplayName({ vertical: subscription.vertical, plan });
}

/**
 * Enqueues S16's declined-signup facts once per subscription, including whether
 * it was a succession predecessor; the renderer maps the raw provider detail.
 */
export async function enqueueSignupDeclinedNotice(
    input: EnqueueSignupDeclinedInput
): Promise<void> {
    const { tx, subscription, declineReason, successionPredecessor } = input;
    const [userRow] = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, subscription.userId ?? ''))
        .limit(1);

    if (!userRow?.email) {
        logger.warn({ subscriptionId: subscription.id }, 'No user found for declined subscription');
        return;
    }

    const planName = await readAttemptPlanName({ tx, subscription });
    const template = SIGNUP_DECLINED_TEMPLATE;
    const recipient = subscription.userId ?? '';
    const dedupKey = buildEmailDedupKey({
        recipient,
        template,
        occurrence: buildEventOccurrence({ eventId: subscription.id })
    });
    await emailOutboxModel.enqueue(
        {
            recipientUserId: subscription.userId,
            recipientEmail: userRow.email,
            template,
            payload: {
                subscriptionId: subscription.id,
                vertical: subscription.vertical,
                planName,
                declineReason,
                successionPredecessor
            },
            dedupKey
        },
        tx
    );
}
