import { mockPaginatedResponse } from '../mocks/handlers';

/**
 * Minimal valid tag fixture for testing.
 * Fields derived from TagSchema in @repo/schemas.
 */
export const mockTag = {
    id: 'tag-test-001',
    name: 'Playa',
    slug: 'playa',
    color: 'BLUE',
    icon: null,
    notes: null,

    // Lifecycle
    lifecycleState: 'ACTIVE',

    // Audit fields
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdById: 'user-test-001',
    updatedById: 'user-test-001',
    deletedAt: undefined,
    deletedById: undefined
} as const;

/** List of 3 tags for table/list tests */
export const mockTagList = [
    mockTag,
    {
        ...mockTag,
        id: 'tag-test-002',
        name: 'Gastronomia',
        slug: 'gastronomia',
        color: 'ORANGE' as const,
        icon: 'utensils'
    },
    {
        ...mockTag,
        id: 'tag-test-003',
        name: 'Aventura',
        slug: 'aventura',
        color: 'GREEN' as const,
        icon: 'mountain'
    }
];

/** Paginated response wrapper for list endpoint tests */
export const mockTagPage = mockPaginatedResponse(mockTagList);
