import { LifecycleStatusEnum, type UserId } from '@repo/types';
import { UserModel } from '../../models/user/user.model';
import { dbLogger } from '../../utils/logger';
import { hasPermission } from '../../utils/permission-manager';
import {
    CanViewReasonEnum,
    getSafeActor,
    isUserDisabled,
    logMethodEnd,
    logMethodStart
} from '../../utils/service-helper';
import { canViewUser } from './user.helper';
import type {
    CreateUserInput,
    CreateUserOutput,
    GetByIdInput,
    GetByIdOutput,
    HardDeleteUserInput,
    HardDeleteUserOutput,
    RestoreUserInput,
    RestoreUserOutput,
    SoftDeleteUserInput,
    SoftDeleteUserOutput,
    UpdateUserInput,
    UpdateUserOutput
} from './user.schemas';
import {
    createUserInputSchema,
    getByIdInputSchema,
    hardDeleteUserInputSchema,
    restoreUserInputSchema,
    softDeleteUserInputSchema,
    updateUserInputSchema
} from './user.schemas';

const SYSTEM_USER_ID = 'system' as UserId;

/**
 * Retrieves a user by their unique ID, applying robust permission checks, logging, and edge-case handling.
 * - Admins can view any user.
 * - A user can view themselves.
 * - Others require explicit permission.
 * - Disabled users cannot view any user.
 *
 * @param input - Object containing the user ID ({ id: UserId }).
 * @param actor - The user or public actor requesting the user.
 * @returns An object with the user if accessible, or null otherwise.
 * @throws Error if the user has unknown visibility (should not occur in current logic).
 * @example
 *   const { user } = await getById({ id: 'user-123' }, adminUser);
 */
export const getById = async (input: GetByIdInput, actor: unknown): Promise<GetByIdOutput> => {
    logMethodStart(dbLogger, 'getById', input, actor as object);
    const parsedInput = getByIdInputSchema.parse(input);
    const user = (await UserModel.getById(parsedInput.id)) ?? null;
    if (!user) {
        logMethodEnd(dbLogger, 'getById', { user: null });
        return { user: null };
    }
    const safeActor = getSafeActor(actor);
    if (isUserDisabled(safeActor)) {
        logMethodEnd(dbLogger, 'getById', { user: null });
        return { user: null };
    }
    const { canView, reason, checkedPermission } = canViewUser(safeActor, user);
    if (
        reason === CanViewReasonEnum.UNKNOWN_VISIBILITY ||
        reason === CanViewReasonEnum.PUBLIC_ACTOR_DENIED
    ) {
        logMethodEnd(dbLogger, 'getById', { user: null });
        return { user: null };
    }
    if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
        try {
            hasPermission(safeActor, checkedPermission);
            logMethodEnd(dbLogger, 'getById', { user });
            return { user };
        } catch {
            logMethodEnd(dbLogger, 'getById', { user: null });
            return { user: null };
        }
    }
    if (canView) {
        logMethodEnd(dbLogger, 'getById', { user });
        return { user };
    }
    // Explicit deny for all other cases (public, no permission, etc)
    logMethodEnd(dbLogger, 'getById', { user: null });
    return { user: null };
};

/**
 * Searches for users based on advanced filters, ordering, and pagination.
 * Applies permission checks, logging, and edge-case handling.
 *
 * @param input - Search filters and ordering (to be defined).
 * @param actor - The user or public actor performing the search.
 * @returns Object with users and total count (to be defined).
 * @throws Error (not implemented).
 */
export const search = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Lists users with basic filters and pagination.
 * Applies permission checks, logging, and edge-case handling.
 *
 * @param input - List filters and pagination (to be defined).
 * @param actor - The user or public actor performing the listing.
 * @returns Object with users (to be defined).
 * @throws Error (not implemented).
 */
