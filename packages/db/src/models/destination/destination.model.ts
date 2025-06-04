import type {
    DestinationType,
    DestinationWithRelationsType,
    NewDestinationInputType,
    UpdateDestinationInputType
} from '@repo/types';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { destinations } from '../../dbschemas/destination/destination.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

const destinationOrderable = createOrderableColumnsAndMapping(
    ['name', 'slug', 'createdAt', 'updatedAt'] as const,
    destinations
);

export const DESTINATION_ORDERABLE_COLUMNS = destinationOrderable.columns;
export type DestinationOrderByColumn = typeof destinationOrderable.type;
const destinationOrderableColumns = destinationOrderable.mapping;

export type DestinationPaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: DestinationOrderByColumn;
};

export type DestinationSearchParams = DestinationPaginationParams & {
    q?: string;
    name?: string;
    slug?: string;
    isFeatured?: boolean;
    visibility?: string;
    lifecycle?: string;
};

export const DestinationModel = {
    /**
     * Retrieve a destination by its unique ID.
     */
    async getById(id: string): Promise<DestinationType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(destinations)
                .where(eq(destinations.id, id))
                .limit(1);
            dbLogger.query({ table: 'destinations', action: 'getById', params: { id }, result });
            return result[0] as DestinationType | undefined;
        } catch (error) {
            dbLogger.error(error, 'DestinationModel.getById');
            throw new Error(`Failed to get destination by id: ${(error as Error).message}`);
        }
    },
    /**
     * Create a new destination.
     */
    async create(input: NewDestinationInputType): Promise<DestinationType> {
        const db = getDb();
        try {
            const result = await db.insert(destinations).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'destinations',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as DestinationType;
        } catch (error) {
            dbLogger.error(error, 'DestinationModel.create');
            throw new Error(`Failed to create destination: ${(error as Error).message}`);
        }
    },
    /**
     * Update a destination by its ID.
     */
    async update(
        id: string,
        input: UpdateDestinationInputType
    ): Promise<DestinationType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .update(destinations)
                .set(input)
                .where(eq(destinations.id, id))
                .returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'destinations',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as DestinationType | undefined;
        } catch (error) {
            dbLogger.error(error, 'DestinationModel.update');
            throw new Error(`Failed to update destination: ${(error as Error).message}`);
        }
    },
    /**
     * Soft delete a destination by ID (sets deletedAt and deletedById).
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(destinations)
                .set({ deletedAt: now, deletedById })
                .where(eq(destinations.id, id))
                .returning({ id: destinations.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'destinations',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'DestinationModel.delete');
            throw new Error(`Failed to delete destination: ${(error as Error).message}`);
        }
    },
    /**
     * Hard delete a destination by ID (permanently removes from DB).
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db.delete(destinations).where(eq(destinations.id, id)).returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'destinations',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'DestinationModel.hardDelete');
            throw new Error(`Failed to hard delete destination: ${(error as Error).message}`);
        }
    },
    /**
     * Retrieve a destination by slug.
     */
    async findBySlug(slug: string): Promise<DestinationType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(destinations)
                .where(eq(destinations.slug, slug))
                .limit(1);
            dbLogger.query({
                table: 'destinations',
                action: 'findBySlug',
                params: { slug },
                result
            });
            return result[0] as DestinationType | undefined;
        } catch (error) {
            dbLogger.error(error, 'DestinationModel.findBySlug');
            throw new Error(`Failed to find destination by slug: ${(error as Error).message}`);
        }
    },
    /**
     * Retrieve a destination by slug (alias for findBySlug).
     */
    async getBySlug(slug: string): Promise<DestinationType | undefined> {
        return this.findBySlug(slug);
    },
    /**
     * Retrieve a destination by ID, including specified relations.
     */
    async getWithRelations(id: string): Promise<DestinationWithRelationsType | undefined> {
        const db = getDb();
        try {
            const result = await db.query.destinations.findFirst({
                where: (d, { eq }) => eq(d.id, id),
                with: {
                    accommodations: true,
                    reviews: true,
                    tags: true,
                    attractions: true
                }
            });
            dbLogger.query({
                table: 'destinations',
                action: 'getWithRelations',
                params: { id },
                result
            });
            return result as DestinationWithRelationsType | undefined;
        } catch (error) {
            dbLogger.error(error, 'DestinationModel.getWithRelations');
            throw new Error(
                `Failed to get destination with relations: ${(error as Error).message}`
            );
        }
    },
    /**
     * List destinations with filters, pagination and ordering.
     * @param params - ListInput (filtros, paginación, orden)
     * @returns Array de destinos
     * @example
     * const results = await DestinationModel.list({ limit: 10, offset: 0, visibility: 'PUBLIC' });
     */
    async list(params: {
        limit: number;
        offset: number;
        order?: 'asc' | 'desc';
        orderBy?:
            | 'name'
            | 'slug'
            | 'createdAt'
            | 'updatedAt'
            | 'isFeatured'
            | 'reviewsCount'
            | 'averageRating'
            | 'accommodationsCount';
        visibility?: string;
        isFeatured?: boolean;
        lifecycle?: string;
        moderationState?: string;
        deletedAt?: string | null;
    }): Promise<DestinationType[]> {
        const db = getDb();
        const {
            limit,
            offset,
            order,
            orderBy,
            visibility,
            isFeatured,
            lifecycle,
            moderationState,
            deletedAt
        } = params;
        try {
            const whereClauses = [];
            if (visibility) whereClauses.push(eq(destinations.visibility, visibility));
            if (isFeatured !== undefined)
                whereClauses.push(eq(destinations.isFeatured, isFeatured));
            if (lifecycle) whereClauses.push(eq(destinations.lifecycle, lifecycle));
            if (moderationState)
                whereClauses.push(eq(destinations.moderationState, moderationState));
            if (deletedAt === null) {
                whereClauses.push(eq(destinations.deletedAt, null));
            } else if (deletedAt) {
                whereClauses.push(eq(destinations.deletedAt, deletedAt));
            }
            // Ordenamiento
            let col = destinations.createdAt;
            switch (orderBy) {
                case 'name':
                    col = destinations.name;
                    break;
                case 'slug':
                    col = destinations.slug;
                    break;
                case 'createdAt':
                    col = destinations.createdAt;
                    break;
                case 'updatedAt':
                    col = destinations.updatedAt;
                    break;
                case 'isFeatured':
                    col = destinations.isFeatured;
                    break;
                case 'reviewsCount':
                    col = destinations.reviewsCount;
                    break;
                case 'averageRating':
                    col = destinations.averageRating;
                    break;
                case 'accommodationsCount':
                    col = destinations.accommodationsCount;
                    break;
            }
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const queryBuilder = db.select().from(destinations);
            const queryWithWhere =
                whereClauses.length > 0 ? queryBuilder.where(and(...whereClauses)) : queryBuilder;
            const finalQuery = queryWithWhere.orderBy(orderExpr).limit(limit).offset(offset);
            const result = await finalQuery;
            dbLogger.query({ table: 'destinations', action: 'list', params, result });
            return result as DestinationType[];
        } catch (error) {
            dbLogger.error(error, 'DestinationModel.list');
            throw new Error(`Failed to list destinations: ${(error as Error).message}`);
        }
    },
    /**
     * Count destinations with optional filters (name, slug, isFeatured, visibility, lifecycle).
     */
    async count(params?: DestinationSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { name, slug, isFeatured, visibility, lifecycle } = params || {};
            const whereClauses = [];
            if (name) {
                // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm typing
                whereClauses.push((destinations as any).name.ilike(prepareLikeQuery(name)));
            }
            if (slug) {
                whereClauses.push(eq(destinations.slug, slug));
            }
            if (isFeatured !== undefined) {
                whereClauses.push(eq(destinations.isFeatured, isFeatured));
            }
            if (visibility) {
                whereClauses.push(eq(destinations.visibility, visibility));
            }
            if (lifecycle) {
                whereClauses.push(eq(destinations.lifecycle, lifecycle));
            }
            const query = db.select({ count: count().as('count') }).from(destinations);
            const finalQuery = whereClauses.length > 0 ? query.where(and(...whereClauses)) : query;
            const result = await finalQuery;
            dbLogger.query({ table: 'destinations', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'DestinationModel.count');
            throw new Error(`Failed to count destinations: ${(error as Error).message}`);
        }
    },
    /**
     * Search destinations by partial name, slug, isFeatured, visibility, lifecycle, with pagination and ordering.
     */
    async search(params: DestinationSearchParams): Promise<DestinationType[]> {
        const db = getDb();
        const { name, slug, isFeatured, visibility, lifecycle, limit, offset, order, orderBy } =
            params;
        try {
            const whereClauses = [];
            if (name) {
                // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm typing
                whereClauses.push((destinations as any).name.ilike(prepareLikeQuery(name)));
            }
            if (slug) {
                whereClauses.push(eq(destinations.slug, slug));
            }
            if (isFeatured !== undefined) {
                whereClauses.push(eq(destinations.isFeatured, isFeatured));
            }
            if (visibility) {
                whereClauses.push(eq(destinations.visibility, visibility));
            }
            if (lifecycle) {
                whereClauses.push(eq(destinations.lifecycle, lifecycle));
            }
            const col = getOrderableColumn(
                destinationOrderableColumns,
                orderBy,
                destinations.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const queryBuilder = db.select().from(destinations);
            const queryWithWhere =
                whereClauses.length > 0 ? queryBuilder.where(and(...whereClauses)) : queryBuilder;
            const finalQuery = queryWithWhere.orderBy(orderExpr).limit(limit).offset(offset);
            const result = await finalQuery;
            dbLogger.query({ table: 'destinations', action: 'search', params, result });
            return result as DestinationType[];
        } catch (error) {
            dbLogger.error(error, 'DestinationModel.search');
            throw new Error(`Failed to search destinations: ${(error as Error).message}`);
        }
    },
    /**
     * Retrieve a destination by name.
     */
    async getByName(name: string): Promise<DestinationType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(destinations)
                .where(eq(destinations.name, name))
                .limit(1);
            dbLogger.query({
                table: 'destinations',
                action: 'getByName',
                params: { name },
                result
            });
            return result[0] as DestinationType | undefined;
        } catch (error) {
            dbLogger.error(error, 'DestinationModel.getByName');
            throw new Error(`Failed to get destination by name: ${(error as Error).message}`);
        }
    }
};
