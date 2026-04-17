import type { PaginatedListOptions } from '@repo/schemas';
import type { SQL, Table } from 'drizzle-orm';
import { and, count } from 'drizzle-orm';
import { getDb } from '../client.ts';
import type { BaseModel, DrizzleClient } from '../types.ts';
import { buildOrderByClause, buildWhereClause } from '../utils/drizzle-helpers.ts';
import { DbError } from '../utils/error.ts';
import { dbLogger, logError, logQuery } from '../utils/logger.ts';
import { warnUnknownRelationKeys } from '../utils/relations-validator.ts';

/**
 * Maximum allowed page size to prevent memory issues with large datasets
 */
const MAX_PAGE_SIZE = 200;

/**
 * Default page size when pagination is not explicitly provided
 */
const DEFAULT_PAGE_SIZE = 20;

/**
 * Transforms relations config to Drizzle ORM syntax.
 * Converts { sponsorship: { sponsor: true } } to { sponsorship: { with: { sponsor: true } } }
 */
function transformRelationsForDrizzle(
    relations: Record<string, boolean | Record<string, unknown>>,
    depth = 0
): Record<string, boolean | { with: Record<string, unknown> }> {
    const MAX_DEPTH = 5;
    if (depth >= MAX_DEPTH) {
        dbLogger.warn(
            { depth, MAX_DEPTH },
            'transformRelationsForDrizzle: MAX_DEPTH reached, truncating nested relations'
        );
        return {};
    }

    const transformed: Record<string, boolean | { with: Record<string, unknown> }> = {};

    for (const [key, value] of Object.entries(relations)) {
        if (typeof value === 'boolean') {
            transformed[key] = value;
        } else if (typeof value === 'object' && value !== null) {
            transformed[key] = {
                with: transformRelationsForDrizzle(
                    value as Record<string, boolean | Record<string, unknown>>,
                    depth + 1
                )
            };
        }
    }

    return transformed;
}

/**
 * Abstract base class for all database models.
 * Provides standardized CRUD, soft/hard delete, restore, and relation methods with logging and error handling.
 * Extend this class for each domain model and provide the required schema/table and entity name.
 *
 * @template T - The entity type managed by the model
 */
export abstract class BaseModelImpl<T extends Record<string, unknown>> implements BaseModel<T> {
    /**
     * The table/schema object (Drizzle table)
     */
    protected abstract table: Table;
    /**
     * The entity name (for logging and error context)
     */
    public abstract entityName: string;

    /**
     * Get the table name for dynamic relation queries
     * This is required for the generic findAllWithRelations implementation
     */
    protected abstract getTableName(): string;

    /**
     * List of valid relation key names that this model's findWithRelations supports.
     * Subclasses MUST override this with their actual supported relation keys.
     * Used by warnUnknownRelationKeys to warn on unknown keys in findWithRelations calls.
     */
    protected readonly validRelationKeys: ReadonlyArray<string> = [];

    /**
     * Returns the provided tx if available, otherwise returns the default db connection from getDb().
     * Safe to call with undefined.
     */
    protected getClient(tx?: DrizzleClient): DrizzleClient {
        return tx ?? getDb();
    }

    /**
     * Returns the Drizzle table schema for this model.
     * Used by the service layer to build search conditions against table columns.
     */
    public getTable(): Table {
        return this.table;
    }

