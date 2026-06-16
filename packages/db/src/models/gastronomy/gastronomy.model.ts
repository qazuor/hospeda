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
}

/** Singleton instance of GastronomyModel for use across the application. */
export const gastronomyModel = new GastronomyModel();
