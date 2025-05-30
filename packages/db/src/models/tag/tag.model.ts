import type {
    EntityTagType,
    LifecycleStatusEnum,
    NewTagInputType,
    PaginationParams,
    SearchParams,
    TagColorEnum,
    TagType,
    UpdateTagInputType
} from '@repo/types';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { tags } from '../../dbschemas/tag/tag.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 *  Orderable Columns Pattern for Drizzle ORM Models
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * This pattern provides a robust, type-safe way to define which columns of a model
 * can be used for ordering (sorting) in list queries, and ensures that both the
 * allowed values and the Drizzle column references are always in sync.
 *
 * Steps to replicate for any model:
 *
 * 1. Define the list of orderable column names as a readonly tuple (e.g.,
 *    ['name', 'createdAt', ...] as const).
 * 2. Use the `createOrderableColumnsAndMapping` utility to generate:
 *    - A readonly array of allowed column names for UI/validation.
 *    - A type union of allowed column names for strong typing.
 *    - A mapping from column name to Drizzle column reference for queries.
 * 3. Export:
 *    - The array (for dropdowns, validation, etc.).
 *    - The type (for params, DTOs, etc.).
 *    - The mapping (for use in getOrderableColumn and query building).
 * 4. Use the type in your pagination/search params:
 *    type MyOrderByColumn = typeof myOrderable.type;
 *    type MyPaginationParams = PaginationParams<MyOrderByColumn>;
 * 5. Use the mapping and getOrderableColumn in your list/search methods to resolve
 *    the correct Drizzle column reference, with fallback and error handling.
 *
 * Example:
 *
 *   const myOrderable = createOrderableColumnsAndMapping(
 *     ['name', 'createdAt'] as const,
 *     myTable
 *   );
 *   export const MY_ORDERABLE_COLUMNS = myOrderable.columns;
 *   export type MyOrderByColumn = typeof myOrderable.type;
 *   const myOrderableColumns = myOrderable.mapping;
 *
 *   // In your model method:
 *   const col = getOrderableColumn(myOrderableColumns, orderBy, myTable.createdAt);
 *   const orderExpr = order === 'desc' ? desc(col) : asc(col);
 *
 * Best practices:
 * - Always use the type for params, not just string.
 * - Export the array for UI and validation.
 * - Keep the mapping internal to the model.
 * - Add/rename columns in the tuple and mapping only, never in multiple places.
 *
 * See TagModel below for a full implementation.
 */

const tagOrderable = createOrderableColumnsAndMapping(
    ['name', 'color', 'lifecycle', 'createdAt', 'updatedAt'] as const,
    tags
);

/**
 * Readonly array of valid columns for ordering tags.
 * Use this for UI dropdowns, validation, etc.
 */
export const TAG_ORDERABLE_COLUMNS = tagOrderable.columns;

/**
 * Type representing all valid columns for ordering tags.
 * Use this for strong typing in params, DTOs, etc.
 */
export type TagOrderByColumn = typeof tagOrderable.type;

/**
 * Internal mapping for Drizzle ORM, generated automatically from TAG_ORDERABLE_COLUMNS.
 * Ensures the mapping is always in sync with the allowed columns.
 */
const tagOrderableColumns = tagOrderable.mapping;

/**
 * Pagination params for TagModel, with strong typing for orderBy.
 */
export type TagPaginationParams = PaginationParams<TagOrderByColumn>;

/**
 * Search params for TagModel, with strong typing for orderBy and tag-specific filters.
 */
export type TagSearchParams = SearchParams<TagOrderByColumn> & {
    color?: TagColorEnum;
    lifecycleState?: LifecycleStatusEnum;
};

/**
 * TagModel provides CRUD and query operations for Tag entities.
 * All methods are strongly typed and log queries/errors via dbLogger.
 */

/**
 * Possible relations for TagModel.withRelations.
 *
 * @example
 * // To fetch a tag with its entityTags:
 * const tag = await TagModel.getWithRelations('tag-uuid', { entityTags: true });
 */
export type TagRelations = {
    entityTags?: true;
};

/**
 * Maps the 'with' object to the actual relation results.
 *
 * @template T - TagRelations
 * @example
 * // Usage in getWithRelations:
 * type Result = TagType & RelationResult<{ entityTags: true }>;
 */
export type RelationResult<T extends TagRelations> = {
    entityTags: T['entityTags'] extends true ? EntityTagType[] : never;
};

