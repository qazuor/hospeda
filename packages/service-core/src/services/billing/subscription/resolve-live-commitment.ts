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

const NotAppliedAuthorizationResultSchema = z.object({
    authorizationId: z.string().min(1),
    applied: z.literal(false)
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
export function commitmentTaken(): ServiceError {
    return new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        'A subscription commitment already exists',
        undefined,
        'COMMITMENT_TAKEN'
    );
}

/** The same-option creation key is still unfinished, so the caller may retry later. */
export function previousAttemptInProgress(): ServiceError {
    return new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        'The previous signup attempt is still being prepared; try again in a few minutes',
        undefined,
        'PREVIOUS_ATTEMPT_IN_PROGRESS'
    );
}

/**
 * The S1 decision for a live commitment: can the request reuse the stored
 * authorization, or does the pending attempt need replacement? Reuse requires:
 *
 * - the row is `PENDING_AUTHORIZATION` (H6, H8);
 * - it is anchored to the very same `billingOptionId` the person asked for
 *   (another cycle or plan is another amount — §3.3.1, H3);
 * - the clock is before the instant stored when its authorization window opened;
 * - for an applied creation, the declared payer email is absent or matches the
 *   requested email after trimming and lowercasing.
 *
 * When it does, the stored `{ subscriptionId, authorizationId, checkoutUrl }`
 * is returned WITHOUT calling the provider and WITHOUT writing anything. A
 * changed declared payer email or completed unapplied creation asks S1 to
 * replace the row; all other non-reusable commitments answer `COMMITMENT_TAKEN`.
 */
export function resolveLiveCommitmentReuse(input: {
    readonly commitment: LiveCommitment;
    readonly billingOptionId: string;
    readonly clock: Clock;
}): Promise<StartSubscriptionResult>;
export function resolveLiveCommitmentReuse(input: {
    readonly commitment: LiveCommitment;
    readonly billingOptionId: string;
    readonly clock: Clock;
    readonly payerEmail?: string;
}): Promise<
    | { readonly kind: 'REUSE'; readonly result: StartSubscriptionResult }
    | { readonly kind: 'REPLACE'; readonly cause: 'PAYER_EMAIL_CHANGED' | 'CREATION_NOT_APPLIED' }
>;
export async function resolveLiveCommitmentReuse(input: {
    readonly commitment: LiveCommitment;
    readonly billingOptionId: string;
    readonly clock: Clock;
    readonly payerEmail?: string;
}): Promise<
    | StartSubscriptionResult
    | { readonly kind: 'REUSE'; readonly result: StartSubscriptionResult }
    | { readonly kind: 'REPLACE'; readonly cause: 'PAYER_EMAIL_CHANGED' | 'CREATION_NOT_APPLIED' }
> {
    const { subscription } = input.commitment;
    if (subscription.status !== 'PENDING_AUTHORIZATION') throw commitmentTaken();
    if (subscription.billingOptionId !== input.billingOptionId) throw commitmentTaken();
    const key = input.commitment.idempotencyKey;
    if (!key || key.completedAt === null) throw previousAttemptInProgress();
    const windowEndsAt = subscription.authorizationWindowEndsAt;
    if (!windowEndsAt) throw commitmentTaken();
    if (input.clock.now().getTime() >= windowEndsAt.getTime()) throw commitmentTaken();
    const parsed = AppliedAuthorizationResultSchema.safeParse(key.result);
    if (parsed.success) {
        const declared = subscription.declaredPayerEmail?.trim().toLowerCase();
        const requested = input.payerEmail?.trim().toLowerCase();
        if (declared && requested && declared !== requested)
            return { kind: 'REPLACE', cause: 'PAYER_EMAIL_CHANGED' };
        const result = {
            kind: 'REUSE' as const,
            result: {
                subscriptionId: subscription.id,
                authorizationId: parsed.data.authorizationId,
                checkoutUrl: parsed.data.checkoutUrl
            }
        };
        return Object.hasOwn(input, 'payerEmail') ? result : result.result;
    }
    const notApplied = NotAppliedAuthorizationResultSchema.safeParse(key.result);
    if (notApplied.success && input.commitment.providerLink)
        return { kind: 'REPLACE', cause: 'CREATION_NOT_APPLIED' };
    throw commitmentTaken();
}
