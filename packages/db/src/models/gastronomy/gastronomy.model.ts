import type { Gastronomy } from '@repo/schemas';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { gastronomies } from '../../schemas/gastronomy/gastronomy.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Search input for gastronomy listings (basic subset — expand as routes are built).
 */
interface GastronomySearchInput {
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
 * GastronomyModel — all DB access for gastronomy commerce listings (SPEC-239).
 *
 * Mirrors AccommodationModel structure: extends BaseModelImpl, provides search()
 * and findWithRelations() overrides. Expand with domain-specific query methods
 * as the service layer grows.
 */
export class GastronomyModel extends BaseModelImpl<Gastronomy> {
    protected table = gastronomies;
    public entityName = 'gastronomies';

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
     * is empty in production as of this fix, so there is no data to migrate.
     *
     * `socialNetworks`, `openingHours`, `videos`, `seo`, `rating` and
     * `adminInfo` (also JSONB on this table) are deliberately NOT added
     * here — that is a separate decision left to the table owner, same as
     * `partners.socialNetworks` was excluded for a documented reason (see
     * `PartnerModel`).
     */
    protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;

    protected getTableName(): string {
        return 'gastronomies';
    }

    /**
     * Paginated search with optional filters.
     * @param params - Search parameters
     * @param tx - Optional transaction client
     * @returns Matching gastronomies and total count
     */
    async search(
        params: GastronomySearchInput,
        tx?: DrizzleClient
    ): Promise<{ items: Gastronomy[]; total: number }> {
        const db = this.getClient(tx);
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 10;
        const ctx = { params };

        try {
            const whereClauses = [isNull(gastronomies.deletedAt)];

            if (params.destinationId) {
                whereClauses.push(eq(gastronomies.destinationId, params.destinationId));
            }
            if (params.ownerId) {
                whereClauses.push(eq(gastronomies.ownerId, params.ownerId));
            }
            if (params.type) {
                whereClauses.push(
                    eq(gastronomies.type, params.type as typeof gastronomies.type._.data)
                );
            }
            if (params.priceRange) {
                whereClauses.push(
                    eq(
                        gastronomies.priceRange,
                        params.priceRange as typeof gastronomies.priceRange._.data
                    )
                );
            }
            if (params.isFeatured !== undefined) {
                whereClauses.push(eq(gastronomies.isFeatured, params.isFeatured));
            }
            if (params.q) {
                whereClauses.push(safeIlike(gastronomies.name, params.q));
            }

            const where = and(...whereClauses);
            const offset = (page - 1) * pageSize;

            const [items, totalResult] = await Promise.all([
                db
                    .select()
                    .from(this.table)
                    .where(where)
                    .orderBy(desc(gastronomies.createdAt))
                    .limit(pageSize)
                    .offset(offset),
                db.select({ count: count() }).from(this.table).where(where)
            ]);

            const result = {
                // DRIZZLE-LIMITATION: select() returns branded Drizzle types; entity type
                // from @repo/schemas uses unbranded domain types. BaseModelImpl casts
                // consistently with the same pattern (see base.model.ts `as T[]`).
                items: items as unknown as Gastronomy[],
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
     * Returns the IDs of every non-deleted gastronomy listing owned by the
     * given owner. Mirrors `AccommodationModel.findIdsByOwnerId` — used by
     * `EntityViewService.getStatsForOwnCommerceListings` /
     * `getDailySeriesForOwnCommerceListings` (HOS-734) to resolve which
     * `entity_views` rows belong to the caller without accepting an ownerId
     * param at the route layer (anti-peeking).
     *
     * @param ownerId - The owner's user id.
     * @param tx - Optional transaction client.
     * @returns Array of gastronomy listing IDs (may be empty).
     */
    async findIdsByOwnerId(ownerId: string, tx?: DrizzleClient): Promise<string[]> {
        const db = this.getClient(tx);
        const ctx = { ownerId };
        try {
            const rows = await db
                .select({ id: gastronomies.id })
                .from(gastronomies)
                .where(and(eq(gastronomies.ownerId, ownerId), isNull(gastronomies.deletedAt)));

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

/** Singleton instance of GastronomyModel for use across the application. */
export const gastronomyModel = new GastronomyModel();
