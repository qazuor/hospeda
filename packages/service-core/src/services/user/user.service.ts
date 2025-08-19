import { UserIdentityModel, UserModel } from '@repo/db';
import {
    CreateUserSchema,
    UpdateUserSchema,
    UserFilterInputSchema,
    UserSchema
} from '@repo/schemas';
import type { PermissionEnum, UserType } from '@repo/types';
import { RoleEnum, ServiceErrorCode } from '@repo/types';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceLogger, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { serviceLogger } from '../../utils';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeUserInput,
    normalizeViewInput
} from './user.normalizers';
import { canAssignRole } from './user.permissions';
import {
    AddPermissionSchema,
    AssignRoleSchema,
    RemovePermissionSchema,
    SetPermissionsSchema
} from './user.schemas';

/**
 * Service for managing users, roles, and permissions.
 * Enforces strict permission rules:
 * - Only super admin can create, delete, or restore users
 * - Users can update themselves, or be updated by super admin
 * - Only super admin or admin can search/list/count users
 * - Only super admin can manage roles and permissions
 */
export class UserService extends BaseCrudService<
    UserType,
    UserModel,
    typeof CreateUserSchema,
    typeof UpdateUserSchema,
    typeof UserFilterInputSchema
> {
    static readonly ENTITY_NAME = 'user';
    protected readonly entityName = UserService.ENTITY_NAME;
    protected readonly model: UserModel;
    protected readonly schema = UserSchema;
    protected readonly filterSchema = UserFilterInputSchema;
    protected readonly normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput
    } as const;
    protected readonly logger: ServiceLogger;
    protected readonly createSchema = CreateUserSchema;
    protected readonly updateSchema = UpdateUserSchema;
    protected readonly searchSchema = UserFilterInputSchema;

    constructor(ctx: ServiceContext, model?: UserModel) {
        super(ctx, UserService.ENTITY_NAME);
        this.logger = ctx.logger ?? serviceLogger;
        this.model = model ?? new UserModel();
    }

    /**
     * Retrieves a user by authentication provider mapping.
     * @param actor - The actor performing the action (authorization handled upstream if needed)
     * @param params - The provider and providerUserId pair
     * @returns The user if found, otherwise null
     */
    public async getByAuthProviderId(
        actor: Actor,
        params: { provider: string; providerUserId: string }
    ): Promise<ServiceOutput<{ user: UserType | null }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByAuthProviderId',
            input: { actor, ...params },
            schema: z.object({ provider: z.string(), providerUserId: z.string() }),
            execute: async ({ provider, providerUserId }) => {
                const user = await this.model.findOne({
                    authProvider: provider,
                    authProviderUserId: providerUserId
                });
                return { user };
            }
        });
    }

    /**
     * Ensures a user exists for a given authentication provider mapping.
     * - If the user exists: updates basic profile fields from provider data.
     * - If not: creates a new user with sane defaults and provider linkage.
     * - Upserts external identities (OAuth) when provided.
     */
    public async ensureFromAuthProvider(
        actor: Actor,
        params: {
            provider: string;
            providerUserId: string;
            profile?: Partial<
                Pick<UserType, 'firstName' | 'lastName' | 'displayName' | 'contactInfo' | 'profile'>
            >;
            identities?: Array<{
                provider: string;
                providerUserId: string;
                email?: string;
                username?: string;
                avatarUrl?: string;
                raw?: unknown;
                lastLoginAt?: Date;
            }>;
        }
    ): Promise<ServiceOutput<{ user: UserType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'ensureFromAuthProvider',
            input: { actor, ...params },
            schema: z.object({
                provider: z.string(),
                providerUserId: z.string(),
                profile: z
                    .object({
                        firstName: z.string().optional(),
                        lastName: z.string().optional(),
                        displayName: z.string().optional(),
                        contactInfo: z.any().optional(),
                        profile: z.any().optional()
                    })
                    .optional(),
                identities: z
                    .array(
                        z.object({
                            provider: z.string(),
                            providerUserId: z.string(),
                            email: z.string().optional(),
                            username: z.string().optional(),
                            avatarUrl: z.string().optional(),
                            raw: z.unknown().optional(),
                            lastLoginAt: z.date().optional()
                        })
                    )
                    .optional()
            }),
            execute: async ({ provider, providerUserId, profile, identities }) => {
                // Try to find existing user
                const existing = await this.model.findOne({
                    authProvider: provider,
                    authProviderUserId: providerUserId
                });

                if (existing) {
                    // Update only when current fields are empty and provider data is available
                    const selectiveUpdates: Partial<UserType> = {};
                    if (!existing.firstName && profile?.firstName) {
                        selectiveUpdates.firstName = profile.firstName;
                    }
                    if (!existing.lastName && profile?.lastName) {
                        selectiveUpdates.lastName = profile.lastName;
                    }
                    if (!existing.displayName && profile?.displayName) {
                        selectiveUpdates.displayName = profile.displayName;
                    }
                    // Merge avatar if missing
                    const newAvatar = profile?.profile?.avatar;
                    const hasAvatar = !!existing.profile?.avatar;
                    if (newAvatar && !hasAvatar) {
                        selectiveUpdates.profile = {
                            ...(existing.profile ?? {}),
                            avatar: newAvatar
                        };
                    }
                    // Complete email only if contactInfo exists already and email available via identities
                    const emailFromIdentities = (identities || []).find((i) => i.email)?.email;
                    if (existing.contactInfo && emailFromIdentities) {
                        const hasAnyEmail =
                            !!existing.contactInfo.personalEmail ||
                            !!existing.contactInfo.workEmail;
                        if (!hasAnyEmail) {
                            selectiveUpdates.contactInfo = {
                                ...existing.contactInfo,
                                personalEmail: emailFromIdentities
                            } as unknown as UserType['contactInfo'];
                        }
                    }

                    const hasUpdates = Object.keys(selectiveUpdates).length > 0;
                    const updated = hasUpdates
                        ? await this.model.update({ id: existing.id }, selectiveUpdates)
                        : null;
                    const user = updated ?? existing;
                    // Upsert identities if provided
                    if (user && identities && identities.length > 0) {
                        const identityModel = new UserIdentityModel();
                        for (const ident of identities) {
                            const exists = await identityModel.findOne({
                                provider: ident.provider,
                                providerUserId: ident.providerUserId
                            });
                            if (exists) {
                                await identityModel.update({ id: exists.id }, {
                                    email: ident.email ?? exists.email,
                                    username: ident.username ?? exists.username,
                                    avatarUrl: ident.avatarUrl ?? exists.avatarUrl,
                                    raw: ident.raw ?? exists.raw,
                                    lastLoginAt: ident.lastLoginAt ?? exists.lastLoginAt,
                                    updatedById: user.id // Use the actual user ID instead of actor ID
                                } as unknown as Record<string, unknown>);
                            } else {
                                await identityModel.create({
                                    userId: user.id,
                                    provider: ident.provider,
                                    providerUserId: ident.providerUserId,
                                    email: ident.email,
                                    username: ident.username,
                                    avatarUrl: ident.avatarUrl,
                                    raw: ident.raw,
                                    lastLoginAt: ident.lastLoginAt,
                                    createdById: user.id, // Use the actual user ID instead of actor ID
                                    updatedById: user.id // Use the actual user ID instead of actor ID
                                } as unknown as Record<string, unknown>);
                            }
                        }
                    }
                    return { user };
                }

                // Create new user with defaults
                const baseNewUser: Partial<UserType> = {
                    slug: `${provider}-${providerUserId}`,
                    authProvider: provider as unknown as UserType['authProvider'],
                    authProviderUserId: providerUserId,
                    role: RoleEnum.USER,
                    permissions: [],
                    visibility: 'PUBLIC' as UserType['visibility'],
                    lifecycleState: 'ACTIVE' as UserType['lifecycleState']
                };
                const profilePayload: Partial<UserType> = {
                    ...(profile?.firstName ? { firstName: profile.firstName } : {}),
                    ...(profile?.lastName ? { lastName: profile.lastName } : {}),
                    ...(profile?.displayName ? { displayName: profile.displayName } : {}),
                    ...(profile?.contactInfo ? { contactInfo: profile.contactInfo } : {}),
                    ...(profile?.profile ? { profile: profile.profile } : {})
                };
                const created = await this.model.create({
                    ...baseNewUser,
                    ...profilePayload
                });
                // Upsert identities for new user
                if (created && identities && identities.length > 0) {
                    const identityModel = new UserIdentityModel();
                    for (const ident of identities) {
                        const exists = await identityModel.findOne({
                            provider: ident.provider,
                            providerUserId: ident.providerUserId
                        });
                        if (!exists) {
                            await identityModel.create({
                                userId: created.id,
                                provider: ident.provider,
                                providerUserId: ident.providerUserId,
                                email: ident.email,
                                username: ident.username,
                                avatarUrl: ident.avatarUrl,
                                raw: ident.raw,
                                lastLoginAt: ident.lastLoginAt,
                                createdById: actor.id,
                                updatedById: actor.id
                            } as unknown as Record<string, unknown>);
                        }
                    }
                }
                return { user: created as UserType };
            }
        });
    }

    /**
     * Permission: Only super admin can create users.
     */
    protected _canCreate(actor: Actor): void {
        if (actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Only super admin can create users');
        }
    }

    /**
     * Permission: Only super admin can delete users.
     */
    protected _canDelete(actor: Actor): void {
        if (actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Only super admin can delete users');
        }
    }

    /**
     * Permission: Only super admin can restore users.
     */
    protected _canRestore(actor: Actor): void {
        if (actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Only super admin can restore users'
            );
        }
    }

    /**
     * Permission: Only self or super admin can update a user.
     */
    protected _canUpdate(actor: Actor, entity: UserType): void {
        if (actor.role !== RoleEnum.SUPER_ADMIN && actor.id !== entity.id) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Only self or super admin can update user'
            );
        }
    }

    /**
     * Permission: Only super admin or admin can search/list/count users.
     */
    protected _canSearch(actor: Actor): void {
        if (actor.role !== RoleEnum.SUPER_ADMIN && actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Only super admin or admin can search users'
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
     * Permission: Only super admin can manage roles and permissions.
     */
    protected _canManagePermissions(actor: Actor): void {
        if (actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Only super admin can manage permissions'
            );
        }
    }

    /**
     * Permission: Only super admin can soft delete users (stub).
     */
    protected _canSoftDelete(actor: Actor, _entity: UserType): void {
        // TODO: Implement soft delete permission logic if needed
        if (actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Only super admin can soft delete users'
            );
        }
    }

    /**
     * Permission: Only super admin can hard delete users (stub).
     */
    protected _canHardDelete(actor: Actor, _entity: UserType): void {
        // TODO: Implement hard delete permission logic if needed
        if (actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Only super admin can hard delete users'
            );
        }
    }

    /**
     * Permission: Only self or super admin can view a user (stub).
     */
    protected _canView(actor: Actor, entity: UserType): void {
        // TODO: Adjust logic if public view is allowed
        if (actor.role !== RoleEnum.SUPER_ADMIN && actor.id !== entity.id) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Only self or super admin can view user'
            );
        }
    }

    /**
     * Permission: Only super admin can update visibility (stub).
     */
    protected _canUpdateVisibility(actor: Actor, _entity: UserType, _newVisibility: unknown): void {
        // TODO: Implement visibility update permission logic if needed
        if (actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Only super admin can update user visibility'
            );
        }
    }

    // --- Lifecycle Hooks ---

    /**
     * Normalizes and generates slug before creating a user.
     */
    protected async _beforeCreate(
        data: z.infer<typeof CreateUserSchema>,
        _actor: Actor
    ): Promise<Partial<UserType>> {
        return normalizeUserInput(data) as Partial<UserType>;
    }

    /**
     * Normalizes and generates slug before updating a user.
     * Bookmarks are always omitted from the result (even if type allows).
     */
    protected async _beforeUpdate(
        data: Partial<z.infer<typeof UserSchema>>,
        _actor: Actor
    ): Promise<Partial<UserType>> {
        // Remove bookmarks before normalization to avoid type errors
        const { bookmarks, ...rest } = data;
        return normalizeUserInput(rest) as Partial<UserType>;
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
        params: { userId: string; role: RoleEnum }
    ): Promise<ServiceOutput<{ user: UserType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'assignRole',
            input: { ...params, actor },
            schema: AssignRoleSchema,
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
        params: { userId: string; permission: PermissionEnum }
    ): Promise<ServiceOutput<{ user: UserType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addPermission',
            input: { ...params, actor },
            schema: AddPermissionSchema,
            execute: async ({ userId, permission }, actor) => {
                this._canManagePermissions(actor);
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
        params: { userId: string; permission: PermissionEnum }
    ): Promise<ServiceOutput<{ user: UserType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removePermission',
            input: { ...params, actor },
            schema: RemovePermissionSchema,
            execute: async ({ userId, permission }, actor) => {
                this._canManagePermissions(actor);
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
        params: { userId: string; permissions: PermissionEnum[] }
    ): Promise<ServiceOutput<{ user: UserType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'setPermissions',
            input: { ...params, actor },
            schema: SetPermissionsSchema,
            execute: async ({ userId, permissions }, actor) => {
                this._canManagePermissions(actor);
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
     * Executes a search for users.
     * @param params - The validated and processed search parameters (filters, pagination, etc.)
     * @returns Paginated list of users matching the criteria
     */
    protected async _executeSearch(params: z.infer<typeof UserFilterInputSchema>, _actor: Actor) {
        const { filters = {}, pagination } = params;
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;
        return this.model.findAll(filters, { page, pageSize });
    }

    /**
     * Executes a count for users.
     * @param params - The validated and processed search parameters (filters, pagination, etc.)
     * @returns Count of users matching the criteria
     */
    protected async _executeCount(params: z.infer<typeof UserFilterInputSchema>, _actor: Actor) {
        const { filters = {} } = params;
        const count = await this.model.count(filters);
        return { count };
    }
}