export const TagModel = {
    /**
     * Retrieve a tag by its unique ID.
     *
     * @param {string} id - Tag ID
     * @returns {Promise<TagType | undefined>} TagType if found, otherwise undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const tag = await TagModel.getById('tag-uuid');
     * if (tag) {
     *   console.log(tag.name);
     * }
     */
    async getById(id: string): Promise<TagType | undefined> {
        const db = getDb();
        try {
            const result = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
            dbLogger.query({ table: 'tags', action: 'getById', params: { id }, result });
            return result[0] as TagType | undefined;
        } catch (error) {
            dbLogger.error(error, 'TagModel.getById');
            throw new Error(`Failed to get tag by id: ${(error as Error).message}`);
        }
    },

    /**
     * Create a new tag.
     *
     * @param {NewTagInputType} input - The tag creation input
     * @returns {Promise<TagType>} The created tag
     * @throws {Error} If the insert fails
     *
     * @example
     * const newTag = await TagModel.create({
     *   name: 'Nature',
     *   color: TagColorEnum.GREEN,
     *   lifecycleState: LifecycleStatusEnum.ACTIVE
     * });
     * console.log(newTag.id);
     */
    async create(input: NewTagInputType): Promise<TagType> {
        const db = getDb();
        try {
            const result = await db.insert(tags).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({ table: 'tags', action: 'create', params: { input }, result: created });
            if (!created) throw new Error('Insert failed');
            return created as TagType;
        } catch (error) {
            dbLogger.error(error, 'TagModel.create');
            throw new Error(`Failed to create tag: ${(error as Error).message}`);
        }
    },

    /**
     * Update a tag by its ID.
     *
     * @param {string} id - Tag ID
     * @param {UpdateTagInputType} input - Fields to update
     * @returns {Promise<TagType | undefined>} The updated tag or undefined if not found
     * @throws {Error} If the update fails
     *
     * @example
     * const updated = await TagModel.update('tag-uuid', { color: TagColorEnum.BLUE });
     * if (updated) {
     *   console.log(updated.color);
     * }
     */
    async update(id: string, input: UpdateTagInputType): Promise<TagType | undefined> {
        const db = getDb();
        try {
            const result = await db.update(tags).set(input).where(eq(tags.id, id)).returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'tags',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as TagType | undefined;
        } catch (error) {
            dbLogger.error(error, 'TagModel.update');
            throw new Error(`Failed to update tag: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete a tag by ID (sets deletedAt and deletedById).
     *
     * @param {string} id - Tag ID
     * @param {string} deletedById - User ID performing the deletion
     * @returns {Promise<{ id: string } | undefined>} The deleted tag's ID or undefined if not found
     * @throws {Error} If the operation fails
     *
     * @example
     * const deleted = await TagModel.delete('tag-uuid', 'user-uuid');
     * if (deleted) {
     *   console.log('Deleted tag:', deleted.id);
     * }
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(tags)
                .set({ deletedAt: now, deletedById })
                .where(eq(tags.id, id))
                .returning({ id: tags.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'tags',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'TagModel.delete');
            throw new Error(`Failed to delete tag: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete a tag by ID (permanently removes from DB).
     *
     * @param {string} id - Tag ID
     * @returns {Promise<boolean>} True if deleted, false if not found
     * @throws {Error} If the operation fails
     *
     * @example
     * const wasDeleted = await TagModel.hardDelete('tag-uuid');
     * if (wasDeleted) {
     *   console.log('Tag permanently deleted');
     * }
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db.delete(tags).where(eq(tags.id, id)).returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'tags',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'TagModel.hardDelete');
            throw new Error(`Failed to hard delete tag: ${(error as Error).message}`);
        }
    },

    /**
     * Retrieve a tag by ID, including specified relations.
     *
     * @template T
     * @param {string} id - Tag ID
     * @param {T} withRelations - Relations to populate (e.g., { entityTags: true })
     * @returns {Promise<(TagType & RelationResult<T>) | undefined>} Tag with requested relations or undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const tagWithRelations = await TagModel.getWithRelations('tag-uuid', { entityTags: true });
     * if (tagWithRelations?.entityTags) {
     *   console.log(tagWithRelations.entityTags.length);
     * }
     */
    async getWithRelations<T extends TagRelations>(
        id: string,
        withRelations: T
    ): Promise<(TagType & RelationResult<T>) | undefined> {
        const db = getDb();
        try {
            const result = await db.query.tags.findFirst({
                where: (t, { eq }) => eq(t.id, id),
                with: withRelations as Record<string, true>
            });
            dbLogger.query({
                table: 'tags',
                action: 'getWithRelations',
                params: { id, with: withRelations },
                result
            });
            return result as (TagType & RelationResult<T>) | undefined;
        } catch (error) {
            dbLogger.error(error, 'TagModel.getWithRelations');
            throw new Error(`Failed to get tag with relations: ${(error as Error).message}`);
        }
    },

    /**
     * List tags with pagination and optional ordering.
     *
     * @param {TagPaginationParams} params - Pagination and ordering params
     * @returns {Promise<TagType[]>} Array of tags
     * @throws {Error} If the query fails
     *
     * @example
     * const tags = await TagModel.list({ limit: 20, offset: 0, orderBy: 'name', order: 'asc' });
     * tags.forEach(tag => console.log(tag.name));
     */
    async list(params: TagPaginationParams): Promise<TagType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            // Determine the column to order by, defaulting to createdAt
            const col = getOrderableColumn(tagOrderableColumns, orderBy, tags.createdAt);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(tags)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'tags', action: 'list', params, result });
            return result as TagType[];
        } catch (error) {
            dbLogger.error(error, 'TagModel.list');
            throw new Error(`Failed to list tags: ${(error as Error).message}`);
        }
    },

    /**
     * Find a tag by its exact name.
     *
     * @param {string} name - Tag name
     * @returns {Promise<TagType | undefined>} Tag if found, otherwise undefined
     * @throws {Error} If the query fails
     *
     * @example
     * const tag = await TagModel.findByName('Nature');
     * if (tag) {
     *   console.log(tag.id);
     * }
     */
    async findByName(name: string): Promise<TagType | undefined> {
        const db = getDb();
        try {
            const result = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
            dbLogger.query({ table: 'tags', action: 'findByName', params: { name }, result });
            return result[0] as TagType | undefined;
        } catch (error) {
            dbLogger.error(error, 'TagModel.findByName');
            throw new Error(`Failed to find tag by name: ${(error as Error).message}`);
        }
    },

    /**
     * Count tags with optional filters (name, color, lifecycle).
     *
     * @param {TagSearchParams} [params] - Search filters
     * @returns {Promise<number>} Number of tags matching the filters
     * @throws {Error} If the query fails
     *
     * @example
     * const count = await TagModel.count({ color: TagColorEnum.BLUE, lifecycleState: LifecycleStatusEnum.ACTIVE });
     * console.log('Active blue tags:', count);
     */
    async count(params?: TagSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { name, color, lifecycleState } = params || {};
            const whereClauses = [];
            if (name) {
                // Partial match on name (case-insensitive)
                // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm typing
                whereClauses.push((tags as any).name.ilike(prepareLikeQuery(name)));
            }
            if (color) {
                whereClauses.push(eq(tags.color, color));
            }
            if (lifecycleState) {
                whereClauses.push(eq(tags.lifecycle, lifecycleState));
            }
            // Only add .where if there are filters
            const query = db.select({ count: count().as('count') }).from(tags);
            const finalQuery = whereClauses.length > 0 ? query.where(and(...whereClauses)) : query;
            const result = await finalQuery;
            dbLogger.query({ table: 'tags', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'TagModel.count');
            throw new Error(`Failed to count tags: ${(error as Error).message}`);
        }
    },

    /**
     * Search tags by partial name, color, or lifecycle, with pagination and ordering.
     *
     * @param {TagSearchParams} params - Search and pagination params
     * @returns {Promise<TagType[]>} Array of tags matching the search
     * @throws {Error} If the query fails
     *
     * @example
     * const tags = await TagModel.search({ name: 'Nat', limit: 10, offset: 0 });
     * tags.forEach(tag => console.log(tag.name));
     */
    async search(params: TagSearchParams): Promise<TagType[]> {
        const db = getDb();
        const { name, color, lifecycleState, limit, offset, order, orderBy } = params;
        try {
            const whereClauses = [];
            if (name) {
                // Partial match on name (case-insensitive)
                // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm typing
                whereClauses.push((tags as any).name.ilike(prepareLikeQuery(name)));
            }
            if (color) {
                whereClauses.push(eq(tags.color, color));
            }
            if (lifecycleState) {
                whereClauses.push(eq(tags.lifecycle, lifecycleState));
            }
            // Determine the column to order by, defaulting to createdAt
            const col = getOrderableColumn(tagOrderableColumns, orderBy, tags.createdAt);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            // Only add .where if there are filters
            const queryBuilder = db.select().from(tags);
            const queryWithWhere =
                whereClauses.length > 0 ? queryBuilder.where(and(...whereClauses)) : queryBuilder;
            const finalQuery = queryWithWhere.orderBy(orderExpr).limit(limit).offset(offset);
            const result = await finalQuery;
            dbLogger.query({ table: 'tags', action: 'search', params, result });
            return result as TagType[];
        } catch (error) {
            dbLogger.error(error, 'TagModel.search');
            throw new Error(`Failed to search tags: ${(error as Error).message}`);
        }
    }
};
