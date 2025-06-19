import { withTransaction } from '@repo/db/client';
import { RRolePermissionModel } from '@repo/db/models/user/rRolePermission.model';
import { RUserPermissionModel } from '@repo/db/models/user/rUserPermission.model';
import { UserModel } from '@repo/db/models/user/user.model';
import type {
    PermissionEnum as PermissionEnumType,
    RoleEnum as RoleEnumType,
    UserId,
    UserPermissionAssignmentType,
    UserType
} from '@repo/types';
import { PermissionEnum, RoleEnum } from '@repo/types';
import type { Actor, ServiceInput, ServiceOutput } from '../../types';
import { ServiceErrorCode } from '../../types';

const ADMIN_PERMISSIONS: PermissionEnumType[] = [
    PermissionEnum.USER_UPDATE_ROLES,
    PermissionEnum.USER_CREATE,
    PermissionEnum.USER_DELETE,
    PermissionEnum.USER_READ_ALL,
    PermissionEnum.USER_IMPERSONATE
];

/**
 * PermissionService centralizes all logic for managing user and role permissions.
 * Provides methods for querying, assigning, revoking, and listing permissions and roles.
 */
export class PermissionService {
    private userModel = new UserModel();
    private userPermissionModel = new RUserPermissionModel();
    private rolePermissionModel = new RRolePermissionModel();