    /**
     * Finds entities matching a where clause with mandatory pagination.
     *
     * Pagination is ALWAYS applied to prevent unbounded queries:
     * - If no pagination options are provided, defaults to page=1, pageSize=DEFAULT_PAGE_SIZE
     * - pageSize is capped at MAX_PAGE_SIZE (200) to prevent memory issues
     *
     * @param where - The filter object to apply.
     * @param options - Optional pagination parameters: `{ page, pageSize }`.
     * @param additionalConditions - Optional extra SQL conditions to combine with the where clause.
     * @param tx - Optional transaction client.
     * @returns A promise resolving to an object containing the `items` array and `total` count.
     */
    async findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<{ items: T[]; total: number }> {
        const db = this.getClient(tx);
        const safeWhere = where ?? {};

        // Always apply pagination - default to page 1 with DEFAULT_PAGE_SIZE
        const page = options?.page ?? 1;
        // Cap pageSize at MAX_PAGE_SIZE to prevent memory issues
        const requestedPageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
        const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

        const logContext = { where: safeWhere, page, pageSize, requestedPageSize };

        try {
            const baseWhereClause = buildWhereClause(safeWhere, this.table);
            const offset = (page - 1) * pageSize;

            // Combine base where clause with any additional SQL conditions
            const allConditions: SQL[] = [];
            if (baseWhereClause) allConditions.push(baseWhereClause);
            if (additionalConditions) allConditions.push(...additionalConditions);

            const finalWhereClause =
                allConditions.length === 0
                    ? undefined
                    : allConditions.length === 1
                      ? allConditions[0]
                      : and(...allConditions);

            // Build orderBy clause if sorting is requested
            const orderClause = options?.sortBy
                ? buildOrderByClause(options.sortBy, this.table, options.sortOrder ?? 'asc')
                : undefined;

            // Build query - use $dynamic() to allow conditional chaining
            const baseQuery = db.select().from(this.table).where(finalWhereClause).$dynamic();
            const sortedQuery = orderClause ? baseQuery.orderBy(orderClause) : baseQuery;

            const [items, total] = await Promise.all([
                sortedQuery.limit(pageSize).offset(offset),
                this.count(safeWhere, { additionalConditions, tx })
            ]);

            const result = { items: items as T[], total };
            try {
                logQuery(this.entityName, 'findAll', logContext, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findAll', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findAll', logContext, err.message);
        }
    }

    /**
     * Finds an entity by its unique ID.
     * @param id - The entity ID
     * @param tx - Optional transaction client
     * @returns Promise resolving to the entity or null if not found
     */
    async findById(id: string, tx?: DrizzleClient): Promise<T | null> {
        if (id === null || id === undefined) return null;
        const db = this.getClient(tx);
        try {
            const whereClause = buildWhereClause({ id }, this.table);
            const result = await db.select().from(this.table).where(whereClause).limit(1);
            try {
                logQuery(this.entityName, 'findById', { id }, result);
            } catch {}
            return (result[0] as T) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findById', { id }, err);
            } catch {}
            throw new DbError(this.entityName, 'findById', { id }, err.message);
        }
    }

