import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { domainEvent } from '../../schemas/domain-event/domain_event.dbschema.ts';
import {
    type InsertProviderLink,
    providerLinks,
    type SelectProviderLink
} from '../../schemas/vertical/provider-link.dbschema.ts';
import {
    LIVE_SUBSCRIPTION_STATUSES,
    type SelectSubscription,
    subscriptions
} from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Input for one keyset page of subscriptions with provider links. */
export interface ListSweepInventoryPageInput {
    readonly afterSubscriptionId?: string;
    readonly limit: number;
    readonly tx?: DrizzleClient;
}

/** One owned subscription and the provider identifier used to read it. */
export interface SweepInventoryRow {
    readonly subscription: SelectSubscription;
    readonly providerLink: SelectProviderLink;
}

/** The domain event type that records our decision to cancel a preapproval (AC:B11:6). */
const CANCELLATION_DECIDED_EVENT = 'subscription.provider_cancellation_decided' as const;

/** Terminal subscription states (B11 §3: `CANCELLED`, `ABANDONED`, `CHARGE_DECLINED`). */
const TERMINAL_SUBSCRIPTION_STATUSES = ['CANCELLED', 'ABANDONED', 'CHARGE_DECLINED'] as const;

/** Our recorded decision to cancel one subscription's preapproval. */
export interface CancellationDecision {
    readonly eventId: string;
    /** The transition code that decided the cancellation (the event's `reason`). */
    readonly transition: string;
    /** The instant of that transition (the event's `occurred_at`). */
    readonly decidedAt: Date;
}

/** Input for one keyset page of the cancellation-retry population. */
export interface ListCancellationRetryPageInput {
    readonly afterSubscriptionId?: string;
    readonly limit: number;
    readonly tx?: DrizzleClient;
}

/** One terminal linked subscription with its most recent cancellation decision. */
export interface CancellationRetryRow extends SweepInventoryRow {
    readonly decision: CancellationDecision;
}

/** Input to read the most recent cancellation decision of one subscription. */
export interface FindCancellationDecisionInput {
    readonly subscriptionId: string;
    readonly tx?: DrizzleClient;
}

/** Input to find a provider link by its provider-scoped identifier. */
export interface FindLinkByProviderIdInput {
    readonly provider: InsertProviderLink['provider'];
    readonly providerId: string;
    readonly tx?: DrizzleClient;
}

/** Input to lock one subscription while checking or creating its link. */
export interface LockSubscriptionForLinkInput {
    readonly subscriptionId: string;
    readonly tx: DrizzleClient;
}

/** A locked subscription and its optional existing provider link. */
export interface LockedSubscriptionForLink {
    readonly subscription: SelectSubscription;
    readonly providerLink: SelectProviderLink | null;
}

/** Input to insert the provider link that completes a re-link. */
export interface InsertReconciliationProviderLinkInput {
    readonly subscriptionId: string;
    readonly provider: InsertProviderLink['provider'];
    readonly providerId: string;
    readonly tx?: DrizzleClient;
}

/** Input to create a receipt tombstone inside the caller's transaction. */
export interface InsertReceiptTombstoneInput {
    readonly tx: DrizzleClient;
}