export const list = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Creates a new user. Only admin or system can create users.
 * Applies validation, logging, and permission checks.
 *
 * @param input - User creation data.
 * @param actor - The user or system actor creating the user.
 * @returns Object with the created user (without password).
 * @throws Error if not allowed or user already exists.
 */
export const create = async (input: CreateUserInput, actor: unknown): Promise<CreateUserOutput> => {
    logMethodStart(dbLogger, 'create', input, actor as object);
    const parsedInput = createUserInputSchema.parse(input);
    const safeActor = getSafeActor(actor);

    // Only admin can create users
    if (!('role' in safeActor) || safeActor.role !== 'ADMIN') {
        logMethodEnd(dbLogger, 'create', { user: null });
        throw new Error('Only admin can create users');
    }
    if (isUserDisabled(safeActor)) {
        logMethodEnd(dbLogger, 'create', { user: null });
        throw new Error('Disabled users cannot create users');
    }
    // Prevent creating users with equal or higher role than actor
    if (
        'role' in safeActor &&
        (parsedInput.role === 'ADMIN' || parsedInput.role === 'SUPER_ADMIN')
    ) {
        logMethodEnd(dbLogger, 'create', { user: null });
        throw new Error('Cannot create user with equal or higher role');
    }
    // Check uniqueness (userName/email)
    const existingByUserName = await UserModel.getByUserName(parsedInput.userName);
    if (existingByUserName) {
        logMethodEnd(dbLogger, 'create', { user: null });
        throw new Error('User name already exists');
    }
    if (parsedInput.email) {
        // TODO: Implement getByEmail in UserModel if not present
        const existingByEmail = await (UserModel.getByEmail(parsedInput.email) ??
            Promise.resolve(undefined));
        if (existingByEmail) {
            logMethodEnd(dbLogger, 'create', { user: null });
            throw new Error('Email already exists');
        }
    }
    // Create user
    const now = new Date();
    const newUser = await UserModel.create({
        ...parsedInput,
        lifecycleState: parsedInput.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
        createdAt: now,
        updatedAt: now,
        createdById: 'id' in safeActor ? safeActor.id : SYSTEM_USER_ID,
        updatedById: 'id' in safeActor ? safeActor.id : SYSTEM_USER_ID
    });
    // Remove password from output
    const { password, ...userOut } = newUser;
    logMethodEnd(dbLogger, 'create', { user: userOut });
    return { user: userOut };
};

/**
 * Updates an existing user. Only admin or the user themselves can update.
 * Applies validation, logging, and permission checks.
 *
 * @param input - User update data.
 * @param actor - The user or admin actor updating the user.
 * @returns Object with the updated user (without password).
 * @throws Error if not allowed, user not found, or duplicate userName/email.
 */
