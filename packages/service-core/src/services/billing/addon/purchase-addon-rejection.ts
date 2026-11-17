import { randomUUID } from 'node:crypto';
import {
    addonInstances,
    and,
    domainEventModel,
    eq,
    getDb,
    idempotencyKeys,
    isNull,
    subscriptions
} from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import {
    rejectedCreationResult,
    throttledCreationResult
} from '../subscription/resolve-live-commitment';

/**
 * Whether a provider failure proves nothing exists at the provider for this creation: a 4xx
 * rejection or a 429 refused before processing. A 5xx or transport failure has an unknown
 * outcome and must keep the pending row for the creations sweep to resolve.
 */
export function isCreationRefusedBeforeExisting(error: unknown): error is PaymentProviderError {
    return (
        error instanceof PaymentProviderError &&
        error.capability === 'authorize' &&
        (error.code === 'REJECTED' || error.transient?.kind === 'RATE_LIMITED')
    );
}

/**
 * HOS-2321: closes a recurring purchase whose preapproval creation the provider refused, so the
 * unique purchase identity is released and the owner's retry reaches a fresh checkout instead of
 * answering PENDING_ELSEWHERE for the whole authorization window. Completes the creation key,
 * then abandons the never-linked COMPLEMENTO and its instance atomically.
 *
 * @param input.instanceId - The pending addon instance
 * @param input.complementId - Its pending COMPLEMENTO subscription
 * @param input.idempotencyKey - The open PREAPPROVAL_CREATE key
 * @param input.rateLimited - Whether the refusal was a throttle rather than a rejection
 * @param input.now - The instant of the transition
 * @returns Whether this call performed the abandonment
 */
export async function abandonRefusedComplement(input: {
    readonly instanceId: string;
    readonly complementId: string;
    readonly idempotencyKey: string;
    readonly rateLimited: boolean;
    readonly now: Date;
}): Promise<boolean> {
    return getDb().transaction(async (tx) => {
        const [complement] = await tx
            .update(subscriptions)
            .set({ status: 'ABANDONED', updatedAt: input.now })
            .where(
                and(
                    eq(subscriptions.id, input.complementId),
                    eq(subscriptions.class, 'COMPLEMENTO'),
                    eq(subscriptions.status, 'PENDING_AUTHORIZATION')
                )
            )
            .returning({ id: subscriptions.id });
        const [instance] = await tx
            .update(addonInstances)
            .set({ status: 'ABANDONED', updatedAt: input.now })
            .where(
                and(
                    eq(addonInstances.id, input.instanceId),
                    eq(addonInstances.complementSubscriptionId, input.complementId),
                    eq(addonInstances.status, 'PENDING_AUTHORIZATION')
                )
            )
            .returning({ id: addonInstances.id });
        // Someone else already moved the pair (for example the window expiry): nothing to do.
        if (!complement || !instance) return false;
        await tx
            .update(idempotencyKeys)
            .set({
                result: input.rateLimited ? throttledCreationResult() : rejectedCreationResult(),
                completedAt: input.now
            })
            .where(
                and(
                    eq(idempotencyKeys.key, input.idempotencyKey),
                    eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE'),
                    eq(idempotencyKeys.subjectId, input.complementId),
                    isNull(idempotencyKeys.completedAt)
                )
            );
        await domainEventModel.insert({
            eventType: 'addon_instance.status_changed',
            entityType: 'addon_instance',
            entityId: input.instanceId,
            actorType: 'provider',
            actorId: null,
            correlationId: randomUUID(),
            changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }],
            occurredAt: input.now,
            tx
        });
        return true;
    });
}