/** Read-only inventory and narrow link persistence used by reconciliation. */
export class ReconciliationInventoryModel {
    /**
     * Lists keyset-paginated linked PRINCIPAL and COMPLEMENTO rows in live states.
     * Terminal rows return through the exception queries, starting with
     * {@link ReconciliationInventoryModel.listCancellationRetryPage}; a receipt
     * tombstone is LAPIDA and enters through exception 4. INNER JOIN excludes rows without a
     * provider id to read; a creation without a response belongs to HOS-1610's creation sweep.
     */
    async listSweepInventoryPage(
        input: ListSweepInventoryPageInput
    ): Promise<ReadonlyArray<SweepInventoryRow>> {
        const db = input.tx ?? getDb();
        return db
            .select({ subscription: subscriptions, providerLink: providerLinks })
            .from(subscriptions)
            .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .where(
                and(
                    inArray(subscriptions.class, ['PRINCIPAL', 'COMPLEMENTO']),
                    inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES),
                    input.afterSubscriptionId === undefined
                        ? undefined
                        : gt(subscriptions.id, input.afterSubscriptionId)
                )
            )
            .orderBy(asc(subscriptions.id))
            .limit(input.limit);
    }

    /**
     * The population of exceptions 1 and 4 (AC:B11:6): only one of OUR transitions that sent the
     * cancellation records the decision, so a terminal row from the mirror or from S17, or the
     * tombstone of a probe, does not enter. Returns terminal rows (any class) with a provider link
     * and at least one `subscription.provider_cancellation_decided` event, each with its most
     * recent decision. Keyset by `subscription.id` ascending, like `listSweepInventoryPage`; the
     * decision lookup rides `domain_event_entity_idx` (entity_type, entity_id, occurred_at).
     */
    async listCancellationRetryPage(
        input: ListCancellationRetryPageInput
    ): Promise<ReadonlyArray<CancellationRetryRow>> {
        const db = input.tx ?? getDb();
        const decision = db
            .selectDistinctOn([domainEvent.entityId], {
                entityId: domainEvent.entityId,
                eventId: domainEvent.id,
                transition: domainEvent.reason,
                decidedAt: domainEvent.occurredAt
            })
            .from(domainEvent)
            .where(
                and(
                    eq(domainEvent.entityType, 'subscription'),
                    eq(domainEvent.eventType, CANCELLATION_DECIDED_EVENT)
                )
            )
            .orderBy(domainEvent.entityId, desc(domainEvent.occurredAt), desc(domainEvent.id))
            .as('decision');
        const rows = await db
            .select({
                subscription: subscriptions,
                providerLink: providerLinks,
                eventId: decision.eventId,
                transition: decision.transition,
                decidedAt: decision.decidedAt
            })
            .from(subscriptions)
            .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .innerJoin(decision, eq(decision.entityId, sql`${subscriptions.id}::text`))
            .where(
                and(
                    inArray(subscriptions.status, TERMINAL_SUBSCRIPTION_STATUSES),
                    input.afterSubscriptionId === undefined
                        ? undefined
                        : gt(subscriptions.id, input.afterSubscriptionId)
                )
            )
            .orderBy(asc(subscriptions.id))
            .limit(input.limit);
        return rows.map((row) => ({
            subscription: row.subscription,
            providerLink: row.providerLink,
            decision: {
                eventId: row.eventId,
                transition: row.transition ?? '',
                decidedAt: row.decidedAt
            }
        }));
    }

    /** The most recent cancellation decision recorded for one subscription, or null. */
    async findCancellationDecision(
        input: FindCancellationDecisionInput
    ): Promise<CancellationDecision | null> {
        const db = input.tx ?? getDb();
        const [row] = await db
            .select({
                eventId: domainEvent.id,
                transition: domainEvent.reason,
                decidedAt: domainEvent.occurredAt
            })
            .from(domainEvent)
            .where(
                and(
                    eq(domainEvent.entityType, 'subscription'),
                    eq(domainEvent.entityId, input.subscriptionId),
                    eq(domainEvent.eventType, CANCELLATION_DECIDED_EVENT)
                )
            )
            .orderBy(desc(domainEvent.occurredAt), desc(domainEvent.id))
            .limit(1);
        if (!row) return null;
        return { eventId: row.eventId, transition: row.transition ?? '', decidedAt: row.decidedAt };
    }

    /** Finds a provider link by the unique provider and provider id pair, or null. */
    async findLinkByProviderId(
        input: FindLinkByProviderIdInput
    ): Promise<SelectProviderLink | null> {
        const db = input.tx ?? getDb();
        const [link] = await db
            .select()
            .from(providerLinks)
            .where(
                and(
                    eq(providerLinks.provider, input.provider),
                    eq(providerLinks.providerId, input.providerId)
                )
            )
            .limit(1);
        return link ?? null;
    }

    /** Locks only the subscription row, then reads its optional link in a separate query. */
    async lockSubscriptionForLink(
        input: LockSubscriptionForLinkInput
    ): Promise<LockedSubscriptionForLink | null> {
        const [subscription] = await input.tx
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, input.subscriptionId))
            .limit(1)
            .for('update');
        if (!subscription) return null;
        const [providerLink] = await input.tx
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, input.subscriptionId))
            .limit(1);
        return { subscription, providerLink: providerLink ?? null };
    }

    /** Inserts a provider link; the database's 23505 errors pass through to the service. */
    async insertProviderLink(
        input: InsertReconciliationProviderLinkInput
    ): Promise<SelectProviderLink> {
        const db = input.tx ?? getDb();
        const [providerLink] = await db
            .insert(providerLinks)
            .values({
                subscriptionId: input.subscriptionId,
                provider: input.provider,
                providerId: input.providerId
            })
            .returning();
        if (!providerLink) throw new Error('Provider link insert returned no row');
        return providerLink;
    }

    /** Inserts the identity-free receipt tombstone; its link must be inserted before transaction commit. */
    async insertReceiptTombstone(input: InsertReceiptTombstoneInput): Promise<SelectSubscription> {
        const [subscription] = await input.tx
            .insert(subscriptions)
            .values({ class: 'LAPIDA', status: 'CANCELLED' })
            .returning();
        if (!subscription) throw new Error('Receipt tombstone insert returned no row');
        return subscription;
    }
}

/** Shared reconciliation inventory persistence model. */
export const reconciliationInventoryModel = new ReconciliationInventoryModel();
