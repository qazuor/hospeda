import type { PermissionEnum, RoleEnum, UserId, UserType } from '@repo/types';
import { LifecycleStatusEnum, RoleEnum as RoleEnumImpl, VisibilityEnum } from '@repo/types';
import { BaseFactoryBuilder } from './baseEntityFactory';
import { getMockId } from './utilsFactory';

/**
 * Base user object for test factories.
 */
const baseUser: UserType = {
    id: getMockId('user') as UserId,
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
    createdById: getMockId('user') as UserId,
    updatedById: getMockId('user') as UserId,
    deletedById: undefined,
    adminInfo: { favorite: false },
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC
};

/**
 * Builder for UserType test data.
 * Supports fluent .with() and role/permission helpers.
 */
export class UserFactoryBuilder extends BaseFactoryBuilder<UserType> {
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
export const createUser = (overrides: Partial<UserType> = {}): UserType => {
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
export const createUserForCreation = (
    overrides: Partial<UserType> = {}
): Omit<
    UserType,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'
    | 'createdById'
    | 'updatedById'
    | 'deletedById'
    | 'bookmarks'
> => {
    const user = createUser(overrides);
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
