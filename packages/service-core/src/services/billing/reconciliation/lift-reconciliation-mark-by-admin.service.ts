import type { Clock } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    type DrizzleClient,
    eq,
    getDb,
    type ReconciliationMarkReason,
    reconciliationMarkModel,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { type Actor, ServiceError } from '../../../types';
import { isSystemActor } from '../../../utils/system-actor.js';
import { createPaymentReconciliationMarkPayments } from '../payment/payment-ledger.js';
import { isHeldChargeMark } from './held-charge-mark.js';
import { resolveHungPaymentsWithoutRefund } from './hung-payment-resolution.js';
import { liftReconciliationMark } from './lift-reconciliation-mark.service.js';
import type { HangablePayment } from './reconciliation-mark-payments.port.js';

const ACTION = 'ACC_7' as const;

export type { LiftReconciliationMarkRejection } from '@repo/schemas';
/**
 * Every typed rejection of the admin S15 action. The tuple and its type live in `@repo/schemas`
 * (single source of truth) and are re-exported here so existing consumers keep importing them
 * from `@repo/service-core`.
 */
export { LIFT_RECONCILIATION_MARK_REJECTIONS } from '@repo/schemas';

/** Input for lifting one mark and naming any payments resolved without a refund. */
export type LiftReconciliationMarkByAdminInput = {
    readonly actor: Actor;
    readonly markId: string;
    readonly expectedVersion: number;
    readonly resolveWithoutRefund: readonly HangablePayment[];
};

/** Persisted mark and named payment resolutions returned for route audit. */
export type LiftReconciliationMarkByAdminResult = {
    readonly markId: string;
    readonly reason: ReconciliationMarkReason;
    readonly subjectId: string | null;
    readonly liftedAt: Date;
    readonly liftedBy: string;
    readonly version: number;
    readonly resolvedWithoutRefund: readonly HangablePayment[];
};

async function readSubject(
    tx: DrizzleClient,
    mark: NonNullable<Awaited<ReturnType<typeof reconciliationMarkModel.findById>>>
): Promise<string | null> {
    if (mark.subscriptionId) {
        const [subscription] = await tx
            .select({ userId: subscriptions.userId })
            .from(subscriptions)
            .where(eq(subscriptions.id, mark.subscriptionId))
            .limit(1)
            .for('share');
        return subscription?.userId ?? null;
    }
    if (!mark.addonInstanceId) return null;
    const [instance] = await tx
        .select({ ownerId: addonInstances.ownerId })
        .from(addonInstances)
        .where(eq(addonInstances.id, mark.addonInstanceId))
        .limit(1)
        .for('share');
    return instance?.ownerId ?? null;
}

function authorize(
    actor: LiftReconciliationMarkByAdminInput['actor'],
    subjectId: string | null
): void {
    const permitted = isAdministrativeActionPermitted({
        action: ACTION,
        actorPermissions: actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action: ACTION,
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
 * ACC:7 performs S15 by lifting one mark. Named payments are resolved without refund in the same
 * transaction; any unnamed unresolved payment still blocks S15. A page-charge mark of a one-time
 * addon (HOS-2179 D1) refuses that resolution: its held payment closes only through a refund. It never refunds money or changes
 * the row status (DEC-RF-002). Step 3 authorization runs inside the transaction.
 */
export async function liftReconciliationMarkByAdmin(
    input: LiftReconciliationMarkByAdminInput,
    ports: { readonly clock: Clock }
): Promise<LiftReconciliationMarkByAdminResult> {
    return getDb().transaction(async (tx) => {
        const mark = await reconciliationMarkModel.findById({ markId: input.markId, tx });
        if (!mark)
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'Reconciliation mark not found',
                undefined,
                'MARK_NOT_FOUND'
            );
        const subjectId = await readSubject(tx, mark);
        authorize(input.actor, subjectId);
        const resolvedWithoutRefund = [
            ...new Map(
                input.resolveWithoutRefund.map((payment) => [
                    `${payment.source}:${payment.id}`,
                    payment
                ])
            ).values()
        ];
        // A page-charge mark holds the charge's own payment row (HOS-2179 D1): that money is
        // closed only by refunding it (owner, option 3), never resolved here without a refund.
        if (resolvedWithoutRefund.length > 0 && isHeldChargeMark(mark))
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'This mark holds a charge that is closed only by refunding it',
                undefined,
                'MARK_CLOSES_ONLY_BY_REFUND'
            );
        if (resolvedWithoutRefund.length > 0)
            await resolveHungPaymentsWithoutRefund({
                tx,
                markId: input.markId,
                payments: resolvedWithoutRefund,
                at: ports.clock.now()
            });
        const lifted = await liftReconciliationMark(
            {
                markId: input.markId,
                expectedVersion: input.expectedVersion,
                liftedBy: input.actor.id,
                tx
            },
            {
                clock: ports.clock,
                markPayments: createPaymentReconciliationMarkPayments(ports.clock)
            }
        );
        return {
            markId: lifted.mark.id,
            reason: lifted.mark.reason as ReconciliationMarkReason,
            subjectId,
            liftedAt: lifted.mark.liftedAt as Date,
            liftedBy: lifted.mark.liftedBy as string,
            version: lifted.mark.version,
            resolvedWithoutRefund
        };
    });
}
