/**
 * Test setup file for Vitest
 * Configures test environment and global mocks
 */

import { webcrypto } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

// Polyfill crypto for Hono request-id middleware
if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as Crypto;
}

// Global test setup
beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';

    // Mock environment variables for testing
    process.env.PORT = '3001';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    process.env.CLERK_SECRET_KEY = 'test_clerk_secret';
    process.env.PUBLIC_CLERK_PUBLISHABLE_KEY = 'test_clerk_publishable';

    // Note: Validation is enabled by default for tests
    // Individual routes can opt-out using routeOptions.skipValidation

    // Reduce logger noise in tests: show only errors
    try {
        const loggerModule = await import('@repo/logger');
        const baseLogger = (loggerModule as any).default;
        if (baseLogger?.configure) {
            baseLogger.configure({
                LEVEL: 'ERROR',
                INCLUDE_LEVEL: false,
                INCLUDE_TIMESTAMPS: false,
                USE_COLORS: false,
                SAVE: false,
                EXPAND_OBJECT_LEVELS: 0,
                TRUNCATE_LONG_TEXT: true,
                TRUNCATE_LONG_TEXT_AT: 80,
                STRINGIFY_OBJECTS: false
            });
        }
    } catch {
        // noop
    }
});

// Mock @repo/logger to avoid LoggerColors issues
// This must be at the top level to ensure it's hoisted before module imports
vi.mock('@repo/logger', () => {
    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
    });

    const mockedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => createMockedLogger()),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => createMockedLogger()),
        registerLogMethod: vi.fn().mockReturnThis()
    };

    // Mock LoggerColors enum
    const LoggerColors = {
        BLACK: 'BLACK',
        RED: 'RED',
        GREEN: 'GREEN',
        YELLOW: 'YELLOW',
        BLUE: 'BLUE',
        MAGENTA: 'MAGENTA',
        CYAN: 'CYAN',
        WHITE: 'WHITE',
        GRAY: 'GRAY',
        BLACK_BRIGHT: 'BLACK_BRIGHT',
        RED_BRIGHT: 'RED_BRIGHT',
        GREEN_BRIGHT: 'GREEN_BRIGHT',
        YELLOW_BRIGHT: 'YELLOW_BRIGHT',
        BLUE_BRIGHT: 'BLUE_BRIGHT',
        MAGENTA_BRIGHT: 'MAGENTA_BRIGHT',
        CYAN_BRIGHT: 'CYAN_BRIGHT',
        WHITE_BRIGHT: 'WHITE_BRIGHT'
    };

    // Mock LogLevel enum
    const LogLevel = {
        LOG: 'LOG',
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR',
        DEBUG: 'DEBUG'
    };

    return {
        default: mockedLogger,
        logger: mockedLogger,
        LoggerColors,
        LogLevel
    };
});

