import type { DestinationReview } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { destinationReviews } from '../../schemas/destination/destination_review.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { buildWhereClause } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Type for destination review with user and destination relations
 */
type DestinationReviewWithRelations = DestinationReview & {
    user?: { id: string; firstName?: string; lastName?: string; email: string };
    destination?: { id: string; name: string; slug: string };
};

export class DestinationReviewModel extends BaseModelImpl<DestinationReview> {
    protected table = destinationReviews;
    public entityName = 'destinationReviews';

    protected getTableName(): string {
        return 'destinationReviews';
    }

    /**
     * Finds destination reviews with user information included.
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
        items: DestinationReviewWithRelations[];
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
                    db.query.destinationReviews.findMany({
                        where: whereClause,
                        with: { user: true, destination: true },
                        limit: pageSize,
                        offset: offset
                    }),
                    this.count(safeWhere, { tx })
                ]);

                const result = {
                    items: items as unknown as DestinationReviewWithRelations[],
                    total
                };
                try {
                    logQuery(this.entityName, 'findAllWithUser', logContext, result);
                } catch {}
                return result;
            }

            const items = await db.query.destinationReviews.findMany({
                where: whereClause,
                with: { user: true, destination: true }
            });

            const result = {
                items: items as unknown as DestinationReviewWithRelations[],
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

/** Singleton instance of DestinationReviewModel for use across the application. */
export const destinationReviewModel = new DestinationReviewModel();
