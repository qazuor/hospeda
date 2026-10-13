import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';

const cancellationSeenLogger = createLogger('cancellation-seen');

/** Internal observation port for a provider authorization re-read as cancelled. */
export interface CancellationSeenAnnotator {
    /** Records the instant a subscription's authorization was observed cancelled. */
    annotateCancellationSeen(input: {
        readonly subscriptionId: string;
        readonly seenAt: Date;
    }): Promise<void>;
}

/** No-op until B4 supplies the implementation backed by provider_link. */
export const noCancellationSeenAnnotation: CancellationSeenAnnotator = {
    async annotateCancellationSeen() {}
};

/** Records a best-effort cancellation observation without interrupting billing transitions. */
export async function recordCancellationSeen(input: {
    readonly annotator: CancellationSeenAnnotator;
    readonly subscriptionId: string;
    readonly seenAt: Date;
}): Promise<void> {
    try {
        await input.annotator.annotateCancellationSeen({
            subscriptionId: input.subscriptionId,
            seenAt: input.seenAt
        });
    } catch (error) {
        cancellationSeenLogger.error(
            { subscriptionId: input.subscriptionId, error },
            'Could not record provider cancellation observation'
        );
    }
}

/** B5 injects the implementation over payment/manual_payment, replacing the default. */
export interface SubscriptionPayments {
    hasCreditedPayment(input: {
        readonly subscriptionId: string;
        readonly tx?: DrizzleClient;
    }): Promise<boolean>;
}

/** No payment tables exist before B5, so the truthful default is no credited payment. */
export const noCreditedPayments: SubscriptionPayments = {
    async hasCreditedPayment() {
        return false;
    }
};

/**
 * S6's guard (AC:B7:7, AC:B7:16): a credited payment of the unpaid period retained
 * by S19 keeps the row out of `SUSPENDED` until it is resolved. S6's default is the
 * real read of `succession_retained_payment` (an open retention of the row,
 * HOS-1561 H5); a read error is thrown, never read as "no retention".
 */
export interface RetainedPeriodPayment {
    /** True when S19 holds a credited payment of the period pending resolution. */
    hasRetainedPeriodPayment(input: {
        readonly subscriptionId: string;
        readonly tx?: DrizzleClient;
    }): Promise<boolean>;
}

/** B8b injects the S18 implementation, replacing the default. */
export interface SuccessionCloser {
    closeSuccession(input: {
        readonly predecessorSubscriptionId: string;
        readonly tx: DrizzleClient;
    }): Promise<void>;
}

/** Closing a succession without B8b registered must fail visibly. */
export const unimplementedSuccessionCloser: SuccessionCloser = {
    async closeSuccession() {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Succession closer is not registered',
            undefined,
            'SUCCESSION_CLOSER_NOT_REGISTERED'
        );
    }
};

export interface FirstChargeReader {
    readFirstCharge(input: {
        readonly subscriptionId: string;
    }): Promise<
        | { readonly outcome: 'REJECTED'; readonly chargeId: string }
        | { readonly outcome: 'NOT_REJECTED' }
        | { readonly outcome: 'UNKNOWN' }
    >;
}

export const unknownFirstCharge: FirstChargeReader = {
    async readFirstCharge() {
        return { outcome: 'UNKNOWN' };
    }
};
