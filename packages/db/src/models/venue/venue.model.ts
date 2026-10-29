import type { Venue } from '@repo/schemas';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { venues } from '../../schemas/venue/venue.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { withListingBirthColumns } from '../listing/listing-birth.ts';

/**
 * Search input for venue listings (basic subset — expand as routes are built).
 */
interface VenueModelSearchInput {
    readonly q?: string;
    readonly destinationId?: string;
    readonly ownerId?: string;
    readonly type?: string;
    readonly priceRange?: string;
    readonly isFeatured?: boolean;
    readonly page?: number;
    readonly pageSize?: number;
}

/**
 * VenueModel — all DB access for venue listings (SPEC-239).
 *
 * Mirrors AccommodationModel structure: extends BaseModelImpl, provides search()
 * and findWithRelations() overrides. Expand with domain-specific query methods
 * as the service layer grows.
 */
export class VenueModel extends BaseModelImpl<Venue> {
    protected table = venues;
    public entityName = 'venues';

    /** Creates a venue with its initial publication clock. */
    override async create(data: Partial<Venue>, tx?: DrizzleClient): Promise<Venue> {
        return super.create(withListingBirthColumns({ data }).data, tx);
    }

    protected override readonly validRelationKeys = [
        'owner',
        'createdBy',
        'updatedBy',
        'deletedBy',
        'destination',
        'amenities',
        'features',
        'reviews',
        'faqs'
    ] as const;

    /**
     * Grouped JSONB columns shallow-merged (PostgreSQL `||`) on update rather
     * than replaced wholesale, following the `accommodations` / `users` /
     * `partners` precedent (HOS-278 D3).
     *
     * `contactInfo` was NOT declared here until now — every model with a
     * `contact_info` JSONB column defaults to full replacement unless it
     * opts in, so a PATCH that sent only one contact field (e.g. a phone
     * number) silently deleted every other stored contact field. The table
     * held ZERO rows in production when this shipped — soft-deleted ones
     * included — so there was nothing to backfill (owner's measurement,
     * 2026-09-05, HOS-1190). That is a dated observation, not a standing
     * property of the table: re-measure before reusing it to justify skipping
     * a migration.
     *
     * `socialNetworks` is merged for the same reason (HOS-1262): it is one JSONB
     * value of up to six independent network URLs, and a PATCH that sent one
     * network used to replace the column and silently delete the rest. The price
     * is the same as for `contactInfo`: clearing a network is an explicit `null`
     * (`{ socialNetworks: { instagram: null } }`), never an omission. The shared
     * `SocialNetworkSchema` (WRITE) and `SocialNetworkReadSchema` (READ) both
     * accept `null` per key for exactly that reason. `socialNetworks: null` (the
     * whole value) still clears the entire column.
     *
     * `openingHours`, `videos`, `seo`, `rating` and `adminInfo` (also JSONB on
     * this table) are deliberately NOT added here — that is a separate decision
     * left to the table owner.
     */
    protected override readonly mergeableJsonbColumns = ['contactInfo', 'socialNetworks'] as const;

    protected getTableName(): string {
        return 'venues';
    }

    /**
     * Paginated search with optional filters.
     * @param params - Search parameters
     * @param tx - Optional transaction client
     * @returns Matching venues and total count
     */
    async search(
        params: VenueModelSearchInput,
        tx?: DrizzleClient
    ): Promise<{ items: Venue[]; total: number }> {
        const db = this.getClient(tx);
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 10;
        const ctx = { params };

        try {
            const whereClauses = [isNull(venues.deletedAt)];

            if (params.destinationId) {
                whereClauses.push(eq(venues.destinationId, params.destinationId));
            }
            if (params.ownerId) {
                whereClauses.push(eq(venues.ownerId, params.ownerId));
            }
            if (params.type) {
                whereClauses.push(eq(venues.type, params.type as typeof venues.type._.data));
            }
            if (params.priceRange) {
                whereClauses.push(
                    eq(venues.priceRange, params.priceRange as typeof venues.priceRange._.data)
                );
            }
            if (params.isFeatured !== undefined) {
                // `isFeatured` is the public name; its only source is
                // `featuredByEntitlement` since HOS-1419 dropped `is_featured`.
                whereClauses.push(eq(venues.featuredByEntitlement, params.isFeatured));
            }
            if (params.q) {
                whereClauses.push(safeIlike(venues.name, params.q));
            }

            const where = and(...whereClauses);
            const offset = (page - 1) * pageSize;

            const [items, totalResult] = await Promise.all([
                db
                    .select()
                    .from(this.table)
                    .where(where)
                    .orderBy(desc(venues.createdAt))
                    .limit(pageSize)
                    .offset(offset),
                db.select({ count: count() }).from(this.table).where(where)
            ]);

            const result = {
                // DRIZZLE-LIMITATION: select() returns branded Drizzle types; entity type
                // from @repo/schemas uses unbranded domain types. BaseModelImpl casts
                // consistently with the same pattern (see base.model.ts `as T[]`).
                items: items as unknown as Venue[],
                total: Number(totalResult[0]?.count ?? 0)
            };
            logQuery(this.entityName, 'search', ctx, { count: result.total });
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'search', ctx, err);
            throw new DbError(this.entityName, 'search', ctx, err.message);
        }
    }

    /**
     * Returns the IDs of every non-deleted venue listing owned by the
     * given owner. Mirrors `AccommodationModel.findIdsByOwnerId` — used by
     * `EntityViewService.getStatsForOwnListings` /
     * `getDailySeriesForOwnListings` (HOS-734) to resolve which
     * `entity_views` rows belong to the caller without accepting an ownerId
     * param at the route layer (anti-peeking).
     *
     * @param ownerId - The owner's user id.
     * @param tx - Optional transaction client.
     * @returns Array of venue listing IDs (may be empty).
     */
    async findIdsByOwnerId(ownerId: string, tx?: DrizzleClient): Promise<string[]> {
        const db = this.getClient(tx);
        const ctx = { ownerId };
        try {
            const rows = await db
                .select({ id: venues.id })
                .from(venues)
                .where(and(eq(venues.ownerId, ownerId), isNull(venues.deletedAt)));

            const ids = rows.map((r) => r.id);
            logQuery(this.entityName, 'findIdsByOwnerId', ctx, { count: ids.length });
            return ids;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findIdsByOwnerId', ctx, err);
            throw new DbError(this.entityName, 'findIdsByOwnerId', ctx, err.message);
        }
    }
}

/** Singleton instance of VenueModel for use across the application. */
export const venueModel = new VenueModel();
