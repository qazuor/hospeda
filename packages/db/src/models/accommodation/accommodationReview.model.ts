import type { AccommodationReview } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodationReviews } from '../../schemas/accommodation/accommodation_review.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { buildWhereClause } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Type for accommodation review with user and accommodation relations
 */
type AccommodationReviewWithRelations = AccommodationReview & {
    user?: { id: string; firstName?: string; lastName?: string; email: string };
    accommodation?: { id: string; name: string; slug: string };
};

/**
 * Model for accommodation reviews. Use for all DB access related to accommodation reviews.
 * Inherits CRUD and paginated methods from BaseModel.
 */
export class AccommodationReviewModel extends BaseModelImpl<AccommodationReview> {
    protected table = accommodationReviews;
    public entityName = 'accommodationReviews';

    protected getTableName(): string {
        return 'accommodationReviews';
    }

    /**
     * Finds accommodation reviews with user information included.
     * @param where - The filter object to apply
     * @param options - Optional pagination parameters
     * @param tx - Optional transaction client
     * @returns Promise resolving to reviews with user data
     */
    async findAllWithUser(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number },
        tx?: DrizzleClient
    ): Promise<{
        items: AccommodationReviewWithRelations[];
        total: number;
    }> {
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        const page = options?.page;
        const pageSize = options?.pageSize;
        const isPaginated = page !== undefined && pageSize !== undefined;
        const logContext = { where: safeWhere, page, pageSize };

        try {
            const whereClause = buildWhereClause(safeWhere, this.table);

            if (isPaginated) {
                const offset = (page - 1) * pageSize;
                const [items, total] = await Promise.all([
                    db.query.accommodationReviews.findMany({
                        where: whereClause,
                        with: { user: true, accommodation: true },
                        limit: pageSize,
                        offset: offset
                    }),
                    this.count(safeWhere, { tx })
                ]);

                const result = {
                    items: items as unknown as AccommodationReviewWithRelations[],
                    total
                };
                try {
                    logQuery(this.entityName, 'findAllWithUser', logContext, result);
                } catch {}
                return result;
            }

            const items = await db.query.accommodationReviews.findMany({
                where: whereClause,
                with: { user: true, accommodation: true }
            });

            const result = {
                items: items as unknown as AccommodationReviewWithRelations[],
                total: items.length
            };
            try {
                logQuery(this.entityName, 'findAllWithUser', { where: safeWhere }, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findAllWithUser', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findAllWithUser', logContext, err.message);
        }
    }
}

/** Singleton instance of AccommodationReviewModel for use across the application. */
export const accommodationReviewModel = new AccommodationReviewModel();
