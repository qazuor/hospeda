import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { domainEventModel } from '@repo/db';
import type { ReconciliationDailySummary } from './reconciliation-daily-summary.port.js';

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
