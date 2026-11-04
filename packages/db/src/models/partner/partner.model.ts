import type { LifecycleStatusEnum, Partner } from '@repo/schemas';
import { and, asc, count, desc, eq, isNotNull, isNull, or, type SQL } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { getDb } from '../../client.js';
import type { LifecycleStatusPgEnum } from '../../schemas/enums.dbschema.ts';
import { partners } from '../../schemas/partner/partner.dbschema.js';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';

export interface SearchPartnerFilters {
    q?: string;
    type?: string;
    includeInactive?: boolean;
    page?: number;
    pageSize?: number;
    sort?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface AdminSearchPartnerFilters extends SearchPartnerFilters {
    includeDeleted?: boolean;
}

function partnerFilterConditions(filters: SearchPartnerFilters): SQL[] {
    const conditions: SQL[] = [];
    if (filters.q) {
        conditions.push(
            or(safeIlike(partners.name, filters.q), safeIlike(partners.description, filters.q))!
        );
    }
    if (filters.type) conditions.push(eq(partners.type, filters.type));
    return conditions;
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

        conditions.push(...partnerFilterConditions(filters));

        // Soft delete filter
        conditions.push(isNull(partners.deletedAt));

        // Build query
        const query = db.select().from(partners);

        if (conditions.length > 0) {
            query.where(and(...conditions));
        }

        // Sorting defaults to newest partners; legacy commercial dates no longer exist.
        const sortBy = filters.sort;
        const sortOrder = filters.sortOrder || 'desc';

        if (sortBy === 'name') {
            query.orderBy(sortOrder === 'asc' ? asc(partners.name) : desc(partners.name));
        } else {
            query.orderBy(desc(partners.createdAt));
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
    async countActivePartners(filters: { q?: string; type?: string } = {}): Promise<number> {
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
     * Find one live, owned and unmoderated public presence candidate by slug.
     * AC:V7:13; V7 §1.6 (V/18 §1.6).
     */
    async findPresenceCandidateBySlug(args: {
        readonly slug: string;
        readonly tx?: DrizzleClient;
    }): Promise<Partner | null> {
        const db = args.tx ?? getDb();
        const rows = (await db
            .select()
            .from(partners)
            .where(
                and(
                    eq(partners.slug, args.slug),
                    isNull(partners.deletedAt),
                    isNotNull(partners.ownerUserId),
                    eq(partners.presenceModerated, false)
                )
            )
            .limit(1)
            .execute()) as Partner[];
        return rows[0] ?? null;
    }

    /**
     * Find live, owned and unmoderated carousel candidates matching search filters.
     * AC:V7:13; V7 §1.6 (V/18 §1.6).
     */
    async findPresenceCandidates(args: {
        readonly filters?: SearchPartnerFilters;
        readonly tx?: DrizzleClient;
    }): Promise<Partner[]> {
        const db = args.tx ?? getDb();
        const filters = args.filters ?? {};
        const conditions: SQL[] = [
            isNull(partners.deletedAt),
            isNotNull(partners.ownerUserId),
            eq(partners.presenceModerated, false)
        ];
        conditions.push(...partnerFilterConditions(filters));
        const query = db
            .select()
            .from(partners)
            .where(and(...conditions));
        const sortOrder = filters.sortOrder ?? 'desc';
        query.orderBy(
            filters.sort === 'name'
                ? sortOrder === 'asc'
                    ? asc(partners.name)
                    : desc(partners.name)
                : desc(partners.createdAt),
            asc(partners.id)
        );
        return query.execute() as Promise<Partner[]>;
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
