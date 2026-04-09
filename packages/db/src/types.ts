import type { PaginatedListOutput } from '@repo/schemas';
import type { ExtractTablesWithRelations, SQL, Table } from 'drizzle-orm';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';

import type { schema } from './client.ts';

/**
 * Common base type for both regular Drizzle database clients and
 * transaction clients. Use this wherever you accept or return
 * a database connection that might be inside a transaction.
 *
 * Why a common base type instead of a union:
 * Both `NodePgDatabase` and `NodePgTransaction` extend `PgDatabase`.
 * Using the common ancestor means:
 * - `PgTransaction` (what `db.transaction()` passes to callbacks at the TS level)
 *   is directly assignable without relying on method bivariance
 * - `NodePgDatabase` (regular connections from `getDb()`) is also assignable
 * - `NodePgTransaction` (runtime transaction type) is also assignable
 *
 * Drizzle type hierarchy (v0.44.x, node-postgres driver):
 * ```
 * PgDatabase<TQueryResult, TFullSchema, TSchema>        <-- DrizzleClient
 *   |-- NodePgDatabase<TSchema>                          (regular connection)
 *   |-- PgTransaction<TQueryResult, TFullSchema, TSchema>(TS-level tx type)
 *         |-- NodePgTransaction<TFullSchema, TSchema>    (runtime tx type)
 * ```
 */
export type DrizzleClient = PgDatabase<
    NodePgQueryResultHKT,
    typeof schema,
    ExtractTablesWithRelations<typeof schema>
>;

/**
 * Extensible context bag for propagating transaction handles and
 * request-scoped metadata through model and service methods.
 *
 * All new model and service methods accept `ctx?: QueryContext` as their
 * last parameter. When `ctx.tx` is provided, methods use that transaction
 * handle instead of the module-level db instance from `getDb()`.
 *
 * See ADR-018 for the full rationale behind the Context Object pattern.
 */
export interface QueryContext {
    /**
     * Active transaction handle. When omitted (undefined), methods use `getDb()`.
     *
     * Semantics: `undefined` and `null` are treated identically (both fall back
     * to `getDb()`). Callers should omit the property or pass `undefined` --
     * never pass `null`. The implementation uses `tx ?? getDb()` internally.
     *
     * This interface is intentionally minimal. SPEC-059 extends it with
     * `ServiceContext` (adding user, permissions, locale) for service-layer use.
     */
    tx?: DrizzleClient;
}

/**
 * Contract for all entity model classes. The concrete implementation
 * is `BaseModelImpl` in `./base/base.model.ts`.
 *
 * All methods accept an optional `tx` parameter (or `tx` inside `options`
 * for `count()`) to participate in an existing database transaction.
 * When `tx` is omitted, methods use the default connection from `getDb()`.
 */
export interface BaseModel<T extends Record<string, unknown>> {
    /** The entity name used for logging and error context. */
    readonly entityName: string;

    /**
     * Find a single entity by its primary key (UUID).
     * @throws {DbError} When the database operation fails
     */
    findById(id: string, tx?: DrizzleClient): Promise<T | null>;

    /**
     * Find a single entity matching the given filter conditions.
     * @throws {DbError} When the database operation fails
     */
    findOne(where: Record<string, unknown>, tx?: DrizzleClient): Promise<T | null>;

    /**
     * Insert a new entity and return the created record.
     * @throws {DbError} When the database operation fails
     */
    create(data: Partial<T>, tx?: DrizzleClient): Promise<T>;

    /**
     * Update entities matching `where` conditions. Returns the first
     * updated entity, or null if no rows matched.
     * @throws {DbError} When the database operation fails or where clause is empty
     */
    update(where: Record<string, unknown>, data: Partial<T>, tx?: DrizzleClient): Promise<T | null>;

    /**
     * Update a single entity by ID. Unlike `update()`, returns void.
     * Useful for fire-and-forget updates where the caller does not need the result.
     * Note: if the ID does not match any row, the update silently does nothing.
     * @throws {DbError} When the database operation fails
     */
    updateById(id: string, data: Partial<T>, tx?: DrizzleClient): Promise<void>;

    /**
     * Soft-delete entities matching `where` (sets `deletedAt`). Returns count of affected rows.
     * @throws {DbError} When the database operation fails, where clause is empty, or table lacks deletedAt
     */
    softDelete(where: Record<string, unknown>, tx?: DrizzleClient): Promise<number>;

    /**
     * Restore soft-deleted entities matching `where` (clears `deletedAt`). Returns count of affected rows.
     * @throws {DbError} When the database operation fails, where clause is empty, or table lacks deletedAt
     */
    restore(where: Record<string, unknown>, tx?: DrizzleClient): Promise<number>;

    /**
     * Permanently delete entities matching `where`. Returns count of deleted rows.
     * @throws {DbError} When the database operation fails or where clause is empty
     */
    hardDelete(where: Record<string, unknown>, tx?: DrizzleClient): Promise<number>;

    /**
     * Count entities matching `where` conditions.
     * NOTE: `tx` is nested inside `options` (not a positional parameter) to match
     * the implementation signature where `additionalConditions` and `tx` share
     * the same options object.
     * @throws {DbError} When the database operation fails
     */
    count(
        where: Record<string, unknown>,
        options?: { additionalConditions?: SQL[]; tx?: DrizzleClient }
    ): Promise<number>;

    /**
     * Find all entities matching `where` with pagination and optional sorting.
     * Returns `{ items: T[], total: number }`.
     * @throws {DbError} When the database operation fails
     */
    findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<PaginatedListOutput<T>>;

    /**
     * Find all entities with specified relations populated.
     * Uses Drizzle's relational query API (`db.query[table].findMany()`).
     * @throws {DbError} When the database operation fails
     */
    findAllWithRelations(
        relations: Record<string, boolean | Record<string, unknown>>,
        where?: Record<string, unknown>,
        options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<PaginatedListOutput<T>>;

    /**
     * Find a single entity with its relations loaded.
     *
     * IMPORTANT: The base class implementation is a FALLBACK that executes
     * a plain `db.select().from(table).where(clause).limit(1)` query,
     * completely IGNORING the `relations` parameter. It returns the entity
     * without any relations populated (not null). Subclasses with relation
     * support (Accommodation, Event, Destination, Sponsorship, Amenity,
     * EventOrganizer) MUST override this method to actually load relations
     * using Drizzle's relational query API.
     * The interface includes it because it IS part of the public API contract
     * and callers use it through the interface.
     * @throws {DbError} When the database operation fails
     */
    findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<T | null>;

    /**
     * Execute a raw SQL query against the database.
     * Use sparingly -- prefer typed query methods when possible.
     * Callers must use Drizzle's `sql` tagged template literal for parameterized queries.
     * @throws {DbError} When the database operation fails
     */
    raw(query: SQL, tx?: DrizzleClient): Promise<unknown>;

    /** Returns the Drizzle table schema for this model. */
    getTable(): Table;
}
