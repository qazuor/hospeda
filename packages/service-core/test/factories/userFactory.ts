import type { PermissionEnum, RoleEnum, User } from '@repo/schemas';
import { LifecycleStatusEnum, RoleEnum as RoleEnumImpl, VisibilityEnum } from '@repo/schemas';
import { BaseFactoryBuilder } from './baseEntityFactory';
import { getMockId } from './utilsFactory';

/**
 * Base user object for test factories.
 */
const baseUser: User = {
    id: getMockId('user') as string,
    slug: 'test-user',
    displayName: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    birthDate: new Date('1990-01-01'),
    contactInfo: undefined,
    location: undefined,
    socialNetworks: undefined,
    role: RoleEnumImpl.USER,
    permissions: [],
    profile: undefined,
    settings: undefined,
    bookmarks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: getMockId('user') as string,
    updatedById: getMockId('user') as string,
    deletedById: undefined,
    adminInfo: { favorite: false },
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC
};

/**
 * Builder for UserType test data.
 * Supports fluent .with() and role/permission helpers.
 */
export class UserFactoryBuilder extends BaseFactoryBuilder<User> {
    constructor() {
        super(baseUser);
    }
    public withRole(role: RoleEnum) {
        return this.with({ role });
    }
    public withPermissions(permissions: PermissionEnum[]) {
        return this.with({ permissions });
    }
    public withDisplayName(displayName: string) {
        return this.with({ displayName });
    }
    public admin() {
        return this.withRole(RoleEnumImpl.ADMIN);
    }
    public superAdmin() {
        return this.withRole(RoleEnumImpl.SUPER_ADMIN);
    }
    public guest() {
        return this.withRole(RoleEnumImpl.GUEST);
    }
}

/**
 * Quick one-off user creation with overrides.
 */
export const createMockUser = (overrides: Partial<User> = {}): User => {
    // Forzar permissions a [] si no se provee en overrides
    const safeOverrides = {
        ...overrides,
        permissions: overrides.permissions ?? []
    };
    return new UserFactoryBuilder().with(safeOverrides).build();
};

/**
 * Creates user data for creation (omits server-generated fields).
 * Use this for testing the create method.
 */
export const createMockUserCreateInput = (
    overrides: Partial<User> = {}
): Omit<
    User,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'
    | 'createdById'
    | 'updatedById'
    | 'deletedById'
    | 'bookmarks'
> => {
    const user = createMockUser(overrides);
    const {
        id,
        createdAt,
        updatedAt,
        deletedAt,
        createdById,
        updatedById,
        deletedById,
        bookmarks,
        ...userForCreation
    } = user;
    return userForCreation;
};

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use createMockUser instead
 */
export const createUser = createMockUser;

/**
 * @deprecated Use createMockUserCreateInput instead
 */
export const createUserForCreation = createMockUserCreateInput;
