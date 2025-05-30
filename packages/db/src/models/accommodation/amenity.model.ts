import type {
    AccommodationType,
    AmenityType,
    NewAmenityInputType,
    UpdateAmenityInputType
} from '@repo/types';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { amenities } from '../../dbschemas/accommodation/amenity.dbschema.ts';
import { rAccommodationAmenity } from '../../dbschemas/accommodation/r_accommodation_amenity.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for AmenityModel
 *
 * This pattern provides a robust, type-safe way to define which columns of a model
 * can be used for ordering (sorting) in list queries, and ensures that both the
 * allowed values and the Drizzle column references are always in sync.
 *
 * Example:
 *   const amenityOrderable = createOrderableColumnsAndMapping([
 *     'name', 'isBuiltin', 'type'
 *   ] as const, amenities);
 *   export const AMENITY_ORDERABLE_COLUMNS = amenityOrderable.columns;
 *   export type AmenityOrderByColumn = typeof amenityOrderable.type;
 *   const amenityOrderableColumns = amenityOrderable.mapping;
 *
 *   // In your model method:
 *   const col = getOrderableColumn(amenityOrderableColumns, orderBy, amenities.name);
 *   const orderExpr = order === 'desc' ? desc(col) : asc(col);
 */
const amenityOrderable = createOrderableColumnsAndMapping(
    ['name', 'isBuiltin', 'type'] as const,
    amenities
);

export const AMENITY_ORDERABLE_COLUMNS = amenityOrderable.columns;
export type AmenityOrderByColumn = typeof amenityOrderable.type;
const amenityOrderableColumns = amenityOrderable.mapping;

export type AmenityPaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: AmenityOrderByColumn;
};

export type AmenitySearchParams = AmenityPaginationParams & {
    q?: string;
    name?: string;
    type?: string;
    isBuiltin?: boolean;
    lifecycle?: string;
};

export type AmenityRelations = {
    accommodations?: true;
};

export type AmenityRelationResult<T extends AmenityRelations> = {
    accommodations: T['accommodations'] extends true ? AccommodationType[] : never;
};

export type AmenityWithRelationsType = AmenityType & {
    accommodations?: AccommodationType[];
};