export const update = async (input: UpdateUserInput, actor: unknown): Promise<UpdateUserOutput> => {
    logMethodStart(dbLogger, 'update', input, actor as object);
    const parsedInput = updateUserInputSchema.parse(input);
    const safeActor = getSafeActor(actor);

    // Get user to update
    const user = await UserModel.getById(parsedInput.id);
    if (!user) {
        logMethodEnd(dbLogger, 'update', { user: null });
        throw new Error('User not found');
    }
    if (isUserDisabled(safeActor)) {
        logMethodEnd(dbLogger, 'update', { user: null });
        throw new Error('Disabled users cannot update users');
    }
    // Only admin or the user themselves can update
    const isAdmin = 'role' in safeActor && safeActor.role === 'ADMIN';
    const isSelf = 'id' in safeActor && safeActor.id === user.id;
    if (!isAdmin && !isSelf) {
        logMethodEnd(dbLogger, 'update', { user: null });
        throw new Error('Only admin or the user themselves can update');
    }
    // Prevent user from changing their own role to admin or higher (unless admin)
    if (
        !isAdmin &&
        parsedInput.role &&
        (parsedInput.role === 'ADMIN' || parsedInput.role === 'SUPER_ADMIN')
    ) {
        logMethodEnd(dbLogger, 'update', { user: null });
        throw new Error('Cannot assign admin or higher role');
    }
    // Check uniqueness (userName/email)
    if (parsedInput.userName && parsedInput.userName !== user.userName) {
        const existingByUserName = await UserModel.getByUserName(parsedInput.userName);
        if (existingByUserName) {
            logMethodEnd(dbLogger, 'update', { user: null });
            throw new Error('User name already exists');
        }
    }
    if (parsedInput.email && parsedInput.email !== user.email) {
        const existingByEmail = await UserModel.getByEmail(parsedInput.email);
        if (existingByEmail) {
            logMethodEnd(dbLogger, 'update', { user: null });
            throw new Error('Email already exists');
        }
    }
    // Update user
    const now = new Date();
    const userId = parsedInput.id as UserId;
    const { id, ...updateFields } = parsedInput;
    const updatedUser = await UserModel.update(userId, {
        ...updateFields,
        updatedAt: now,
        updatedById: 'id' in safeActor ? safeActor.id : user.id
    });
    if (!updatedUser) {
        logMethodEnd(dbLogger, 'update', { user: null });
        throw new Error('Failed to update user');
    }
    // Remove password from output
    const { password, ...userOut } = updatedUser;
    logMethodEnd(dbLogger, 'update', { user: userOut });
    return { user: userOut };
};

/**
 * Soft-deletes (disables) a user. Only admin can perform this action.
 * Applies validation, logging, and permission checks.
 *
 * @param input - User ID to soft-delete.
 * @param actor - The admin actor performing the soft-delete.
 * @returns Object with the disabled user (without password).
 * @throws Error if not allowed, user not found, already disabled, or self-delete.
 */
export const softDelete = async (
    input: SoftDeleteUserInput,
    actor: unknown
): Promise<SoftDeleteUserOutput> => {
    logMethodStart(dbLogger, 'softDelete', input, actor as object);
    const parsedInput = softDeleteUserInputSchema.parse(input);
    const safeActor = getSafeActor(actor);

    // First: do not allow if the actor is disabled
    if (isUserDisabled(safeActor)) {
        logMethodEnd(dbLogger, 'softDelete', { user: null });
        throw new Error('Disabled users cannot soft-delete users');
    }
    // Solo admin puede soft-delete
    if (!('role' in safeActor) || safeActor.role !== 'ADMIN') {
        logMethodEnd(dbLogger, 'softDelete', { user: null });
        throw new Error('Only admin can soft-delete users');
    }
    // Get user to disable
    const user = await UserModel.getById(parsedInput.id);
    if (!user) {
        logMethodEnd(dbLogger, 'softDelete', { user: null });
        throw new Error('User not found');
    }
    if (user.lifecycleState === LifecycleStatusEnum.INACTIVE) {
        logMethodEnd(dbLogger, 'softDelete', { user: null });
        throw new Error('User is already disabled');
    }
    // Prevent admin from disabling themselves
    if ('id' in safeActor && safeActor.id === user.id) {
        logMethodEnd(dbLogger, 'softDelete', { user: null });
        throw new Error('Admin cannot soft-delete themselves');
    }
    // Disable user
    const now = new Date();
    const updatedUser = await UserModel.update(user.id, {
        lifecycleState: LifecycleStatusEnum.INACTIVE,
        updatedAt: now,
        updatedById: safeActor.id
    });
    if (!updatedUser) {
        logMethodEnd(dbLogger, 'softDelete', { user: null });
        throw new Error('Failed to soft-delete user');
    }
    // Remove password from output
    const { password, ...userOut } = updatedUser;
    logMethodEnd(dbLogger, 'softDelete', { user: userOut });
    return { user: userOut };
};

/**
 * Restores a previously soft-deleted (disabled) user. Only admin can perform this action.
 * Applies validation, logging, and permission checks.
 *
 * @param input - User ID to restore.
 * @param actor - The admin actor performing the restore.
 * @returns Object with the restored user (without password).
 * @throws Error if not allowed, user not found, already active, or self-restore.
 */