    /**
     * Returns all direct permissions assigned to a user.
     * View: super admin, admin, the user themselves, or user with admin permission.
     */
    public async getUserPermissions(
        input: ServiceInput<{ userId: string }>
    ): Promise<ServiceOutput<PermissionEnumType[]>> {
        const { actor, userId } = input;
        if (!this.canViewUserPermissions(actor, userId)) {
            return {
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: "You do not have permission to view this user's permissions."
                }
            };
        }
        const assignments = await this.userPermissionModel.findAll({ userId: userId as UserId });
        const arr: { permission: PermissionEnumType }[] = Array.isArray(assignments)
            ? assignments
            : 'items' in assignments && Array.isArray(assignments.items)
              ? assignments.items
              : [];
        return { data: arr.map((a) => a.permission) };
    }

    /**
     * Assigns a permission to a user.
     * Edit: super admin, admin, or user with admin permission.
     */
    public async addPermissionToUser(
        input: ServiceInput<{ userId: string; permission: PermissionEnumType }>
    ): Promise<ServiceOutput<void>> {
        const { actor, userId, permission } = input;
        if (!this.canEditPermissions(actor)) {
            return {
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'You do not have permission to modify user permissions.'
                }
            };
        }
        const brandedUserId = userId as UserId;
        const existing = await this.userPermissionModel.findOne({
            userId: brandedUserId,
            permission
        });
        if (existing) {
            return {
                error: {
                    code: ServiceErrorCode.ALREADY_EXISTS,
                    message: `Permission '${permission}' is already assigned to user '${userId}'.`
                }
            };
        }
        await this.userPermissionModel.create({ userId: brandedUserId, permission });
        return { data: undefined };
    }

    /**
     * Removes a permission from a user.
     * Edit: super admin, admin, or user with admin permission.
     */
    public async removePermissionFromUser(
        input: ServiceInput<{ userId: string; permission: PermissionEnumType }>
    ): Promise<ServiceOutput<void>> {
        const { actor, userId, permission } = input;
        if (!this.canEditPermissions(actor)) {
            return {
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'You do not have permission to modify user permissions.'
                }
            };
        }
        const brandedUserId = userId as UserId;
        const existing = await this.userPermissionModel.findOne({
            userId: brandedUserId,
            permission
        });
        if (!existing) {
            return {
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: `Permission '${permission}' is not assigned to user '${userId}'.`
                }
            };
        }
        await this.userPermissionModel.hardDelete({
            userId: brandedUserId,
            permission
        });
        return { data: undefined };
    }

    /**
     * Sets the full list of permissions for a user (overwrites existing).
     * Edit: super admin, admin, or user with admin permission.
     */
    public async setUserPermissions(
        input: ServiceInput<{ userId: string; permissions: PermissionEnumType[] }>
    ): Promise<ServiceOutput<void>> {
        const { actor, userId, permissions } = input;
        if (!this.canEditPermissions(actor)) {
            return {
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'You do not have permission to modify user permissions.'
                }
            };
        }

        const brandedUserId = userId as UserId;

        try {
            await withTransaction(async (tx) => {
                // Eliminar permisos existentes
                await this.userPermissionModel.hardDelete({ userId: brandedUserId }, tx);

                // Crear nuevos permisos
                for (const permission of permissions) {
                    await this.userPermissionModel.create(
                        {
                            userId: brandedUserId,
                            permission
                        },
                        tx
                    );
                }
            });

            return { data: undefined };
        } catch (error) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Failed to set user permissions: ${(error as Error).message}`
                }
            };
        }
    }

    /**
     * Returns all users who have a given permission directly assigned.
     * View: super admin, admin, or user with admin permission.
     */
    public async listUsersByPermission(
        input: ServiceInput<{ permission: PermissionEnumType }>
    ): Promise<ServiceOutput<UserType[]>> {
        const { actor, permission } = input;

        if (!this.canEditPermissions(actor)) {
            return {
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'You do not have permission to list users by permission.'
                }
            };
        }

        try {
            // Obtener todos los assignments del permiso
            const result = await this.userPermissionModel.findAll({ permission });
            const assignments = 'items' in result ? result.items : result;

            if (assignments.length === 0) {
                return { data: [] };
            }

            // Extraer los userIds
            const userIds = assignments.map((a: UserPermissionAssignmentType) => a.userId);

            // Buscar los usuarios correspondientes
            const users = await Promise.all(
                userIds.map((userId: string) => this.userModel.findOne({ id: userId }))
            );

            // Filtrar los nulls y usuarios eliminados
            const validUsers = users.filter(
                (user: UserType | null): user is UserType => user !== null && !user.deletedAt
            );

            return { data: validUsers };
        } catch (error) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Failed to list users by permission: ${(error as Error).message}`
                }
            };
        }
    }

    /**
     * Returns all users with a given role.
     */
    public async listUsersByRole(_role: RoleEnumType): Promise<UserType[]> {
        // Implementation
        return [];
    }

    /**
     * Returns all available roles.
     */
    public listRoles(): RoleEnumType[] {
        // Implementation
        return Object.values(RoleEnum);
    }

    /**
     * Returns all permissions assigned to a role.
     */
    public async getRolePermissions(role: RoleEnumType): Promise<PermissionEnumType[]> {
        const assignments = await this.rolePermissionModel.findAll({ role });
        const arr: { permission: PermissionEnumType }[] = Array.isArray(assignments)
            ? assignments
            : 'items' in assignments && Array.isArray(assignments.items)
              ? assignments.items
              : [];
        return arr.map((a) => a.permission);
    }

    /**
     * Assigns a permission to a role.
     */
    public async addPermissionToRole(
        role: RoleEnumType,
        permission: PermissionEnumType
    ): Promise<void> {
        const existing = await this.rolePermissionModel.findOne({ role, permission });
        if (existing) return;

        await this.rolePermissionModel.create({ role, permission });
    }

    /**
     * Removes a permission from a role.
     */
    public async removePermissionFromRole(
        role: RoleEnumType,
        permission: PermissionEnumType
    ): Promise<void> {
        await this.rolePermissionModel.hardDelete({ role, permission });
    }

    /**
     * Sets the full list of permissions for a role (overwrites existing).
     */
    public async setRolePermissions(
        role: RoleEnumType,
        permissions: PermissionEnumType[]
    ): Promise<void> {
        await withTransaction(async (tx) => {
            // Eliminar permisos existentes
            await this.rolePermissionModel.hardDelete({ role }, tx);

            // Crear nuevos permisos
            for (const permission of permissions) {
                await this.rolePermissionModel.create({ role, permission }, tx);
            }
        });
    }

    /**
     * Returns all effective permissions for a user (from direct assignments and roles).
     */
    public async getEffectivePermissions(userId: string): Promise<PermissionEnumType[]> {
        const [directPermissions, user] = await Promise.all([
            this.getUserPermissions({
                actor: { id: userId, role: RoleEnum.USER, permissions: [] },
                userId
            }),
            this.userModel.findOne({ id: userId as UserId })
        ]);

        if (!user || directPermissions.error) {
            return [];
        }

        const rolePermissions = await this.getRolePermissions(user.role);
        const allPermissions = new Set([...directPermissions.data, ...rolePermissions]);

        return Array.from(allPermissions);
    }

    /**
     * Checks if a user has a specific permission (either directly or through a role).
     */
    public async userHasPermission(
        userId: string,
        permission: PermissionEnumType
    ): Promise<boolean> {
        const permissions = await this.getEffectivePermissions(userId);
        return permissions.includes(permission);
    }

    /**
     * Checks if a user has a specific role.
     */
    public async userHasRole(userId: string, role: RoleEnumType): Promise<boolean> {
        const user = await this.userModel.findOne({ id: userId as UserId });
        return user?.role === role;
    }

    /**
     * Generic permission check for any action on any entity.
     */
    public async canUser(userId: string, action: string): Promise<boolean> {
        return this.userHasPermission(userId, action as PermissionEnumType);
    }

    // --- Permission helpers ---
    private canEditPermissions(actor: Actor): boolean {
        return (
            actor.role === RoleEnum.SUPER_ADMIN ||
            actor.role === RoleEnum.ADMIN ||
            actor.permissions?.some((p) => ADMIN_PERMISSIONS.includes(p))
        );
    }

    private canViewUserPermissions(actor: Actor, userId: string): boolean {
        return (
            actor.role === RoleEnum.SUPER_ADMIN ||
            actor.role === RoleEnum.ADMIN ||
            actor.id === userId ||
            actor.permissions?.some((p) => ADMIN_PERMISSIONS.includes(p))
        );
    }
}
