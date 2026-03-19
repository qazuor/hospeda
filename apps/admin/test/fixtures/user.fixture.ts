import { mockPaginatedResponse } from '../mocks/handlers';

/**
 * Minimal valid user fixture for testing.
 * Fields derived from UserSchema in @repo/schemas.
 */
export const mockUser = {
    id: 'user-test-001',
    slug: 'maria-gonzalez',
    email: 'maria@example.com',
    emailVerified: true,
    image: null,
    banned: false,
    banReason: null,
    banExpires: null,

    // Authentication
    authProvider: undefined,
    authProviderUserId: undefined,

    // Personal information
    displayName: 'Maria Gonzalez',
    firstName: 'Maria',
    lastName: 'Gonzalez',
    birthDate: null,

    // Role and permissions
    role: 'USER',
    permissions: [],

    // Lifecycle and visibility
    lifecycleState: 'ACTIVE',
    visibility: 'PUBLIC',

    // Audit fields
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null,

    // Optional / nullable fields
    adminInfo: null,
    contactInfo: null,
    location: null,
    socialNetworks: null,
    profile: null,
    settings: undefined,
    bookmarks: []
} as const;

/** List of 3 users for table/list tests */
export const mockUserList = [
    mockUser,
    {
        ...mockUser,
        id: 'user-test-002',
        slug: 'juan-perez',
        email: 'juan@example.com',
        displayName: 'Juan Perez',
        firstName: 'Juan',
        lastName: 'Perez',
        role: 'HOST' as const
    },
    {
        ...mockUser,
        id: 'user-test-003',
        slug: 'admin-test',
        email: 'admin@example.com',
        displayName: 'Admin User',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN' as const,
        emailVerified: true
    }
];

/** Paginated response wrapper for list endpoint tests */
export const mockUserPage = mockPaginatedResponse(mockUserList);
