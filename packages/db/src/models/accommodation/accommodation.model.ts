import type {
    AccommodationType,
    DestinationType,
    NewAccommodationInputType,
    TagType,
    UpdateAccommodationInputType,
    UserType
} from '@repo/types';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { accommodations } from '../../dbschemas/accommodation/accommodation.dbschema.ts';
import { rEntityTag } from '../../dbschemas/tag/r_entity_tag.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for AccommodationModel
 * Columns: owner, destination, averageRating, visibility, lifecycle, name, type
 */
const accommodationOrderable = createOrderableColumnsAndMapping(
    [
        'ownerId',
        'destinationId',
        'averageRating',
        'visibility',
        'lifecycle',
        'name',
        'type'
    ] as const,
    accommodations
);

export const ACCOMMODATION_ORDERABLE_COLUMNS = accommodationOrderable.columns;
export type AccommodationOrderByColumn = typeof accommodationOrderable.type;
const accommodationOrderableColumns = accommodationOrderable.mapping;

export type AccommodationPaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: AccommodationOrderByColumn;
};

export type AccommodationSearchParams = AccommodationPaginationParams & {
    q?: string;
    name?: string;
    type?: string;
    ownerId?: string;
    destinationId?: string;
    tagId?: string;
    lifecycle?: string;
    visibility?: string;
};

export type AccommodationRelations = {
    tags?: true;
    owner?: true;
    destination?: true;
};

export type AccommodationRelationResult<T extends AccommodationRelations> = {
    tags: T['tags'] extends true ? TagType[] : never;
    owner: T['owner'] extends true ? UserType : never;
    destination: T['destination'] extends true ? DestinationType : never;
};

export type AccommodationWithRelationsType = AccommodationType & {
    tags?: TagType[];
    owner?: UserType;
    destination?: DestinationType;
};

