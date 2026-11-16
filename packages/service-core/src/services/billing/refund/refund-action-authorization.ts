import type { DrizzleClient } from '@repo/db';
import { addonInstances, eq, subscriptions } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { type Actor, ServiceError } from '../../../types';
import { isSystemActor } from '../../../utils/system-actor';

/** Reads the payer who is the subject of administrative action 13. */
export async function readRefundSubject(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string | null;
    readonly addonInstanceId: string | null;
}): Promise<string | null> {
    const { tx, subscriptionId, addonInstanceId } = input;
    if (subscriptionId) {
        // No row lock (HOS-2223): `subscription.user_id` is written once at insert and never
        // updated, so there is nothing to protect. A lock here would be taken AFTER the payment
        // lock, inverting the global order (subscription before payment) that P1, S1 and S19
        // follow, and could deadlock against them on the same charge.
        const [row] = await tx
            .select({ userId: subscriptions.userId })
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId))
            .limit(1);
        return row?.userId ?? null;
    }
    if (!addonInstanceId) return null;
    const [row] = await tx
        .select({ ownerId: addonInstances.ownerId })
        .from(addonInstances)
        .where(eq(addonInstances.id, addonInstanceId))
        .limit(1)
        .for('share');
    return row?.ownerId ?? null;
}

/** Checks administrative action 13 for the actor and payer subject. */
export function authorizeRefundAction(input: {
    readonly actor: Actor;
    readonly subjectId: string | null;
}): void {
    const permitted = isAdministrativeActionPermitted({
        action: 'ACC_13',
        actorPermissions: input.actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action: 'ACC_13',
        actorId: input.actor.id,
        subjectId: input.subjectId,
        permitted,
        isSystemActor: isSystemActor(input.actor)
    });
    if (!step.allowed)
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden',
            undefined,
            'ADMINISTRATIVE_ACTION_FORBIDDEN'
        );
}
