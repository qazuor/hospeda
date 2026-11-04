import type { Clock } from '@repo/billing-verticals-contract';
import { providerChargeSnapshotModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { CanChargeDeadlines } from '../../coverage/can-charge';
import { reconciliationWindowSince } from '../sweep/payment-window';
import type { ClosedChargeSnapshot, ClosedChargeSnapshots } from './closed-charge-snapshot';

const logger = createLogger('closed-charge-snapshots');

/** Build a read-time closed snapshot source for a provider. */
export function createClosedChargeSnapshots(input: {
    readonly provider: string;
    readonly clock: Clock;
    readonly deadlines?: CanChargeDeadlines;
}): ClosedChargeSnapshots {
    return {
        async find({ chargeIds }): Promise<readonly ClosedChargeSnapshot[]> {
            if (!chargeIds.length) return [];
            const rows = await providerChargeSnapshotModel.findByChargeIds({
                provider: input.provider,
                chargeIds
            });
            let approvedSince: Date | null = null;
            try {
                approvedSince = await reconciliationWindowSince({
                    clock: input.clock,
                    ...(input.deadlines ? { deadlines: input.deadlines } : {})
                });
            } catch (error) {
                logger.warn(
                    { error },
                    'Deadline 18 unavailable; approved charge snapshots remain open'
                );
            }
            return rows
                .filter(
                    (row) =>
                        (row.status === 'rejected' &&
                            row.expiresAt !== null &&
                            row.expiresAt <= input.clock.now()) ||
                        (row.status === 'approved' &&
                            approvedSince !== null &&
                            row.providerCreatedAt < approvedSince)
                )
                .map((row) => ({
                    chargeId: row.chargeId,
                    providerCreatedAt: row.providerCreatedAt.toISOString(),
                    status: row.status as ClosedChargeSnapshot['status'],
                    purpose: row.purpose,
                    authorizationId: row.authorizationId,
                    reference: row.reference,
                    amountMinor: row.amountMinor,
                    currency: row.currency,
                    refundedAmountMinor: row.refundedAmountMinor,
                    chargedBack: row.chargedBack
                }));
        }
    };
}
