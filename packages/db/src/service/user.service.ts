import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type UserProfile, type UserType } from '@repo/types';
import bcrypt from 'bcryptjs';
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
            dbLogger.warn(
                {
                    actorId: actor.id,
                    requiredOwnerId: ownerId
                },
                'Forbidden access attempt'
            );
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
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
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
        dbLogger.info({ actor: actor.id }, 'creating user');

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
            dbLogger.info({ userId: createdUser.id }, 'user created successfully');
            return createdUser;
        } catch (error) {
            dbLogger.error(error, 'failed to create user');
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
        dbLogger.info({ userId: id, actor: actor.id }, 'fetching user by id');

        const user = await UserModel.getUserById(id);
        const existingUser = assertExists(user, `User ${id} not found`);

        UserService.assertOwnerOrAdmin(existingUser.id, actor);

        dbLogger.info({ userId: existingUser.id }, 'user fetched successfully');
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
        dbLogger.info({ filter, actor: actor.id }, 'listing users');

        UserService.assertAdmin(actor);

        try {
            const users = await UserModel.listUsers(filter);
            dbLogger.info({ count: users.length, filter }, 'users listed successfully');
            return users;
        } catch (error) {
            dbLogger.error(error, 'failed to list users');
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
        dbLogger.info({ userId: id, actor: actor.id }, 'updating user');

        const existingUser = await this.getById(id, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateUserData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedUser = await UserModel.updateUser(existingUser.id, dataWithAudit);
            dbLogger.info({ userId: updatedUser.id }, 'user updated successfully');
            return updatedUser;
        } catch (error) {
            dbLogger.error(error, 'failed to update user');
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
        dbLogger.info({ userId: id, actor: actor.id }, 'soft deleting user');

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
            dbLogger.info({ userId: existingUser.id }, 'user soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete user');
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
        dbLogger.info({ userId: id, actor: actor.id }, 'restoring user');

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
            dbLogger.info({ userId: existingUser.id }, 'user restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore user');
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
        dbLogger.info({ userId: id, actor: actor.id }, 'hard deleting user');

        UserService.assertAdmin(actor);

        assertExists(await UserModel.getUserById(id), `User ${id} not found for hard delete`);

        try {
            await UserModel.hardDeleteUser(id);
            dbLogger.info({ userId: id }, 'user hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete user');
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
        dbLogger.info({ userId, actor: actor.id }, 'changing password for user');

        const existingUser = await this.getById(userId, actor);

        try {
            const newPasswordHash = await bcrypt.hash(newPassword, UserService.saltRounds);
            const changes: UpdateUserData = {
                passwordHash: newPasswordHash,
                updatedById: actor.id
            };
            await UserModel.updateUser(existingUser.id, changes);
            dbLogger.info({ userId: existingUser.id }, 'password changed successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to change password');
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
        dbLogger.info({ roleId, actor: actor.id, pagination }, 'fetching users by role');

        UserService.assertAdmin(actor);

        const filter: SelectUserFilter = {
            roleId,
            ...pagination,
            includeDeleted: false
        };

        try {
            const users = await UserModel.listUsers(filter);
            dbLogger.info({ roleId, count: users.length }, 'users fetched by role successfully');
            return users;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch users by role');
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
        dbLogger.info({ username, actor: actor.id }, 'finding user by username');

        UserService.assertAdmin(actor);

        try {
            const user = await UserModel.getUserByUsername(username);
            dbLogger.info({ username, found: !!user?.id }, 'user found by username');
            return user;
        } catch (error) {
            dbLogger.error(error, 'failed to find user by username');
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
        dbLogger.info({ email, actor: actor.id }, 'finding user by email');

        UserService.assertAdmin(actor);

        try {
            const user = await UserModel.getUserByEmail(email);
            dbLogger.info({ email, found: !!user?.id }, 'user found by email');
            return user;
        } catch (error) {
            dbLogger.error(error, 'failed to find user by email');
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
        dbLogger.info({ userId, actor: actor.id }, 'resetting password for user');

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
            dbLogger.info(
                { userId: existingUser.id },
                'password reset successfully (new hash set)'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to reset password');
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
        dbLogger.info({ userId, newRoleId, actor: actor.id }, 'changing role for user');

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
            dbLogger.info({ userId: updatedUser.id, newRoleId }, 'user role changed successfully');
            return updatedUser;
        } catch (error) {
            dbLogger.error(error, 'failed to change user role');
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
        dbLogger.info({ actor: actor.id, pagination }, 'listing admin users');

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
            dbLogger.info({ count: adminUsers.length }, 'admin users listed successfully');
            return adminUsers;
        } catch (error) {
            dbLogger.error(error, 'failed to list admin users');
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
        dbLogger.info({ query, actor: actor.id, pagination }, 'searching users');

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
        dbLogger.info({ state, actor: actor.id, pagination }, 'fetching users by state');

        UserService.assertAdmin(actor);

        const filter: SelectUserFilter = {
            state,
            ...pagination,
            includeDeleted: false
        };

        try {
            const users = await UserModel.listUsers(filter);
            dbLogger.info({ state, count: users.length }, 'users fetched by state successfully');
            return users;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch users by state');
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
        dbLogger.info({ userId, permissionId, actor: actor.id }, 'adding permission to user');

        UserService.assertAdmin(actor);

        assertExists(await UserModel.getUserById(userId), `User ${userId} not found`);

        const data: InsertUserPermission = {
            userId,
            permissionId
        };

        try {
            const relation = await UserPermissionModel.createRelation(data);
            dbLogger.info({ userId, permissionId }, 'permission added to user successfully');
            return relation;
        } catch (error) {
            dbLogger.error(error, 'failed to add permission to user');
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
        dbLogger.info({ userId, permissionId, actor: actor.id }, 'removing permission from user');

        UserService.assertAdmin(actor);

        try {
            await UserPermissionModel.deleteRelation(userId, permissionId);
            dbLogger.info({ userId, permissionId }, 'permission removed from user successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to remove permission from user');
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
        dbLogger.info({ userId, actor: actor.id, filter }, 'listing permissions for user');

        const existingUser = await this.getById(userId, actor);

        try {
            // Call the model method designed to list permissions for a user ID
            // Assuming a method like listPermissionsByUserId exists and accepts PaginationParams
            const permissions = await UserPermissionModel.listByUser(existingUser.id, filter);
            dbLogger.info(
                { userId: existingUser.id, count: permissions.length },
                'permissions listed for user successfully'
            );
            return permissions;
        } catch (error) {
            dbLogger.error(error, 'failed to list permissions for user');
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
        dbLogger.info({ userId, bookmarkData, actor: actor.id }, 'adding bookmark for user');

        UserService.assertOwnerOrAdmin(userId, actor);

        const data: InsertUserBookmark = {
            ...bookmarkData,
            ownerId: userId,
            createdById: actor.id,
            updatedById: actor.id
        };

        try {
            const createdBookmark = await BookmarkModel.insertBookmark(data);
            dbLogger.info(
                { userId, bookmarkId: createdBookmark.id },
                'bookmark added for user successfully'
            );
            return createdBookmark;
        } catch (error) {
            dbLogger.error(error, 'failed to add bookmark for user');
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
        dbLogger.info({ bookmarkId, actor: actor.id }, 'removing bookmark');

        const bookmark = assertExists(
            await BookmarkModel.selectBookmarkById(bookmarkId),
            `Bookmark ${bookmarkId} not found`
        );

        UserService.assertOwnerOrAdmin(bookmark.ownerId, actor);

        try {
            await BookmarkModel.hardDeleteBookmark(bookmarkId);
            dbLogger.info({ bookmarkId, actor: actor.id }, 'bookmark removed successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to remove bookmark');
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
        dbLogger.info({ userId, actor: actor.id, filter }, 'listing bookmarks for user');

        const existingUser = await this.getById(userId, actor);

        const fullFilter: SelectBookmarkFilter = {
            ownerId: existingUser.id,
            ...filter,
            includeDeleted: filter.includeDeleted ?? false
        };

        try {
            const bookmarks = await BookmarkModel.selectBookmarks(fullFilter);
            dbLogger.info(
                { userId: existingUser.id, count: bookmarks.length },
                'bookmarks listed for user successfully'
            );
            return bookmarks;
        } catch (error) {
            dbLogger.error(error, 'failed to list bookmarks for user');
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
        dbLogger.info({ userId, actor: actor.id }, 'updating user profile');

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
            dbLogger.info({ userId: updatedUser.id }, 'user profile updated successfully');
            return updatedUser;
        } catch (error) {
            dbLogger.error(error, 'failed to update user profile');
            throw error;
        }
    }
}
