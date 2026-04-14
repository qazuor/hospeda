import { UserModel, safeIlike, users as userTable } from '@repo/db';
import type { ImageProvider } from '@repo/media';
import { resolveEnvironment } from '@repo/media';
import type { EntityFilters, User } from '@repo/schemas';
import {
    PermissionEnum,
    ServiceErrorCode,
    type UserAddPermissionInput,
    UserAddPermissionInputSchema,
    UserAdminSearchSchema,
    type UserAssignRoleInput,
    UserAssignRoleInputSchema,
    type UserCreateInput,
    UserCreateInputSchema,
    type UserRemovePermissionInput,
    UserRemovePermissionInputSchema,
    type UserRolePermissionOutput,
    UserSchema,
    type UserSearch,
    type UserSearchResult,
    UserSearchSchema,
    type UserSetPermissionsInput,
    UserSetPermissionsInputSchema,
    UserUpdateInputSchema
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { BaseCrudService } from '../../base/base.crud.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import type {
    Actor,
    AdminSearchExecuteParams,
    ListOptions,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceLogger,
    ServiceOutput
} from '../../types';
import { ServiceError, listOptionsSchema } from '../../types';
import { serviceLogger } from '../../utils';
import { hasPermission } from '../../utils/permission';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeUserInput,
    normalizeViewInput
} from './user.normalizers';
import { canAssignRole, checkCanAdminList } from './user.permissions';
import type { UserHookState } from './user.types';

/** Entity-specific filter fields for user admin search. */
type UserEntityFilters = EntityFilters<typeof UserAdminSearchSchema>;

/**
 * Service for managing users, roles, and permissions.
 * Enforces strict permission rules:
 * - Only super admin can create, delete, or restore users
 * - Users can update themselves, or be updated by super admin
 * - Only super admin or admin can search/list/count users
 * - Only super admin can manage roles and permissions
 */
export class UserService extends BaseCrudService<
    User,
    UserModel,
    typeof UserCreateInputSchema,
    typeof UserUpdateInputSchema,
    typeof UserSearchSchema