export const AmenityModel = {
    /**
     * Retrieve an amenity by its unique ID.
     *
     * @param {string} id - Amenity ID
     * @returns {Promise<AmenityType | undefined>} AmenityType if found, otherwise undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const amenity = await AmenityModel.getById('amenity-uuid');
     * if (amenity) {
     *   console.log(amenity.name);
     * }
     */
    async getById(id: string): Promise<AmenityType | undefined> {
        const db = getDb();
        try {
            const result = await db.select().from(amenities).where(eq(amenities.id, id)).limit(1);
            dbLogger.query({ table: 'amenities', action: 'getById', params: { id }, result });
            return result[0] as AmenityType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AmenityModel.getById');
            throw new Error(`Failed to get amenity by id: ${(error as Error).message}`);
        }
    },

    /**
     * Retrieve an amenity by its exact name.
     *
     * @param {string} name - Amenity name
     * @returns {Promise<AmenityType | undefined>} AmenityType if found, otherwise undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const amenity = await AmenityModel.getByName('WiFi');
     * if (amenity) {
     *   console.log(amenity.id);
     * }
     */
    async getByName(name: string): Promise<AmenityType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(amenities)
                .where(eq(amenities.name, name))
                .limit(1);
            dbLogger.query({ table: 'amenities', action: 'getByName', params: { name }, result });
            return result[0] as AmenityType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AmenityModel.getByName');
            throw new Error(`Failed to get amenity by name: ${(error as Error).message}`);
        }
    },

    /**
     * Retrieve all amenities of a given type.
     *
     * @param {string} type - Amenity type
     * @returns {Promise<AmenityType[]>} Array of amenities of the given type
     * @throws {Error} If the query fails
     *
     * @example
     * const amenities = await AmenityModel.getByType('KITCHEN');
     * amenities.forEach(a => console.log(a.name));
     */
    async getByType(type: string): Promise<AmenityType[]> {
        const db = getDb();
        try {
            const result = await db.select().from(amenities).where(eq(amenities.type, type));
            dbLogger.query({ table: 'amenities', action: 'getByType', params: { type }, result });
            return result as AmenityType[];
        } catch (error) {
            dbLogger.error(error, 'AmenityModel.getByType');
            throw new Error(`Failed to get amenities by type: ${(error as Error).message}`);
        }
    },

    /**
     * Retrieve all amenities for a given accommodation.
     *
     * @param {string} accommodationId - Accommodation ID
     * @returns {Promise<AmenityType[]>} Array of amenities for the accommodation
     * @throws {Error} If the query fails
     *
     * @example
     * const amenities = await AmenityModel.getByAccommodation('accommodation-uuid');
     * amenities.forEach(a => console.log(a.name));
     */
    async getByAccommodation(accommodationId: string): Promise<AmenityType[]> {
        const db = getDb();
        try {
            const result = await db
                .select({ amenities, rAccommodationAmenity })
                .from(amenities)
                .innerJoin(
                    rAccommodationAmenity,
                    and(
                        eq(rAccommodationAmenity.amenityId, amenities.id),
                        eq(rAccommodationAmenity.accommodationId, accommodationId)
                    )
                );
            dbLogger.query({
                table: 'amenities',
                action: 'getByAccommodation',
                params: { accommodationId },
                result
            });
            if (!Array.isArray(result)) return [];
            return result.map((row) => row.amenities as AmenityType);
        } catch (error) {
            dbLogger.error(error, 'AmenityModel.getByAccommodation');
            throw new Error(
                `Failed to get amenities by accommodation: ${(error as Error).message}`
            );
        }
    },

    /**
     * Create a new amenity.
     *
     * @param {NewAmenityInputType} input - The amenity creation input
     * @returns {Promise<AmenityType>} The created amenity
     * @throws {Error} If the insert fails
     *
     * @example
     * const newAmenity = await AmenityModel.create({
     *   name: 'WiFi',
     *   isBuiltin: true,
     *   type: 'CONNECTIVITY'
     * });
     * console.log(newAmenity.id);
     */
    async create(input: NewAmenityInputType): Promise<AmenityType> {
        const db = getDb();
        try {
            const result = await db.insert(amenities).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'amenities',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as AmenityType;
        } catch (error) {
            dbLogger.error(error, 'AmenityModel.create');
            throw new Error(`Failed to create amenity: ${(error as Error).message}`);
        }
    },

    /**
     * Update an amenity by ID.
     *
     * @param {string} id - Amenity ID
     * @param {UpdateAmenityInputType} input - Fields to update
     * @returns {Promise<AmenityType | undefined>} The updated amenity or undefined if not found
     * @throws {Error} If the update fails
     *
     * @example
     * const updated = await AmenityModel.update('amenity-uuid', { name: 'Updated' });
     * if (updated) {
     *   console.log(updated.name);
     * }
     */
    async update(id: string, input: UpdateAmenityInputType): Promise<AmenityType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .update(amenities)
                .set(input)
                .where(eq(amenities.id, id))
                .returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'amenities',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as AmenityType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AmenityModel.update');
            throw new Error(`Failed to update amenity: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete an amenity by ID (sets deletedAt and deletedById).
     *
     * @param {string} id - Amenity ID
     * @param {string} deletedById - User ID performing the deletion
     * @returns {Promise<{ id: string } | undefined>} The deleted amenity's ID or undefined if not found
     * @throws {Error} If the operation fails
     *
     * @example
     * const deleted = await AmenityModel.delete('amenity-uuid', 'user-uuid');
     * if (deleted) {
     *   console.log('Deleted amenity:', deleted.id);
     * }
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(amenities)
                .set({ deletedAt: now, deletedById })
                .where(eq(amenities.id, id))
                .returning({ id: amenities.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'amenities',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'AmenityModel.delete');
            throw new Error(`Failed to delete amenity: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete an amenity by ID (permanently removes from DB).
     *
     * @param {string} id - Amenity ID
     * @returns {Promise<boolean>} True if deleted, false if not found
     * @throws {Error} If the operation fails
     *
     * @example
     * const wasDeleted = await AmenityModel.hardDelete('amenity-uuid');
     * if (wasDeleted) {
     *   console.log('Amenity permanently deleted');
     * }
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db.delete(amenities).where(eq(amenities.id, id)).returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'amenities',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'AmenityModel.hardDelete');
            throw new Error(`Failed to hard delete amenity: ${(error as Error).message}`);
        }
    },

    /**
     * List amenities with pagination and optional ordering.
     *
     * @param {AmenityPaginationParams} params - Pagination and ordering params
     * @returns {Promise<AmenityType[]>} Array of amenities
     * @throws {Error} If the query fails
     *
     * @example
     * const amenities = await AmenityModel.list({ limit: 20, offset: 0, orderBy: 'name', order: 'asc' });
     * amenities.forEach(a => console.log(a.name));
     */
    async list(params: AmenityPaginationParams): Promise<AmenityType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(amenityOrderableColumns, orderBy, amenities.name);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(amenities)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'amenities', action: 'list', params, result });
            return result as AmenityType[];
        } catch (error) {
            dbLogger.error(error, 'AmenityModel.list');
            throw new Error(`Failed to list amenities: ${(error as Error).message}`);
        }
    },

    /**
     * Search amenities by name, type, isBuiltin, or lifecycle, with pagination and ordering.
     *
     * @param {AmenitySearchParams} params - Search and pagination params
     * @returns {Promise<AmenityType[]>} Array of amenities matching the search
     * @throws {Error} If the query fails
     *
     * @example
     * const amenities = await AmenityModel.search({ name: 'WiFi', limit: 10, offset: 0 });
     * amenities.forEach(a => console.log(a.name));
     */
    async search(params: AmenitySearchParams): Promise<AmenityType[]> {
        const db = getDb();
        const { q, name, type, isBuiltin, lifecycle, limit, offset, order, orderBy } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(amenities.name, prepareLikeQuery(q)));
            }
            if (name) {
                whereClauses.push(ilike(amenities.name, prepareLikeQuery(name)));
            }
            if (type) {
                whereClauses.push(eq(amenities.type, type));
            }
            if (typeof isBuiltin === 'boolean') {
                whereClauses.push(eq(amenities.isBuiltin, isBuiltin));
            }
            if (lifecycle) {
                whereClauses.push(eq(amenities.lifecycle, lifecycle));
            }
            const col = getOrderableColumn(amenityOrderableColumns, orderBy, amenities.name);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const queryBuilder = db.select().from(amenities);
            const queryWithWhere =
                whereClauses.length > 0 ? queryBuilder.where(and(...whereClauses)) : queryBuilder;
            const finalQuery = queryWithWhere.orderBy(orderExpr).limit(limit).offset(offset);
            const result = await finalQuery;
            dbLogger.query({ table: 'amenities', action: 'search', params, result });
            return result as AmenityType[];
        } catch (error) {
            dbLogger.error(error, 'AmenityModel.search');
            throw new Error(`Failed to search amenities: ${(error as Error).message}`);
        }
    },

    /**
     * Count amenities with optional filters (name, type, isBuiltin, lifecycle).
     *
     * @param {AmenitySearchParams} [params] - Search filters
     * @returns {Promise<number>} Number of amenities matching the filters
     * @throws {Error} If the query fails
     *
     * @example
     * const count = await AmenityModel.count({ type: 'KITCHEN' });
     * console.log('Kitchen amenities:', count);
     */
    async count(params?: AmenitySearchParams): Promise<number> {
        const db = getDb();
        try {
            const { name, type, isBuiltin, lifecycle, q } = params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(amenities.name, prepareLikeQuery(q)));
            }
            if (name) {
                whereClauses.push(ilike(amenities.name, prepareLikeQuery(name)));
            }
            if (type) {
                whereClauses.push(eq(amenities.type, type));
            }
            if (typeof isBuiltin === 'boolean') {
                whereClauses.push(eq(amenities.isBuiltin, isBuiltin));
            }
            if (lifecycle) {
                whereClauses.push(eq(amenities.lifecycle, lifecycle));
            }
            const query = db.select({ count: count().as('count') }).from(amenities);
            const finalQuery = whereClauses.length > 0 ? query.where(and(...whereClauses)) : query;
            const result = await finalQuery;
            dbLogger.query({ table: 'amenities', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'AmenityModel.count');
            throw new Error(`Failed to count amenities: ${(error as Error).message}`);
        }
    },

    /**
     * Retrieve an amenity by ID, including specified relations.
     *
     * @template T
     * @param {string} id - Amenity ID
     * @param {T} withRelations - Relations to populate (e.g., { accommodations: true })
     * @returns {Promise<(AmenityWithRelationsType & AmenityRelationResult<T>) | undefined>} Amenity with requested relations or undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const amenity = await AmenityModel.getWithRelations('amenity-uuid', { accommodations: true });
     * if (amenity?.accommodations) {
     *   console.log(amenity.accommodations.length);
     * }
     */
    async getWithRelations<T extends AmenityRelations>(
        id: string,
        withRelations: T
    ): Promise<(AmenityWithRelationsType & AmenityRelationResult<T>) | undefined> {
        const db = getDb();
        try {
            const result = await db.query.amenities.findFirst({
                where: (a, { eq }) => eq(a.id, id),
                with: withRelations as Record<string, true>
            });
            dbLogger.query({
                table: 'amenities',
                action: 'getWithRelations',
                params: { id, with: withRelations },
                result
            });
            return result as (AmenityWithRelationsType & AmenityRelationResult<T>) | undefined;
        } catch (error) {
            dbLogger.error(error, 'AmenityModel.getWithRelations');
            throw new Error(`Failed to get amenity with relations: ${(error as Error).message}`);
        }
    }
};
