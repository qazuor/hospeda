import { and, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    providerLinks,
    type SelectProviderLink
} from '../../schemas/vertical/provider-link.dbschema.ts';
import {
    type SelectSubscription,
    subscriptions
} from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** States which emit a TITLE source in coverage resolution. */
export const TITLE_EMITTING_STATUSES = ['ACTIVE', 'GRACE_PERIOD', 'CANCEL_SCHEDULED'] as const;
/**
 * Statuses whose paid Tourist VIP mandate may still be cancelled.
 * This intentionally differs from LIVE_SUBSCRIPTION_STATUSES: pending
 * authorization is not a paid, emitting benefit, while suspended/paused VIP
 * mandates still require cancellation when another plan grants the benefit.
 */
export const TOURIST_VIP_CANCELLABLE_STATUSES = [
    'ACTIVE',
    'GRACE_PERIOD',
    'PAUSED',
    'SUSPENDED',
    'CANCEL_SCHEDULED'
] as const;

export interface TouristVipTitleRow {
    /** Database identity of the principal title-emitting subscription. */
    readonly id: string;
    /** Non-Tourist vertical that provides the inherited capability. */
    readonly vertical: string;
    /** Version anchor used to resolve the title's current capabilities. */
    readonly planVersionId: string;
    /** Emitting subscription state. */
    readonly status: string;
    /** End of service for scheduled cancellation, when present. */
    readonly serviceEndsAt: Date | null;
    /** Creation instant used as the coverage source start. */
    readonly createdAt: Date;
}

/** A Tourist VIP subscription that may be closed, with its provider mandate if present. */
export interface TouristVipCancellableRow {
    readonly subscription: SelectSubscription;
    readonly providerLink: SelectProviderLink | null;
}

/** Queries title subscriptions and paid Tourist VIP mandates for inheritance handling. */
export class TouristVipModel {
    /** Finds principal title rows in states that emit coverage sources. */
    async findTitleRows(input: {
        readonly userId: string;
        readonly tx?: DrizzleClient;
    }): Promise<TouristVipTitleRow[]> {
        const db = input.tx ?? getDb();
        const rows = await db
            .select({
                id: subscriptions.id,
                vertical: subscriptions.vertical,
                planVersionId: subscriptions.planVersionId,
                status: subscriptions.status,
                serviceEndsAt: subscriptions.serviceEndsAt,
                createdAt: subscriptions.createdAt
            })
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.userId, input.userId),
                    eq(subscriptions.class, 'PRINCIPAL'),
                    ne(subscriptions.vertical, 'tourist'),
                    isNotNull(subscriptions.planVersionId),
                    inArray(subscriptions.status, [...TITLE_EMITTING_STATUSES])
                )
            );
        return rows.flatMap((row) =>
            row.vertical && row.planVersionId
                ? [{ ...row, vertical: row.vertical, planVersionId: row.planVersionId }]
                : []
        );
    }

    /** Finds cancellable Tourist VIP rows and their optional provider mandate. */
    async findCancellableRows(input: {
        readonly userId: string;
        readonly tx?: DrizzleClient;
    }): Promise<TouristVipCancellableRow[]> {
        const db = input.tx ?? getDb();
        return db
            .select({ subscription: subscriptions, providerLink: providerLinks })
            .from(subscriptions)
            .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .where(
                and(
                    eq(subscriptions.userId, input.userId),
                    eq(subscriptions.vertical, 'tourist'),
                    eq(subscriptions.class, 'PRINCIPAL'),
                    inArray(subscriptions.status, [...TOURIST_VIP_CANCELLABLE_STATUSES])
                )
            );
    }

    /** Finds bounded sweep candidates with an emitting title and cancellable VIP; inheritance is re-read separately. */
    async findUserIdsWithCancellableVip(input: {
        readonly limit: number;
        readonly tx?: DrizzleClient;
    }): Promise<string[]> {
        const db = input.tx ?? getDb();
        const rows = await db
            .selectDistinct({ userId: subscriptions.userId })
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.class, 'PRINCIPAL'),
                    eq(subscriptions.vertical, 'tourist'),
                    inArray(subscriptions.status, [...TOURIST_VIP_CANCELLABLE_STATUSES]),
                    isNotNull(subscriptions.userId),
                    sql`exists (select 1 from subscription title where title.user_id = ${subscriptions.userId} and title.class = 'PRINCIPAL' and title.vertical <> 'tourist' and title.plan_version_id is not null and title.status in ('ACTIVE','GRACE_PERIOD','CANCEL_SCHEDULED'))`
                )
            )
            .limit(input.limit);
        return rows.flatMap(({ userId }) => (userId ? [userId] : []));
    }

    /** Closes one still-cancellable Tourist VIP row without issuing a refund. */
    async closeCancelledVip(input: {
        readonly subscriptionId: string;
        readonly now: Date;
        readonly tx?: DrizzleClient;
    }): Promise<boolean> {
        const db = input.tx ?? getDb();
        const rows = await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', serviceEndsAt: input.now, updatedAt: input.now })
            .where(
                and(
                    eq(subscriptions.id, input.subscriptionId),
                    eq(subscriptions.vertical, 'tourist'),
                    eq(subscriptions.class, 'PRINCIPAL'),
                    inArray(subscriptions.status, [...TOURIST_VIP_CANCELLABLE_STATUSES])
                )
            )
            .returning({ id: subscriptions.id });
        return rows.length > 0;
    }
}

/** Shared Tourist VIP query model. */
export const touristVipModel = new TouristVipModel();
