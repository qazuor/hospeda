import { beforeAll, vi } from 'vitest';

/**
 * Creates a new service mockLogger object for use in tests.
 */
export const createMockServiceLogger = () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    permission: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
    registerCategory: vi.fn(),
    configure: vi.fn(),
    resetConfig: vi.fn(),
    createLogger: vi.fn(),
    registerLogMethod: vi.fn()
});

export const mockServiceLogger = createMockServiceLogger();

// Base module mocks for all tests
vi.mock('../utils/service-logger.ts', () => ({
    serviceLogger: globalThis.mockServiceLogger
}));

globalThis.mockServiceLogger = mockServiceLogger;

const FIXED_DATE = new Date('2025-06-13T12:55:14.711Z');

beforeAll(() => {
    vi.setSystemTime(FIXED_DATE);
});

// Mock global para todos los modelos y métodos de @repo/db usados en tests de services
vi.mock('@repo/db', async () => {
    const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db');
    return {
        ...actual,
        // Accommodation
        AccommodationModel: {
            create: vi.fn(),
            getById: vi.fn(),
            getByName: vi.fn(),
            getBySlug: vi.fn(),
            search: vi.fn(),
            update: vi.fn(),
            hardDelete: vi.fn(),
            getByDestination: vi.fn(),
            list: vi.fn(),
            delete: vi.fn(),
            count: vi.fn()
        },
        ACCOMMODATION_ORDERABLE_COLUMNS: [
            'ownerId',
            'destinationId',
            'averageRating',
            'visibility',
            'lifecycle',
            'name',
            'type'
        ],
        // Destination
        DestinationModel: {
            create: vi.fn(),
            getById: vi.fn(),
            getByName: vi.fn(),
            getBySlug: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
            hardDelete: vi.fn(),
            search: vi.fn()
        },
        DestinationReviewModel: {
            list: vi.fn()
        },
        // Event
        EventModel: {
            search: vi.fn(),
            getById: vi.fn(),
            getBySlug: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
            hardDelete: vi.fn(),
            count: vi.fn()
        },
        // Post
        PostModel: {
            list: vi.fn(),
            search: vi.fn(),
            getBySlug: vi.fn(),
            getById: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            hardDelete: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
            restore: vi.fn(),
            getByCategory: vi.fn()
        },
        // UserBookmark
        UserBookmarkModel: {
            create: vi.fn(),
            getById: vi.fn(),
            getByUserId: vi.fn(),
            delete: vi.fn()
        },
        // Tag
        TagModel: {
            addTag: vi.fn(),
            removeTag: vi.fn(),
            getAccommodationsByTag: vi.fn(),
            getDestinationsByTag: vi.fn(),
            getEventsByTag: vi.fn(),
            getPostsByTag: vi.fn(),
            search: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
            delete: vi.fn()
        }
    };
});
