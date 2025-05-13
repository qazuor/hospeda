import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../client';
import { users } from '../schema/user.dbschema';
import type { BaseSelectFilter, UpdateData } from '../types/db.types';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

// Scoped logger for user model operations
const log = logger.createLogger('UserModel');

/**
 * Full user record as returned by the database.
 */
export type UserRecord = InferSelectModel<typeof users>;

/**
 * Data required to create a new user.
 */
export type CreateUserData = InferInsertModel<typeof users>;

/**
 * Fields allowed for updating a user.
 */
export type UpdateUserData = UpdateData<CreateUserData>;

/**
 * Filter options for listing users.
 */
export interface SelectUserFilter extends BaseSelectFilter {
    /** Filter by user state */
    state?: string;
}

/**
 * UserModel provides low-level CRUD operations for the users table.
 */
export const UserModel = {
    /**
     * Create a new user record.
     *
     * @param data - Fields required to create the user
     * @returns The created user record
     */
    async createUser(data: CreateUserData): Promise<UserRecord> {
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
            const [user] = (await db
                .select()
                .from(users)
                .where(eq(users.id, id))
                .limit(1)) as UserRecord[];
            log.query('select', 'users', { id }, user);
            return user;
        } catch (error) {
            log.error('getUserById failed', 'getUserById', error);
            throw error;
        }
    },

    /**
     * List users with optional pagination, fuzzy search, and state filter.
     *
     * @param filter - Pagination and filtering options
     * @returns Array of user records
     */
    async listUsers(filter: SelectUserFilter): Promise<UserRecord[]> {
        try {
            log.info('listing users', 'listUsers', filter);

            let query = rawSelect(db.select().from(users));

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(or(ilike(users.name, term), ilike(users.userName, term)));
            }

            if (filter.state) {
                query = query.where(eq(users.state, filter.state));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(users.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(users.createdAt, 'desc')) as UserRecord[];

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
     * @param changes - Partial fields to update
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
