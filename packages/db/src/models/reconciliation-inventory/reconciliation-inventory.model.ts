import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import { getDb } from '../../client.ts';
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
     * Terminal rows return through the four exception queries added by B11.2 and later; a receipt
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