    /**
     * Finds a single entity matching the where clause.
     * @param where - The filter object
     * @param tx - Optional transaction client
     * @returns Promise resolving to the entity or null if not found
     */
    async findOne(where: Record<string, unknown>, tx?: DrizzleClient): Promise<T | null> {
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table);
            const result = await db.select().from(this.table).where(whereClause).limit(1);
            try {
                logQuery(this.entityName, 'findOne', safeWhere, result);
            } catch {}
            return (result[0] as T) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findOne', safeWhere, err);
            } catch {}
            throw new DbError(this.entityName, 'findOne', safeWhere, err.message);
        }
    }

    /**
     * Creates a new entity.
     * @param data - The entity data
     * @param tx - Optional transaction client
     * @returns Promise resolving to the created entity
     */
    async create(data: Partial<T>, tx?: DrizzleClient): Promise<T> {
        const db = this.getClient(tx);
        try {
            const result = await db.insert(this.table).values(data).returning();
            try {
                logQuery(this.entityName, 'create', data, result);
            } catch {}
            if (!result[0]) throw new Error(`Insert failed for entity '${this.entityName}'`);
            return result[0] as T;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'create', data, err);
            } catch {}
            throw new DbError(this.entityName, 'create', data, err.message);
        }
    }

    /**
     * Updates entities matching the where clause.
     * @param where - The filter object
     * @param data - The fields to update
     * @param tx - Optional transaction client
     * @returns Promise resolving to the updated entity or null if not found
     */
    async update(
        where: Record<string, unknown>,
        data: Partial<T>,
        tx?: DrizzleClient
    ): Promise<T | null> {
        if (!where || Object.keys(where).length === 0) {
            throw new DbError(
                this.entityName,
                'update',
                where,
                'where clause cannot be empty — this would update all records'
            );
        }
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        const safeData = data ?? {};

        if (Object.keys(safeData).length === 0) return null;

        try {
            const whereClause = buildWhereClause(safeWhere, this.table);

            const result = await db.update(this.table).set(safeData).where(whereClause).returning();
            try {
                logQuery(this.entityName, 'update', { where: safeWhere, data: safeData }, result);
            } catch {}
            return (result[0] as T) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'update', { where: safeWhere, data: safeData }, err);
            } catch {}
            throw new DbError(
                this.entityName,
                'update',
                { where: safeWhere, data: safeData },
                err.message
            );
        }
    }

    /**
     * Counts entities matching the given where clause and optional additional conditions.
     *
     * @param where - Record of column-value pairs for filtering
     * @param options - Optional configuration: tx for transaction, additionalConditions for extra SQL
     * @returns Promise resolving to the count
     */
    async count(
        where: Record<string, unknown>,
        options?: { additionalConditions?: SQL[]; tx?: DrizzleClient }
    ): Promise<number> {
        const { additionalConditions = [], tx } = options ?? {};
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        try {
            const baseWhereClause = buildWhereClause(safeWhere, this.table);

            const allConditions: SQL[] = [];
            if (baseWhereClause) allConditions.push(baseWhereClause);
            if (additionalConditions.length > 0) allConditions.push(...additionalConditions);

            const finalWhereClause =
                allConditions.length === 0
                    ? undefined
                    : allConditions.length === 1
                      ? allConditions[0]
                      : and(...allConditions);

            const result = await db
                .select({ count: count() })
                .from(this.table)
                .where(finalWhereClause);

            try {
                logQuery(this.entityName, 'count', safeWhere, result);
            } catch {}
            // Drizzle types count() as SQL<number> but pg driver returns bigint as string.
            // The explicit Number() coercion is required — do not remove.
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'count', safeWhere, err);
            } catch {}
            throw new DbError(this.entityName, 'count', safeWhere, err.message);
        }
    }

    /**
     * Executes a raw SQL query.
     * @param query - The SQL query
     * @param tx - Optional transaction client
     * @returns Promise resolving to the query result
     */
    async raw(query: SQL, tx?: DrizzleClient): Promise<unknown> {
        const db = this.getClient(tx);
        try {
            const result = await db.execute(query);
            try {
                logQuery(this.entityName, 'raw', query, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'raw', query, err);
            } catch {}
            throw new DbError(this.entityName, 'raw', query, err.message);
        }
    }

    /**
     * Hard deletes entities matching the where clause.
     * @param where - The filter object
     * @param tx - Optional transaction client
     * @returns Promise resolving to the number of deleted rows
     */
    async hardDelete(where: Record<string, unknown>, tx?: DrizzleClient): Promise<number> {
        if (!where || Object.keys(where).length === 0) {
            throw new DbError(
                this.entityName,
                'hardDelete',
                where,
                'where clause cannot be empty — this would delete all records'
            );
        }
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table);
            const result = await db.delete(this.table).where(whereClause).returning();
            try {
                logQuery(this.entityName, 'hardDelete', safeWhere, result);
            } catch {}
            return result.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'hardDelete', safeWhere, err);
            } catch {}
            throw new DbError(this.entityName, 'hardDelete', safeWhere, err.message);
        }
    }

    /**
     * Soft deletes entities matching the where clause.
     * Sets both deletedAt and updatedAt timestamps.
     *
     * @param where - The filter object
     * @param tx - Optional transaction client
     * @returns Promise resolving to the number of deleted rows
     */
    async softDelete(where: Record<string, unknown>, tx?: DrizzleClient): Promise<number> {
        if (!where || Object.keys(where).length === 0) {
            throw new DbError(
                this.entityName,
                'softDelete',
                where,
                'where clause cannot be empty — this would soft-delete all records'
            );
        }
        if (!('deletedAt' in this.table)) {
            throw new DbError(
                this.entityName,
                'softDelete',
                where,
                `Table '${this.entityName}' does not have a deletedAt column — soft delete is not supported`
            );
        }
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table);
            const now = new Date();
            const result = await db
                .update(this.table)
                .set({ deletedAt: now, updatedAt: now })
                .where(whereClause)
                .returning();
            try {
                logQuery(this.entityName, 'softDelete', safeWhere, result);
            } catch {}
            return result.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'softDelete', safeWhere, err);
            } catch {}
            throw new DbError(this.entityName, 'softDelete', safeWhere, err.message);
        }
    }

    /**
     * Restores a soft-deleted record by clearing deletedAt.
     *
     * WARNING: For billing_addon_purchases, restoring does NOT re-provision
     * entitlements. You must manually call AddonEntitlementService.applyAddonEntitlements()
     * after restoring an addon purchase to re-grant customer access.
     *
     * @param where - The filter object
     * @param tx - Optional transaction client
     * @returns Promise resolving to the number of restored rows
     */
    async restore(where: Record<string, unknown>, tx?: DrizzleClient): Promise<number> {
        if (!where || Object.keys(where).length === 0) {
            throw new DbError(
                this.entityName,
                'restore',
                where,
                'where clause cannot be empty — this would restore all soft-deleted records'
            );
        }
        if (!('deletedAt' in this.table)) {
            throw new DbError(
                this.entityName,
                'restore',
                where,
                `Table '${this.entityName}' does not have a deletedAt column — restore is not supported`
            );
        }
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table);
            const result = await db
                .update(this.table)
                .set({ deletedAt: null, updatedAt: new Date() })
                .where(whereClause)
                .returning();
            try {
                logQuery(this.entityName, 'restore', safeWhere, result);
            } catch {}
            return result.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'restore', safeWhere, err);
            } catch {}
            throw new DbError(this.entityName, 'restore', safeWhere, err.message);
        }
    }

    /**
     * Finds an entity with its relations.
     *
     * NOTE: This base implementation is a STUB that ignores the `relations` parameter.
     * It only performs a simple `select().from().where().limit(1)` without any joins.
     * Subclasses MUST override this method to actually load relations.
     *
     * @param where - The filter object
     * @param relations - The relations to include (ignored in base implementation)
     * @param tx - Optional transaction client
     * @returns Promise resolving to the entity or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<T | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table);
            const result = await db.select().from(this.table).where(whereClause).limit(1);
            try {
                logQuery(
                    this.entityName,
                    'findWithRelations',
                    { where: safeWhere, relations },
                    result
                );
            } catch {}
            return (result[0] as T) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(
                    this.entityName,
                    'findWithRelations',
                    { where: safeWhere, relations },
                    err
                );
            } catch {}
            throw new DbError(
                this.entityName,
                'findWithRelations',
                { where: safeWhere, relations },
                err.message
            );
        }
    }

    /**
     * Updates an entity by its unique ID.
     * @param id - The entity ID
     * @param data - The fields to update
     * @param tx - Optional transaction client
     */
    async updateById(id: string, data: Partial<T>, tx?: DrizzleClient): Promise<void> {
        await this.update({ id }, data, tx);
    }

    /**
     * Finds a single entity with its relations populated using Drizzle's `findFirst()`.
     *
     * Unlike `findWithRelations()` (which is a stub overridden by subclasses), this method
     * provides a GENERIC implementation backed by `db.query[tableName].findFirst()` and works
     * for any model that defines `getTableName()` correctly and has Drizzle relations configured.
     *
     * Supports nested relations (e.g., `{ sponsorship: { sponsor: true } }`).
     * When no active relations are detected (all values are `false` or empty objects), the method
     * falls back to `findOne()` to avoid the overhead of the relational query API.
     *
     * @param where - Filter conditions used to locate the entity
     * @param relations - Relations to include, e.g. `{ destination: true, owner: true }`
     *   or nested `{ sponsorship: { sponsor: true } }`. `false` values are treated as absent.
     * @param tx - Optional transaction client. When provided, all queries execute within this
     *   transaction. When omitted, the global database connection is used.
     * @returns Promise resolving to the entity with the requested relations populated,
     *   or `null` if no matching entity is found.
     *
     * @throws {DbError} If the table name is not defined or the query execution fails.
     *
     * @example
     * ```ts
     * const accommodation = await model.findOneWithRelations(
     *   { slug: 'hotel-paradise' },
     *   { destination: true, owner: true, amenities: true }
     * );
     *
     * // Nested relations
     * const event = await model.findOneWithRelations(
     *   { id: 'uuid-here' },
     *   { sponsorship: { sponsor: true }, destination: true }
     * );
     * ```
     */
    async findOneWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<T | null> {
        const logContext = { where, relations };

        try {
            // Validate relations object first — warnUnknownRelationKeys would explode on null/non-object
            if (!relations || typeof relations !== 'object') {
                throw new Error('Relations must be a valid object');
            }

            warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);

            // Check if any relations are actually requested
            const hasRelations = Object.values(relations).some((value) => {
                if (typeof value === 'boolean') return value;
                if (typeof value === 'object' && value !== null) {
                    return Object.values(value).some(Boolean);
                }
                return false;
            });

            if (!hasRelations) {
                // Fall back to regular findOne if no relations requested
                logQuery(
                    this.entityName,
                    'findOneWithRelations',
                    { ...logContext, inTransaction: !!tx },
                    'Falling back to findOne - no relations requested'
                );
                return this.findOne(where, tx);
            }

            // Only acquire db client when relations are actually needed
            const db = this.getClient(tx);

            // Get table name for dynamic query
            const tableName = this.getTableName();
            if (!tableName) {
                throw new Error(`Table name not defined for entity: ${this.entityName}`);
            }

            // Build WHERE clause using existing helper
            const whereClause = buildWhereClause(where, this.table);

            // Known limitation: db.query is cast to Record<string, unknown> because BaseModel
            // is not generic over the table type. Query results are cast to T without type guards.
            // Future fix: make BaseModel generic over table type for correct Drizzle inference.
            const queryTable = (db.query as Record<string, unknown>)[tableName];
            if (!queryTable || typeof queryTable !== 'object' || !('findFirst' in queryTable)) {
                throw new Error(`Invalid table configuration for: ${tableName}`);
            }

            // Type assertion for the query method - verified above that findFirst exists
            interface QueryableTable {
                findFirst: (options: {
                    where?: unknown;
                    with?: Record<string, boolean | Record<string, unknown>>;
                }) => Promise<unknown | undefined>;
            }
            const typedQueryTable = queryTable as QueryableTable;

            const transformedRelations = transformRelationsForDrizzle(relations);

            const result = await typedQueryTable.findFirst({
                where: whereClause,
                with: transformedRelations
            });

            // Drizzle's findFirst() returns undefined when no row matches.
            // Hospeda convention: convert undefined to null.
            const entity = (result as T) ?? null;

            try {
                logQuery(
                    this.entityName,
                    'findOneWithRelations',
                    { ...logContext, inTransaction: !!tx },
                    { found: entity !== null, hasRelations: true }
                );
            } catch {}

            return entity;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findOneWithRelations', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findOneWithRelations', logContext, err.message);
        }
    }

    /**
     * Finds all entities with specified relations populated.
     * Supports nested relations (e.g., { sponsorship: { sponsor: true } })
     *
     * Pagination is ALWAYS applied to prevent unbounded queries:
     * - If no pagination options are provided, defaults to page=1, pageSize=DEFAULT_PAGE_SIZE
     * - pageSize is capped at MAX_PAGE_SIZE (200) to prevent memory issues
     *
     * @param relations Relations to include (e.g., { destination: true, sponsorship: { sponsor: true } })
     * @param where Filter conditions
     * @param options Pagination and other options
     * @param additionalConditions Optional extra SQL conditions to combine with the where clause.
     *   Must reference base table columns only. Conditions on related table columns will fail
     *   silently because the parallel count() query has no joins.
     * @param tx - Optional transaction client for atomic operations. When provided, all queries execute
     *   within this transaction. When omitted, the global database connection is used.
     * @returns Promise resolving to paginated list with relations
     */
    async findAllWithRelations(
        relations: Record<string, boolean | Record<string, unknown>>,
        where: Record<string, unknown> = {},
        options: Omit<PaginatedListOptions, 'relations'> = {},
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<{ items: T[]; total: number }> {
        // Always apply pagination - default to page 1 with DEFAULT_PAGE_SIZE
        const page = options.page ?? 1;
        // Cap pageSize at MAX_PAGE_SIZE to prevent memory issues
        const requestedPageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
        const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);
        const offset = (page - 1) * pageSize;

        try {
            // Validate relations object
            if (!relations || typeof relations !== 'object') {
                throw new Error('Relations must be a valid object');
            }

            // Check if any relations are actually requested
            const hasRelations = Object.values(relations).some((value) => {
                // Check for boolean true or object with relations
                if (typeof value === 'boolean') return value;
                if (typeof value === 'object' && value !== null) {
                    return Object.values(value).some(Boolean);
                }
                return false;
            });

            if (!hasRelations) {
                // Fall back to regular findAll if no relations requested
                logQuery(
                    this.entityName,
                    'findAllWithRelations',
                    { where, options, relations, inTransaction: !!tx },
                    'Falling back to findAll - no relations requested'
                );
                return this.findAll(where, options, additionalConditions, tx);
            }

            // Only acquire db client when relations are actually needed
            const db = this.getClient(tx);

            // Get table name for dynamic query
            const tableName = this.getTableName();
            if (!tableName) {
                throw new Error(`Table name not defined for entity: ${this.entityName}`);
            }

            // Build WHERE clause using existing helper and combine with additional conditions
            const baseWhereClause = buildWhereClause(where, this.table);

            const allConditions: SQL[] = [];
            if (baseWhereClause) allConditions.push(baseWhereClause);
            if (additionalConditions) allConditions.push(...additionalConditions);

            // allConditions[0] is typed as SQL | undefined, but the length === 1 guard
            // guarantees it is defined. Drizzle's .where() accepts SQL | undefined anyway.
            const whereClause =
                allConditions.length === 0
                    ? undefined
                    : allConditions.length === 1
                      ? allConditions[0]
                      : and(...allConditions);

            // Known limitation: db.query is cast to Record<string, unknown> because BaseModel
            // is not generic over the table type. Query results are cast to T[] without type guards.
            // Future fix: make BaseModel generic over table type for correct Drizzle inference.
            const queryTable = (db.query as Record<string, unknown>)[tableName];
            if (!queryTable || typeof queryTable !== 'object' || !('findMany' in queryTable)) {
                throw new Error(`Invalid table configuration for: ${tableName}`);
            }

            // Type assertion for the query method - verified above that findMany exists
            interface QueryableTable {
                findMany: (options: {
                    where?: unknown;
                    with?: Record<string, boolean | Record<string, unknown>>;
                    orderBy?: unknown;
                    limit?: number;
                    offset?: number;
                }) => Promise<unknown[]>;
            }
            const typedQueryTable = queryTable as QueryableTable;

            // Pagination is always applied to prevent unbounded queries
            const transformedRelations = transformRelationsForDrizzle(relations);

            // Build optional orderBy clause
            const orderByClause = options.sortBy
                ? buildOrderByClause(options.sortBy, this.table, options.sortOrder ?? 'asc')
                : undefined;

            const queryOptions = {
                where: whereClause,
                with: transformedRelations,
                ...(orderByClause ? { orderBy: orderByClause } : {}),
                limit: pageSize,
                offset: offset
            };

            // Execute query with relations and get total count.
            // Known limitation: under READ COMMITTED, findMany and count may see different
            // committed data if concurrent writes occur between the two queries.
            // Also: additionalConditions must reference base table columns only — count()
            // has no joins, so conditions on related table columns will fail silently.
            const [items, totalCount] = await Promise.all([
                typedQueryTable.findMany(queryOptions),
                this.count(where, { additionalConditions, tx })
            ]);

            const result = { items: items as T[], total: totalCount };

            try {
                logQuery(
                    this.entityName,
                    'findAllWithRelations',
                    {
                        where,
                        options: { page, pageSize, requestedPageSize },
                        relations,
                        inTransaction: !!tx
                    },
                    {
                        itemCount: items.length,
                        total: totalCount,
                        hasRelations: true
                    }
                );
            } catch {}

            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(
                    this.entityName,
                    'findAllWithRelations',
                    { where, options, relations, inTransaction: !!tx },
                    err
                );
            } catch {}
            throw new DbError(
                this.entityName,
                'findAllWithRelations',
                { where, options, relations },
                err.message
            );
        }
    }
}
