import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    type DrizzleClient,
    eq,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';
import type { SuccessionCloser } from './subscription-billing-ports';
import {
    clearSuccessorLink,
    deferOrCloseCourtesy,
    flagRetainedPayments,
    linkClosedPredecessor,
    repointComplements
} from './succession-close-writes';

const logger = createLogger('succession-closer');
const inputSchema = z.strictObject({ predecessorSubscriptionId: z.uuid() });

/** The observable S18 write result for AC:B8b:10. */
export interface CloseSuccessionWritesResult {
    readonly outcome: 'CLOSED' | 'NO_LIVE_SUCCESSOR' | 'PREDECESSOR_STILL_LIVE';
    readonly successorId: string | null;
    readonly complementsMoved: number;
    readonly courtesy: 'DEFERRED' | 'CLOSED_NON_MONTHLY' | 'NONE';
    readonly marksOpened: number;
}

/** S18 ports for the caller's clock and the optional real payment-to-mark adapter. */
export interface SuccessionCloserPorts {
    readonly clock: Clock;
    readonly markPayments?: ReconciliationMarkPayments;
}

/**
 * TRANS:B:S18, AC:B8b:10, DEC-GRANT-007 and MOT:1: close a dead predecessor's succession.
 * D-1 keeps a live predecessor unchanged until S17 cancels it. Every read and write uses tx.
 */
export async function closeSuccessionWrites(
    input: { readonly predecessorSubscriptionId: string; readonly tx: DrizzleClient },
    ports: SuccessionCloserPorts
): Promise<CloseSuccessionWritesResult> {
    const { predecessorSubscriptionId } = inputSchema.parse({
        predecessorSubscriptionId: input.predecessorSubscriptionId
    });
    const [predecessor] = await input.tx
        .select({
            id: subscriptions.id,
            status: subscriptions.status,
            succeededById: subscriptions.succeededById,
            paymentMethod: subscriptions.paymentMethod
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, predecessorSubscriptionId))
        .limit(1)
        .for('update');
    const [successor] = await input.tx
        .select({
            id: subscriptions.id,
            status: subscriptions.status,
            billingOptionId: subscriptions.billingOptionId,
            predecessorRef: subscriptions.succeedsId
        })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.succeedsId, predecessorSubscriptionId),
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES)
            )
        )
        .limit(1);
    if (!successor)
        return {
            outcome: 'NO_LIVE_SUCCESSOR',
            successorId: null,
            complementsMoved: 0,
            courtesy: 'NONE',
            marksOpened: 0
        };
    if (
        predecessor &&
        (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(predecessor.status)
    ) {
        logger.info(
            {
                predecessorSubscriptionId,
                successorId: successor.id,
                outcome: 'PREDECESSOR_STILL_LIVE'
            },
            'Succession awaits predecessor cancellation'
        );
        return {
            outcome: 'PREDECESSOR_STILL_LIVE',
            successorId: successor.id,
            complementsMoved: 0,
            courtesy: 'NONE',
            marksOpened: 0
        };
    }
    if (!predecessor)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Succession predecessor missing',
            undefined,
            'SUCCESSION_CLOSE_PREDECESSOR_MISSING'
        );
    if (successor.status !== 'ACTIVE' && successor.status !== 'PENDING_AUTHORIZATION')
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Succession successor is in an unsupported live state',
            undefined,
            'SUCCESSION_CLOSE_SUCCESSOR_STATE'
        );
    if (!successor.billingOptionId)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Succession successor has no billing option',
            undefined,
            'SUCCESSION_CLOSE_BILLING_OPTION_MISSING'
        );
    const now = ports.clock.now();
    try {
        await linkClosedPredecessor({
            predecessorId: predecessorSubscriptionId,
            successorId: successor.id,
            now,
            tx: input.tx
        });
        await clearSuccessorLink({
            predecessorId: predecessorSubscriptionId,
            successorId: successor.id,
            successorStatus: successor.status,
            now,
            tx: input.tx
        });
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code === '23505' && cause.constraint === 'uq_subscription_commitment_origin')
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Succession origin is already taken',
                undefined,
                'SUCCESSION_ORIGIN_TAKEN'
            );
        throw error;
    }
    const complementsMoved = await repointComplements({
        predecessorId: predecessorSubscriptionId,
        successorId: successor.id,
        tx: input.tx
    });
    const courtesy = await deferOrCloseCourtesy({
        predecessorId: predecessorSubscriptionId,
        successorBillingOptionId: successor.billingOptionId,
        now,
        tx: input.tx
    });
    const marksOpened = await flagRetainedPayments({
        predecessorId: predecessorSubscriptionId,
        now,
        tx: input.tx,
        markPayments: ports.markPayments
    });
    return {
        outcome: 'CLOSED',
        successorId: successor.id,
        complementsMoved,
        courtesy,
        marksOpened
    };
}

/** AC:B8b:10: implement the SuccessionCloser interface used by B5, B7 and B8a. */
export function createSuccessionCloser(ports: SuccessionCloserPorts): SuccessionCloser {
    return {
        async closeSuccession(input) {
            await closeSuccessionWrites(input, ports);
        }
    };
}
