import type { Clock } from '@repo/billing-verticals-contract';
import { type DrizzleClient, getDb, reconciliationMarkModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import {
    type ReconciliationMarkPayments,
    unimplementedReconciliationMarkPayments
} from './reconciliation-mark-payments.port';

export interface LiftReconciliationMarkInput {
    readonly markId: string;
    readonly expectedVersion: number;
    readonly liftedBy: string;
    readonly tx?: DrizzleClient;
}
export interface LiftReconciliationMarkPorts {
    readonly clock: Clock;
    readonly markPayments?: ReconciliationMarkPayments;
}

function conflict(message: string, code: string): ServiceError {
    return new ServiceError(ServiceErrorCode.ALREADY_EXISTS, message, undefined, code);
}

/** S15 lifts exactly one mark, after checking unresolved attached payments and the version read by the caller. */
export async function liftReconciliationMark(
    input: LiftReconciliationMarkInput,
    ports: LiftReconciliationMarkPorts
) {
    const db = input.tx ?? getDb();
    return db.transaction(async (tx) => {
        const mark = await reconciliationMarkModel.findById({ markId: input.markId, tx });
        if (!mark)
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'Reconciliation mark not found',
                undefined,
                'MARK_NOT_FOUND'
            );
        if (mark.liftedAt !== null)
            throw conflict('Reconciliation mark is already lifted', 'MARK_ALREADY_LIFTED');
        const unresolved = await (
            ports.markPayments ?? unimplementedReconciliationMarkPayments
        ).countUnresolved({ markId: input.markId, tx });
        if (unresolved > 0)
            throw conflict(
                'Reconciliation mark has unresolved payments',
                'MARK_HAS_UNRESOLVED_PAYMENTS'
            );
        const result = await reconciliationMarkModel.lift({
            markId: input.markId,
            expectedVersion: input.expectedVersion,
            liftedBy: input.liftedBy,
            now: ports.clock.now(),
            tx
        });
        if (result.outcome === 'VERSION_CONFLICT')
            throw conflict(
                'Reconciliation mark version changed; reload it',
                'MARK_VERSION_CONFLICT'
            );
        if (result.outcome === 'NOT_OPEN')
            throw conflict('Reconciliation mark is already lifted', 'MARK_ALREADY_LIFTED');
        return result;
    });
}
