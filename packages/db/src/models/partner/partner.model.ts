import type { LifecycleStatusEnum, Partner } from '@repo/schemas';
import { and, asc, count, desc, eq, isNotNull, isNull, or, type SQL, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { getDb } from '../../client.js';
import type { LifecycleStatusPgEnum } from '../../schemas/enums.dbschema.ts';
import { partners } from '../../schemas/partner/partner.dbschema.js';
import { partnerTypes } from '../../schemas/partner/partner-type.dbschema.js';
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

/**
 * Filter by partner type SLUG (HOS-2336, spec D6).
 *
 * Matches through `type_id` against the catalog. During release N a row the
 * backfill has not reached yet (`type_id IS NULL`) still matches by its legacy
 * enum value. An unknown slug matches nothing (AC-5.2): the comparison is on
 * text, so it never raises an invalid-enum error.
 *
 * Exported for `PartnerService`'s admin search, which receives `type` as an
 * entity filter and must not map it to the enum column (HOS-2336 AC-4.2).
 *
 * @param slug - Partner type catalog slug.
 * @returns The SQL predicate.
 */
export function partnerTypeSlugCondition(slug: string): SQL {
    return sql`(${partners.typeId} IN (SELECT ${partnerTypes.id} FROM ${partnerTypes} WHERE ${partnerTypes.slug} = ${slug}) OR (${partners.typeId} IS NULL AND ${partners.type}::text = ${slug}))`;
}

function partnerFilterConditions(filters: SearchPartnerFilters): SQL[] {
    const conditions: SQL[] = [];
    if (filters.q) {
        const textFilter = or(
            safeIlike(partners.name, filters.q),
            safeIlike(partners.description, filters.q)
        );
        if (textFilter) conditions.push(textFilter);
    }
    if (filters.type) conditions.push(partnerTypeSlugCondition(filters.type));
    return conditions;
}

/**
 * Partner model extending BaseModel
 * Handles all database operations for partners
 */
/**
 * Predicate for "this account owns a live partner row" (HOS-2551): the row's
 * `owner_user_id` matches, it is not revoked and not soft-deleted. Served by
 * `partners_ownerUserId_idx` / `uq_partners_owner_user_id`.
 *
 * Exported so the compiled SQL can be pinned by a unit test without a database.
 *
 * @param ownerUserId - The account id.
 * @returns The SQL predicate.
 */
export function activeOwnedPartnerCondition(ownerUserId: string): SQL {
    return and(
        eq(partners.ownerUserId, ownerUserId),
        isNull(partners.revokedAt),
        isNull(partners.deletedAt)
    ) as SQL;
}

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
            conditions.push(partnerTypeSlugCondition(filters.type));
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
     * Whether the account owns a live (not revoked, not deleted) partner row
     * (HOS-2551). A one-row indexed existence probe: it selects only the id,
     * so `/auth/me` can afford it on every protected render.
     *
     * @param args - `{ ownerUserId, tx? }`.
     * @returns `true` when such a row exists.
     */
    async existsActiveForOwner(args: {
        readonly ownerUserId: string;
        readonly tx?: DrizzleClient;
    }): Promise<boolean> {
        const db = args.tx ?? getDb();
        const rows = await db
            .select({ id: partners.id })
            .from(partners)
            .where(activeOwnedPartnerCondition(args.ownerUserId))
            .limit(1);
        return rows.length > 0;
    }

    /** Locks a non-deleted Partner row for ACC:12 (sources: action 13), AC:V7:14; V7 §1.6. */
    async lockById(args: {
        readonly tx: DrizzleClient;
        readonly partnerId: string;
    }): Promise<Partner | null> {
        const rows = await args.tx
            .select()
            .from(partners)
            .where(and(eq(partners.id, args.partnerId), isNull(partners.deletedAt)))
            .for('update')
            .limit(1);
        return (rows[0] as Partner | undefined) ?? null;
    }

    /** Writes the sole ACC:12 (sources: action 13) presence bit, AC:V7:14; V7 §1.6. */
    async setPresenceModerated(args: {
        readonly tx: DrizzleClient;
        readonly partnerId: string;
        readonly moderated: boolean;
    }): Promise<void> {
        await args.tx
            .update(partners)
            .set({ presenceModerated: args.moderated })
            .where(and(eq(partners.id, args.partnerId), isNull(partners.deletedAt)));
    }

    /**
     * The sole ACC:25 write (D-2): empties exactly the presence-content and review-delivery columns
     * that align with `partnerPresenceHasContent`, without changing unrelated Partner state.
     */
    async emptyPresenceContent(args: { tx: DrizzleClient; partnerId: string }): Promise<void> {
        await args.tx
            .update(partners)
            .set({
                logoUrl: null,
                websiteUrl: null,
                description: null,
                contactInfo: null,
                socialNetworks: null,
                pendingLogoUrl: null,
                pendingDescription: null,
                pendingWebsiteUrl: null,
                contentReviewState: null,
                contentReviewNote: null
            })
            .where(and(eq(partners.id, args.partnerId), isNull(partners.deletedAt)));
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
