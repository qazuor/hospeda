import type { Clock } from '@repo/billing-verticals-contract';
import {
    type DrizzleClient,
    eq,
    getDb,
    manualPaymentModel,
    manualPayments,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { z } from 'zod';
import { type Actor, ServiceError } from '../../../types';
import { isSystemActor } from '../../../utils/system-actor';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { readArrearsSuspensionNoticeContent } from './arrears-suspension-notice';
import {
    emitArrearsSuspensionCoverageChanged,
    writeArrearsSuspensionInTx
} from './arrears-suspension-write';
import { pauseComplementsS32 } from './complement-pause-s32';
import type { ComplementPolicyPorts } from './complement-ports';
import { isLiveSuccessionPredecessor } from './late-payment-conditions';
import type { BeforeCancelNotice } from './start-subscription.service';
import { hasOpenRetention } from './succession-retained-payment';

const logger = createLogger('declare-manual-unpaid');
const inputSchema = z.strictObject({
    actor: z.object({
        id: z.uuid(),
        roles: z.array(z.enum(RoleEnum)),
        permissions: z.array(z.enum(PermissionEnum))
    }),
    subscriptionId: z.uuid(),
    manualPaymentId: z.uuid()
});

/** Stable reasons returned by MP2. */
export const DECLARE_MANUAL_UNPAID_REJECTIONS = [
    'SUBSCRIPTION_NOT_FOUND',
    'MANUAL_PAYMENT_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'MANUAL_PAYMENT_NOT_MANUAL',
    'MANUAL_PAYMENT_NOT_AWAITING',
    'MANUAL_PAYMENT_NOT_IN_GRACE',
    'SUCCESSION_IN_PROGRESS',
    'RETAINED_PAYMENT',
    'LOST_RACE'
] as const;

/** One rejected MP2 condition. */
export type DeclareManualUnpaidRejection = (typeof DECLARE_MANUAL_UNPAID_REJECTIONS)[number];

/** Dependencies for MP2's post-commit effects. */
export interface DeclareManualUnpaidPorts {
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly coverageNotices?: CoverageNotices;
    readonly complements?: ComplementPolicyPorts;
    readonly provider?: PaymentProvider;
}

type Input = {
    readonly actor: Actor;
    readonly subscriptionId: string;
    readonly manualPaymentId: string;
};

function reject(code: ServiceErrorCode, reason: DeclareManualUnpaidRejection): never {
    throw new ServiceError(code, reason, undefined, reason);
}

async function check(input: Input, tx: DrizzleClient, lock: boolean) {
    // S19 and MP1 use the same order: subscription, then installment.
    const query = tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);
    const [subscription] = lock ? await query.for('update') : await query;
    if (!subscription) reject(ServiceErrorCode.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND');
    const [installment] = lock
        ? [await manualPaymentModel.lockInstallment({ manualPaymentId: input.manualPaymentId, tx })]
        : await tx
              .select()
              .from(manualPayments)
              .where(eq(manualPayments.id, input.manualPaymentId))
              .limit(1);
    if (!installment || installment.subscriptionId !== subscription.id)
        reject(ServiceErrorCode.NOT_FOUND, 'MANUAL_PAYMENT_NOT_FOUND');
    const permitted = isAdministrativeActionPermitted({
        action: 'ACC_4',
        actorPermissions: input.actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action: 'ACC_4',
        actorId: input.actor.id,
        subjectId: subscription.userId,
        permitted,
        isSystemActor: isSystemActor(input.actor)
    });
    if (!step.allowed) reject(ServiceErrorCode.FORBIDDEN, 'ADMINISTRATIVE_ACTION_FORBIDDEN');
    if (subscription.paymentMethod !== 'MANUAL' || subscription.class !== 'PRINCIPAL')
        reject(ServiceErrorCode.VALIDATION_ERROR, 'MANUAL_PAYMENT_NOT_MANUAL');
    if (installment.status !== 'AWAITING')
        reject(ServiceErrorCode.ALREADY_EXISTS, 'MANUAL_PAYMENT_NOT_AWAITING');
    if (subscription.status !== 'GRACE_PERIOD')
        reject(ServiceErrorCode.VALIDATION_ERROR, 'MANUAL_PAYMENT_NOT_IN_GRACE');
    if (await isLiveSuccessionPredecessor({ subscriptionId: subscription.id, tx }))
        reject(ServiceErrorCode.ALREADY_EXISTS, 'SUCCESSION_IN_PROGRESS');
    if (await hasOpenRetention({ subscriptionId: subscription.id, tx }))
        reject(ServiceErrorCode.ALREADY_EXISTS, 'RETAINED_PAYMENT');
    return { subscription, installment };
}

/** Read-only MP2 preview with the same business rejection checks as the act. */
export async function previewManualUnpaidDeclaration(input: Input): Promise<{
    readonly subscriptionId: string;
    readonly manualPaymentId: string;
    readonly periodStart: Date;
    readonly effect: 'S6';
}> {
    const parsed = inputSchema.parse(input);
    const checked = await getDb().transaction((tx) =>
        check({ ...parsed, actor: input.actor }, tx, false)
    );
    return {
        subscriptionId: checked.subscription.id,
        manualPaymentId: checked.installment.id,
        periodStart: checked.installment.periodStart,
        effect: 'S6'
    };
}

/** MP2 declares the installment unpaid and suspends the subscription in one transaction. */
export async function declareManualPaymentUnpaid(
    input: Input,
    ports: DeclareManualUnpaidPorts
): Promise<{ readonly outcome: 'SUSPENDED'; readonly notice: 'SENT' | 'FAILED' | 'NO_RECIPIENT' }> {
    const parsed = inputSchema.parse(input);
    const value = { ...parsed, actor: input.actor };
    const prechecked = await getDb().transaction((tx) => check(value, tx, false));
    const now = ports.clock.now();
    const content = await readArrearsSuspensionNoticeContent({
        subscription: prechecked.subscription,
        now
    });
    const committed = await getDb().transaction(async (tx) => {
        const { subscription, installment } = await check(value, tx, true);
        const marked = await manualPaymentModel.markDeclaredUnpaid({
            manualPaymentId: installment.id,
            tx
        });
        if (!marked) reject(ServiceErrorCode.ALREADY_EXISTS, 'MANUAL_PAYMENT_NOT_AWAITING');
        const written = await writeArrearsSuspensionInTx({
            tx,
            subscriptionId: subscription.id,
            origin: 'GRACE_PERIOD',
            now
        });
        if (written.kind === 'RETAINED_PAYMENT')
            reject(ServiceErrorCode.ALREADY_EXISTS, 'RETAINED_PAYMENT');
        if (written.kind === 'LOST_RACE') reject(ServiceErrorCode.ALREADY_EXISTS, 'LOST_RACE');
        return { subscription, row: written.row };
    });
    await emitArrearsSuspensionCoverageChanged({
        row: committed.row,
        coverageNotices: ports.coverageNotices ?? unwiredCoverageNotices
    });
    let notice: 'SENT' | 'FAILED' | 'NO_RECIPIENT';
    try {
        const result = await ports.beforeCancelNotice.beforeCancel({
            subscriptionId: committed.subscription.id,
            userId: committed.subscription.userId ?? '',
            kind: 'ARREARS_SUSPENSION',
            occurrenceId: input.manualPaymentId,
            content
        });
        notice =
            result === 'NO_RECIPIENT'
                ? 'NO_RECIPIENT'
                : result === 'DELIVERY_EXHAUSTED'
                  ? 'FAILED'
                  : 'SENT';
    } catch (error) {
        logger.error(
            { subscriptionId: input.subscriptionId, error },
            'Manual arrears suspension notice failed'
        );
        notice = 'FAILED';
    }
    if (ports.complements && ports.provider) {
        try {
            await pauseComplementsS32(
                { principalSubscriptionId: input.subscriptionId, trigger: 'PRINCIPAL_SUSPENDED' },
                { provider: ports.provider, clock: ports.clock, policy: ports.complements }
            );
        } catch (error) {
            logger.error(
                { subscriptionId: input.subscriptionId, error },
                'S32 could not pause complements after manual suspension'
            );
        }
    }
    return { outcome: 'SUSPENDED', notice };
}