export const AccommodationModel = {
    /**
     * Get an accommodation by its unique ID.
     *
     * @param {string} id - Accommodation ID
     * @returns {Promise<AccommodationType | undefined>} Accommodation if found, otherwise undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const accommodation = await AccommodationModel.getById('accommodation-uuid');
     * if (accommodation) {
     *   console.log(accommodation.name);
     * }
     */
    async getById(id: string): Promise<AccommodationType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(accommodations)
                .where(eq(accommodations.id, id))
                .limit(1);
            dbLogger.query({ table: 'accommodations', action: 'getById', params: { id }, result });
            return result[0] as AccommodationType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.getById');
            throw new Error(`Failed to get accommodation by id: ${(error as Error).message}`);
        }
    },

    /**
     * Get an accommodation by its unique name.
     */
    async getByName(name: string): Promise<AccommodationType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(accommodations)
                .where(eq(accommodations.name, name))
                .limit(1);
            dbLogger.query({
                table: 'accommodations',
                action: 'getByName',
                params: { name },
                result
            });
            return result[0] as AccommodationType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.getByName');
            throw new Error(`Failed to get accommodation by name: ${(error as Error).message}`);
        }
    },

    /**
     * Get an accommodation by its unique slug.
     */
    async getBySlug(slug: string): Promise<AccommodationType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(accommodations)
                .where(eq(accommodations.slug, slug))
                .limit(1);
            dbLogger.query({
                table: 'accommodations',
                action: 'getBySlug',
                params: { slug },
                result
            });
            return result[0] as AccommodationType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.getBySlug');
            throw new Error(`Failed to get accommodation by slug: ${(error as Error).message}`);
        }
    },

    /**
     * Get accommodations by type.
     */
    async getByType(type: string): Promise<AccommodationType[]> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(accommodations)
                .where(eq(accommodations.type, type));
            dbLogger.query({
                table: 'accommodations',
                action: 'getByType',
                params: { type },
                result
            });
            return result as AccommodationType[];
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.getByType');
            throw new Error(`Failed to get accommodations by type: ${(error as Error).message}`);
        }
    },

    /**
     * Create a new accommodation.
     */
    async create(input: NewAccommodationInputType): Promise<AccommodationType> {
        const db = getDb();
        try {
            const result = await db.insert(accommodations).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'accommodations',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as AccommodationType;
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.create');
            throw new Error(`Failed to create accommodation: ${(error as Error).message}`);
        }
    },

    /**
     * Update an accommodation by ID.
     */
    async update(
        id: string,
        input: UpdateAccommodationInputType
    ): Promise<AccommodationType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .update(accommodations)
                .set(input)
                .where(eq(accommodations.id, id))
                .returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'accommodations',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as AccommodationType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.update');
            throw new Error(`Failed to update accommodation: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete an accommodation by ID.
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(accommodations)
                .set({ deletedAt: now, deletedById })
                .where(eq(accommodations.id, id))
                .returning({ id: accommodations.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'accommodations',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.delete');
            throw new Error(`Failed to delete accommodation: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete an accommodation by ID.
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db
                .delete(accommodations)
                .where(eq(accommodations.id, id))
                .returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'accommodations',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.hardDelete');
            throw new Error(`Failed to hard delete accommodation: ${(error as Error).message}`);
        }
    },

    /**
     * List accommodations with pagination and optional ordering.
     */
    async list(params: AccommodationPaginationParams): Promise<AccommodationType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                accommodationOrderableColumns,
                orderBy,
                accommodations.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(accommodations)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'accommodations', action: 'list', params, result });
            return result as AccommodationType[];
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.list');
            throw new Error(`Failed to list accommodations: ${(error as Error).message}`);
        }
    },

    /**
     * Search accommodations by name, type, owner, destination, tag, etc.
     */
    async search(params: AccommodationSearchParams): Promise<AccommodationType[]> {
        const db = getDb();
        const {
            q,
            name,
            type,
            ownerId,
            destinationId,
            tagId,
            lifecycle,
            visibility,
            limit,
            offset,
            order,
            orderBy
        } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(
                    or(
                        ilike(accommodations.name, prepareLikeQuery(q)),
                        ilike(accommodations.summary, prepareLikeQuery(q)),
                        ilike(accommodations.description, prepareLikeQuery(q))
                    )
                );
            }
            if (name) {
                whereClauses.push(ilike(accommodations.name, prepareLikeQuery(name)));
            }
            if (type) {
                whereClauses.push(eq(accommodations.type, type));
            }
            if (ownerId) {
                whereClauses.push(eq(accommodations.ownerId, ownerId));
            }
            if (destinationId) {
                whereClauses.push(eq(accommodations.destinationId, destinationId));
            }
            if (lifecycle) {
                whereClauses.push(eq(accommodations.lifecycle, lifecycle));
            }
            if (visibility) {
                whereClauses.push(eq(accommodations.visibility, visibility));
            }
            const col = getOrderableColumn(
                accommodationOrderableColumns,
                orderBy,
                accommodations.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            if (tagId) {
                // Query with innerJoin
                const result = await db
                    .select({ accommodations, rEntityTag })
                    .from(accommodations)
                    .innerJoin(
                        rEntityTag,
                        and(
                            eq(rEntityTag.entityId, accommodations.id),
                            eq(rEntityTag.tagId, tagId),
                            eq(rEntityTag.entityType, 'ACCOMMODATION')
                        )
                    )
                    .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
                    .orderBy(orderExpr)
                    .limit(limit)
                    .offset(offset);
                dbLogger.query({ table: 'accommodations', action: 'search', params, result });
                return result.map((row) => row.accommodations as AccommodationType);
            }
            // Query without innerJoin
            const result = await db
                .select()
                .from(accommodations)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'accommodations', action: 'search', params, result });
            return result as AccommodationType[];
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.search');
            throw new Error(`Failed to search accommodations: ${(error as Error).message}`);
        }
    },

    /**
     * Count accommodations with optional filters.
     */
    async count(params?: AccommodationSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { name, type, ownerId, destinationId, tagId, lifecycle, visibility, q } =
                params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(accommodations.name, prepareLikeQuery(q)));
            }
            if (name) {
                whereClauses.push(ilike(accommodations.name, prepareLikeQuery(name)));
            }
            if (type) {
                whereClauses.push(eq(accommodations.type, type));
            }
            if (ownerId) {
                whereClauses.push(eq(accommodations.ownerId, ownerId));
            }
            if (destinationId) {
                whereClauses.push(eq(accommodations.destinationId, destinationId));
            }
            if (lifecycle) {
                whereClauses.push(eq(accommodations.lifecycle, lifecycle));
            }
            if (visibility) {
                whereClauses.push(eq(accommodations.visibility, visibility));
            }
            if (tagId) {
                // Query con innerJoin
                const result = await db
                    .select({ count: count().as('count'), rEntityTag })
                    .from(accommodations)
                    .innerJoin(
                        rEntityTag,
                        and(
                            eq(rEntityTag.entityId, accommodations.id),
                            eq(rEntityTag.tagId, tagId),
                            eq(rEntityTag.entityType, 'ACCOMMODATION')
                        )
                    )
                    .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
                dbLogger.query({ table: 'accommodations', action: 'count', params, result });
                return Number(result[0]?.count ?? 0);
            }
            // Query sin innerJoin
            const result = await db
                .select({ count: count().as('count') })
                .from(accommodations)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
            dbLogger.query({ table: 'accommodations', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.count');
            throw new Error(`Failed to count accommodations: ${(error as Error).message}`);
        }
    },

    /**
     * Get an accommodation by ID, including specified relations.
     */
    async getWithRelations<T extends AccommodationRelations>(
        id: string,
        withRelations: T
    ): Promise<(AccommodationWithRelationsType & AccommodationRelationResult<T>) | undefined> {
        const db = getDb();
        try {
            const result = await db.query.accommodations.findFirst({
                where: (a, { eq }) => eq(a.id, id),
                with: withRelations as Record<string, true>
            });
            dbLogger.query({
                table: 'accommodations',
                action: 'getWithRelations',
                params: { id, with: withRelations },
                result
            });
            return result as
                | (AccommodationWithRelationsType & AccommodationRelationResult<T>)
                | undefined;
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.getWithRelations');
            throw new Error(
                `Failed to get accommodation with relations: ${(error as Error).message}`
            );
        }
    },

    /**
     * Get accommodations by tag.
     */
    async getByTag(tagId: string): Promise<AccommodationType[]> {
        const db = getDb();
        try {
            const result = await db
                .select({ accommodations, rEntityTag })
                .from(accommodations)
                .innerJoin(
                    rEntityTag,
                    and(
                        eq(rEntityTag.entityId, accommodations.id),
                        eq(rEntityTag.tagId, tagId),
                        eq(rEntityTag.entityType, 'ACCOMMODATION')
                    )
                );
            dbLogger.query({
                table: 'accommodations',
                action: 'getByTag',
                params: { tagId },
                result
            });
            return result.map((row) => row.accommodations as AccommodationType);
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.getByTag');
            throw new Error(`Failed to get accommodations by tag: ${(error as Error).message}`);
        }
    },

    /**
     * Get accommodations by owner.
     */
    async getByOwner(ownerId: string): Promise<AccommodationType[]> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(accommodations)
                .where(eq(accommodations.ownerId, ownerId));
            dbLogger.query({
                table: 'accommodations',
                action: 'getByOwner',
                params: { ownerId },
                result
            });
            return result as AccommodationType[];
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.getByOwner');
            throw new Error(`Failed to get accommodations by owner: ${(error as Error).message}`);
        }
    },

    /**
     * Get accommodations by destination.
     */
    async getByDestination(destinationId: string): Promise<AccommodationType[]> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(accommodations)
                .where(eq(accommodations.destinationId, destinationId));
            dbLogger.query({
                table: 'accommodations',
                action: 'getByDestination',
                params: { destinationId },
                result
            });
            return result as AccommodationType[];
        } catch (error) {
            dbLogger.error(error, 'AccommodationModel.getByDestination');
            throw new Error(
                `Failed to get accommodations by destination: ${(error as Error).message}`
            );
        }
    }
};
