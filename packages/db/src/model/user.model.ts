import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../client.js';
import { users } from '../schema/user.dbschema.js';
import type { InsertUser, SelectUserFilter, UpdateUserData } from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Full user record as returned by the database.
 */
export type UserRecord = InferSelectModel<typeof users>;

/**
 * UserModel provides low-level CRUD operations for the users table.
 */
export const UserModel = {
    /**
     * Create a new user record.
     *
     * @param data - Fields required to create the user (InsertUser type from db-types)
     * @returns The created user record
     */
    async createUser(data: InsertUser): Promise<UserRecord> {
        try {
            dbLogger.info(data, 'creating a new user');
            const db = getDb();
            const rows = castReturning<UserRecord>(await db.insert(users).values(data).returning());
            const user = assertExists(rows[0], 'createUser: no user returned');
            dbLogger.query({ table: 'users', action: 'insert', params: data, result: user });
            return user;
        } catch (error) {
            dbLogger.error(error, 'createUser failed');
            throw error;
        }
    },

    /**
     * Fetch a single user by ID.
     *
     * @param id - UUID of the user
     * @returns The user record or undefined if not found
     */
    async getUserById(id: string): Promise<UserRecord | undefined> {
        try {
            dbLogger.info({ id }, 'fetching user by id');
            const db = getDb();
            const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1); // No need to cast as any, Drizzle handles this with select()
            dbLogger.query({ table: 'users', action: 'select', params: { id }, result: user });
            return user ? (user as UserRecord) : undefined; // Cast the potentially found user
        } catch (error) {
            dbLogger.error(error, 'getUserById failed');
            throw error;
        }
    },

    /**
     * Fetch a single user by username.
     *
     * @param username - The username of the user.
     * @returns The user record or undefined if not found.
     */
    async getUserByUsername(username: string): Promise<UserRecord | undefined> {
        try {
            dbLogger.info({ username }, 'fetching user by username');
            const db = getDb();
            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.userName, username))
                .limit(1);
            dbLogger.query({
                table: 'users',
                action: 'select',
                params: { username },
                result: user
            });
            return user ? (user as UserRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getUserByUsername failed');
            throw error;
        }
    },

    /**
     * Fetch a single user by email.
     * NOTE: This implementation queries the 'email' field within the 'contactInfo' JSONB column.
     * This approach might require specific Drizzle setup for JSONB or could be less performant
     * than a dedicated email column depending on the database and index strategy.
     *
     * @param email - The email of the user.
     * @returns The user record or undefined if not found.
     * @deprecated This method assumes email is in JSONB and might not be performant. A dedicated email column is recommended for frequent lookups.
     */
    async getUserByEmail(email: string): Promise<UserRecord | undefined> {
        try {
            dbLogger.info({ email }, 'fetching user by email');
            // Querying JSONB ->> 'key' is common in PostgreSQL for text access
            // Using sql template tag for direct DB syntax is often necessary for JSONB
            const db = getDb();
            const [user] = await db
                .select()
                .from(users)
                // Example JSONB query syntax for email in contactInfo
                // This syntax might vary based on your specific DB and Drizzle setup for JSONB
                // The '::text' cast is often needed for comparison
                .where(sql`${users.contactInfo}->>'email'::text = ${email}`)
                .limit(1);

            dbLogger.query({ table: 'users', action: 'select', params: { email }, result: user });
            return user ? (user as UserRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getUserByEmail failed');
            throw error;
        }
    },

    /**
     * List users with optional pagination, fuzzy search, state filter, and role filter.
     *
     * @param filter - Pagination and filtering options (SelectUserFilter type from db-types)
     * @returns Array of user records
     */
    async listUsers(filter: SelectUserFilter): Promise<UserRecord[]> {
        try {
            dbLogger.info(filter, 'listing users');
            const db = getDb();
            let query = db.select().from(users).$dynamic(); // Use $dynamic() for conditional where clauses

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(or(ilike(users.name, term), ilike(users.userName, term)));
            }

            if (filter.roleId) {
                query = query.where(eq(users.roleId, filter.roleId));
            }

            if (filter.state) {
                // Using inherited 'state' filter
                query = query.where(eq(users.state, filter.state));
            }

            if (filter.createdById) {
                // Added createdById filter
                query = query.where(eq(users.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                // Added updatedById filter
                query = query.where(eq(users.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                // Added deletedById filter
                query = query.where(eq(users.deletedById, filter.deletedById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(users.deletedAt));
            }

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(users, filter.orderBy, users.createdAt);
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as UserRecord[];

            dbLogger.query({ table: 'users', action: 'select', params: filter, result: rows });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listUsers failed');
            throw error;
        }
    },

    /**
     * Update fields on an existing user.
     *
     * @param id - UUID of the user to update
     * @param changes - Partial fields to update (UpdateUserData type from db-types)
     * @returns The updated user record
     */
    async updateUser(id: string, changes: UpdateUserData): Promise<UserRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            dbLogger.info({ id, dataToUpdate }, 'updating user');
            const db = getDb();
            const rows = castReturning<UserRecord>(
                await db.update(users).set(dataToUpdate).where(eq(users.id, id)).returning()
            );
            const updated = assertExists(rows[0], `updateUser: no user found for id ${id}`);
            dbLogger.query({
                table: 'users',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateUser failed');
            throw error;
        }
    },

    /**
     * Soft-delete a user by setting the deletedAt timestamp.
     *
     * @param id - UUID of the user
     */
    async softDeleteUser(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'soft deleting user');
            const db = getDb();
            await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
            dbLogger.query({
                table: 'users',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteUser failed');
            throw error;
        }
    },

    /**
     * Restore a soft-deleted user by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the user
     */
    async restoreUser(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'restoring user');
            const db = getDb();
            await db.update(users).set({ deletedAt: null }).where(eq(users.id, id));
            dbLogger.query({
                table: 'users',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreUser failed');
            throw error;
        }
    },

    /**
     * Permanently delete a user record from the database.
     *
     * @param id - UUID of the user
     */
    async hardDeleteUser(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'hard deleting user');
            const db = getDb();
            await db.delete(users).where(eq(users.id, id));
            dbLogger.query({
                table: 'users',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteUser failed');
            throw error;
        }
    }
};
