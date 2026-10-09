import type { Clock } from '@repo/billing-verticals-contract';
import type { LiveCommitment } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service';
import type { StartSubscriptionResult } from './start-subscription.service';

/**
 * The persisted, application-owned result of a completed `PREAPPROVAL_CREATE`.
 *
 * Parsed with zod instead of cast: the idempotency key's `result` is JSONB, so
 * it is runtime data, not a type. A missing `checkoutUrl` or an `applied: false`
 * (creation that did not apply, C3 of B3.1) is NOT a reusable commitment.
 */
const AppliedAuthorizationResultSchema = z.object({
    authorizationId: z.string().min(1),
    applied: z.literal(true),
    checkoutUrl: z.url()
});

/** The today's 409 for an occupied commitment slot (H11). */
function commitmentTaken(): ServiceError {
    return new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        'A subscription commitment already exists',
        undefined,
        'COMMITMENT_TAKEN'
    );
}

/**
 * Instant until which the live `PENDING_AUTHORIZATION` row can still be reused:
 * its creation instant plus the `cardHours` of the current PLAZO:10 version
 * (`DEC-SUB-016`).
 *
 * B3.3 (`AC:B3:9`, kit V-6) stores the deadline version and the exact instant on
 * the subscription when the window opens; when that column lands, this function
 * is replaced by that stored instant. Until then it is the SINGLE place that
 * answers "hasta cuándo vale la ventana".
 */
async function reuseWindowEndsAt(createdAt: Date): Promise<Date> {
    const deadlines = await getCurrentBillingDeadlines();
    const { cardHours } = deadlines.values['10'];
    return new Date(createdAt.getTime() + cardHours * 60 * 60 * 1000);
}

/**
 * The reuse decision of S1: does the live commitment answer this request with
 * what is already stored? Reuse requires ALL of:
 *
 * - the row is `PENDING_AUTHORIZATION` (H6, H8);
 * - it is anchored to the very same `billingOptionId` the person asked for
 *   (another cycle or plan is another amount — §3.3.1, H3);
 * - its key is completed with an `applied === true` result carrying a
 *   `checkoutUrl`;
 * - it still has window remaining.
 *
 * When it does, the stored `{ subscriptionId, authorizationId, checkoutUrl }`
 * is returned WITHOUT calling the provider and WITHOUT writing anything. When
 * it does not, the same 409 `COMMITMENT_TAKEN` as before is thrown (an in-flight
 * winner, another plan, an expired window or a diverging creation all answer it).
 */
export async function resolveLiveCommitmentReuse(input: {
    readonly commitment: LiveCommitment;
    readonly billingOptionId: string;
    readonly clock: Clock;
}): Promise<StartSubscriptionResult> {
    const { subscription } = input.commitment;
    if (subscription.status !== 'PENDING_AUTHORIZATION') throw commitmentTaken();
    if (subscription.billingOptionId !== input.billingOptionId) throw commitmentTaken();
    const key = input.commitment.idempotencyKey;
    if (!key || key.completedAt === null) throw commitmentTaken();
    const parsed = AppliedAuthorizationResultSchema.safeParse(key.result);
    if (!parsed.success) throw commitmentTaken();
    const windowEndsAt = await reuseWindowEndsAt(subscription.createdAt);
    if (input.clock.now().getTime() >= windowEndsAt.getTime()) throw commitmentTaken();
    return {
        subscriptionId: subscription.id,
        authorizationId: parsed.data.authorizationId,
        checkoutUrl: parsed.data.checkoutUrl
    };
}
