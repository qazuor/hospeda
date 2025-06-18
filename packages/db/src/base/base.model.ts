import type { SQL, Table } from 'drizzle-orm';
import { getDb } from '../client';
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
     * Finds all entities matching the where clause.
     * Si se pasan page y pageSize, devuelve { items, total } paginado. Si no, devuelve el array completo.
     * @param where - The filter object
     * @param options - Opcional: { page, pageSize }
     * @returns Promise resolving to array o a objeto paginado
     */
    async findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number }
    ): Promise<T[] | { items: T[]; total: number }> {
        const db = getDb();
        const safeWhere = where ?? {};
        if (options?.page && options?.pageSize) {
            const offset = (options.page - 1) * options.pageSize;
            try {
                const whereClause = buildWhereClause(safeWhere, this.table as unknown);
                const [items, total] = await Promise.all([
                    db
                        .select()
                        .from(this.table)
                        .where(whereClause)
                        .limit(options.pageSize)
                        .offset(offset),
                    this.count(safeWhere)
                ]);
                try {
                    logQuery(
                        this.entityName,
                        'findAll',
                        { where: safeWhere, page: options.page, pageSize: options.pageSize },
                        { items, total }
                    );
                } catch {}
                return { items: items as T[], total };
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                try {
                    logError(
                        this.entityName,
                        'findAll',
                        { where: safeWhere, page: options.page, pageSize: options.pageSize },
                        err
                    );
                } catch {}
                throw new DbError(
                    this.entityName,
                    'findAll',
                    { where: safeWhere, page: options.page, pageSize: options.pageSize },
                    err.message
                );
            }
        } else {
            try {
                const whereClause = buildWhereClause(safeWhere, this.table as unknown);
                const result = await db.select().from(this.table).where(whereClause);
                try {
                    logQuery(this.entityName, 'findAll', safeWhere, result);
                } catch {}
                return result as T[];
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                try {
                    logError(this.entityName, 'findAll', safeWhere, err);
                } catch {}
                throw new DbError(this.entityName, 'findAll', safeWhere, err.message);
            }
        }
    }

    /**
     * Finds an entity by its unique ID.
     * @param id - The entity ID
     * @returns Promise resolving to the entity or null if not found
     */
    async findById(id: string): Promise<T | null> {
        const db = getDb();
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
     * @returns Promise resolving to the entity or null if not found
     */
    async findOne(where: Record<string, unknown>): Promise<T | null> {
        const db = getDb();
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
     * @returns Promise resolving to the created entity
     */
    async create(data: Partial<T>): Promise<T> {
        const db = getDb();
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
     * @returns Promise resolving to the updated entity or null if not found
     */
    async update(where: Record<string, unknown>, data: Partial<T>): Promise<T | null> {
        const db = getDb();
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
     * @returns Promise resolving to the count
     */
    async count(where: Record<string, unknown>): Promise<number> {
        const db = getDb();
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table as unknown);
            // Buscar la columna id o la primera columna disponible
            const tableRecord = this.table as unknown as Record<string, unknown>;
            const column = 'id' in tableRecord ? tableRecord.id : Object.values(tableRecord)[0];
            // Type guard para asegurar que column tiene count
            type CountableColumn = { count: () => { as: (name: string) => unknown } };
            if (!column || typeof (column as CountableColumn).count !== 'function') {
                throw new Error('No countable column found in table schema');
            }
            const countColumn = column as CountableColumn;
            const result = await db
                .select({
                    count: countColumn.count().as('count') as unknown as import(
                        'drizzle-orm'
                    ).SQL<unknown>
                })
                .from(this.table)
                .where(whereClause)
                .then((rows) => {
                    const count = rows?.[0]?.count;
                    return typeof count === 'number' ? count : Number(count) || 0;
                });
            try {
                logQuery(this.entityName, 'count', safeWhere, result);
            } catch {}
            return result;
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
     * @returns Promise resolving to the query result
     */
    async raw(query: SQL): Promise<unknown> {
        const db = getDb();
        try {
            const result = await db.execute(query);
            logQuery(this.entityName, 'raw', { query }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'raw', { query }, error as Error);
            throw new DbError(this.entityName, 'raw', { query }, (error as Error).message);
        }
    }

    /**
     * Hard deletes entities matching the where clause.
     * @param where - The filter object
     * @returns Promise resolving to the number of deleted rows
     */
    async hardDelete(where: Record<string, unknown>): Promise<number> {
        const db = getDb();
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table as unknown);
            const result = await db.delete(this.table).where(whereClause).returning();
            try {
                logQuery(this.entityName, 'hardDelete', safeWhere, result);
            } catch {}
            return Array.isArray(result) ? result.length : 0;
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
     * @returns Promise resolving to the number of soft-deleted rows
     */
    async softDelete(where: Record<string, unknown>): Promise<number> {
        const db = getDb();
        const safeWhere = where ?? {};
        try {
            const whereClause = buildWhereClause(safeWhere, this.table as unknown);
            const now = new Date().toISOString();
            const result = await db
                .update(this.table)
                .set({ deletedAt: now })
                .where(whereClause)
                .returning();
            try {
                logQuery(this.entityName, 'softDelete', safeWhere, result);
            } catch {}
            return Array.isArray(result) ? result.length : 0;
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
     * @returns Promise resolving to the number of restored rows
     */
    async restore(where: Record<string, unknown>): Promise<number> {
        const db = getDb();
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
            return Array.isArray(result) ? result.length : 0;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'restore', safeWhere, err);
            } catch {}
            throw new DbError(this.entityName, 'restore', safeWhere, err.message);
        }
    }

    /**
     * Finds an entity with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<T | null> {
        // This should be implemented in the concrete model if relations are needed
        throw new DbError(
            this.entityName,
            'findWithRelations',
            { where, relations },
            'findWithRelations must be implemented in the concrete model'
        );
    }
}
