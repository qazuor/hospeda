import type { LifecycleStatusEnum, Partner } from '@repo/schemas';
import { and, asc, count, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { getDb } from '../../client.js';
import type { LifecycleStatusPgEnum } from '../../schemas/enums.dbschema.ts';
import { partners } from '../../schemas/partner/partner.dbschema.js';
import { safeIlike } from '../../utils/drizzle-helpers.ts';

export interface SearchPartnerFilters {
    q?: string;
    type?: string;
    tier?: string;
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

    /**
     * Grouped JSONB columns shallow-merged (PostgreSQL `||`) on update rather
     * than replaced wholesale (HOS-278 D3).
     *
     * `contactInfo` is here because the `/mi-cuenta` form models a SUBSET of
     * its keys (three of nine). Without the merge, saving a phone number would
     * replace the whole object and silently delete the emails and preference
     * enums the form never sent — the exact loss `accommodations` declared this
     * for. Clearing still works: every `ContactInfoSchema` field is
     * `.nullish()`, so "I deleted my phone" travels as an explicit `null`.
     *
     * `socialNetworks` is merged for the same reason (HOS-1262): it is one JSONB
     * value of up to six independent network URLs, and a PATCH that sent one
     * network used to replace the column and silently delete the rest. The price
     * is the same as for `contactInfo`: clearing a network is an explicit `null`
     * (`{ socialNetworks: { instagram: null } }`), never an omission. The shared
     * `SocialNetworkSchema` (WRITE) and `SocialNetworkReadSchema` (READ) both
     * accept `null` per key for exactly that reason. `socialNetworks: null` (the
     * whole value) still clears the entire column. `PartnerEditForm` therefore sends an explicit `null` for every
     * network the partner cleared.
     */
    protected override readonly mergeableJsonbColumns = ['contactInfo', 'socialNetworks'] as const;

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

        // Only active partners by default. The lifecycle state is the only
        // visibility switch since the partner billing columns were dropped
        // (HOS-1419).
        if (!filters.includeInactive) {
            conditions.push(eq(partners.lifecycleState, 'ACTIVE'));
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

        // Soft delete filter
        conditions.push(isNull(partners.deletedAt));

        // Build query
        const query = db.select().from(partners);

        if (conditions.length > 0) {
            query.where(and(...conditions));
        }

        // Sorting: tier order (gold > silver) then startsAt.
        //
        // The `bronze` branch was dropped by HOS-294 along with the tier itself.
        // It is raw SQL, so nothing in the type system would ever have flagged
        // it — the enum could lose a value and this CASE would keep naming it
        // forever, silently dead. `ELSE 99` still catches anything unexpected.
        const sortBy = filters.sort || 'tier';
        const sortOrder = filters.sortOrder || 'desc';

        if (sortBy === 'tier') {
            query.orderBy(
                sql`CASE ${partners.tier} WHEN 'gold' THEN 0 WHEN 'silver' THEN 1 ELSE 99 END`,
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
        const conditions = [eq(partners.lifecycleState, 'ACTIVE'), isNull(partners.deletedAt)];

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
                    isNull(partners.deletedAt),
                    lte(partners.endsAt, now)
                )
            );

        return result as Partner[];
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
