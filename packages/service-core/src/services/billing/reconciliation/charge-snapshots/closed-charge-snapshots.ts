import type { Clock } from '@repo/billing-verticals-contract';
import { providerChargeSnapshotModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { CanChargeDeadlines } from '../../coverage/can-charge';
import { reconciliationWindowSince } from '../sweep/payment-window';
import type { ClosedChargeSnapshot, ClosedChargeSnapshots } from './closed-charge-snapshot';

const logger = createLogger('closed-charge-snapshots');

/**
 * Safety floor for the age at which an approved charge stops being re-read: a refund or a
 * chargeback can reach us until the provider's dispute window ends, and deadline 18 is
 * configuration that someone could set below it. The effective horizon is therefore
 * `max(deadline 18, this floor)`, so a short setting can only keep charges open longer
 * (more reads), never hide a late chargeback.
 */
export const CLOSED_CHARGE_FLOOR_DAYS = 180;
const DAY_MS = 86_400_000;

/**
 * Build a read-time closed snapshot source for a provider.
 *
 * @param input.provider - Provider code the snapshots were recorded under.
 * @param input.clock - Injected clock used to evaluate closedness at read time.
 * @param input.deadlines - Deadline versions source (deadline 18).
 * @param input.floorDays - Override of {@link CLOSED_CHARGE_FLOOR_DAYS}, for tests only.
 */
export function createClosedChargeSnapshots(input: {
    readonly provider: string;
    readonly clock: Clock;
    readonly deadlines?: CanChargeDeadlines;
    readonly floorDays?: number;
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
                const windowSince = await reconciliationWindowSince({
                    clock: input.clock,
                    ...(input.deadlines ? { deadlines: input.deadlines } : {})
                });
                const floorSince = new Date(
                    input.clock.now().getTime() -
                        (input.floorDays ?? CLOSED_CHARGE_FLOOR_DAYS) * DAY_MS
                );
                approvedSince = windowSince < floorSince ? windowSince : floorSince;
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