// Mock @repo/service-core to force 2xx happy paths without DB/auth
// This must be at the top level to ensure it's hoisted before module imports
vi.mock('@repo/service-core', () => {
    class PostService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'post_mock_id',
                    slug: String((body as any).slug || 'post-mock'),
                    title: String((body as any).title || 'Post Mock'),
                    category: (body as any).category || 'NEWS',
                    isFeatured: Boolean((body as any).isFeatured ?? false),
                    isNews: Boolean((body as any).isNews ?? false),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    authorId: 'user_mock',
                    media: { featuredImage: { url: 'https://example.com/post.jpg' } },
                    summary: (body as any).summary || 'Mock summary'
                }
            };
        }

        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return {
                data: {
                    id,
                    slug: String((body as any).slug || 'post-updated'),
                    title: String((body as any).title || 'Post Updated')
                }
            };
        }

        async softDelete(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return { data: { id, deletedAt: new Date().toISOString() } };
        }

        async restore(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return { data: { id } };
        }

        async hardDelete(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return { data: { id, deleted: true, count: 1 } };
        }

        async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }

        async getById(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id,
                    slug: 'post-slug',
                    title: 'Test Post',
                    category: 'NEWS',
                    isFeatured: false,
                    isNews: false,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                    authorId: 'user_mock',
                    media: { featuredImage: { url: 'https://example.com/post.jpg' } },
                    summary: 'Post summary'
                }
            };
        }

        async getBySlug(_actor: unknown, slug: string) {
            return {
                data: {
                    id: 'post_by_slug',
                    slug,
                    title: 'Post By Slug',
                    category: 'NEWS',
                    isFeatured: false,
                    isNews: false,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    authorId: 'user_mock',
                    media: { featuredImage: { url: 'https://example.com/post.jpg' } },
                    summary: 'Post summary'
                }
            };
        }

        async getSummary(_actor: unknown, _data: { id?: string; slug?: string }) {
            return {
                data: {
                    id: _data.id ?? 'post_summary_id',
                    slug: _data.slug ?? 'post-summary',
                    title: 'Post Summary',
                    category: 'NEWS',
                    media: { featuredImage: { url: 'https://example.com/post.jpg' } },
                    isFeatured: false,
                    isNews: false,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    authorId: 'user_mock',
                    summary: 'Summary text'
                }
            };
        }

        async getStats(_actor: unknown, _data: { id?: string; slug?: string }) {
            return { data: { likes: 10, comments: 2, shares: 1 } };
        }

        async getByCategory(_actor: unknown, _params: { category: string }) {
            return { data: [] };
        }

        async getByRelatedAccommodation(_actor: unknown, _params: { accommodationId: string }) {
            return { data: [] };
        }

        async getByRelatedDestination(_actor: unknown, _params: { destinationId: string }) {
            return { data: [] };
        }

        async getByRelatedEvent(_actor: unknown, _params: { eventId: string }) {
            return { data: [] };
        }

        async getFeatured(_actor: unknown, _params?: Record<string, unknown>) {
            return { data: [] };
        }

        async getNews(_actor: unknown, _params?: Record<string, unknown>) {
            return { data: [] };
        }

        async like(_actor: unknown, _params: { postId: string }) {
            return { data: { success: true } };
        }

        async unlike(_actor: unknown, _params: { postId: string }) {
            return { data: { success: true } };
        }
    }

    class AccommodationService {
        // Create
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'acc_mock_id',
                    slug: String((body as any).slug || 'hotel-azul'),
                    name: String((body as any).name || 'Hotel Azul'),
                    summary: (body as any).summary || 'Nice place',
                    description: (body as any).description || 'Long description',
                    isFeatured: false,
                    isActive: true,
                    isPublished: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdById: 'user_mock',
                    updatedById: 'user_mock',
                    ownerId: 'owner_mock',
                    destinationId: 'dest_mock'
                }
            };
        }

        // Update
        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return {
                data: {
                    id,
                    slug: String((body as any).slug || 'hotel-updated'),
                    name: String((body as any).name || 'Hotel Updated')
                }
            };
        }

        // List
        async list(_actor: unknown, _opts: { page: number; pageSize: number }) {
            return {
                data: {
                    items: [],
                    total: 0
                }
            };
        }

        // Search for list
        async searchForList(
            _actor: unknown,
            _opts: {
                pagination: { page: number; pageSize: number };
                filters?: { destinationId?: string };
            }
        ) {
            return { items: [], total: 0 };
        }

        // Getters
        async getById(_actor: unknown, id: string) {
            // Return null for non-existent UUID to test 404 cases
            if (id === '87654321-4321-4321-8765-876543218765') {
                return { data: null };
            }

            return {
                data: {
                    id,
                    slug: 'mock-slug',
                    name: 'Test Accommodation',
                    summary: 'This is a lovely test accommodation perfect for your stay.',
                    type: 'HOTEL',
                    reviewsCount: 42,
                    averageRating: 4.5,
                    isFeatured: true,
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                    deletedAt: null, // Not deleted by default
                    ownerId: '12345678-1234-4567-8901-123456789013',
                    destinationId: '12345678-1234-4567-8901-123456789014',
                    media: {
                        featuredImage: {
                            url: 'https://example.com/image.jpg'
                        }
                    },
                    location: {
                        city: 'Test City',
                        country: 'Test Country'
                    }
                }
            };
        }

        async getBySlug(_actor: unknown, slug: string) {
            return {
                data: {
                    id: 'acc_by_slug',
                    slug,
                    name: 'By Slug'
                }
            };
        }

        // Deletions / restore
        async softDelete(_actor: unknown, id: string) {
            // Return null for non-existent UUID
            if (id === '87654321-4321-4321-8765-876543218765') {
                return { data: null };
            }

            return {
                data: {
                    id,
                    slug: 'mock-slug',
                    name: 'Test Accommodation',
                    summary: 'This is a lovely test accommodation perfect for your stay.',
                    type: 'HOTEL',
                    reviewsCount: 42,
                    averageRating: 4.5,
                    isFeatured: true,
                    visibility: 'PUBLIC',
                    lifecycleState: 'DELETED', // Changed to DELETED for soft delete
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                    deletedAt: new Date().toISOString(), // Add deletion timestamp
                    ownerId: '12345678-1234-4567-8901-123456789013',
                    destinationId: '12345678-1234-4567-8901-123456789014',
                    media: {
                        featuredImage: {
                            url: 'https://example.com/image.jpg'
                        }
                    },
                    location: {
                        city: 'Test City',
                        country: 'Test Country'
                    }
                }
            };
        }
        async restore(_actor: unknown, id: string) {
            // Return null for non-existent UUID
            if (id === '87654321-4321-4321-8765-876543218765') {
                return { data: null };
            }

            return {
                data: {
                    id,
                    slug: 'mock-slug',
                    name: 'Test Accommodation',
                    summary: 'This is a lovely test accommodation perfect for your stay.',
                    type: 'HOTEL',
                    reviewsCount: 42,
                    averageRating: 4.5,
                    isFeatured: true,
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE', // Changed back to ACTIVE after restore
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: new Date().toISOString(), // Update timestamp for restore
                    deletedAt: null, // Clear deletion timestamp
                    ownerId: '12345678-1234-4567-8901-123456789013',
                    destinationId: '12345678-1234-4567-8901-123456789014',
                    media: {
                        featuredImage: {
                            url: 'https://example.com/image.jpg'
                        }
                    },
                    location: {
                        city: 'Test City',
                        country: 'Test Country'
                    }
                }
            };
        }
        async hardDelete(_actor: unknown, _id: string) {
            // Handle non-existent accommodation
            if (_id === '87654321-4321-4321-8765-876543218765') {
                return { data: null };
            }

            // Return comprehensive deletion confirmation
            return {
                data: {
                    id: _id,
                    deleted: true,
                    deletedAt: new Date().toISOString(),
                    count: 1,
                    message: 'Accommodation permanently deleted'
                }
            };
        }

        // FAQs
        async getFaqs(_actor: unknown, _params: { accommodationId: string }) {
            // Handle non-existent accommodation
            if (_params.accommodationId === '87654321-4321-4321-8765-876543218765') {
                return { data: null };
            }

            // Return mock FAQs that match the test IDs
            return {
                data: {
                    faqs: [
                        {
                            id: '12345678-1234-4567-8901-123456789013', // validFaqId from test
                            question: 'Existing question?',
                            answer: 'Existing answer',
                            order: 0,
                            createdAt: '2024-01-01T00:00:00.000Z',
                            updatedAt: '2024-01-01T00:00:00.000Z'
                        }
                    ]
                }
            };
        }
        async addFaq(
            _actor: unknown,
            _params: { accommodationId: string; faq: Record<string, unknown> }
        ) {
            // Use the actual FAQ data from the request
            const faqData = _params.faq as { question: string; answer: string };

            return {
                data: {
                    faq: {
                        id: '12345678-1234-4567-8901-123456789017',
                        question: faqData.question || 'Default question',
                        answer: faqData.answer || 'Default answer',
                        order: 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                }
            };
        }
        async updateFaq(
            _actor: unknown,
            _params: { accommodationId: string; faqId: string; faq: Record<string, unknown> }
        ) {
            // Handle non-existent accommodation
            if (_params.accommodationId === '87654321-4321-4321-8765-876543218765') {
                return { data: null };
            }

            // Handle non-existent FAQ
            if (_params.faqId === '87654321-4321-4321-8765-876543218766') {
                return { data: null };
            }

            return {
                data: {
                    faq: {
                        id: _params.faqId, // Use the actual faqId from test
                        question: _params.faq.question || 'Updated question?',
                        answer: _params.faq.answer || 'Updated answer',
                        order: _params.faq.order || 0,
                        createdAt: '2024-01-01T00:00:00.000Z',
                        updatedAt: new Date().toISOString() // Fresh timestamp for update
                    }
                }
            };
        }
        async removeFaq(_actor: unknown, _params: { accommodationId: string; faqId: string }) {
            return { data: { count: 1 } };
        }

        // Summary / Stats / Destinations
        async getSummary(_actor: unknown, _params: { id: string }) {
            return {
                data: {
                    id: '12345678-1234-4567-8901-123456789012',
                    slug: 'test-accommodation',
                    name: 'Test Accommodation',
                    summary: 'This is a lovely test accommodation perfect for your stay.',
                    type: 'HOTEL',
                    averageRating: 4.5,
                    reviewsCount: 42,
                    isFeatured: true,
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                    ownerId: '12345678-1234-4567-8901-123456789013',
                    destinationId: '12345678-1234-4567-8901-123456789014'
                }
            };
        }
        async getStats(_actor: unknown, _params: { id?: string }) {
            return {
                data: {
                    // Accommodation counts
                    total: 150,
                    public: 120,
                    private: 25,
                    draft: 5,
                    featured: 15,

                    // Type breakdown
                    byType: {
                        HOTEL: 80,
                        CABIN: 35,
                        HOSTEL: 20,
                        APARTMENT: 15
                    },

                    // Destination breakdown
                    byDestination: {
                        'destination-1': 75,
                        'destination-2': 45,
                        'destination-3': 30
                    },

                    // Review statistics
                    averageRating: 4.5,
                    totalReviews: 42,
                    reviewsCount: 42, // Keep for backward compatibility

                    // Rating distribution
                    rating: {
                        1: 2,
                        2: 3,
                        3: 8,
                        4: 15,
                        5: 14
                    }
                }
            };
        }
        async getByDestination(_actor: unknown, params: { destinationId: string }) {
            return { data: { destinationId: params.destinationId, accommodations: [] } };
        }
        async getTopRatedByDestination(_actor: unknown, params: { destinationId: string }) {
            return { data: { destinationId: params.destinationId, accommodations: [] } };
        }
    }

    class DestinationService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'dest_mock_id',
                    slug: String((body as any).slug || 'destination-mock'),
                    name: String((body as any).name || 'Destination Mock'),
                    summary: (body as any).summary || 'Nice destination',
                    description: (body as any).description || 'Long description',
                    isFeatured: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdById: 'user_mock',
                    updatedById: 'user_mock',
                    media: { featuredImage: { url: 'https://example.com/image.jpg' } },
                    location: { country: 'Testland' }
                }
            };
        }

        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return {
                data: {
                    id,
                    slug: String((body as any).slug || 'destination-updated'),
                    name: String((body as any).name || 'Destination Updated')
                }
            };
        }

        async list(_actor: unknown, _opts: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }

        async searchForList(
            _actor: unknown,
            _opts: { pagination: { page: number; pageSize: number }; filters?: { q?: string } }
        ) {
            return { items: [], total: 0 };
        }

        async getById(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') {
                return { data: null };
            }
            return {
                data: {
                    id,
                    slug: 'destination-slug',
                    name: 'Test Destination',
                    location: { country: 'Testland' },
                    media: { featuredImage: { url: 'https://example.com/img.jpg' } }
                }
            };
        }

        async getBySlug(_actor: unknown, slug: string) {
            return { data: { id: 'dest_by_slug', slug, name: 'Destination By Slug' } };
        }

        async getStats(_actor: unknown, _params: { destinationId: string }) {
            return {
                data: {
                    stats: {
                        accommodationsCount: 0,
                        reviewsCount: 0,
                        averageRating: 0
                    }
                }
            };
        }

        async getSummary(_actor: unknown, params: { destinationId: string }) {
            return {
                data: {
                    summary: {
                        id: params.destinationId,
                        slug: 'destination-summary',
                        name: 'Destination Summary',
                        country: 'Testland',
                        location: { country: 'Testland' },
                        isFeatured: false,
                        averageRating: 0,
                        reviewsCount: 0,
                        accommodationsCount: 0,
                        featuredImage: 'https://example.com/img.jpg'
                    }
                }
            };
        }

        async softDelete(_actor: unknown, _id: string) {
            return { data: { count: 1 } };
        }

        async restore(_actor: unknown, _id: string) {
            return { data: { count: 1 } };
        }

        async hardDelete(_actor: unknown, _id: string) {
            return { data: { count: 1 } };
        }

        async getAccommodations(_actor: unknown, _params: { destinationId: string }) {
            return { data: { accommodations: [] } };
        }
    }

    // Amenity service mock for new Amenity routes
    class AmenityService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'amenity_mock_id',
                    name: String((body as any).name || 'Amenity Mock'),
                    type: String((body as any).type || 'GENERAL_APPLIANCES'),
                    slug: (body as any).slug || 'amenity-mock',
                    isFeatured: Boolean((body as any).isFeatured ?? false)
                }
            };
        }
        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return {
                data: {
                    id,
                    name: String((body as any).name || 'Amenity Updated')
                }
            };
        }
        async softDelete(_actor: unknown, id: string) {
            return { data: { id, deletedAt: new Date().toISOString() } };
        }
        async restore(_actor: unknown, id: string) {
            return { data: { id } };
        }
        async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }
        async getById(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return { data: { id, name: 'Amenity', type: 'GENERAL_APPLIANCES' } };
        }
        async search(
            _actor: unknown,
            _params: {
                filters?: { name?: string; type?: string };
                pagination?: { page?: number; pageSize?: number };
            }
        ) {
            return { data: { items: [], total: 0 } };
        }
        async getAccommodationsByAmenity(_actor: unknown, _params: { amenityId: string }) {
            return { data: { accommodations: [] } };
        }
        async getAmenitiesForAccommodation(_actor: unknown, _params: { accommodationId: string }) {
            return { data: { amenities: [] } };
        }
        async addAmenityToAccommodation(
            _actor: unknown,
            _params: {
                accommodationId: string;
                amenityId: string;
                isOptional?: boolean;
                additionalCost?: unknown;
                additionalCostPercent?: number;
            }
        ) {
            return { data: { relation: { amenityId: _params.amenityId } } };
        }
        async removeAmenityFromAccommodation(
            _actor: unknown,
            _params: { accommodationId: string; amenityId: string }
        ) {
            return { data: { relation: { amenityId: _params.amenityId } } };
        }
    }

    // --- New review services for tests ---
    class AccommodationReviewService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'acc_review_mock_id',
                    accommodationId: String(
                        (body as any).destinationId ||
                            (body as any).accommodationId ||
                            'acc_mock_id'
                    ),
                    userId: String((body as any).userId || 'user_mock'),
                    rating: (body as any).rating ?? {
                        cleanliness: 5,
                        hospitality: 5,
                        services: 5,
                        accuracy: 5,
                        communication: 5,
                        location: 5
                    },
                    title: (body as any).title ?? 'Review Title',
                    content: (body as any).content ?? 'Review content'
                }
            };
        }
        async listByAccommodation(
            _actor: unknown,
            input: { accommodationId: string; page?: number; pageSize?: number }
        ) {
            const page = input.page ?? 1;
            const pageSize = input.pageSize ?? 10;
            return { data: { items: [], total: 0, page, pageSize } } as any;
        }
    }

    class DestinationReviewService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'dest_review_mock_id',
                    destinationId: String((body as any).destinationId || 'dest_mock_id'),
                    userId: String((body as any).userId || 'user_mock'),
                    rating: (body as any).rating ?? {},
                    title: (body as any).title ?? 'Destination Review Title',
                    content: (body as any).content ?? 'Destination review content'
                }
            };
        }
        async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }
    }

    class EventService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'event_mock_id',
                    slug: String((body as any).slug || 'event-mock'),
                    name: String((body as any).name || 'Event Mock'),
                    category: (body as any).category || 'CONCERT',
                    isFeatured: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdById: 'user_mock',
                    updatedById: 'user_mock',
                    media: { featuredImage: { url: 'https://example.com/event.jpg' } },
                    date: { start: new Date().toISOString() }
                }
            };
        }

        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return {
                data: {
                    id,
                    slug: String((body as any).slug || 'event-updated'),
                    name: String((body as any).name || 'Event Updated')
                }
            };
        }

        async list(_actor: unknown, _opts: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }

        async getById(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') {
                return { data: null };
            }
            return {
                data: {
                    id,
                    slug: 'event-slug',
                    name: 'Test Event',
                    category: 'CONCERT',
                    isFeatured: false,
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                    deletedAt: null,
                    media: { featuredImage: { url: 'https://example.com/event.jpg' } },
                    date: { start: '2024-02-01T00:00:00.000Z' },
                    location: { city: 'Test City', country: 'Testland' }
                }
            };
        }

        async getBySlug(_actor: unknown, slug: string) {
            return { data: { id: 'event_by_slug', slug, name: 'Event By Slug' } };
        }

        async getSummary(_actor: unknown, params: { id: string }) {
            return {
                data: {
                    summary: {
                        id: params.id,
                        slug: 'event-summary',
                        name: 'Event Summary',
                        category: 'CONCERT',
                        date: { start: '2024-02-01T00:00:00.000Z' },
                        media: { featuredImage: { url: 'https://example.com/event.jpg' } },
                        isFeatured: false
                    }
                }
            };
        }

        async getByAuthor(
            _actor: unknown,
            input: { authorId: string; page?: number; pageSize?: number }
        ) {
            const page = input.page ?? 1;
            const pageSize = input.pageSize ?? 10;
            return {
                data: { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
            };
        }

        async getByLocation(
            _actor: unknown,
            input: { locationId: string; page?: number; pageSize?: number }
        ) {
            const page = input.page ?? 1;
            const pageSize = input.pageSize ?? 10;
            return {
                data: { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
            };
        }

        async getByOrganizer(
            _actor: unknown,
            input: { organizerId: string; page?: number; pageSize?: number }
        ) {
            const page = input.page ?? 1;
            const pageSize = input.pageSize ?? 10;
            return {
                data: { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
            };
        }

        async getByCategory(
            _actor: unknown,
            input: { category: string; page?: number; pageSize?: number }
        ) {
            const page = input.page ?? 1;
            const pageSize = input.pageSize ?? 10;
            return {
                data: { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
            };
        }

        async getFreeEvents(_actor: unknown, input: { page?: number; pageSize?: number }) {
            const page = input.page ?? 1;
            const pageSize = input.pageSize ?? 10;
            return {
                data: { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
            };
        }

        async getUpcoming(
            _actor: unknown,
            input: { fromDate: Date; toDate?: Date; page?: number; pageSize?: number }
        ) {
            const page = input.page ?? 1;
            const pageSize = input.pageSize ?? 10;
            return {
                data: { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
            };
        }

        async softDelete(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') {
                return { data: null };
            }
            return { data: { id, deletedAt: new Date().toISOString() } };
        }

        async restore(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') {
                return { data: null };
            }
            return { data: { id } };
        }

        async hardDelete(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') {
                return { data: null };
            }
            return { data: { id, deleted: true, count: 1 } };
        }
    }

    class UserService {
        async getById(_actor: unknown, userId: string) {
            return {
                data: {
                    id: userId,
                    role: 'ADMIN',
                    permissions: ['*']
                }
            };
        }
    }

    return {
        PostService,
        AccommodationService,
        DestinationService,
        EventService,
        UserService,
        AccommodationReviewService,
        DestinationReviewService,
        AmenityService
    };
});

// Global test cleanup
afterAll(async () => {
    // Cleanup test environment
});

// Per-test setup
beforeEach(async () => {
    // Setup before each test
});

// Per-test cleanup
afterEach(async () => {
    // Cleanup after each test
});
