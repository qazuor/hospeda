import { RRolePermissionModel } from '@repo/db/models/user/rRolePermission.model';
import { RUserPermissionModel } from '@repo/db/models/user/rUserPermission.model';
import { UserModel } from '@repo/db/models/user/user.model';
import { UserSchema } from '@repo/schemas/entities/user/user.schema';
import { PermissionEnumSchema, RoleEnumSchema } from '@repo/schemas/enums';
import type {
    NewUserInputType,
    RolePermissionAssignmentType,
    UpdateUserInputType,
    UserId,
    UserPermissionAssignmentType,
    UserType
} from '@repo/types';
import { PermissionEnum, type RoleEnum } from '@repo/types';
import { toSlug } from '@repo/utils';
import z from 'zod';
import { BaseService } from '../../base/base.service';
import type {
    Actor,
    CanCreateResult,
    CanDeleteResult,
    CanHardDeleteResult,
    CanRestoreResult,
    CanUpdateResult,
    CanViewResult,
    ServiceInput,
    ServiceOutput
} from '../../types';
import { EntityPermissionReasonEnum } from '../../types';

/**
 * UserService provides business logic and permission management for users.
 * Inherits CRUD and listing logic from BaseService.
 *
 * Custom methods:
 * - getByEmail: Find a user by email address.
 * - setRole: Assign or change a user's role.
 * - addPermission: Add a direct permission to a user.
 * - removePermission: Remove a direct permission from a user.
 * - getPermissions: Retrieve all permissions (direct + inherited from role).
 */
export class UserService extends BaseService<
    UserType,
    NewUserInputType,
    UpdateUserInputType,
    unknown,
    UserType[]
