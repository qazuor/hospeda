import type { DrizzleClient } from '@repo/db';
import { addonInstances, and, eq, refundCalls, refunds, subscriptions } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { type Actor, ServiceError } from '../../../types';
import { isSystemActor } from '../../../utils/system-actor';
import type { LockedRefundSource } from './refund-source';

/** The administrative action that records a refund made outside our flow (ACC:14, Coord-178). */
export const REFUND_ACTION_14 = 'ACC_14' as const;

/** The partial unique index that keeps a provider panel reference on one row (HOS-1540 notes H3). */
export const PANEL_REFERENCE_CONSTRAINT = 'uq_refund_provider_panel_reference';

/**
 * The subject of a refund action: the owner of the payment's subscription or add-on instance;
 * `null` on a tombstone.
 *
 * @param input.tx - The transaction holding the source `FOR UPDATE`.
 * @param input.locked - The locked refund source.
 * @returns The subject user id, or `null`.
 */
export async function readRefundSubject(input: {
    readonly tx: DrizzleClient;
    readonly locked: LockedRefundSource;
}): Promise<string | null> {
    const { tx, locked } = input;
    const subscriptionId =
        locked.kind === 'PAYMENT'
            ? locked.payment.subscriptionId
            : locked.manualPayment.subscriptionId;
    if (subscriptionId) {
        // No row lock (HOS-2223): `subscription.user_id` is written once at insert and never
        // updated, so there is nothing to protect. A lock here would be taken AFTER the payment
        // lock, inverting the global order (subscription before payment) that P1, S1 and S19
        // follow, and could deadlock against them on the same charge.
        const [subscription] = await tx
            .select({ userId: subscriptions.userId })
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId))
            .limit(1);
        return subscription?.userId ?? null;
    }
    const addonInstanceId = locked.kind === 'PAYMENT' ? locked.payment.addonInstanceId : null;
    if (!addonInstanceId) return null;
    const [instance] = await tx
        .select({ ownerId: addonInstances.ownerId })
        .from(addonInstances)
        .where(eq(addonInstances.id, addonInstanceId))
        .limit(1)
        .for('share');
    return instance?.ownerId ?? null;
}

/**
 * Step 3 of administrative action 14, derived only from the action's own permission (never roles).
 *
 * @param input.actor - The person acting.
 * @param input.subjectId - The subject of the refund.
 * @throws ServiceError FORBIDDEN `ADMINISTRATIVE_ACTION_FORBIDDEN` when step 3 refuses.
 */
export function authorizeRefundAction14(input: {
    readonly actor: Actor;
    readonly subjectId: string | null;
}): void {
    const { actor, subjectId } = input;
    const permitted = isAdministrativeActionPermitted({
        action: REFUND_ACTION_14,
        actorPermissions: actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action: REFUND_ACTION_14,
        actorId: actor.id,
        subjectId,
        permitted,
        isSystemActor: isSystemActor(actor)
    });
    if (!step.allowed)
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden',
            undefined,
            'ADMINISTRATIVE_ACTION_FORBIDDEN'
        );
}

/**
 * The rejection of a provider panel reference that is already recorded.
 *
 * @returns ServiceError ALREADY_EXISTS `EXTERNAL_REFERENCE_ALREADY_SETTLED`.
 */
export function externalReferenceAlreadySettled(): ServiceError {
    return new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        'This provider panel reference is already settled',
        undefined,
        'EXTERNAL_REFERENCE_ALREADY_SETTLED'
    );
}

/**
 * A provider panel reference identifies one refund: it may be neither another row's panel
 * reference nor the provider id of one of our own calls (HOS-1540 notes H3).
 *
 * @param input.tx - The transaction.
 * @param input.reference - The provider panel refund id.
 * @throws ServiceError ALREADY_EXISTS `EXTERNAL_REFERENCE_ALREADY_SETTLED` when it is taken.
 */
export async function assertPanelReferenceUnused(input: {
    readonly tx: DrizzleClient;
    readonly reference: string;
}): Promise<void> {
    const { tx, reference } = input;
    const [settled] = await tx
        .select({ id: refunds.id })
        .from(refunds)
        .where(
            and(eq(refunds.externalRef, reference), eq(refunds.externalChannel, 'PROVIDER_PANEL'))
        )
        .limit(1);
    const [called] = await tx
        .select({ id: refundCalls.id })
        .from(refundCalls)
        .where(eq(refundCalls.providerRefundId, reference))
        .limit(1);
    if (settled || called) throw externalReferenceAlreadySettled();
}
