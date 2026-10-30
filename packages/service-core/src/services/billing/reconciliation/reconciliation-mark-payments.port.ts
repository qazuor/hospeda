import type { DrizzleClient } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';

export type HangablePayment = {
    readonly source: 'PAYMENT' | 'MANUAL_PAYMENT';
    readonly id: string;
};

/** Internal boundary for payments attached to reconciliation marks. B5 replaces the default by injecting its implementation. */
export interface ReconciliationMarkPayments {
    hang(input: {
        readonly markId: string;
        readonly payment: HangablePayment;
        readonly tx: DrizzleClient;
    }): Promise<void>;
    countUnresolved(input: {
        readonly markId: string;
        readonly tx: DrizzleClient;
    }): Promise<number>;
}

/** Until B5 creates the table, no unresolved payment can exist; hanging must fail visibly. */
export const unimplementedReconciliationMarkPayments: ReconciliationMarkPayments = {
    async hang() {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Reconciliation mark payments port is not registered',
            undefined,
            'MARK_PAYMENTS_PORT_NOT_REGISTERED'
        );
    },
    async countUnresolved() {
        return 0;
    }
};
