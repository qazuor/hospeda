import type { Partner } from '@repo/schemas';
import type { LifecycleStatusEnum, PartnerSubscriptionStatusEnum } from '@repo/schemas';
import { and, asc, count, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { getDb } from '../../client.js';
import type {
    LifecycleStatusPgEnum,
    PartnerSubscriptionStatusPgEnum
} from '../../schemas/enums.dbschema.ts';
import type { SelectPartnerSubscription } from '../../schemas/partner/index.js';
import { partners } from '../../schemas/partner/partner.dbschema.js';
import { partnerSubscriptions } from '../../schemas/partner/partner_subscription.dbschema.js';
import { safeIlike } from '../../utils/drizzle-helpers.ts';

export interface SearchPartnerFilters {
    q?: string;
    type?: string;
    tier?: string;
    subscriptionStatus?: string;
    includeInactive?: boolean;
    page?: number;
    pageSize?: number;
    sort?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface AdminSearchPartnerFilters extends SearchPartnerFilters {
    includeDeleted?: boolean;
}

/**
 * Partner model extending BaseModel
 * Handles all database operations for partners
 */
export class PartnerModel extends BaseModelImpl<Partner> {
    protected table = partners;
    public entityName = 'partner';

    protected getTableName(): string {
        return 'partners';
    }

    /**
     * Find partners by search filters (public)
     * This is a custom findAll with partner-specific filters
     */
    async findByFilters(filters: SearchPartnerFilters = {}): Promise<Partner[]> {
        const db = getDb();
        const conditions = [];

        // Only active partners by default
        if (!filters.includeInactive) {
            conditions.push(
                and(
                    eq(partners.lifecycleState, 'ACTIVE'),
                    eq(partners.subscriptionStatus, 'ACTIVE')
                )
            );
        }

        // Text search on name and description.
        if (filters.q) {
            conditions.push(
                or(safeIlike(partners.name, filters.q), safeIlike(partners.description, filters.q))
            );
        }

        // Type filter
        if (filters.type) {
            conditions.push(eq(partners.type, filters.type));
        }

        // Tier filter
        if (filters.tier) {
            conditions.push(eq(partners.tier, filters.tier));
        }

        // Subscription status filter
        if (filters.subscriptionStatus) {
            conditions.push(eq(partners.subscriptionStatus, filters.subscriptionStatus));
        }

        // Soft delete filter
        conditions.push(isNull(partners.deletedAt));

        // Build query
        const query = db.select().from(partners);

        if (conditions.length > 0) {
            query.where(and(...conditions));
        }

        // Sorting: tier order (gold > silver > bronze) then startsAt
        const sortBy = filters.sort || 'tier';
        const sortOrder = filters.sortOrder || 'desc';

        if (sortBy === 'tier') {
            query.orderBy(
                sql`CASE ${partners.tier} WHEN 'gold' THEN 0 WHEN 'silver' THEN 1 WHEN 'bronze' THEN 2 ELSE 99 END`,
                desc(partners.startsAt)
            );
        } else if (sortBy === 'startsAt') {
            query.orderBy(sortOrder === 'asc' ? asc(partners.startsAt) : desc(partners.startsAt));
        } else if (sortBy === 'name') {
            query.orderBy(sortOrder === 'asc' ? asc(partners.name) : desc(partners.name));
        } else {
            query.orderBy(desc(partners.startsAt));
        }

        // Pagination
        const page = filters.page || 1;
        const pageSize = Math.min(filters.pageSize || 20, 100);
        query.limit(pageSize).offset((page - 1) * pageSize);

        return query.execute() as Promise<Partner[]>;
    }

    /**
     * Count active partners matching the given filters.
     *
     * Uses a SQL `COUNT(*)` aggregation rather than fetching rows and counting
     * in memory.  Applies the same text-search filter on `name`/`description`
     * that {@link findByFilters} uses so the total is always consistent with
     * the paginated results returned for the same query.
     */
    async countActivePartners(
        filters: { q?: string; type?: string; tier?: string } = {}
    ): Promise<number> {
        const db = getDb();
        const conditions = [
            eq(partners.lifecycleState, 'ACTIVE'),
            eq(partners.subscriptionStatus, 'ACTIVE'),
            isNull(partners.deletedAt)
        ];

        // Text search — mirrors findByFilters so counts are always consistent.
        if (filters.q) {
            const textSearch = or(
                safeIlike(partners.name, filters.q),
                safeIlike(partners.description, filters.q)
            );
            if (textSearch) {
                conditions.push(textSearch);
            }
        }

        if (filters.type) {
            conditions.push(eq(partners.type, filters.type));
        }

        if (filters.tier) {
            conditions.push(eq(partners.tier, filters.tier));
        }

        const result = await db
            .select({ count: count() })
            .from(partners)
            .where(and(...conditions));

        return result[0]?.count ?? 0;
    }

    /**
     * Find partner by slug
     */
    async findBySlug(slug: string): Promise<Partner | null> {
        return this.findOne({ slug });
    }

    /**
     * Find partner with subscription details
     */
    async findWithSubscription(
        id: string
    ): Promise<(Partner & { subscription: SelectPartnerSubscription | null }) | null> {
        const db = getDb();
        const result = await db
            .select({
                partner: partners,
                subscription: partnerSubscriptions
            })
            .from(partners)
            .leftJoin(partnerSubscriptions, eq(partners.id, partnerSubscriptions.partnerId))
            .where(and(eq(partners.id, id), isNull(partners.deletedAt)))
            .limit(1);

        if (result.length === 0) return null;

        const row = result[0];
        if (!row) return null;

        return {
            ...row.partner,
            subscription: row.subscription
        } as Partner & { subscription: SelectPartnerSubscription | null };
    }

    /**
     * Find partners expiring soon (for cron)
     */
    async findExpiringSoon(days = 7): Promise<Partner[]> {
        const db = getDb();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + days);

        const result = await db
            .select()
            .from(partners)
            .where(
                and(
                    eq(partners.lifecycleState, 'ACTIVE'),
                    eq(partners.subscriptionStatus, 'ACTIVE'),
                    isNull(partners.deletedAt),
                    gte(partners.endsAt, new Date()),
                    lte(partners.endsAt, cutoffDate)
                )
            );

        return result as Partner[];
    }

    /**
     * Find expired partners that need status update (for cron)
     */
    async findExpired(): Promise<Partner[]> {
        const db = getDb();
        const now = new Date();

        const result = await db
            .select()
            .from(partners)
            .where(
                and(
                    eq(partners.lifecycleState, 'ACTIVE'),
                    eq(partners.subscriptionStatus, 'ACTIVE'),
                    isNull(partners.deletedAt),
                    lte(partners.endsAt, now)
                )
            );

        return result as Partner[];
    }

    /**
     * Update partner subscription status
     */
    async updateSubscriptionStatus(
        id: string,
        status: (typeof PartnerSubscriptionStatusPgEnum.enumValues)[number]
    ): Promise<Partner | null> {
        return this.update(
            { id },
            { subscriptionStatus: status as PartnerSubscriptionStatusEnum }
        ) as Promise<Partner | null>;
    }

    /**
     * Update partner lifecycle state
     */
    async updateLifecycleState(
        id: string,
        state: (typeof LifecycleStatusPgEnum.enumValues)[number]
    ): Promise<Partner | null> {
        return this.update(
            { id },
            { lifecycleState: state as LifecycleStatusEnum }
        ) as Promise<Partner | null>;
    }

    /**
     * Link partner to subscription (for webhook handling)
     */
    async linkSubscription(
        partnerId: string,
        subscriptionId: string
    ): Promise<SelectPartnerSubscription> {
        const db = getDb();
        const result = await db
            .insert(partnerSubscriptions)
            .values({
                subscriptionId,
                partnerId,
                status: 'active',
                productDomain: 'partner'
            })
            .onConflictDoUpdate({
                target: partnerSubscriptions.partnerId,
                set: {
                    subscriptionId,
                    status: 'active',
                    updatedAt: new Date()
                }
            })
            .returning();

        if (!result[0]) {
            throw new Error('Failed to link partner subscription');
        }
        return result[0];
    }

    /**
     * Unlink partner subscription (for cancellation)
     */
    async unlinkSubscription(partnerId: string): Promise<void> {
        const db = getDb();
        await db
            .update(partnerSubscriptions)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(partnerSubscriptions.partnerId, partnerId));
    }

    /**
     * Increment analytics (impressions/clicks)
     */
    async incrementAnalytics(
        id: string,
        field: 'impressions' | 'clicks',
        increment = 1
    ): Promise<void> {
        const partner = await this.findById(id);
        if (!partner) return;

        const currentAnalytics = partner.analytics || {};
        const currentValue = currentAnalytics[field] || 0;

        await this.update(
            { id },
            {
                analytics: {
                    ...currentAnalytics,
                    [field]: currentValue + increment
                }
            }
        );
    }
}
