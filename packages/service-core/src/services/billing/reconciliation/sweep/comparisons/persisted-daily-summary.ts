import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { domainEventModel } from '@repo/db';
import type { ReconciliationDailySummary } from './reconciliation-daily-summary.port.js';

/**
 * Creates the database-backed daily reconciliation summary writer.
 *
 * Undercharges are recorded as domain events and deduplicated by payment ID.
 * The supplied transaction is used when present; otherwise the model uses
 * its configured database client.
 *
 * @param input - Correlation ID, clock, and optional transaction for writes.
 * @returns A summary port that persists each undercharge at most once.
 */
export function createPersistedReconciliationDailySummary(input: {
    readonly correlationId: string;
    readonly clock: Clock;
    readonly tx?: DrizzleClient;
}): ReconciliationDailySummary {
    return {
        async addUndercharge(charge) {
            if (
                await domainEventModel.existsByEntity({
                    eventType: 'reconciliation.undercharge_detected',
                    entityType: 'payment',
                    entityId: charge.paymentId,
                    tx: input.tx
                })
            )
                return;
            await domainEventModel.insert({
                eventType: 'reconciliation.undercharge_detected',
                entityType: 'payment',
                entityId: charge.paymentId,
                actorType: 'job',
                correlationId: input.correlationId,
                occurredAt: input.clock.now(),
                changes: [
                    { field: 'subscription.id', new: charge.subscriptionId },
                    { field: 'provider.charge_id', new: charge.chargeId },
                    { field: 'payment.currency', new: charge.currency },
                    { field: 'payment.expected_minor', new: charge.expectedMinor },
                    { field: 'payment.charged_minor', new: charge.chargedMinor },
                    { field: 'payment.difference_minor', new: charge.differenceMinor }
                ],
                tx: input.tx
            });
        }
    };
}
