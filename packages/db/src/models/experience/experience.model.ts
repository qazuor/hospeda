import type { Experience } from '@repo/schemas';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { experiences } from '../../schemas/experience/experiences.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Search input for experience listings (basic subset — expand as routes are built).
 */
interface ExperienceSearchInput {
    readonly q?: string;
    readonly destinationId?: string;
    readonly ownerId?: string;
    readonly type?: string;
    readonly isFeatured?: boolean;
    readonly hasActiveSubscription?: boolean;
    readonly page?: number;
    readonly pageSize?: number;
}

/**
 * ExperienceModel — all DB access for experience commerce listings (SPEC-240).
 *
 * Mirrors GastronomyModel structure: extends BaseModelImpl, provides search()
 * override with experience-specific filters (type, hasActiveSubscription).
 * Expand with domain-specific query methods as the service layer grows.
 */
export class ExperienceModel extends BaseModelImpl<Experience> {
    protected table = experiences;
    public entityName = 'experiences';

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
     * `socialNetworks`, `openingHours`, `videos`, `seo`, `rating` and
     * `adminInfo` (also JSONB on this table) are deliberately NOT added
     * here — that is a separate decision left to the table owner, same as
     * `partners.socialNetworks` was excluded for a documented reason (see
     * `PartnerModel`).
     */
    protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;

    protected getTableName(): string {
        return 'experiences';
    }

    /**
     * Paginated search with optional filters.
     * @param params - Search parameters
     * @param tx - Optional transaction client
     * @returns Matching experiences and total count
     */
    async search(
        params: ExperienceSearchInput,
        tx?: DrizzleClient
    ): Promise<{ items: Experience[]; total: number }> {
        const db = this.getClient(tx);
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 10;
        const ctx = { params };

        try {
            const whereClauses = [isNull(experiences.deletedAt)];

            if (params.destinationId) {
                whereClauses.push(eq(experiences.destinationId, params.destinationId));
            }
            if (params.ownerId) {
                whereClauses.push(eq(experiences.ownerId, params.ownerId));
            }
            if (params.type) {
                whereClauses.push(
                    eq(experiences.type, params.type as typeof experiences.type._.data)
                );
            }
            if (params.isFeatured !== undefined) {
                whereClauses.push(eq(experiences.isFeatured, params.isFeatured));
            }
            if (params.hasActiveSubscription !== undefined) {
                whereClauses.push(
                    eq(experiences.hasActiveSubscription, params.hasActiveSubscription)
                );
            }
            if (params.q) {
                whereClauses.push(safeIlike(experiences.name, params.q));
            }

            const where = and(...whereClauses);
            const offset = (page - 1) * pageSize;

            const [items, totalResult] = await Promise.all([
                db
                    .select()
                    .from(this.table)
                    .where(where)
                    .orderBy(desc(experiences.createdAt))
                    .limit(pageSize)
                    .offset(offset),
                db.select({ count: count() }).from(this.table).where(where)
            ]);

            const result = {
                // DRIZZLE-LIMITATION: select() returns branded Drizzle types; entity type
                // from @repo/schemas uses unbranded domain types. BaseModelImpl casts
                // consistently with the same pattern (see base.model.ts `as T[]`).
                items: items as unknown as Experience[],
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
     * Returns the IDs of every non-deleted experience listing owned by the
     * given owner. Mirrors `AccommodationModel.findIdsByOwnerId` — used by
     * `EntityViewService.getStatsForOwnCommerceListings` /
     * `getDailySeriesForOwnCommerceListings` (HOS-734) to resolve which
     * `entity_views` rows belong to the caller without accepting an ownerId
     * param at the route layer (anti-peeking).
     *
     * @param ownerId - The owner's user id.
     * @param tx - Optional transaction client.
     * @returns Array of experience listing IDs (may be empty).
     */
    async findIdsByOwnerId(ownerId: string, tx?: DrizzleClient): Promise<string[]> {
        const db = this.getClient(tx);
        const ctx = { ownerId };
        try {
            const rows = await db
                .select({ id: experiences.id })
                .from(experiences)
                .where(and(eq(experiences.ownerId, ownerId), isNull(experiences.deletedAt)));

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

/** Singleton instance of ExperienceModel for use across the application. */
export const experienceModel = new ExperienceModel();
