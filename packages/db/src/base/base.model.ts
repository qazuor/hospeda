import type { PaginatedListOptions } from '@repo/schemas';
import type { SQL, Table } from 'drizzle-orm';
import { count } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { getDb } from '../client';
import type * as schema from '../schemas/index.js';
import { buildWhereClause } from '../utils/drizzle-helpers';
import { DbError } from '../utils/error';
import { logError, logQuery } from '../utils/logger';

/**
 * Abstract base class for all database models.
 * Provides standardized CRUD, soft/hard delete, restore, and relation methods with logging and error handling.
 * Extend this class for each domain model and provide the required schema/table and entity name.
 *
 * @template T - The entity type managed by the model
 */
export abstract class BaseModel<T> {
    /**
     * The table/schema object (Drizzle table)
     */
    protected abstract table: Table;
    /**
     * The entity name (for logging and error context)
     */
    protected abstract entityName: string;

    /**
     * Get the table name for dynamic relation queries
     * This is required for the generic findAllWithRelations implementation
     */
    protected abstract getTableName(): string;

    /**
     * Gets the database client, either from transaction or global connection.
     * @param tx - Optional transaction client
     * @returns Database client
     */
    protected getClient(tx?: NodePgDatabase<typeof schema>): NodePgDatabase<typeof schema> {
        return tx ?? getDb();
    }