export const restore = async (
    input: RestoreUserInput,
    actor: unknown
): Promise<RestoreUserOutput> => {
    logMethodStart(dbLogger, 'restore', input, actor as object);
    const parsedInput = restoreUserInputSchema.parse(input);
    const safeActor = getSafeActor(actor);

    // Primero: no permitir si el actor está deshabilitado
    if (isUserDisabled(safeActor)) {
        logMethodEnd(dbLogger, 'restore', { user: null });
        throw new Error('Disabled users cannot restore users');
    }
    // Solo admin puede restaurar usuarios
    if (!('role' in safeActor) || safeActor.role !== 'ADMIN') {
        logMethodEnd(dbLogger, 'restore', { user: null });
        throw new Error('Only admin can restore users');
    }
    // Buscar usuario a restaurar
    const user = await UserModel.getById(parsedInput.id);
    if (!user) {
        logMethodEnd(dbLogger, 'restore', { user: null });
        throw new Error('User not found');
    }
    // Prevenir que el admin se restaure a sí mismo
    if ('id' in safeActor && safeActor.id === user.id) {
        logMethodEnd(dbLogger, 'restore', { user: null });
        throw new Error('Admin cannot restore themselves');
    }
    if (user.lifecycleState === LifecycleStatusEnum.ACTIVE) {
        logMethodEnd(dbLogger, 'restore', { user: null });
        throw new Error('User is already active');
    }
    // Restaurar usuario
    const now = new Date();
    const updatedUser = await UserModel.update(user.id, {
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        updatedAt: now,
        updatedById: safeActor.id
    });
    if (!updatedUser) {
        logMethodEnd(dbLogger, 'restore', { user: null });
        throw new Error('Failed to restore user');
    }
    // Quitar password del output
    const { password, ...userOut } = updatedUser;
    logMethodEnd(dbLogger, 'restore', { user: userOut });
    return { user: userOut };
};

/**
 * Hard-deletes (permanently deletes) a user. Only admin can perform this action.
 * Applies validation, logging, and permission checks.
 *
 * @param input - User ID to hard-delete.
 * @param actor - The admin actor performing the hard-delete.
 * @returns Object with the deleted user (without password), or null if not found.
 * @throws Error if not allowed, user not found, self-delete, or DB error.
 */
export const hardDelete = async (
    input: HardDeleteUserInput,
    actor: unknown
): Promise<HardDeleteUserOutput> => {
    logMethodStart(dbLogger, 'hardDelete', input, actor as object);
    const parsedInput = hardDeleteUserInputSchema.parse(input);
    const safeActor = getSafeActor(actor);

    // Do not allow if the actor is disabled
    if (isUserDisabled(safeActor)) {
        logMethodEnd(dbLogger, 'hardDelete', { user: null });
        throw new Error('Disabled users cannot hard-delete users');
    }
    // Only admin can hard-delete
    if (!('role' in safeActor) || safeActor.role !== 'ADMIN') {
        logMethodEnd(dbLogger, 'hardDelete', { user: null });
        throw new Error('Only admin can hard-delete users');
    }
    // Find user to delete
    const user = await UserModel.getById(parsedInput.id);
    if (!user) {
        logMethodEnd(dbLogger, 'hardDelete', { user: null });
        throw new Error('User not found');
    }
    // Prevent admin from deleting themselves
    if ('id' in safeActor && safeActor.id === user.id) {
        logMethodEnd(dbLogger, 'hardDelete', { user: null });
        throw new Error('Admin cannot hard-delete themselves');
    }
    // Perform physical deletion
    const deletedUser = await UserModel.hardDelete(user.id);
    if (!deletedUser) {
        logMethodEnd(dbLogger, 'hardDelete', { user: null });
        throw new Error('Failed to hard-delete user');
    }
    logMethodEnd(dbLogger, 'hardDelete', { user: deletedUser });
    return { user: deletedUser };
};

