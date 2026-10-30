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
import { resolveHungPaymentsWithoutRefund } from './hung-payment-resolution.js';
import { liftReconciliationMark } from './lift-reconciliation-mark.service.js';
import type { HangablePayment } from './reconciliation-mark-payments.port.js';

const ACTION = 'ACC_7' as const;

/** Every typed rejection of the admin S15 action. */
export const LIFT_RECONCILIATION_MARK_REJECTIONS = [
    'MARK_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'MARK_ALREADY_LIFTED',
    'MARK_VERSION_CONFLICT',
    'MARK_HAS_UNRESOLVED_PAYMENTS',
    'MARK_PAYMENT_NOT_HUNG'
] as const;

/** A typed rejection of the admin S15 action. */
export type LiftReconciliationMarkRejection = (typeof LIFT_RECONCILIATION_MARK_REJECTIONS)[number];

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
 * transaction; any unnamed unresolved payment still blocks S15. It never refunds money or changes
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
