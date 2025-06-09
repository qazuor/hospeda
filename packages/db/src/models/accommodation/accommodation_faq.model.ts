import type {
    AccommodationFaqType,
    NewAccommodationFaqInputType,
    UpdateAccommodationFaqInputType
} from '@repo/types';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { accommodationFaqs } from '../../dbschemas/accommodation/accommodation_faq.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for AccommodationFaqModel
 * Columns: question, createdAt
 */
const faqOrderable = createOrderableColumnsAndMapping(
    ['question', 'createdAt'] as const,
    accommodationFaqs
);

export const FAQ_ORDERABLE_COLUMNS = faqOrderable.columns;
export type FaqOrderByColumn = typeof faqOrderable.type;
const faqOrderableColumns = faqOrderable.mapping;

export type FaqPaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: FaqOrderByColumn;
};

export type FaqSearchParams = FaqPaginationParams & {
    q?: string;
    question?: string;
    category?: string;
    lifecycle?: string;
};

export const AccommodationFaqModel = {
    /**
     * Get FAQ by its unique ID.
     *
     * @param id - FAQ ID
     * @returns AccommodationFaqType if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getById(id: string): Promise<AccommodationFaqType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(accommodationFaqs)
                .where(eq(accommodationFaqs.id, id))
                .limit(1);
            dbLogger.query({
                table: 'accommodation_faqs',
                action: 'getById',
                params: { id },
                result
            });
            return result[0] as AccommodationFaqType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AccommodationFaqModel.getById');
            throw new Error(`Failed to get accommodation FAQ by id: ${(error as Error).message}`);
        }
    },

    /**
     * Get FAQs by accommodation ID.
     *
     * @param accommodationId - Accommodation ID
     * @returns Array of AccommodationFaqType
     * @throws Error if the query fails
     */
    async getByAccommodation(accommodationId: string): Promise<AccommodationFaqType[]> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(accommodationFaqs)
                .where(eq(accommodationFaqs.accommodationId, accommodationId));
            dbLogger.query({
                table: 'accommodation_faqs',
                action: 'getByAccommodation',
                params: { accommodationId },
                result
            });
            return result as AccommodationFaqType[];
        } catch (error) {
            dbLogger.error(error, 'AccommodationFaqModel.getByAccommodation');
            throw new Error(
                `Failed to get accommodation FAQs by accommodation: ${(error as Error).message}`
            );
        }
    },

    /**
     * Create a new FAQ entry.
     *
     * @param input - New FAQ input
     * @returns The created AccommodationFaqType
     * @throws Error if the insert fails
     */
    async create(input: NewAccommodationFaqInputType): Promise<AccommodationFaqType> {
        const db = getDb();
        try {
            const result = await db.insert(accommodationFaqs).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'accommodation_faqs',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as AccommodationFaqType;
        } catch (error) {
            dbLogger.error(error, 'AccommodationFaqModel.create');
            throw new Error(`Failed to create accommodation FAQ: ${(error as Error).message}`);
        }
    },

    /**
     * Update a FAQ entry by ID.
     *
     * @param id - FAQ ID
     * @param input - Update input
     * @returns Updated AccommodationFaqType if found, otherwise undefined
     * @throws Error if the update fails
     */
    async update(
        id: string,
        input: UpdateAccommodationFaqInputType
    ): Promise<AccommodationFaqType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .update(accommodationFaqs)
                .set(input)
                .where(eq(accommodationFaqs.id, id))
                .returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'accommodation_faqs',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as AccommodationFaqType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AccommodationFaqModel.update');
            throw new Error(`Failed to update accommodation FAQ: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete a FAQ entry by ID.
     *
     * @param id - FAQ ID
     * @param deletedById - User ID who deletes
     * @returns Object with deleted FAQ id if found, otherwise undefined
     * @throws Error if the delete fails
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(accommodationFaqs)
                .set({ deletedAt: now, deletedById })
                .where(eq(accommodationFaqs.id, id))
                .returning({ id: accommodationFaqs.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'accommodation_faqs',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'AccommodationFaqModel.delete');
            throw new Error(`Failed to delete accommodation FAQ: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete a FAQ entry by ID.
     *
     * @param id - FAQ ID
     * @returns True if deleted, false otherwise
     * @throws Error if the delete fails
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db
                .delete(accommodationFaqs)
                .where(eq(accommodationFaqs.id, id))
                .returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'accommodation_faqs',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'AccommodationFaqModel.hardDelete');
            throw new Error(`Failed to hard delete accommodation FAQ: ${(error as Error).message}`);
        }
    },

    /**
     * List FAQ entries with pagination and optional ordering.
     *
     * @param params - Pagination and ordering parameters
     * @returns Array of AccommodationFaqType
     * @throws Error if the query fails
     */
    async list(params: FaqPaginationParams): Promise<AccommodationFaqType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                faqOrderableColumns,
                orderBy,
                accommodationFaqs.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(accommodationFaqs)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'accommodation_faqs', action: 'list', params, result });
            return result as AccommodationFaqType[];
        } catch (error) {
            dbLogger.error(error, 'AccommodationFaqModel.list');
            throw new Error(`Failed to list accommodation FAQs: ${(error as Error).message}`);
        }
    },

    /**
     * Search FAQ entries by question, category, etc.
     *
     * @param params - Search and pagination parameters
     * @returns Array of AccommodationFaqType
     * @throws Error if the query fails
     */
    async search(params: FaqSearchParams): Promise<AccommodationFaqType[]> {
        const db = getDb();
        const { q, question, category, lifecycle, limit, offset, order, orderBy } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(accommodationFaqs.question, prepareLikeQuery(q)));
            }
            if (question) {
                whereClauses.push(ilike(accommodationFaqs.question, prepareLikeQuery(question)));
            }
            if (category) {
                whereClauses.push(eq(accommodationFaqs.category, category));
            }
            if (lifecycle) {
                whereClauses.push(eq(accommodationFaqs.lifecycle, lifecycle));
            }
            const col = getOrderableColumn(
                faqOrderableColumns,
                orderBy,
                accommodationFaqs.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(accommodationFaqs)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'accommodation_faqs', action: 'search', params, result });
            return result as AccommodationFaqType[];
        } catch (error) {
            dbLogger.error(error, 'AccommodationFaqModel.search');
            throw new Error(`Failed to search accommodation FAQs: ${(error as Error).message}`);
        }
    },

    /**
     * Count FAQ entries with optional filters.
     *
     * @param params - Search parameters
     * @returns Number of FAQ entries matching the query
     * @throws Error if the query fails
     */
    async count(params?: FaqSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { q, question, category, lifecycle } = params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(accommodationFaqs.question, prepareLikeQuery(q)));
            }
            if (question) {
                whereClauses.push(ilike(accommodationFaqs.question, prepareLikeQuery(question)));
            }
            if (category) {
                whereClauses.push(eq(accommodationFaqs.category, category));
            }
            if (lifecycle) {
                whereClauses.push(eq(accommodationFaqs.lifecycle, lifecycle));
            }
            const result = await db
                .select({ count: count().as('count') })
                .from(accommodationFaqs)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
            dbLogger.query({ table: 'accommodation_faqs', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'AccommodationFaqModel.count');
            throw new Error(`Failed to count accommodation FAQs: ${(error as Error).message}`);
        }
    }
};