    /**
     * Finds entities matching a where clause.
     *
     * If pagination options (`page`, `pageSize`) are provided, it returns a paginated result,
     * including a total count of all matching records.
     * If no pagination is provided, it returns all matching entities, and `total` will be the
     * length of the returned `items` array.
     *
     * @param where - The filter object to apply.
     * @param options - Optional pagination parameters: `{ page, pageSize }`.
     * @param tx - Optional transaction client.
     * @returns A promise resolving to an object containing the `items` array and `total` count.
     */
    async findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: T[]; total: number }> {
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        const page = options?.page;
        const pageSize = options?.pageSize;
        const isPaginated = page !== undefined && pageSize !== undefined;
        const logContext = { where: safeWhere, page, pageSize };

        try {
            const whereClause = buildWhereClause(safeWhere, this.table as unknown);

            if (isPaginated) {
                const offset = (page - 1) * pageSize;
                const [items, total] = await Promise.all([
                    db.select().from(this.table).where(whereClause).limit(pageSize).offset(offset),
                    this.count(safeWhere, tx)
                ]);

                const result = { items: items as T[], total };
                try {
                    logQuery(this.entityName, 'findAll', logContext, result);
                } catch {}
                return result;
            }
            const items = (await db.select().from(this.table).where(whereClause)) || [];
            const result = { items: items as T[], total: items.length };
            try {
                logQuery(this.entityName, 'findAll', { where: safeWhere }, result);
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
    async findById(id: string, tx?: NodePgDatabase<typeof schema>): Promise<T | null> {
        const db = this.getClient(tx);
        try {
            const whereClause = buildWhereClause({ id }, this.table as unknown);
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
    async findOne(
        where: Record<string, unknown>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<T | null> {
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table as unknown);
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
    async create(data: Partial<T>, tx?: NodePgDatabase<typeof schema>): Promise<T> {
        const db = this.getClient(tx);
        try {
            const result = await db.insert(this.table).values(data).returning();
            logQuery(this.entityName, 'create', data, result);
            if (!result[0]) throw new Error('Insert failed');
            return result[0] as T;
        } catch (error) {
            logError(this.entityName, 'create', data, error as Error);
            throw new DbError(this.entityName, 'create', data, (error as Error).message);
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
        tx?: NodePgDatabase<typeof schema>
    ): Promise<T | null> {
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        const safeData = data ?? {};

        try {
            const whereClause = buildWhereClause(safeWhere, this.table as unknown);

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
     * Counts entities matching the where clause.
     * @param where - The filter object
     * @param tx - Optional transaction client
     * @returns Promise resolving to the count
     */
    async count(
        where: Record<string, unknown>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number> {
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table as unknown);

            const result = await db.select({ count: count() }).from(this.table).where(whereClause);

            try {
                logQuery(this.entityName, 'count', safeWhere, result);
            } catch {}
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
    async raw(query: SQL, tx?: NodePgDatabase<typeof schema>): Promise<unknown> {
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
    async hardDelete(
        where: Record<string, unknown>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number> {
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table as unknown);
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
     * @param where - The filter object
     * @param tx - Optional transaction client
     * @returns Promise resolving to the number of deleted rows
     */
    async softDelete(
        where: Record<string, unknown>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number> {
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table as unknown);
            const result = await db
                .update(this.table)
                .set({ deletedAt: new Date() })
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
     * Restores soft-deleted entities matching the where clause.
     * @param where - The filter object
     * @param tx - Optional transaction client
     * @returns Promise resolving to the number of restored rows
     */
    async restore(
        where: Record<string, unknown>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number> {
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table as unknown);
            const result = await db
                .update(this.table)
                .set({ deletedAt: null })
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
     * @param where - The filter object
     * @param relations - The relations to include (supports nested relations)
     * @param tx - Optional transaction client
     * @returns Promise resolving to the entity or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<T | null> {
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table as unknown);
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
    async updateById(
        id: string,
        data: Partial<T>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<void> {
        await this.update({ id }, data, tx);
    }

    /**
     * Finds all entities with specified relations populated.
     * Supports nested relations (e.g., { sponsorship: { sponsor: true } })
     *
     * @param relations Relations to include (e.g., { destination: true, sponsorship: { sponsor: true } })
     * @param where Filter conditions
     * @param options Pagination and other options
     * @returns Promise resolving to paginated list with relations
     */
    async findAllWithRelations(
        relations: Record<string, boolean | Record<string, unknown>>,
        where: Record<string, unknown> = {},
        options: PaginatedListOptions = {}
    ): Promise<{ items: T[]; total: number }> {
        const db = this.getClient();
        const { page = 1, pageSize = 20 } = options;
        const offset = (page - 1) * pageSize;
        const safeWhere = where ?? {};

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
                    { where: safeWhere, options, relations },
                    'Falling back to findAll - no relations requested'
                );
                return this.findAll(safeWhere, options);
            }

            // Get table name for dynamic query
            const tableName = this.getTableName();
            if (!tableName) {
                throw new Error(`Table name not defined for entity: ${this.entityName}`);
            }

            // Build WHERE clause using existing helper
            const whereClause = buildWhereClause(safeWhere, this.table as unknown);

            // Build the query with relations using dynamic table access
            // Dynamic access to db.query[tableName] - type safety verified at runtime
            const queryTable = (db.query as Record<string, unknown>)[tableName];
            if (!queryTable || typeof queryTable !== 'object' || !('findMany' in queryTable)) {
                throw new Error(`Invalid table configuration for: ${tableName}`);
            }

            // Type assertion for the query method - verified above that findMany exists
            interface QueryableTable {
                findMany: (options: {
                    where?: unknown;
                    with?: Record<string, boolean | Record<string, unknown>>;
                    limit?: number;
                    offset?: number;
                }) => Promise<unknown[]>;
            }
            const typedQueryTable = queryTable as QueryableTable;

            /**
             * Transforms relations config to Drizzle ORM syntax
             * Converts { sponsorship: { sponsor: true } } to { sponsorship: { with: { sponsor: true } } }
             */
            const transformRelationsForDrizzle = (
                relations: Record<string, boolean | Record<string, unknown>>
            ) => {
                const transformed: Record<string, boolean | { with: Record<string, unknown> }> = {};

                for (const [key, value] of Object.entries(relations)) {
                    if (typeof value === 'boolean') {
                        // Simple relation: { author: true }
                        transformed[key] = value;
                    } else if (typeof value === 'object' && value !== null) {
                        // Nested relation: { sponsorship: { sponsor: true } } -> { sponsorship: { with: { sponsor: true } } }
                        transformed[key] = { with: value };
                    }
                }

                return transformed;
            };

            // Check if pagination is requested
            const isPaginated = page !== undefined && pageSize !== undefined;

            if (isPaginated) {
                const transformedRelations = transformRelationsForDrizzle(relations);
                const queryOptions = {
                    where: whereClause,
                    with: transformedRelations,
                    limit: pageSize,
                    offset: offset
                };

                // Execute query with relations and get total count
                const [items, totalCount] = await Promise.all([
                    typedQueryTable.findMany(queryOptions),
                    this.count(safeWhere)
                ]);

                const result = { items: items as T[], total: totalCount };

                logQuery(
                    this.entityName,
                    'findAllWithRelations',
                    { where: safeWhere, options, relations },
                    {
                        itemCount: items.length,
                        total: totalCount,
                        hasRelations: true,
                        isPaginated: true
                    }
                );

                return result;
            }

            // No pagination - get all items
            const transformedRelations = transformRelationsForDrizzle(relations);
            const queryOptions = {
                where: whereClause,
                with: transformedRelations
            };

            const items = await typedQueryTable.findMany(queryOptions);
            const result = { items: items as T[], total: items.length };

            logQuery(
                this.entityName,
                'findAllWithRelations',
                { where: safeWhere, options, relations },
                {
                    itemCount: items.length,
                    total: items.length,
                    hasRelations: true,
                    isPaginated: false
                }
            );

            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(
                this.entityName,
                'findAllWithRelations',
                { where: safeWhere, options, relations },
                err
            );
            throw new DbError(
                this.entityName,
                'findAllWithRelations',
                { where: safeWhere, options, relations },
                err.message
            );
        }
    }
}
