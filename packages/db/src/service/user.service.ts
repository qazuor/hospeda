import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserProfile, type UserType } from '@repo/types';
import * as bcrypt from 'bcrypt';
import {
    BookmarkModel,
    type BookmarkRecord,
    RoleModel,
    UserModel,
    UserPermissionModel,
    type UserPermissionRecord,
    type UserRecord
} from '../model/index.js';
import type {
    InsertUser,
    InsertUserBookmark,
    InsertUserPermission,
    PaginationParams,
    SelectBookmarkFilter,
    SelectUserFilter,
    UpdateUserData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

const log = logger.createLogger('UserService');

/**
 * Service layer for managing user operations.
 * Handles business logic, authorization, and interacts with the UserModel and related models.
 */
export class UserService {
    private static readonly saltRounds = 10;

    /**
     * Checks if the given actor is an admin.
     * @param actor - The user performing the action.
     * @returns true if the actor is an admin, false otherwise.
     */
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    /**
     * Asserts that the actor is either the owner of the resource or an admin.
     * @param ownerId - The ID of the resource owner.
     * @param actor - The user performing the action.
     * @throws Error if the actor is neither the owner nor an admin.
     */
    private static assertOwnerOrAdmin(ownerId: string, actor: UserType): void {
        if (actor.id !== ownerId && !UserService.isAdmin(actor)) {
            log.warn('Forbidden access attempt', 'assertOwnerOrAdmin', {
                actorId: actor.id,
                requiredOwnerId: ownerId
            });
            throw new Error('Forbidden');
        }
    }

    /**
     * Asserts that the actor is an admin.
     * @param actor - The user performing the action.
     * @throws Error if the actor is not an admin.
     */
    private static assertAdmin(actor: UserType): void {
        if (!UserService.isAdmin(actor)) {
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new user.
     * @param data - The data for the new user.
     * @param actor - The user creating the new user (must be an admin).
     * @returns The created user record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertUser, actor: UserType): Promise<UserRecord> {
        log.info('creating user', 'create', { actor: actor.id });

        UserService.assertAdmin(actor);

        try {
            const passwordHash = await bcrypt.hash(data.passwordHash, UserService.saltRounds);
            const dataWithHashedPassword: InsertUser = {
                ...data,
                passwordHash,
                createdById: actor.id,
                updatedById: actor.id
            };

            const createdUser = await UserModel.createUser(dataWithHashedPassword);
            log.info('user created successfully', 'create', { userId: createdUser.id });
            return createdUser;
        } catch (error) {
            log.error('failed to create user', 'create', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * Get a single user by ID.
     * @param id - The ID of the user to fetch.
     * @param actor - The user performing the action.
     * @returns The user record.
     * @throws Error if user is not found or actor is not authorized.
     */
    async getById(id: string, actor: UserType): Promise<UserRecord> {
        log.info('fetching user by id', 'getById', { userId: id, actor: actor.id });

        const user = await UserModel.getUserById(id);
        const existingUser = assertExists(user, `User ${id} not found`);

        UserService.assertOwnerOrAdmin(existingUser.id, actor);

        log.info('user fetched successfully', 'getById', { userId: existingUser.id });
        return existingUser;
    }

    /**
     * List users with optional filtering and pagination.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action (must be an admin).
     * @returns An array of user records.
     * @throws Error if actor is not authorized or listing fails.
     */
    async list(filter: SelectUserFilter, actor: UserType): Promise<UserRecord[]> {
        log.info('listing users', 'list', { filter, actor: actor.id });

        UserService.assertAdmin(actor);

        try {
            const users = await UserModel.listUsers(filter);
            log.info('users listed successfully', 'list', { count: users.length, filter });
            return users;
        } catch (error) {
            log.error('failed to list users', 'list', error, { filter, actor: actor.id });
            throw error;
        }
    }

    /**
     * Update fields on an existing user.
     * @param id - The ID of the user to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action.
     * @returns The updated user record.
     * @throws Error if user is not found, actor is not authorized, or update fails.
     */
    async update(id: string, changes: UpdateUserData, actor: UserType): Promise<UserRecord> {
        log.info('updating user', 'update', { userId: id, actor: actor.id });

        const existingUser = await this.getById(id, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateUserData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedUser = await UserModel.updateUser(existingUser.id, dataWithAudit);
            log.info('user updated successfully', 'update', { userId: updatedUser.id });
            return updatedUser;
        } catch (error) {
            log.error('failed to update user', 'update', error, { userId: id, actor: actor.id });
            throw error;
        }
    }

    /**
     * Soft-delete a user by setting the deletedAt timestamp.
     * @param id - The ID of the user to soft-delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if user is not found, actor is not authorized, or soft-delete fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting user', 'delete', { userId: id, actor: actor.id });

        UserService.assertAdmin(actor);

        const existingUser = assertExists(
            await UserModel.getUserById(id),
            `User ${id} not found for soft delete`
        );

        try {
            const changes: UpdateUserData = {
                deletedAt: new Date(),
                deletedById: actor.id
            };
            await UserModel.updateUser(existingUser.id, changes);
            log.info('user soft deleted successfully', 'delete', { userId: existingUser.id });
        } catch (error) {
            log.error('failed to soft delete user', 'delete', error, {
                userId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Restore a soft-deleted user by clearing the deletedAt timestamp.
     * @param id - The ID of the user to restore.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if user is not found, actor is not authorized, or restore fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring user', 'restore', { userId: id, actor: actor.id });

        UserService.assertAdmin(actor);

        const existingUser = assertExists(
            await UserModel.getUserById(id),
            `User ${id} not found or not soft-deleted for restore`
        );

        try {
            const changes: UpdateUserData = {
                deletedAt: null,
                deletedById: null
            };
            await UserModel.updateUser(existingUser.id, changes);
            log.info('user restored successfully', 'restore', { userId: existingUser.id });
        } catch (error) {
            log.error('failed to restore user', 'restore', error, { userId: id, actor: actor.id });
            throw error;
        }
    }

    /**
     * Permanently delete a user record from the database.
     * @param id - The ID of the user to hard-delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if user is not found, actor is not authorized, or hard-delete fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting user', 'hardDelete', { userId: id, actor: actor.id });

        UserService.assertAdmin(actor);

        assertExists(await UserModel.getUserById(id), `User ${id} not found for hard delete`);

        try {
            await UserModel.hardDeleteUser(id);
            log.info('user hard deleted successfully', 'hardDelete', { userId: id });
        } catch (error) {
            log.error('failed to hard delete user', 'hardDelete', error, {
                userId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Change the password for a user.
     * @param userId - The ID of the user whose password to change.
     * @param newPassword - The new plain text password.
     * @param actor - The user performing the action.
     * @throws Error if user is not found, actor is not authorized, or update fails.
     */
    async changePassword(userId: string, newPassword: string, actor: UserType): Promise<void> {
        log.info('changing password for user', 'changePassword', { userId, actor: actor.id });

        const existingUser = await this.getById(userId, actor);

        try {
            const newPasswordHash = await bcrypt.hash(newPassword, UserService.saltRounds);
            const changes: UpdateUserData = {
                passwordHash: newPasswordHash,
                updatedById: actor.id
            };
            await UserModel.updateUser(existingUser.id, changes);
            log.info('password changed successfully', 'changePassword', {
                userId: existingUser.id
            });
        } catch (error) {
            log.error('failed to change password', 'changePassword', error, {
                userId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get users by role ID.
     * @param roleId - The ID of the role to filter by.
     * @param actor - The user performing the action (must be an admin).
     * @param pagination - Pagination options.
     * @returns An array of user records with the specified role.
     * @throws Error if actor is not authorized or listing fails.
     */
    async getByRole(
        roleId: string,
        actor: UserType,
        pagination: PaginationParams = {}
    ): Promise<UserRecord[]> {
        log.info('fetching users by role', 'getByRole', { roleId, actor: actor.id, pagination });

        UserService.assertAdmin(actor);

        const filter: SelectUserFilter = {
            roleId,
            ...pagination,
            includeDeleted: false
        };

        try {
            const users = await UserModel.listUsers(filter);
            log.info('users fetched by role successfully', 'getByRole', {
                roleId,
                count: users.length
            });
            return users;
        } catch (error) {
            log.error('failed to fetch users by role', 'getByRole', error, {
                roleId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Find a user by username.
     * @param username - The username to search for.
     * @param actor - The user performing the action (must be an admin).
     * @returns The user record or undefined if not found.
     * @throws Error if actor is not authorized or search fails.
     */
    async findByUsername(username: string, actor: UserType): Promise<UserRecord | undefined> {
        log.info('finding user by username', 'findByUsername', { username, actor: actor.id });

        UserService.assertAdmin(actor);

        try {
            const user = await UserModel.getUserByUsername(username);
            log.info('user found by username', 'findByUsername', { username, found: !!user?.id });
            return user;
        } catch (error) {
            log.error('failed to find user by username', 'findByUsername', error, {
                username,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Find a user by email.
     * @param email - The email to search for.
     * @param actor - The user performing the action (must be an admin).
     * @returns The user record or undefined if not found.
     * @throws Error if actor is not authorized or search fails.
     */
    async findByEmail(email: string, actor: UserType): Promise<UserRecord | undefined> {
        log.info('finding user by email', 'findByEmail', { email, actor: actor.id });

        UserService.assertAdmin(actor);

        try {
            const user = await UserModel.getUserByEmail(email);
            log.info('user found by email', 'findByEmail', { email, found: !!user?.id });
            return user;
        } catch (error) {
            log.error('failed to find user by email', 'findByEmail', error, {
                email,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Reset the password for a user. This typically involves generating a temporary password
     * or triggering a process like sending a reset link. This service method
     * will generate a new hash and update the user record, but the higher layer
     * is responsible for the flow (e.g., sending email with temporary password/link).
     * @param userId - The ID of the user whose password to reset.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if user is not found, actor is not authorized, or reset fails.
     */
    async resetPassword(userId: string, actor: UserType): Promise<void> {
        log.info('resetting password for user', 'resetPassword', { userId, actor: actor.id });

        UserService.assertAdmin(actor);

        const existingUser = assertExists(
            await UserModel.getUserById(userId),
            `User ${userId} not found`
        );

        const temporaryPassword = Math.random().toString(36).slice(-10);

        try {
            const newPasswordHash = await bcrypt.hash(temporaryPassword, UserService.saltRounds);
            const changes: UpdateUserData = {
                passwordHash: newPasswordHash,
                updatedById: actor.id
            };
            await UserModel.updateUser(existingUser.id, changes);
            log.info('password reset successfully (new hash set)', 'resetPassword', {
                userId: existingUser.id
            });
        } catch (error) {
            log.error('failed to reset password', 'resetPassword', error, {
                userId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Change the role of a user.
     * @param userId - The ID of the user whose role to change.
     * @param newRoleId - The ID of the new role.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated user record.
     * @throws Error if user or role is not found, actor is not authorized, or update fails.
     */
    async changeRole(userId: string, newRoleId: string, actor: UserType): Promise<UserRecord> {
        log.info('changing role for user', 'changeRole', { userId, newRoleId, actor: actor.id });

        UserService.assertAdmin(actor);

        const existingUser = assertExists(
            await UserModel.getUserById(userId),
            `User ${userId} not found`
        );
        assertExists(await RoleModel.getRoleById(newRoleId), `Role ${newRoleId} not found`);

        try {
            const changes: UpdateUserData = {
                roleId: newRoleId,
                updatedById: actor.id
            };
            const updatedUser = await UserModel.updateUser(existingUser.id, changes);
            log.info('user role changed successfully', 'changeRole', {
                userId: updatedUser.id,
                newRoleId
            });
            return updatedUser;
        } catch (error) {
            log.error('failed to change user role', 'changeRole', error, {
                userId,
                newRoleId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List all users with the admin role.
     * @param actor - The user performing the action (must be an admin).
     * @param pagination - Pagination options.
     * @returns An array of admin user records.
     * @throws Error if actor is not authorized or listing fails.
     */
    async listAdmins(actor: UserType, pagination: PaginationParams = {}): Promise<UserRecord[]> {
        log.info('listing admin users', 'listAdmins', { actor: actor.id, pagination });

        UserService.assertAdmin(actor);

        try {
            const adminRole = assertExists(
                await RoleModel.getRoleByName(BuiltinRoleTypeEnum.ADMIN),
                'Admin role not found'
            );

            const filter: SelectUserFilter = {
                roleId: adminRole.id,
                ...pagination,
                includeDeleted: false
            };

            const adminUsers = await UserModel.listUsers(filter);
            log.info('admin users listed successfully', 'listAdmins', { count: adminUsers.length });
            return adminUsers;
        } catch (error) {
            log.error('failed to list admin users', 'listAdmins', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * Search users by query term (fuzzy search on name and username).
     * @param query - The search term.
     * @param actor - The user performing the action (must be an admin).
     * @param pagination - Pagination options.
     * @returns An array of matching user records.
     * @throws Error if actor is not authorized or search fails.
     */
    async search(
        query: string,
        actor: UserType,
        pagination: PaginationParams = {}
    ): Promise<UserRecord[]> {
        log.info('searching users', 'search', { query, actor: actor.id, pagination });

        const filter: SelectUserFilter = {
            query,
            ...pagination,
            includeDeleted: false
        };

        return this.list(filter, actor);
    }

    /**
     * Get users by state.
     * @param state - The state to filter by.
     * @param actor - The user performing the action (must be an admin).
     * @param pagination - Pagination options.
     * @returns An array of user records with the specified state.
     * @throws Error if actor is not authorized or listing fails.
     */
    async getByState(
        state: string,
        actor: UserType,
        pagination: PaginationParams = {}
    ): Promise<UserRecord[]> {
        log.info('fetching users by state', 'getByState', { state, actor: actor.id, pagination });

        UserService.assertAdmin(actor);

        const filter: SelectUserFilter = {
            state,
            ...pagination,
            includeDeleted: false
        };

        try {
            const users = await UserModel.listUsers(filter);
            log.info('users fetched by state successfully', 'getByState', {
                state,
                count: users.length
            });
            return users;
        } catch (error) {
            log.error('failed to fetch users by state', 'getByState', error, {
                state,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Add a direct permission to a user.
     * @param userId - The ID of the user.
     * @param permissionId - The ID of the permission to add.
     * @param actor - The user performing the action (must be an admin).
     * @returns The created user-permission relation record.
     * @throws Error if user or permission is not found, actor is not authorized, or creation fails.
     */
    async addPermission(
        userId: string,
        permissionId: string,
        actor: UserType
    ): Promise<UserPermissionRecord> {
        log.info('adding permission to user', 'addPermission', {
            userId,
            permissionId,
            actor: actor.id
        });

        UserService.assertAdmin(actor);

        assertExists(await UserModel.getUserById(userId), `User ${userId} not found`);

        const data: InsertUserPermission = {
            userId,
            permissionId
        };

        try {
            const relation = await UserPermissionModel.createRelation(data);
            log.info('permission added to user successfully', 'addPermission', {
                userId,
                permissionId
            });
            return relation;
        } catch (error) {
            log.error('failed to add permission to user', 'addPermission', error, {
                userId,
                permissionId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Remove a direct permission from a user.
     * @param userId - The ID of the user.
     * @param permissionId - The ID of the permission to remove.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if actor is not authorized or deletion fails.
     */
    async removePermission(userId: string, permissionId: string, actor: UserType): Promise<void> {
        log.info('removing permission from user', 'removePermission', {
            userId,
            permissionId,
            actor: actor.id
        });

        UserService.assertAdmin(actor);

        try {
            await UserPermissionModel.deleteRelation(userId, permissionId);
            log.info('permission removed from user successfully', 'removePermission', {
                userId,
                permissionId
            });
        } catch (error) {
            log.error('failed to remove permission from user', 'removePermission', error, {
                userId,
                permissionId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List all direct permissions for a user.
     * @param userId - The ID of the user.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns An array of user-permission relation records.
     * @throws Error if user is not found, actor is not authorized, or listing fails.
     */
    async listPermissions(
        userId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<UserPermissionRecord[]> {
        log.info('listing permissions for user', 'listPermissions', {
            userId,
            actor: actor.id,
            filter
        });

        const existingUser = await this.getById(userId, actor);

        try {
            // Call the model method designed to list permissions for a user ID
            // Assuming a method like listPermissionsByUserId exists and accepts PaginationParams
            const permissions = await UserPermissionModel.listByUser(existingUser.id, filter);
            log.info('permissions listed for user successfully', 'listPermissions', {
                userId: existingUser.id,
                count: permissions.length
            });
            return permissions;
        } catch (error) {
            log.error('failed to list permissions for user', 'listPermissions', error, {
                userId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Add a bookmark for a user.
     * @param userId - The ID of the user adding the bookmark.
     * @param bookmarkData - The data for the bookmark (entityType, entityId, name, description, state, adminInfo).
     * @param actor - The user performing the action.
     * @returns The created bookmark record.
     * @throws Error if user or entity is not found, actor is not authorized, or creation fails.
     */
    async addBookmark(
        userId: string,
        bookmarkData: Omit<
            InsertUserBookmark,
            | 'ownerId'
            | 'createdById'
            | 'updatedById'
            | 'deletedById'
            | 'createdAt'
            | 'updatedAt'
            | 'deletedAt'
        >,
        actor: UserType
    ): Promise<BookmarkRecord> {
        log.info('adding bookmark for user', 'addBookmark', {
            userId,
            bookmarkData,
            actor: actor.id
        });

        UserService.assertOwnerOrAdmin(userId, actor);

        const data: InsertUserBookmark = {
            ...bookmarkData,
            ownerId: userId,
            createdById: actor.id,
            updatedById: actor.id
        };

        try {
            const createdBookmark = await BookmarkModel.insertBookmark(data);
            log.info('bookmark added for user successfully', 'addBookmark', {
                userId,
                bookmarkId: createdBookmark.id
            });
            return createdBookmark;
        } catch (error) {
            log.error('failed to add bookmark for user', 'addBookmark', error, {
                userId,
                bookmarkData,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Remove a bookmark.
     * @param bookmarkId - The ID of the bookmark to remove.
     * @param actor - The user performing the action.
     * @throws Error if bookmark is not found, actor is not authorized (must be owner or admin), or deletion fails.
     */
    async removeBookmark(bookmarkId: string, actor: UserType): Promise<void> {
        log.info('removing bookmark', 'removeBookmark', { bookmarkId, actor: actor.id });

        const bookmark = assertExists(
            await BookmarkModel.selectBookmarkById(bookmarkId),
            `Bookmark ${bookmarkId} not found`
        );

        UserService.assertOwnerOrAdmin(bookmark.ownerId, actor);

        try {
            await BookmarkModel.hardDeleteBookmark(bookmarkId);
            log.info('bookmark removed successfully', 'removeBookmark', {
                bookmarkId,
                actor: actor.id
            });
        } catch (error) {
            log.error('failed to remove bookmark', 'removeBookmark', error, {
                bookmarkId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List bookmarks for a user.
     * @param userId - The ID of the user whose bookmarks to list.
     * @param actor - The user performing the action.
     * @param filter - Filtering and pagination options (Omit<'ownerId'> from SelectBookmarkFilter, PaginationParams type from db-types included).
     * @returns An array of bookmark records.
     * @throws Error if user is not found, actor is not authorized, or listing fails.
     */
    async listBookmarks(
        userId: string,
        actor: UserType,
        filter: Omit<SelectBookmarkFilter, 'ownerId'> = {}
    ): Promise<BookmarkRecord[]> {
        log.info('listing bookmarks for user', 'listBookmarks', {
            userId,
            actor: actor.id,
            filter
        });

        const existingUser = await this.getById(userId, actor);

        const fullFilter: SelectBookmarkFilter = {
            ownerId: existingUser.id,
            ...filter,
            includeDeleted: filter.includeDeleted ?? false
        };

        try {
            const bookmarks = await BookmarkModel.selectBookmarks(fullFilter);
            log.info('bookmarks listed for user successfully', 'listBookmarks', {
                userId: existingUser.id,
                count: bookmarks.length
            });
            return bookmarks;
        } catch (error) {
            log.error('failed to list bookmarks for user', 'listBookmarks', error, {
                userId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Update a user's profile data (JSONB field).
     * @param userId - The ID of the user whose profile to update.
     * @param profileData - The partial profile data to update.
     * @param actor - The user performing the action.
     * @returns The updated user record.
     * @throws Error if user is not found, actor is not authorized, or update fails.
     */
    async updateProfile(
        userId: string,
        profileData: Partial<UserProfile>,
        actor: UserType
    ): Promise<UserRecord> {
        log.info('updating user profile', 'updateProfile', { userId, actor: actor.id });

        const existingUser = await this.getById(userId, actor);

        const updatedProfile = {
            ...(existingUser.profile || {}),
            ...profileData
        } as UserProfile;

        try {
            const changes: UpdateUserData = {
                profile: updatedProfile,
                updatedById: actor.id
            };
            const updatedUser = await UserModel.updateUser(existingUser.id, changes);
            log.info('user profile updated successfully', 'updateProfile', {
                userId: updatedUser.id
            });
            return updatedUser;
        } catch (error) {
            log.error('failed to update user profile', 'updateProfile', error, {
                userId,
                actor: actor.id
            });
            throw error;
        }
    }
}
