import type { RRolePermissionModel, RUserPermissionModel } from '@repo/db';
import type { RolePermissionAssignment, UserIdType, UserPermissionAssignment } from '@repo/schemas';
import {
    type PermissionAssignmentOutput,
    type PermissionRemovalOutput,
    type PermissionsByRoleInput,
    PermissionsByRoleInputSchema,
    type PermissionsByUserInput,
    PermissionsByUserInputSchema,
    type PermissionsQueryOutput,
    type RolePermissionManagementInput,
    RolePermissionManagementInputSchema,
    type RolesByPermissionInput,
    RolesByPermissionInputSchema,
    type RolesQueryOutput,
    ServiceErrorCode,
    type UserPermissionManagementInput,
    UserPermissionManagementInputSchema,
    type UsersByPermissionInput,
    UsersByPermissionInputSchema,
    type UsersQueryOutput
} from '@repo/schemas';
import { BaseService } from '../../base/base.service';
import type { Actor, ServiceContext, ServiceLogger, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { serviceLogger } from '../../utils';
import { canManagePermissions } from './permission.service.permission';
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
        this.logger = ctx.logger ?? serviceLogger;
        this.rolePermissionModel = models.rolePermissionModel;
        this.userPermissionModel = models.userPermissionModel;
    }

    /**
     * Assigns a permission to a role.
     * @param actor The actor performing the action
     * @param input { role, permission }
     * @returns ServiceOutput<PermissionAssignmentOutput>
     */
    public async assignPermissionToRole(
        actor: Actor,
        input: RolePermissionManagementInput
    ): Promise<ServiceOutput<PermissionAssignmentOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'assignPermissionToRole',
            input: { actor, ...input },
            schema: RolePermissionManagementInputSchema,
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
     * @returns ServiceOutput<PermissionRemovalOutput>
     */
    public async removePermissionFromRole(
        actor: Actor,
        input: RolePermissionManagementInput
    ): Promise<ServiceOutput<PermissionRemovalOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removePermissionFromRole',
            input: { actor, ...input },
            schema: RolePermissionManagementInputSchema,
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
     * @returns ServiceOutput<PermissionAssignmentOutput>
     */
    public async assignPermissionToUser(
        actor: Actor,
        input: UserPermissionManagementInput
    ): Promise<ServiceOutput<PermissionAssignmentOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'assignPermissionToUser',
            input: { actor, ...input },
            schema: UserPermissionManagementInputSchema,
            execute: async ({ userId, permission }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const user = userId as UserIdType;
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
     * @returns ServiceOutput<PermissionRemovalOutput>
     */
    public async removePermissionFromUser(
        actor: Actor,
        input: UserPermissionManagementInput
    ): Promise<ServiceOutput<PermissionRemovalOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removePermissionFromUser',
            input: { actor, ...input },
            schema: UserPermissionManagementInputSchema,
            execute: async ({ userId, permission }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const user = userId as UserIdType;
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
     * @returns ServiceOutput<PermissionsQueryOutput>
     */
    public async getPermissionsForRole(
        actor: Actor,
        input: PermissionsByRoleInput
    ): Promise<ServiceOutput<PermissionsQueryOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPermissionsForRole',
            input: { actor, ...input },
            schema: PermissionsByRoleInputSchema,
            execute: async ({ role }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const { items } = await this.rolePermissionModel.findAll({ role });
                const permissions = items.map((a: RolePermissionAssignment) => a.permission);
                return { permissions };
            }
        });
    }

    /**
     * Gets all permissions assigned to a user.
     * @param actor The actor performing the action
     * @param input { userId }
     * @returns ServiceOutput<PermissionsQueryOutput>
     */
    public async getPermissionsForUser(
        actor: Actor,
        input: PermissionsByUserInput
    ): Promise<ServiceOutput<PermissionsQueryOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPermissionsForUser',
            input: { actor, ...input },
            schema: PermissionsByUserInputSchema,
            execute: async ({ userId }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const user = userId as UserIdType;
                const { items } = await this.userPermissionModel.findAll({ userId: user });
                const permissions = items.map((a: UserPermissionAssignment) => a.permission);
                return { permissions };
            }
        });
    }

    /**
     * Gets all roles that have a given permission.
     * @param actor The actor performing the action
     * @param input { permission }
     * @returns ServiceOutput<RolesQueryOutput>
     */
    public async getRolesForPermission(
        actor: Actor,
        input: RolesByPermissionInput
    ): Promise<ServiceOutput<RolesQueryOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getRolesForPermission',
            input: { actor, ...input },
            schema: RolesByPermissionInputSchema,
            execute: async ({ permission }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const { items } = await this.rolePermissionModel.findAll({ permission });
                const roles = items.map((a: RolePermissionAssignment) => a.role);
                return { roles };
            }
        });
    }

    /**
     * Gets all users that have a given permission.
     * @param actor The actor performing the action
     * @param input { permission }
     * @returns ServiceOutput<UsersQueryOutput>
     */
    public async getUsersForPermission(
        actor: Actor,
        input: UsersByPermissionInput
    ): Promise<ServiceOutput<UsersQueryOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getUsersForPermission',
            input: { actor, ...input },
            schema: UsersByPermissionInputSchema,
            execute: async ({ permission }, actor) => {
                if (!canManagePermissions(actor)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'You do not have permission to manage permissions.'
                    );
                }
                const { items } = await this.userPermissionModel.findAll({ permission });
                const users = items.map((a: UserPermissionAssignment) => a.userId);
                return { users };
            }
        });
    }
}
