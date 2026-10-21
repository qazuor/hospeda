import type { Clock } from '@repo/billing-verticals-contract';
import type { LiveCommitment } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
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

/** The stored result of an applied creation, the one shape S1's reuse accepts. */
export type AppliedAuthorizationResult = z.infer<typeof AppliedAuthorizationResultSchema>;

/**
 * Builds the result every writer of an applied `PREAPPROVAL_CREATE` stores: S1's own success
 * path and the creations sweep's recovery (HOS-1725). One builder next to the schema that reads
 * it back, so the writers cannot drift from what the reuse decision accepts.
 *
 * @param input.authorizationId - The provider authorization the key created
 * @param input.checkoutUrl - The SANITIZED approval link
 * @returns The result to persist on the key
 */
export function appliedAuthorizationResult(input: {
    readonly authorizationId: string;
    readonly checkoutUrl: string;
}): AppliedAuthorizationResult {
    return {
        authorizationId: input.authorizationId,
        applied: true,
        checkoutUrl: input.checkoutUrl
    };
}

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
 * The reuse decision of S1: does the live commitment answer this request with
 * what is already stored? Reuse requires ALL of:
 *
 * - the row is `PENDING_AUTHORIZATION` (H6, H8);
 * - it is anchored to the very same `billingOptionId` the person asked for
 *   (another cycle or plan is another amount — §3.3.1, H3);
 * - its key is completed with an `applied === true` result carrying a
 *   `checkoutUrl`;
 * - the clock is before the instant stored when its authorization window opened.
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
    const windowEndsAt = subscription.authorizationWindowEndsAt;
    if (!windowEndsAt) throw commitmentTaken();
    if (input.clock.now().getTime() >= windowEndsAt.getTime()) throw commitmentTaken();
    return {
        subscriptionId: subscription.id,
        authorizationId: parsed.data.authorizationId,
        checkoutUrl: parsed.data.checkoutUrl
    };
}