> {
    /**
     * The main user model for database operations.
     */
    protected model = new UserModel();
    /**
     * Model for managing direct user permissions.
     */
    protected userPermissionModel = new RUserPermissionModel();
    /**
     * Model for managing role-based permissions.
     */
    protected rolePermissionModel = new RRolePermissionModel();
    /**
     * Zod schema for validating user input.
     */
    protected inputSchema = UserSchema as unknown as z.ZodType<NewUserInputType>;

    /**
     * Generates a unique, URL-friendly slug for a user based on their name.
     * If the slug already exists (as determined by the provided callback),
     * appends an incremental suffix (-2, -3, ...).
     *
     * @param _type - Entity type (ignored in this context)
     * @param name - The user's name to generate the slug from
     * @param checkSlugExists - Async callback to check if a slug exists (returns true if exists)
     * @returns The generated unique slug string
     * @throws {Error} If name is empty
     */
    public async generateSlug(
        _type: string,
        name: string,
        checkSlugExists: (slug: string) => Promise<boolean>
    ): Promise<string> {
        if (!name) {
            throw new Error('Name must be provided to generate a slug');
        }
        const baseSlug = toSlug(`${name}`);
        let slug = baseSlug;
        let i = 2;
        while (await checkSlugExists(slug)) {
            slug = `${baseSlug}-${i++}`;
        }
        return slug;
    }

    /**
     * Finds a user by their email address.
     *
     * @param input - The input object containing the email address.
     * @returns A ServiceOutput containing the user if found, null if not found, or an error if validation fails.
     */
    public async getByEmail(
        input: ServiceInput<{ email: string }>
    ): Promise<ServiceOutput<UserType | null>> {
        return this.runWithLoggingAndValidation<{ email: string }, UserType | null>(
            'getByEmail',
            input,
            async (_actor, input) => {
                const emailSchema = z.string().email();
                if (!input.email || typeof input.email !== 'string') {
                    throw new Error('Email is required and must be a string');
                }
                const parsed = emailSchema.safeParse(input.email);
                if (!parsed.success) {
                    throw new Error('Invalid email');
                }
                return this.model.findOne({ email: input.email });
            }
        );
    }

    /**
     * Sets the role of a user.
     *
     * @param input - The input object containing the user ID and the new role.
     * @returns A ServiceOutput containing the updated user or an error if validation fails or the user is not found.
     */
    public async setRole(
        input: ServiceInput<{ userId: UserId; role: RoleEnum }>
    ): Promise<ServiceOutput<UserType>> {
        return this.runWithLoggingAndValidation<{ userId: UserId; role: RoleEnum }, UserType>(
            'setRole',
            input,
            async (_actor, input) => {
                if (!input.userId || !input.role) {
                    throw new Error('userId and role are required');
                }
                const parsed = RoleEnumSchema.safeParse(input.role);
                if (!parsed.success) {
                    throw new Error('Invalid role');
                }
                const user = await this.model.findById(input.userId);
                if (!user) throw new Error('User not found');
                if (user.role === input.role) return user;
                await this.model.update({ id: input.userId }, { role: input.role });
                return { ...user, role: input.role };
            }
        );
    }

    /**
     * Adds a direct permission to a user (if not already present).
     *
     * @param input - The input object containing the user ID and the permission to add.
     * @returns A ServiceOutput containing the updated user or an error if validation fails or the user is not found.
     */
    public async addPermission(
        input: ServiceInput<{ userId: UserId; permission: PermissionEnum }>
    ): Promise<ServiceOutput<UserType>> {
        return this.runWithLoggingAndValidation<
            { userId: UserId; permission: PermissionEnum },
            UserType
        >('addPermission', input, async (_actor, input) => {
            if (!input.userId || !input.permission) {
                throw new Error('userId and permission are required');
            }
            const parsed = PermissionEnumSchema.safeParse(input.permission);
            if (!parsed.success) {
                throw new Error('Invalid permission');
            }
            const user = await this.model.findById(input.userId);
            if (!user) throw new Error('User not found');
            const existing = await this.userPermissionModel.findOne({
                userId: input.userId,
                permission: input.permission
            });
            if (!existing) {
                await this.userPermissionModel.create({
                    userId: input.userId,
                    permission: input.permission
                });
            }
            const updatedUser = await this.model.findById(input.userId);
            if (!updatedUser) throw new Error('User not found after permission update');
            return updatedUser;
        });
    }

    /**
     * Removes a direct permission from a user.
     *
     * @param input - The input object containing the user ID and the permission to remove.
     * @returns A ServiceOutput containing the updated user or an error if validation fails or the user is not found.
     */
    public async removePermission(
        input: ServiceInput<{ userId: UserId; permission: PermissionEnum }>
    ): Promise<ServiceOutput<UserType>> {
        return this.runWithLoggingAndValidation<
            { userId: UserId; permission: PermissionEnum },
            UserType
        >('removePermission', input, async (_actor, input) => {
            if (!input.userId || !input.permission) {
                throw new Error('userId and permission are required');
            }
            const parsed = PermissionEnumSchema.safeParse(input.permission);
            if (!parsed.success) {
                throw new Error('Invalid permission');
            }
            const user = await this.model.findById(input.userId);
            if (!user) throw new Error('User not found');
            await this.userPermissionModel.hardDelete({
                userId: input.userId,
                permission: input.permission
            });
            const updatedUser = await this.model.findById(input.userId);
            if (!updatedUser) throw new Error('User not found after permission removal');
            return updatedUser;
        });
    }

    /**
     * Retrieves the complete list of permissions for a user, including both direct permissions and those inherited from the user's role.
     *
     * @param input - The input object containing the user ID.
     * @returns A ServiceOutput containing an array of PermissionEnum (no duplicates) or an error if validation fails or the user is not found.
     */
    public async getPermissions(
        input: ServiceInput<{ userId: UserId }>
    ): Promise<ServiceOutput<PermissionEnum[]>> {
        return this.runWithLoggingAndValidation<{ userId: UserId }, PermissionEnum[]>(
            'getPermissions',
            input,
            async (_actor, input) => {
                if (!input.userId) {
                    throw new Error('userId is required');
                }
                const user = await this.model.findById(input.userId);
                if (!user) throw new Error('User not found');
                // Get direct permissions
                const directPermsRaw = await this.userPermissionModel.findAll({
                    userId: input.userId
                });
                const directPerms: UserPermissionAssignmentType[] = Array.isArray(directPermsRaw)
                    ? directPermsRaw
                    : 'items' in directPermsRaw
                      ? directPermsRaw.items
                      : [];
                const direct = directPerms.map((p: UserPermissionAssignmentType) => p.permission);
                // Get role permissions
                const rolePermsRaw = await this.rolePermissionModel.findAll({ role: user.role });
                const rolePerms: RolePermissionAssignmentType[] = Array.isArray(rolePermsRaw)
                    ? rolePermsRaw
                    : 'items' in rolePermsRaw
                      ? rolePermsRaw.items
                      : [];
                const fromRole = rolePerms.map((p: RolePermissionAssignmentType) => p.permission);
                // Merge and deduplicate
                return Array.from(new Set([...direct, ...fromRole]));
            }
        );
    }

    // --- BaseService required methods (minimal implementations) ---

    /**
     * Checks if the actor can view the given user entity.
     * @param _actor - The actor performing the action.
     * @param _entity - The user entity to check.
     * @returns An object indicating if the entity can be viewed and the reason.
     */
    protected async canViewEntity(_actor: Actor, _entity: UserType): Promise<CanViewResult> {
        return { canView: true, reason: EntityPermissionReasonEnum.PUBLIC_ACCESS };
    }
    /**
     * Checks if the actor can update the given user entity.
     * @param _actor - The actor performing the action.
     * @param _entity - The user entity to check.
     * @returns An object indicating if the entity can be updated and the reason.
     */
    protected async canUpdateEntity(_actor: Actor, _entity: UserType): Promise<CanUpdateResult> {
        return { canUpdate: true, reason: EntityPermissionReasonEnum.OWNER };
    }
    /**
     * Checks if the actor can delete the given user entity.
     * @param _actor - The actor performing the action.
     * @param _entity - The user entity to check.
     * @returns An object indicating if the entity can be deleted and the reason.
     */
    protected async canDeleteEntity(_actor: Actor, _entity: UserType): Promise<CanDeleteResult> {
        return { canDelete: true, reason: EntityPermissionReasonEnum.OWNER };
    }
    /**
     * Checks if the actor can create a new user entity.
     * @param _actor - The actor performing the action.
     * @returns An object indicating if the entity can be created and the reason.
     */
    protected async canCreateEntity(_actor: Actor): Promise<CanCreateResult> {
        return { canCreate: true, reason: EntityPermissionReasonEnum.PUBLIC_ACCESS };
    }
    /**
     * Checks if the actor can restore the given user entity.
     * @param _actor - The actor performing the action.
     * @param _entity - The user entity to check.
     * @returns An object indicating if the entity can be restored and the reason.
     */
    protected async canRestoreEntity(_actor: Actor, _entity: UserType): Promise<CanRestoreResult> {
        return { canRestore: false, reason: EntityPermissionReasonEnum.DENIED };
    }
    /**
     * Checks if the actor can hard-delete the given user entity.
     * @param _actor - The actor performing the action.
     * @param _entity - The user entity to check.
     * @returns An object indicating if the entity can be hard-deleted, the reason, and the checked permission.
     */
    protected canHardDeleteEntity(_actor: Actor, _entity: UserType): CanHardDeleteResult {
        return {
            canHardDelete: false,
            reason: EntityPermissionReasonEnum.DENIED,
            checkedPermission: PermissionEnum.USER_UPDATE_ROLES
        };
    }
    /**
     * Normalizes the input for creating a new user entity.
     * @param input - The input object for user creation.
     * @returns The normalized input object.
     */
    protected async normalizeCreateInput(input: NewUserInputType): Promise<NewUserInputType> {
        return input;
    }
    /**
     * Normalizes the input for updating a user entity.
     * @param input - The input object for user update.
     * @returns The normalized input object.
     */
    protected async normalizeUpdateInput(input: UpdateUserInputType): Promise<UpdateUserInputType> {
        return input;
    }
    /**
     * Normalizes the input for listing user entities.
     * @param input - The input object for listing users.
     * @returns The normalized input object.
     */
    protected async normalizeListInput(input: unknown): Promise<unknown> {
        return input;
    }
    /**
     * Lists all user entities.
     * @param _input - The input object for listing users (unused).
     * @returns An array of all user entities.
     */
    protected async listEntities(_input: unknown): Promise<UserType[]> {
        return this.model.findAll({}) as Promise<UserType[]>;
    }
}
