import type { RRolePermissionModel, RUserPermissionModel } from '@repo/db';
import type {
    PermissionEnum,
    RoleEnum,
    RolePermissionAssignmentType,
    UserId,
    UserPermissionAssignmentType
} from '@repo/types';
import { ServiceErrorCode } from '@repo/types';
import { BaseService } from '../../base/base.service';
import type { Actor, ServiceContext, ServiceLogger, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { canManagePermissions } from './permission.service.permission';
import {
    type AssignPermissionToRoleInput,
    AssignPermissionToRoleSchema,
    type AssignPermissionToUserInput,
    AssignPermissionToUserSchema,
    type GetPermissionsForRoleInput,
    GetPermissionsForRoleSchema,
    type GetPermissionsForUserInput,
    GetPermissionsForUserSchema,
    type GetRolesForPermissionInput,
    GetRolesForPermissionSchema,
    type GetUsersForPermissionInput,
    GetUsersForPermissionSchema
} from './permission.service.schema';
// import * as normalizers from './permission.service.normalizer'; // Uncomment if/when normalizers are needed

/**
 * PermissionService: manages assignment/removal of permissions to roles/users and querying those relationships.
 * Extends BaseService for logging, validation, and homogeneity. Does NOT provide CRUD for permissions/roles.
 */
export class PermissionService extends BaseService {
    public static readonly ENTITY_NAME = 'permission';
    protected readonly entityName = PermissionService.ENTITY_NAME;
    protected readonly logger: ServiceLogger;
    private readonly rolePermissionModel: RRolePermissionModel;
    private readonly userPermissionModel: RUserPermissionModel;

    /**
     * @param ctx Service context (must include logger)
     * @param models Object with rolePermissionModel and userPermissionModel
     */
    constructor(
        ctx: ServiceContext,
        models: {
            rolePermissionModel: RRolePermissionModel;
            userPermissionModel: RUserPermissionModel;
        }
    ) {
        super(ctx, PermissionService.ENTITY_NAME);
        this.logger = ctx.logger;
        this.rolePermissionModel = models.rolePermissionModel;
        this.userPermissionModel = models.userPermissionModel;
    }

    /**
     * Assigns a permission to a role.
     * @param actor The actor performing the action
     * @param input { role, permission }
     * @returns ServiceOutput<{ assigned: boolean }>
     */
    public async assignPermissionToRole(
        actor: Actor,
        input: AssignPermissionToRoleInput
    ): Promise<ServiceOutput<{ assigned: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'assignPermissionToRole',
            input: { actor, ...input },
            schema: AssignPermissionToRoleSchema,
            execute: async ({ role, permission }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const exists = await this.rolePermissionModel.findOne({ role, permission });
                if (exists) return { assigned: false };
                await this.rolePermissionModel.create({ role, permission });
                return { assigned: true };
            }
        });
    }

    /**
     * Removes a permission from a role.
     * @param actor The actor performing the action
     * @param input { role, permission }
     * @returns ServiceOutput<{ removed: boolean }>
     */
    public async removePermissionFromRole(
        actor: Actor,
        input: AssignPermissionToRoleInput
    ): Promise<ServiceOutput<{ removed: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removePermissionFromRole',
            input: { actor, ...input },
            schema: AssignPermissionToRoleSchema,
            execute: async ({ role, permission }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const exists = await this.rolePermissionModel.findOne({ role, permission });
                if (!exists) return { removed: false };
                await this.rolePermissionModel.hardDelete({ role, permission });
                return { removed: true };
            }
        });
    }

    /**
     * Assigns a permission to a user.
     * @param actor The actor performing the action
     * @param input { userId, permission }
     * @returns ServiceOutput<{ assigned: boolean }>
     */
    public async assignPermissionToUser(
        actor: Actor,
        input: AssignPermissionToUserInput
    ): Promise<ServiceOutput<{ assigned: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'assignPermissionToUser',
            input: { actor, ...input },
            schema: AssignPermissionToUserSchema,
            execute: async ({ userId, permission }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const user = userId as UserId;
                const exists = await this.userPermissionModel.findOne({ userId: user, permission });
                if (exists) return { assigned: false };
                await this.userPermissionModel.create({ userId: user, permission });
                return { assigned: true };
            }
        });
    }

    /**
     * Removes a permission from a user.
     * @param actor The actor performing the action
     * @param input { userId, permission }
     * @returns ServiceOutput<{ removed: boolean }>
     */
    public async removePermissionFromUser(
        actor: Actor,
        input: AssignPermissionToUserInput
    ): Promise<ServiceOutput<{ removed: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removePermissionFromUser',
            input: { actor, ...input },
            schema: AssignPermissionToUserSchema,
            execute: async ({ userId, permission }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const user = userId as UserId;
                const exists = await this.userPermissionModel.findOne({ userId: user, permission });
                if (!exists) return { removed: false };
                await this.userPermissionModel.hardDelete({ userId: user, permission });
                return { removed: true };
            }
        });
    }

    /**
     * Gets all permissions assigned to a role.
     * @param actor The actor performing the action
     * @param input { role }
     * @returns ServiceOutput<{ permissions: PermissionEnum[] }>
     */
    public async getPermissionsForRole(
        actor: Actor,
        input: GetPermissionsForRoleInput
    ): Promise<ServiceOutput<{ permissions: PermissionEnum[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPermissionsForRole',
            input: { actor, ...input },
            schema: GetPermissionsForRoleSchema,
            execute: async ({ role }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const { items } = await this.rolePermissionModel.findAll({ role });
                const permissions = items.map((a: RolePermissionAssignmentType) => a.permission);
                return { permissions };
            }
        });
    }

    /**
     * Gets all permissions assigned to a user.
     * @param actor The actor performing the action
     * @param input { userId }
     * @returns ServiceOutput<{ permissions: PermissionEnum[] }>
     */
    public async getPermissionsForUser(
        actor: Actor,
        input: GetPermissionsForUserInput
    ): Promise<ServiceOutput<{ permissions: PermissionEnum[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPermissionsForUser',
            input: { actor, ...input },
            schema: GetPermissionsForUserSchema,
            execute: async ({ userId }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const user = userId as UserId;
                const { items } = await this.userPermissionModel.findAll({ userId: user });
                const permissions = items.map((a: UserPermissionAssignmentType) => a.permission);
                return { permissions };
            }
        });
    }

    /**
     * Gets all roles that have a given permission.
     * @param actor The actor performing the action
     * @param input { permission }
     * @returns ServiceOutput<{ roles: RoleEnum[] }>
     */
    public async getRolesForPermission(
        actor: Actor,
        input: GetRolesForPermissionInput
    ): Promise<ServiceOutput<{ roles: RoleEnum[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getRolesForPermission',
            input: { actor, ...input },
            schema: GetRolesForPermissionSchema,
            execute: async ({ permission }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const { items } = await this.rolePermissionModel.findAll({ permission });
                const roles = items.map((a: RolePermissionAssignmentType) => a.role);
                return { roles };
            }
        });
    }

    /**
     * Gets all users that have a given permission.
     * @param actor The actor performing the action
     * @param input { permission }
     * @returns ServiceOutput<{ users: UserId[] }>
     */
    public async getUsersForPermission(
        actor: Actor,
        input: GetUsersForPermissionInput
    ): Promise<ServiceOutput<{ users: UserId[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getUsersForPermission',
            input: { actor, ...input },
            schema: GetUsersForPermissionSchema,
            execute: async ({ permission }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const { items } = await this.userPermissionModel.findAll({ permission });
                const users = items.map((a: UserPermissionAssignmentType) => a.userId);
                return { users };
            }
        });
    }
}
