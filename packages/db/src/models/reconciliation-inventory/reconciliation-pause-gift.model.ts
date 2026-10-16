import { and, asc, eq, gt, gte, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { domainEvent } from '../../schemas/domain-event/domain_event.dbschema.ts';
import { billingOptions } from '../../schemas/vertical/billing-option.dbschema.ts';
import { subscriptions } from '../../schemas/vertical/subscription.dbschema.ts';
import { subscriptionPauses } from '../../schemas/vertical/subscription-pause.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

export type PauseGiftCycle = 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export interface EndedPauseGiftRow {
    readonly pauseId: string;
    readonly subscriptionId: string;
    readonly startsAt: Date;
    readonly actualEndAt: Date;
    readonly nextChargeAt: Date;
    readonly cycle: PauseGiftCycle | null;
}

export class ReconciliationPauseGiftModel {
    async listEndedPausePage(input: {
        readonly endedSince: Date;
        readonly afterPauseId?: string;
        readonly limit: number;
        readonly tx?: DrizzleClient;
    }): Promise<ReadonlyArray<EndedPauseGiftRow>> {
        const db = input.tx ?? getDb();
        const detected = sql<boolean>`EXISTS (SELECT 1 FROM ${domainEvent} de WHERE de.event_type = 'reconciliation.pause_gift_detected' AND de.entity_type = 'subscription_pause' AND de.entity_id = ${subscriptionPauses.id}::text)`;
        return db
            .select({
                pauseId: subscriptionPauses.id,
                subscriptionId: subscriptions.id,
                startsAt: subscriptionPauses.startsAt,
                actualEndAt: subscriptionPauses.actualEndAt,
                nextChargeAt: subscriptions.nextChargeAt,
                cycle: billingOptions.cycle
            })
            .from(subscriptionPauses)
            .innerJoin(subscriptions, eq(subscriptions.id, subscriptionPauses.subscriptionId))
            .leftJoin(billingOptions, eq(billingOptions.id, subscriptions.billingOptionId))
            .where(
                and(
                    eq(subscriptionPauses.reason, 'CUSTOMER_REQUEST'),
                    isNotNull(subscriptionPauses.actualEndAt),
                    gte(subscriptionPauses.actualEndAt, input.endedSince),
                    eq(subscriptions.class, 'PRINCIPAL'),
                    eq(subscriptions.status, 'ACTIVE'),
                    eq(subscriptions.paymentMethod, 'CARD'),
                    isNotNull(subscriptions.nextChargeAt),
                    input.afterPauseId === undefined
                        ? undefined
                        : gt(subscriptionPauses.id, input.afterPauseId),
                    sql`NOT ${detected}`
                )
            )
            .orderBy(asc(subscriptionPauses.id))
            .limit(input.limit) as Promise<ReadonlyArray<EndedPauseGiftRow>>;
    }
}

export const reconciliationPauseGiftModel = new ReconciliationPauseGiftModel();
