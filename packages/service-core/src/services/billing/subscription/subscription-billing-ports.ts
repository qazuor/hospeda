import type { DrizzleClient } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';

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