/**
 * Changes the role of a user. Only admin can perform this action.
 * Applies validation, logging, and permission checks.
 *
 * @param input - User ID and new role (to be defined).
 * @param actor - The admin actor changing the role.
 * @returns Object with the updated user (to be defined).
 * @throws Error (not implemented).
 */
export const changeRole = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Adds a permission to a user. Only admin can perform this action.
 * Applies validation, logging, and permission checks.
 *
 * @param input - User ID and permission to add (to be defined).
 * @param actor - The admin actor adding the permission.
 * @returns Object with the updated user (to be defined).
 * @throws Error (not implemented).
 */
export const addPermission = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Removes a permission from a user. Only admin can perform this action.
 * Applies validation, logging, and permission checks.
 *
 * @param input - User ID and permission to remove (to be defined).
 * @param actor - The admin actor removing the permission.
 * @returns Object with the updated user (to be defined).
 * @throws Error (not implemented).
 */
export const removePermission = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Retrieves the effective permissions of a user.
 * Applies permission checks and logging.
 *
 * @param input - User ID or data (to be defined).
 * @param actor - The user or admin actor requesting permissions.
 * @returns Object with the permissions (to be defined).
 * @throws Error (not implemented).
 */
export const getPermissions = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Retrieves the bookmarks/favorites of a user.
 * Applies permission checks and logging.
 *
 * @param input - User ID or data (to be defined).
 * @param actor - The user or admin actor requesting bookmarks.
 * @returns Object with the bookmarks (to be defined).
 * @throws Error (not implemented).
 */
export const getBookmarks = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * --- Future Methods Stubs ---
 */

/**
 * Lists users by role. Only admin can perform this action.
 * Applies permission checks and logging.
 *
 * @param input - Role filter (to be defined).
 * @param actor - The admin actor requesting users by role.
 * @returns Object with users (to be defined).
 * @throws Error (not implemented).
 */
export const getByRole = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Retrieves the public profile of a user.
 * Applies permission checks and logging.
 *
 * @param input - User ID or data (to be defined).
 * @param actor - The user or public actor requesting the profile.
 * @returns Object with the profile (to be defined).
 * @throws Error (not implemented).
 */
export const getProfile = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Bulk-updates users. Only admin can perform this action.
 * Applies validation, logging, and permission checks.
 *
 * @param input - Bulk update data (to be defined).
 * @param actor - The admin actor performing the bulk update.
 * @returns Object with the updated users (to be defined).
 * @throws Error (not implemented).
 */
export const bulkUpdate = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Bulk-deletes users. Only admin can perform this action.
 * Applies validation, logging, and permission checks.
 *
 * @param input - Bulk delete data (to be defined).
 * @param actor - The admin actor performing the bulk delete.
 * @returns Object indicating success (to be defined).
 * @throws Error (not implemented).
 */
export const bulkDelete = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Retrieves the activity log of a user.
 * Applies permission checks and logging.
 *
 * @param input - User ID or data (to be defined).
 * @param actor - The user or admin actor requesting the activity log.
 * @returns Object with the activity log (to be defined).
 * @throws Error (not implemented).
 */
export const getActivityLog = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Updates the public profile of a user.
 * Applies validation, logging, and permission checks.
 *
 * @param input - Profile update data (to be defined).
 * @param actor - The user or admin actor updating the profile.
 * @returns Object with the updated profile (to be defined).
 * @throws Error (not implemented).
 */
export const updateProfile = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Retrieves users and metrics for the admin dashboard.
 * Applies permission checks and logging.
 *
 * @param input - Dashboard filters (to be defined).
 * @param actor - The admin actor requesting dashboard data.
 * @returns Object with users and metrics (to be defined).
 * @throws Error (not implemented).
 */
export const getForAdminDashboard = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};
