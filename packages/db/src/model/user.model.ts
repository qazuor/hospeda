import { logger } from '@repo/logger';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { users } from '../schema/user.dbschema';
import type { InsertUser, SelectUserFilter, UpdateUserData } from '../types/db-types';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils';

// Scoped logger for user model operations
const log = logger.createLogger('UserModel');

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
            log.info('creating a new user', 'createUser', data);
            const rows = castReturning<UserRecord>(await db.insert(users).values(data).returning());
            const user = assertExists(rows[0], 'createUser: no user returned');
            log.query('insert', 'users', data, user);
            return user;
        } catch (error) {
            log.error('createUser failed', 'createUser', error);
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
            log.info('fetching user by id', 'getUserById', { id });
            const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1); // No need to cast as any, Drizzle handles this with select()
            log.query('select', 'users', { id }, user);
            return user ? (user as UserRecord) : undefined; // Cast the potentially found user
        } catch (error) {
            log.error('getUserById failed', 'getUserById', error);
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
            log.info('fetching user by username', 'getUserByUsername', { username });
            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.userName, username))
                .limit(1);
            log.query('select', 'users', { username }, user);
            return user ? (user as UserRecord) : undefined;
        } catch (error) {
            log.error('getUserByUsername failed', 'getUserByUsername', error);
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
            log.info('fetching user by email', 'getUserByEmail', { email });
            // Querying JSONB ->> 'key' is common in PostgreSQL for text access
            // Using sql template tag for direct DB syntax is often necessary for JSONB
            const [user] = await db
                .select()
                .from(users)
                // Example JSONB query syntax for email in contactInfo
                // This syntax might vary based on your specific DB and Drizzle setup for JSONB
                // The '::text' cast is often needed for comparison
                .where(sql`${users.contactInfo}->>'email'::text = ${email}`)
                .limit(1);

            log.query('select', 'users', { email }, user);
            return user ? (user as UserRecord) : undefined;
        } catch (error) {
            log.error('getUserByEmail failed', 'getUserByEmail', error);
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
            log.info('listing users', 'listUsers', filter);

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

            log.query('select', 'users', filter, rows);
            return rows;
        } catch (error) {
            log.error('listUsers failed', 'listUsers', error);
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
            log.info('updating user', 'updateUser', { id, dataToUpdate });
            const rows = castReturning<UserRecord>(
                await db.update(users).set(dataToUpdate).where(eq(users.id, id)).returning()
            );
            const updated = assertExists(rows[0], `updateUser: no user found for id ${id}`);
            log.query('update', 'users', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateUser failed', 'updateUser', error);
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
            log.info('soft deleting user', 'softDeleteUser', { id });
            await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
            log.query('update', 'users', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteUser failed', 'softDeleteUser', error);
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
            log.info('restoring user', 'restoreUser', { id });
            await db.update(users).set({ deletedAt: null }).where(eq(users.id, id));
            log.query('update', 'users', { id }, { restored: true });
        } catch (error) {
            log.error('restoreUser failed', 'restoreUser', error);
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
            log.info('hard deleting user', 'hardDeleteUser', { id });
            await db.delete(users).where(eq(users.id, id));
            log.query('delete', 'users', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteUser failed', 'hardDeleteUser', error);
            throw error;
        }
    }
};
