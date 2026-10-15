import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { billingOptions } from '../../schemas/vertical/billing-option.dbschema.ts';
import { providerLinks } from '../../schemas/vertical/provider-link.dbschema.ts';
import { subscriptions } from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import {
    CANCELLATION_DECIDED_EVENT,
    type SweepInventoryRow,
    TERMINAL_SUBSCRIPTION_STATUSES
} from './reconciliation-inventory.model.ts';

export type TerminalHoldCutoffs = Readonly<
    Record<'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'none', Date>
>;

export interface TerminalReturnRow extends SweepInventoryRow {
    readonly hasOpenMark: boolean;
    readonly hasOpenRetention: boolean;
    readonly rejectionTerminal: boolean;
}

export interface ListTerminalReturnPageInput {
    readonly afterSubscriptionId?: string;
    readonly limit: number;
    readonly holdCutoffs: TerminalHoldCutoffs;
    readonly tx?: DrizzleClient;
}

export class ReconciliationTerminalReturnModel {
    async listTerminalReturnPage(
        input: ListTerminalReturnPageInput
    ): Promise<ReadonlyArray<TerminalReturnRow>> {
        const db = input.tx ?? getDb();
        const hasDecision = sql<boolean>`EXISTS (SELECT 1 FROM domain_event de WHERE de.entity_type = 'subscription' AND de.entity_id = ${subscriptions.id}::text AND de.event_type = ${CANCELLATION_DECIDED_EVENT})`;
        const hasOpen16 = sql<boolean>`EXISTS (SELECT 1 FROM reconciliation_mark rm WHERE rm.subscription_id = ${subscriptions.id} AND rm.reason = 'CANCELACION_SIN_CONFIRMAR' AND rm.lifted_at IS NULL)`;
        const hasOpenMark = sql<boolean>`EXISTS (SELECT 1 FROM reconciliation_mark rm WHERE rm.subscription_id = ${subscriptions.id} AND rm.lifted_at IS NULL)`;
        const hasOpenRetention = sql<boolean>`EXISTS (SELECT 1 FROM succession_retained_payment srp WHERE srp.subscription_id = ${subscriptions.id} AND srp.released_at IS NULL)`;
        const rejectionTerminal = sql<boolean>`(${subscriptions.status} = 'CHARGE_DECLINED' OR EXISTS (SELECT 1 FROM domain_event de WHERE de.entity_type = 'subscription' AND de.entity_id = ${subscriptions.id}::text AND de.event_type = 'subscription.provider_cancelled_after_rejection'))`;
        const cutoff = sql`CASE ${billingOptions.cycle} WHEN 'monthly' THEN ${input.holdCutoffs.monthly}::timestamptz WHEN 'quarterly' THEN ${input.holdCutoffs.quarterly}::timestamptz WHEN 'semiannual' THEN ${input.holdCutoffs.semiannual}::timestamptz WHEN 'annual' THEN ${input.holdCutoffs.annual}::timestamptz ELSE ${input.holdCutoffs.none}::timestamptz END`;
        return db
            .select({
                subscription: subscriptions,
                providerLink: providerLinks,
                hasOpenMark,
                hasOpenRetention,
                rejectionTerminal
            })
            .from(subscriptions)
            .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .leftJoin(billingOptions, eq(billingOptions.id, subscriptions.billingOptionId))
            .where(
                and(
                    inArray(subscriptions.status, TERMINAL_SUBSCRIPTION_STATUSES),
                    input.afterSubscriptionId === undefined
                        ? undefined
                        : gt(subscriptions.id, input.afterSubscriptionId),
                    sql`NOT (${hasDecision} AND ${providerLinks.cancelledSeenAt} IS NULL AND NOT ${hasOpen16})`,
                    sql`(${hasOpenMark} OR ${hasOpenRetention} OR (${providerLinks.cancelledSeenAt} IS NOT NULL AND ${providerLinks.cancelledSeenAt} > ${cutoff}))`
                )
            )
            .orderBy(asc(subscriptions.id))
            .limit(input.limit);
    }
}

export const reconciliationTerminalReturnModel = new ReconciliationTerminalReturnModel();