> {
    static readonly ENTITY_NAME = 'user';
    protected readonly entityName = UserService.ENTITY_NAME;
    protected readonly model: UserModel;
    protected readonly schema = UserSchema;
    protected readonly filterSchema = UserSearchSchema;
    protected readonly normalizers: CrudNormalizersFromSchemas<
        typeof UserCreateInputSchema,
        typeof UserUpdateInputSchema,
        typeof UserSearchSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput
    };
    protected readonly logger: ServiceLogger;
    protected readonly createSchema = UserCreateInputSchema;
    protected readonly updateSchema = UserUpdateInputSchema;
    protected readonly searchSchema = UserSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Users are searched by display name, first name, last name, and email.
     */
    protected override getSearchableColumns(): string[] {
        return ['displayName', 'firstName', 'lastName', 'email'];
    }

    /**
     * Optional Cloudinary media provider for avatar cleanup on hard delete.
     * When null, media cleanup is skipped (Cloudinary not configured).
     */
    private readonly mediaProvider: ImageProvider | null;

    /**
     * Initializes a new instance of the UserService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional UserModel instance (for testing/mocking).
     * @param mediaProvider - Optional ImageProvider for Cloudinary avatar cleanup on hard delete.
     */
    constructor(ctx: ServiceConfig, model?: UserModel, mediaProvider?: ImageProvider | null) {
        super(ctx, UserService.ENTITY_NAME);
        this.logger = ctx.logger ?? serviceLogger;
        this.model = model ?? new UserModel();
        this.adminSearchSchema = UserAdminSearchSchema;
        this.mediaProvider = mediaProvider ?? null;
    }

    /**
     * Permission: Requires USER_CREATE permission to create users.
     */
    protected _canCreate(actor: Actor): void {
        if (!hasPermission(actor, PermissionEnum.USER_CREATE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_CREATE permission to create users'
            );
        }
    }

    /**
     * Permission: Requires USER_RESTORE permission to restore users.
     */
    protected _canRestore(actor: Actor): void {
        if (!hasPermission(actor, PermissionEnum.USER_RESTORE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_RESTORE permission to restore users'
            );
        }
    }

    /**
     * Permission: Self or actor with USER_READ_ALL permission can update.
     */
    protected _canUpdate(actor: Actor, entity: User): void {
        if (actor.id !== entity.id && !hasPermission(actor, PermissionEnum.USER_READ_ALL)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Only self or users with USER_READ_ALL can update user'
            );
        }
    }

    /**
     * Permission: Requires USER_READ_ALL permission to search/list/count users.
     */
    protected _canSearch(actor: Actor): void {
        if (!hasPermission(actor, PermissionEnum.USER_READ_ALL)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_READ_ALL permission to search users'
            );
        }
    }
    protected _canList(actor: Actor): void {
        this._canSearch(actor);
    }
    protected _canCount(actor: Actor): void {
        this._canSearch(actor);
    }

    /**
     * Permission: Requires USER_UPDATE_ROLES permission to manage permissions.
     */
    protected _canManagePermissions(actor: Actor): void {
        if (!hasPermission(actor, PermissionEnum.USER_UPDATE_ROLES)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_UPDATE_ROLES permission to manage permissions'
            );
        }
    }

    /**
     * Permission: Requires USER_DELETE permission to soft delete users.
     */
    protected _canSoftDelete(actor: Actor, _entity: User): void {
        if (!hasPermission(actor, PermissionEnum.USER_DELETE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_DELETE permission to soft delete users'
            );
        }
    }

    /**
     * Permission: Requires USER_HARD_DELETE permission to hard delete users.
     */
    protected _canHardDelete(actor: Actor, _entity: User): void {
        if (!hasPermission(actor, PermissionEnum.USER_HARD_DELETE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_HARD_DELETE permission to hard delete users'
            );
        }
    }

    /**
     * Permission: Self or actor with USER_READ_ALL permission can view.
     */
    protected _canView(actor: Actor, entity: User): void {
        if (actor.id !== entity.id && !hasPermission(actor, PermissionEnum.USER_READ_ALL)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Only self or users with USER_READ_ALL can view user'
            );
        }
    }

    /**
     * Permission: Requires USER_READ_ALL permission to update visibility.
     */
    protected _canUpdateVisibility(actor: Actor, _entity: User, _newVisibility: unknown): void {
        if (!hasPermission(actor, PermissionEnum.USER_READ_ALL)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Requires USER_READ_ALL permission to update user visibility'
            );
        }
    }

    /**
     * Permission: Requires admin access (base class) plus USER_READ_ALL for admin list.
     * Calls super to enforce ACCESS_PANEL_ADMIN / ACCESS_API_ADMIN first, then
     * applies the entity-specific USER_READ_ALL check.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }

    // --- Lifecycle Hooks ---

    /**
     * Normalizes and generates slug before creating a user.
     */
    protected async _beforeCreate(
        data: UserCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<User>> {
        // Ensure data is properly typed for normalization
        const cleanData = data as Partial<User>;
        const normalized = await normalizeUserInput(cleanData);
        return normalized;
    }

    /**
     * Normalizes and generates slug before updating a user.
     * Bookmarks are always omitted from the result (even if type allows).
     */
    protected async _beforeUpdate(
        data: Partial<User>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<User>> {
        // Remove bookmarks before normalization to avoid type errors
        const { bookmarks, ...rest } = data;
        return normalizeUserInput(rest) as Partial<User>;
    }

    // --- Custom Methods (stubs) ---

    /**
     * Assigns a role to a user. Only super admin can assign roles.
     * @param actor - The actor performing the action
     * @param params - The input object containing userId and role
     * @returns The updated user object
     * @throws ServiceError (FORBIDDEN, NOT_FOUND, INTERNAL)
     */
    public async assignRole(
        actor: Actor,
        params: UserAssignRoleInput
    ): Promise<ServiceOutput<UserRolePermissionOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'assignRole',
            input: { ...params, actor },
            schema: UserAssignRoleInputSchema,
            execute: async ({ userId, role }, actor) => {
                canAssignRole(actor);
                const user = await this.model.findById(userId);
                if (!user) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }
                if (user.role === role) {
                    return { user };
                }
                const updated = await this.model.update({ id: userId }, { role });
                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to assign role'
                    );
                }
                return { user: updated };
            }
        });
    }

    /**
     * Adds a permission to a user. Only super admin.
     * @param actor - The actor performing the action
     * @param params - The input object containing userId and permission
     * @returns The updated user object
     * @throws ServiceError (FORBIDDEN, NOT_FOUND, INTERNAL)
     */
    public async addPermission(
        actor: Actor,
        params: UserAddPermissionInput
    ): Promise<ServiceOutput<UserRolePermissionOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addPermission',
            input: { ...params, actor },
            schema: UserAddPermissionInputSchema,
            execute: async ({ userId, permission }, actor) => {
                await this._canManagePermissions(actor);
                const user = await this.model.findById(userId);
                if (!user) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }
                if (user.permissions.includes(permission)) {
                    return { user };
                }
                const updated = await this.model.update(
                    { id: userId },
                    { permissions: [...user.permissions, permission] }
                );
                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to add permission'
                    );
                }
                return { user: updated };
            }
        });
    }

    /**
     * Removes a permission from a user. Only super admin.
     * @param actor - The actor performing the action
     * @param params - The input object containing userId and permission
     * @returns The updated user object
     * @throws ServiceError (FORBIDDEN, NOT_FOUND, INTERNAL)
     */
    public async removePermission(
        actor: Actor,
        params: UserRemovePermissionInput
    ): Promise<ServiceOutput<UserRolePermissionOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removePermission',
            input: { ...params, actor },
            schema: UserRemovePermissionInputSchema,
            execute: async ({ userId, permission }, actor) => {
                await this._canManagePermissions(actor);
                const user = await this.model.findById(userId);
                if (!user) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }
                if (!user.permissions.includes(permission)) {
                    return { user };
                }
                const updated = await this.model.update(
                    { id: userId },
                    { permissions: user.permissions.filter((p) => p !== permission) }
                );
                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to remove permission'
                    );
                }
                return { user: updated };
            }
        });
    }

    /**
     * Sets the permissions array for a user. Only super admin.
     * @param actor - The actor performing the action
     * @param params - The input object containing userId and permissions
     * @returns The updated user object
     * @throws ServiceError (FORBIDDEN, NOT_FOUND, INTERNAL)
     */
    public async setPermissions(
        actor: Actor,
        params: UserSetPermissionsInput
    ): Promise<ServiceOutput<UserRolePermissionOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'setPermissions',
            input: { ...params, actor },
            schema: UserSetPermissionsInputSchema,
            execute: async ({ userId, permissions }, actor) => {
                await this._canManagePermissions(actor);
                const user = await this.model.findById(userId);
                if (!user) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
                }
                const updated = await this.model.update({ id: userId }, { permissions });
                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to set permissions'
                    );
                }
                return { user: updated };
            }
        });
    }

    /**
     * Executes admin search for users with email partial match support.
     *
     * Overrides the base implementation to handle the `email` filter as a
     * case-insensitive partial match (ILIKE) instead of an exact equality check.
     * Delegates all remaining query assembly (where, pagination, sort, search,
     * relations) to `super._executeAdminSearch()`.
     *
     * @param params - The assembled admin search parameters.
     * @returns A paginated list of users matching the criteria.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams<UserEntityFilters>
    ): Promise<PaginatedListOutput<User>> {
        const { entityFilters, extraConditions, ...rest } = params;
        const { email, ...simpleFilters } = entityFilters;

        const additionalConditions: SQL[] = [...(extraConditions ?? [])];

        // email partial match (ilike, not eq)
        if (email) {
            additionalConditions.push(safeIlike(userTable.email, email));
        }

        return super._executeAdminSearch({
            ...rest,
            entityFilters: simpleFilters,
            extraConditions: additionalConditions.length > 0 ? additionalConditions : undefined
        });
    }

    /**
     * Lifecycle hook: captures the user ID before hard delete for avatar cleanup.
     * @param id - The ID of the user to hard-delete.
     * @param _actor - The actor performing the action.
     * @param ctx - Service execution context carrying transaction and hookState.
     */
    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<UserHookState>
    ): Promise<string> {
        if (ctx.hookState) {
            ctx.hookState.deletedEntityId = id;
        }
        return id;
    }

    /**
     * Lifecycle hook: removes the user avatar from Cloudinary after a confirmed hard delete.
     * Best-effort: errors are logged but never propagated.
     * @param result - An object containing the count of affected rows.
     * @param _actor - The actor performing the action.
     * @param ctx - Service execution context carrying transaction and hookState.
     */
    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<UserHookState>
    ): Promise<{ count: number }> {
        // Best-effort Cloudinary avatar cleanup after confirmed hard delete
        if (result.count > 0 && ctx.hookState?.deletedEntityId && this.mediaProvider) {
            const env = resolveEnvironment();
            const publicId = `hospeda/${env}/avatars/${ctx.hookState.deletedEntityId}`;
            try {
                await this.mediaProvider.delete({ publicId });
            } catch (mediaError) {
                this.logger.warn(
                    { error: mediaError, publicId },
                    '[media] Failed to clean up Cloudinary avatar for user'
                );
            }
        }
        return result;
    }

    /**
     * Executes a search for users.
     * @param params - The validated and processed search parameters (filters, pagination, etc.)
     * @returns Paginated list of users matching the criteria
     */
    protected async _executeSearch(params: UserSearch, _actor: Actor, _ctx: ServiceContext) {
        const { page, pageSize } = params;
        return this.model.findAll(params, { page, pageSize });
    }

    /**
     * Executes a count for users.
     * @param params - The validated and processed search parameters (filters, pagination, etc.)
     * @returns Count of users matching the criteria
     */
    protected async _executeCount(params: UserSearch, _actor: Actor, _ctx: ServiceContext) {
        const count = await this.model.count(params);
        return { count };
    }

    /**
     * Override the list method to use findAllWithCounts for better performance
     */
    public override async list(actor: Actor, options: ListOptions = {}, ctx?: ServiceContext) {
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };
        return this.runWithLoggingAndValidation({
            methodName: 'list',
            input: { actor, ...options },
            ctx: resolvedCtx,
            schema: listOptionsSchema,
            execute: async (validatedOptions, validatedActor, execCtx) => {
                await this._canList(validatedActor);

                const normalized =
                    (await this.normalizers?.list?.(validatedOptions || {}, validatedActor)) ??
                    (validatedOptions || {});
                const processedOptions = await this._beforeList(
                    normalized,
                    validatedActor,
                    execCtx
                );

                // Use the efficient findAllWithCounts method
                const result = await this.model.findAllWithCounts(processedOptions.where ?? {}, {
                    page: processedOptions.page,
                    pageSize: processedOptions.pageSize
                });

                return this._afterList(result, validatedActor, execCtx);
            }
        });
    }

    /**
     * Searches for users with accommodation, event, and post counts.
     * Uses the efficient findAllWithCounts method that fetches counts via
     * correlated subqueries instead of N+1 individual queries.
     * @param actor - The actor performing the action
     * @param params - The search parameters
     * @returns Users with counts
     */
    public async searchForList(
        actor: Actor,
        params: UserSearch
    ): Promise<ServiceOutput<UserSearchResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'searchForList',
            input: { ...params, actor },
            schema: UserSearchSchema,
            execute: async (validated, validatedActor) => {
                await this._canSearch(validatedActor);
                const { page, pageSize } = validated;

                const result = await this.model.findAllWithCounts(validated, { page, pageSize });

                const itemsWithCounts = result.items.map((user) => ({
                    ...user,
                    accommodationCount: user.accommodationsCount,
                    eventsCount: user.eventsCount,
                    postsCount: user.postsCount
                }));

                return {
                    data: itemsWithCounts,
                    pagination: {
                        page,
                        pageSize,
                        total: result.total,
                        totalPages: Math.ceil(result.total / pageSize),
                        hasNextPage: page * pageSize < result.total,
                        hasPreviousPage: page > 1
                    }
                };
            }
        });
    }
}
