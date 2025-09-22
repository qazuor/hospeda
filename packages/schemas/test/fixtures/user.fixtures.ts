import type { UserIdType as UserId } from '../../src/common/id.schema.js';
import type { User as UserType } from '../../src/entities/user/user.schema.js';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    VisibilityEnum
} from '../../src/enums/index.js';

/**
 * Creates a complete user fixture for testing
 */
export const createUserFixture = (overrides: Partial<UserType> = {}): UserType => {
    const baseUser: UserType = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' as UserId,
        slug: 'john-doe',
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        visibility: VisibilityEnum.PUBLIC,

        // Basic info
        displayName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',

        // Role and permissions
        role: RoleEnum.USER,
        permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL],

        // Contact info
        contactInfo: {
            personalEmail: 'john@example.com',
            mobilePhone: '+12345678901'
        },

        // Profile
        profile: {
            bio: 'Software developer passionate about travel and technology.',
            avatar: 'https://example.com/avatar.jpg',
            website: 'https://johndoe.com',
            occupation: 'Software Developer'
        },

        // Location
        location: {
            country: 'United States',
            state: 'California',
            city: 'San Francisco',
            zipCode: '94102',
            street: 'Market Street',
            number: '123',
            coordinates: {
                lat: '37.7749',
                long: '-122.4194'
            }
        },

        // Settings
        settings: {
            language: 'en',
            darkMode: false,
            notifications: {
                enabled: true,
                allowEmails: true,
                allowPush: false,
                allowSms: false
            }
        },

        // Admin info
        adminInfo: {
            favorite: false,
            notes: 'Test user for development'
        },

        // Bookmarks
        bookmarks: [],

        // Timestamps
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-15T10:30:00Z'),

        // Optional fields
        createdById: '550e8400-e29b-41d4-a716-446655440001' as UserId,
        updatedById: '550e8400-e29b-41d4-a716-446655440002' as UserId
    };

    return { ...baseUser, ...overrides };
};

/**
 * Creates a minimal user fixture for testing
 */
export const createMinimalUserFixture = (overrides: Partial<UserType> = {}): Partial<UserType> => {
    const minimalUser: Partial<UserType> = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' as UserId,
        slug: 'jane-doe',
        displayName: 'Jane Doe',
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        visibility: VisibilityEnum.PUBLIC,
        role: RoleEnum.USER,
        permissions: [],
        contactInfo: {
            personalEmail: 'jane@example.com',
            mobilePhone: '+10987654321'
        },
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        createdById: '550e8400-e29b-41d4-a716-446655440003' as UserId,
        updatedById: '550e8400-e29b-41d4-a716-446655440004' as UserId
    };

    return { ...minimalUser, ...overrides };
};

/**
 * Creates a user fixture with admin role
 */
export const createAdminUserFixture = (overrides: Partial<UserType> = {}): UserType => {
    return createUserFixture({
        displayName: 'Admin User',
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCOMMODATION_VIEW_ALL,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY,
            PermissionEnum.USER_READ_ALL,
            PermissionEnum.USER_UPDATE_ROLES
        ],
        ...overrides
    });
};

/**
 * Creates a user fixture with super admin role
 */
export const createSuperAdminUserFixture = (overrides: Partial<UserType> = {}): UserType => {
    return createUserFixture({
        displayName: 'Super Admin',
        role: RoleEnum.SUPER_ADMIN,
        permissions: Object.values(PermissionEnum),
        ...overrides
    });
};

// Aliases for backward compatibility with existing tests
export const createValidUser = createUserFixture;
export const createMinimalUser = createMinimalUserFixture;
export const createAdminUser = createAdminUserFixture;
export const createSuperAdminUser = createSuperAdminUserFixture;

/**
 * Creates a user fixture with invalid data for testing validation
 */
export const createInvalidUser = (): Partial<UserType> => {
    return {
        id: 'invalid-uuid' as any, // Invalid UUID
        displayName: '', // Empty required field
        contactInfo: {
            personalEmail: 'invalid-email', // Invalid email format
            mobilePhone: 'invalid-phone'
        }
    };
};

/**
 * Creates user fixtures with edge cases for testing
 */
export const createUserEdgeCases = (overrides: Partial<UserType> = {}): UserType => {
    return createUserFixture({
        // Edge case values that are still valid
        displayName: 'AB', // Minimum length (2 chars)
        slug: 'edge-user-123',
        profile: {
            bio: 'Short bio.', // Minimum length (10 chars)
            avatar: 'https://example.com/edge-avatar.jpg',
            website: 'https://edge.example.com',
            occupation: 'Edge Case Tester'
        },
        permissions: [], // Empty array
        bookmarks: [], // Empty array
        ...overrides
    });
};

/**
 * Creates a user fixture with complex profile data
 */
export const createUserWithComplexProfile = (overrides: Partial<UserType> = {}): UserType => {
    return createUserFixture({
        profile: {
            bio: 'Experienced travel blogger and digital nomad with over 10 years of experience exploring South America. Passionate about sustainable tourism and local culture.',
            avatar: 'https://example.com/complex-avatar.jpg',
            website: 'https://travelblogger.example.com',
            occupation: 'Travel Blogger & Digital Marketing Consultant'
        },
        contactInfo: {
            personalEmail: 'complex.user@example.com',
            workEmail: 'work@travelblogger.example.com',
            mobilePhone: '+5491123456789',
            homePhone: '+541143216789',
            website: 'https://travelblogger.example.com'
        },
        location: {
            country: 'Argentina',
            state: 'Buenos Aires',
            city: 'Buenos Aires',
            zipCode: 'C1001',
            street: 'Av. Corrientes',
            number: '1234',
            floor: '5',
            apartment: 'B',
            neighborhood: 'San Nicolás',
            coordinates: {
                lat: '-34.6037',
                long: '-58.3816'
            }
        },
        ...overrides
    });
};
