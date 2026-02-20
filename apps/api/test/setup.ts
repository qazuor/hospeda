/**
 * Test setup file for Vitest
 * Configures test environment and global mocks
 */

import { webcrypto } from 'node:crypto';
import { ServiceErrorCode } from '@repo/schemas';
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
    process.env.HOSPEDA_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    process.env.HOSPEDA_BETTER_AUTH_SECRET = 'test_better_auth_secret_key_32chars!';
    process.env.API_VALIDATION_AUTH_ENABLED = 'false';
    // Enable mock authentication for tests (required for isMockAuthAllowed())
    process.env.DISABLE_AUTH = 'true';
    // Mock exchange rate API key for tests
    process.env.HOSPEDA_EXCHANGE_RATE_API_KEY = 'test_exchange_rate_api_key';

    // Initialize environment validation
    try {
        // Import the actual module, not the mocked one
        const envModule = await import('../src/utils/env');
        if (envModule.validateApiEnv && typeof envModule.validateApiEnv === 'function') {
            envModule.validateApiEnv();
        } else {
            // Module is mocked, skip validation
        }
    } catch (_error) {
        // Environment validation failed or module is mocked
        // This is expected in some test scenarios
    }

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
        createLogger: mockedLogger.createLogger,
        LoggerColors,
        LogLevel
    };
});

// Mock @repo/db to avoid module resolution issues
// This must be at the top level to ensure it's hoisted before module imports
vi.mock('@repo/db', () => ({
    // Database client
    getDb: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        query: {},
        transaction: vi.fn()
    })),
    initializeDb: vi.fn(),

    // Re-export drizzle-orm operators (commonly used)
    sql: vi.fn(),
    eq: vi.fn((a: string, b: unknown) => ({ type: 'eq', left: a, right: b })),
    and: vi.fn((...args: unknown[]) => ({ type: 'and', conditions: args })),
    or: vi.fn((...args: unknown[]) => ({ type: 'or', conditions: args })),
    ilike: vi.fn((a: string, b: string) => ({ type: 'ilike', column: a, pattern: b })),
    desc: vi.fn((a: string) => ({ type: 'desc', column: a })),
    asc: vi.fn((a: string) => ({ type: 'asc', column: a })),
    count: vi.fn(),
    gte: vi.fn((a: string, b: unknown) => ({ type: 'gte', left: a, right: b })),
    lte: vi.fn((a: string, b: unknown) => ({ type: 'lte', left: a, right: b })),
    isNull: vi.fn((a: string) => ({ type: 'isNull', column: a })),
    isNotNull: vi.fn((a: string) => ({ type: 'isNotNull', column: a })),

    // Mock BaseModel class
    BaseModel: class MockBaseModel {
        protected table = {};
        protected entityName = 'mock';
        protected getTableName() {
            return 'mock_table';
        }
    },

    // Mock UserModel
    UserModel: class MockUserModel {
        async findById(_id: string) {
            return null;
        }
        async findAll(_filters: unknown) {
            return { items: [], total: 0 };
        }
        async create(_data: unknown) {
            return { id: 'user_mock_id', email: 'mock@example.com', createdAt: new Date() };
        }
        async update(_id: string, _data: unknown) {
            return { id: _id, updatedAt: new Date() };
        }
        async delete(_id: string) {
            return { id: _id, deletedAt: new Date() };
        }
        async findByEmail(_email: string) {
            return null;
        }
    },

    // Mock TagModel
    TagModel: class MockTagModel {
        async findById(_id: string) {
            return null;
        }
        async findAll(_filters: unknown) {
            return { items: [], total: 0 };
        }
        async findBySlug(_slug: string) {
            return null;
        }
        async create(_data: unknown) {
            return { id: 'tag_mock_id', name: 'Mock Tag', slug: 'mock-tag', createdAt: new Date() };
        }
        async update(_id: string, _data: unknown) {
            return { id: _id, updatedAt: new Date() };
        }
        async delete(_id: string) {
            return { id: _id, deletedAt: new Date() };
        }
    },

    // Mock REntityTagModel
    REntityTagModel: class MockREntityTagModel {
        async findAll(_filters: unknown) {
            return { items: [], total: 0 };
        }
        async create(_data: unknown) {
            return { id: 'r_entity_tag_mock_id', createdAt: new Date() };
        }
        async delete(_id: string) {
            return { id: _id, deletedAt: new Date() };
        }
    },

    // Mock ExchangeRateModel
    ExchangeRateModel: class MockExchangeRateModel {
        async create(_data: unknown) {
            return {
                id: 'rate_mock_id',
                fromCurrency: 'USD',
                toCurrency: 'ARS',
                rate: 1180.5,
                inverseRate: 0.000847,
                rateType: 'blue',
                source: 'MANUAL',
                isManualOverride: true,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }

        async findAll(_filters: unknown) {
            return {
                items: [],
                total: 0
            };
        }

        async findById(_id: string) {
            return null;
        }

        async update(_id: string, _data: unknown) {
            return {
                id: 'rate_mock_id',
                fromCurrency: 'USD',
                toCurrency: 'ARS',
                rate: 1180.5,
                inverseRate: 0.000847,
                rateType: 'blue',
                source: 'MANUAL',
                isManualOverride: true,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }

        async delete(_id: string) {
            return { id: _id, deletedAt: new Date() };
        }
    },

    // Mock billing schemas
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        status: 'status',
        purchasedAt: 'purchased_at',
        expiresAt: 'expires_at',
        cancelledAt: 'cancelled_at',
        paymentId: 'payment_id',
        limitAdjustments: 'limit_adjustments',
        entitlementAdjustments: 'entitlement_adjustments',
        promoCodeId: 'promo_code_id',
        metadata: 'metadata',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    billingNotificationLogs: {
        id: 'id',
        customerId: 'customer_id',
        eventType: 'event_type',
        channel: 'channel',
        status: 'status',
        metadata: 'metadata',
        createdAt: 'created_at'
    },
    billingAuditLogs: {
        action: 'action',
        entityType: 'entityType',
        entityId: 'entityId',
        actorId: 'actorId',
        metadata: 'metadata',
        livemode: 'livemode',
        createdAt: 'createdAt'
    }
}));

// Mock @repo/db/schemas separately
vi.mock('@repo/db/schemas', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        status: 'status',
        purchasedAt: 'purchased_at',
        expiresAt: 'expires_at',
        cancelledAt: 'cancelled_at',
        paymentId: 'payment_id',
        limitAdjustments: 'limit_adjustments',
        entitlementAdjustments: 'entitlement_adjustments',
        promoCodeId: 'promo_code_id',
        metadata: 'metadata',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    billingNotificationLogs: {
        id: 'id',
        customerId: 'customer_id',
        eventType: 'event_type',
        channel: 'channel',
        status: 'status',
        metadata: 'metadata',
        createdAt: 'created_at'
    }
}));

// Mock @repo/service-core to force 2xx happy paths without DB/auth
// This must be at the top level to ensure it's hoisted before module imports
vi.mock('@repo/service-core', () => {
    class ServiceError extends Error {
        constructor(
            public readonly code: string,
            message: string
        ) {
            super(message);
            this.name = 'ServiceError';
        }
    }

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
                return {
                    error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found')
                };
            }

            // Handle non-existent FAQ
            if (_params.faqId === '87654321-4321-4321-8765-876543218766') {
                return {
                    error: new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'FAQ not found for this accommodation'
                    )
                };
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
            // Return zero reviews for specific test UUID
            if (_params.id === '00000000-0000-4000-8000-000000000000') {
                return {
                    data: {
                        id: '00000000-0000-4000-8000-000000000000',
                        slug: 'zero-reviews-accommodation',
                        name: 'Zero Reviews Accommodation',
                        summary: 'This accommodation has no reviews yet.',
                        type: 'HOTEL',
                        price: { price: 75.0, currency: 'USD' },
                        location: { city: 'Test City', country: 'Test Country' },
                        media: { featuredImage: { url: 'https://example.com/zero-image.jpg' } },
                        averageRating: 0,
                        reviewsCount: 0,
                        isFeatured: false,
                        ownerId: '12345678-1234-4567-8901-123456789013'
                    }
                };
            }

            return {
                data: {
                    id: _params.id, // Use the actual ID from the request
                    slug: 'test-accommodation',
                    name: 'Test Accommodation',
                    summary: 'This is a lovely test accommodation perfect for your stay.',
                    type: 'HOTEL',
                    price: { price: 150.5, currency: 'USD' },
                    location: { city: 'Test City', country: 'Test Country' },
                    media: { featuredImage: { url: 'https://example.com/image.jpg' } },
                    averageRating: 4.5,
                    reviewsCount: 42,
                    isFeatured: true,
                    ownerId: '12345678-1234-4567-8901-123456789013'
                }
            };
        }
        async getStats(_actor: unknown, _params: { idOrSlug?: string }) {
            // Return null for non-existent accommodation
            if (_params.idOrSlug === '87654321-4321-4321-8765-876543218765') {
                return { data: null };
            }

            // Return zero stats for specific test UUID
            if (_params.idOrSlug === '00000000-0000-4000-8000-000000000000') {
                return {
                    data: {
                        stats: {
                            total: 1,
                            totalFeatured: 0,
                            averagePrice: 0,
                            averageRating: 0,
                            totalByType: { HOTEL: 1 }
                        }
                    }
                };
            }

            return {
                data: {
                    stats: {
                        total: 1,
                        totalFeatured: 1,
                        averagePrice: 150.5,
                        averageRating: 4.5,
                        totalByType: { HOTEL: 1 }
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

    // Attraction service mock
    class AttractionService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'attraction_mock_id',
                    name: String((body as any).name || 'Attraction Mock'),
                    slug: (body as any).slug || 'attraction-mock',
                    type: String((body as any).type || 'MUSEUM'),
                    description: String((body as any).description || 'Mock attraction description'),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }

        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return {
                data: {
                    id,
                    name: String((body as any).name || 'Attraction Updated'),
                    slug: (body as any).slug || 'attraction-updated'
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
                    name: 'Test Attraction',
                    slug: 'test-attraction',
                    type: 'MUSEUM',
                    description: 'Test attraction description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }

        async getBySlug(_actor: unknown, slug: string) {
            return {
                data: {
                    id: 'attraction_by_slug',
                    name: 'Attraction By Slug',
                    slug,
                    type: 'MUSEUM',
                    description: 'Attraction description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }

        async getByName(_actor: unknown, name: string) {
            return {
                data: {
                    id: 'attraction_by_name',
                    name,
                    slug: 'attraction-by-name',
                    type: 'MUSEUM',
                    description: 'Attraction description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }

        async count(_actor: unknown) {
            return { data: { count: 10 } };
        }

        async search(_actor: unknown, _params: { q?: string }) {
            return { data: { items: [], total: 0 } };
        }

        async getAttractionsForDestination(_actor: unknown, _destinationId: string) {
            return { data: [] };
        }

        async getDestinationsByAttraction(_actor: unknown, _attractionId: string) {
            return { data: [] };
        }

        async addAttractionToDestination(
            _actor: unknown,
            _attractionId: string,
            _destinationId: string
        ) {
            return { data: { success: true } };
        }

        async removeAttractionFromDestination(
            _actor: unknown,
            _attractionId: string,
            _destinationId: string
        ) {
            return { data: { success: true } };
        }
    }

    // Feature service mock
    class FeatureService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'feature_mock_id',
                    name: String((body as any).name || 'Feature Mock'),
                    slug: (body as any).slug || 'feature-mock',
                    type: String((body as any).type || 'GENERAL'),
                    description: String((body as any).description || 'Mock feature description'),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }

        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return {
                data: {
                    id,
                    name: String((body as any).name || 'Feature Updated'),
                    slug: (body as any).slug || 'feature-updated'
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
                    name: 'Test Feature',
                    slug: 'test-feature',
                    type: 'GENERAL',
                    description: 'Test feature description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }

        async getBySlug(_actor: unknown, slug: string) {
            return {
                data: {
                    id: 'feature_by_slug',
                    name: 'Feature By Slug',
                    slug,
                    type: 'GENERAL',
                    description: 'Feature description',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }

        async count(_actor: unknown) {
            return { data: { count: 5 } };
        }

        async search(_actor: unknown, _params: { q?: string }) {
            return { data: { items: [], total: 0 } };
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
        async listByUser(
            _actor: unknown,
            _input: {
                userId: string;
                page?: number;
                pageSize?: number;
                sortBy?: string;
                sortOrder?: string;
            }
        ) {
            return { data: { accommodationReviews: [], total: 0 } };
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
        async listByUser(
            _actor: unknown,
            _input: {
                userId: string;
                page?: number;
                pageSize?: number;
                sortBy?: string;
                sortOrder?: string;
            }
        ) {
            return { data: { data: [], pagination: { total: 0 } } };
        }
    }

    class UserBookmarkService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'bookmark_mock_id',
                    entityId: String((body as any).entityId || 'entity_mock_id'),
                    entityType: String((body as any).entityType || 'ACCOMMODATION'),
                    userId: String((body as any).userId || 'user_mock'),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async listBookmarksByUser(
            _actor: unknown,
            _input: { userId: string; page?: number; pageSize?: number; entityType?: string }
        ) {
            return { data: { bookmarks: [], total: 0 } };
        }
        async countBookmarksForUser(
            _actor: unknown,
            _input: { userId: string; entityType?: string }
        ) {
            return { data: { count: 0 } };
        }
        async softDelete(_actor: unknown, _id: string) {
            return { data: { count: 1 } };
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

    class EventLocationService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'event_location_mock_id',
                    slug: String((body as any).slug || 'location-mock'),
                    name: String((body as any).name || 'Location Mock'),
                    city: String((body as any).city || 'Test City'),
                    address: String((body as any).address || '123 Test St'),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdById: 'user_mock',
                    updatedById: 'user_mock'
                }
            };
        }

        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return {
                data: {
                    id,
                    slug: String((body as any).slug || 'location-updated'),
                    name: String((body as any).name || 'Location Updated')
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
                    slug: 'location-slug',
                    name: 'Test Location',
                    city: 'Test City',
                    address: '123 Test St',
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                    deletedAt: null
                }
            };
        }

        async getBySlug(_actor: unknown, slug: string) {
            return { data: { id: 'location_by_slug', slug, name: 'Location By Slug' } };
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

    class EventOrganizerService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'event_organizer_mock_id',
                    slug: String((body as any).slug || 'organizer-mock'),
                    name: String((body as any).name || 'Organizer Mock'),
                    description: (body as any).description || null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdById: 'user_mock',
                    updatedById: 'user_mock'
                }
            };
        }

        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return {
                data: {
                    id,
                    slug: String((body as any).slug || 'organizer-updated'),
                    name: String((body as any).name || 'Organizer Updated')
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
                    slug: 'organizer-slug',
                    name: 'Test Organizer',
                    description: 'Test description',
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                    deletedAt: null
                }
            };
        }

        async getBySlug(_actor: unknown, slug: string) {
            return { data: { id: 'organizer_by_slug', slug, name: 'Organizer By Slug' } };
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

    // Business Model System Services
    class ClientService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'client_mock_id',
                    name: String((body as any).name || 'Client Mock'),
                    billingEmail: String((body as any).billingEmail || 'billing@mock.com'),
                    userId: (body as any).userId || null,
                    status: (body as any).status || 'active',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }
        async getById(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return { data: { id, name: 'Test Client', billingEmail: 'test@example.com' } };
        }
        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return { data: { id, name: (body as any).name || 'Updated Client' } };
        }
        async softDelete(_actor: unknown, id: string) {
            return { data: { id, deletedAt: new Date().toISOString() } };
        }
    }

    class ClientAccessRightService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'client_access_right_mock_id',
                    clientId: String((body as any).clientId),
                    subscriptionItemId: String((body as any).subscriptionItemId),
                    feature: String((body as any).feature),
                    scope: String((body as any).scope),
                    scopeId: (body as any).scopeId || null,
                    scopeType: (body as any).scopeType || null,
                    validFrom: (body as any).validFrom || null,
                    validTo: (body as any).validTo || null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }
        async getById(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return { data: { id, feature: 'test-feature', scope: 'full' } };
        }
        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return { data: { id, feature: (body as any).feature } };
        }
        async softDelete(_actor: unknown, id: string) {
            return { data: { id, deletedAt: new Date().toISOString() } };
        }
    }

    class ProductService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'product_mock_id',
                    name: String((body as any).name || 'Product Mock'),
                    type: String((body as any).type || 'recurring'),
                    description: (body as any).description || null,
                    metadata: (body as any).metadata || null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }
        async getById(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return { data: { id, name: 'Test Product', type: 'recurring' } };
        }
        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return { data: { id, name: (body as any).name } };
        }
        async softDelete(_actor: unknown, id: string) {
            return { data: { id, deletedAt: new Date().toISOString() } };
        }
    }

    class PricingPlanService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'pricing_plan_mock_id',
                    productId: String((body as any).productId),
                    billingScheme: String((body as any).billingScheme || 'per_unit'),
                    interval: (body as any).interval || null,
                    amount: Number((body as any).amount || 0),
                    currency: String((body as any).currency || 'USD'),
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'draft',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }
        async getById(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return { data: { id, billingScheme: 'per_unit', currency: 'USD' } };
        }
        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return { data: { id, amount: (body as any).amount } };
        }
        async softDelete(_actor: unknown, id: string) {
            return { data: { id, deletedAt: new Date().toISOString() } };
        }
    }

    class PricingTierService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'pricing_tier_mock_id',
                    pricingPlanId: String((body as any).pricingPlanId),
                    minQuantity: Number((body as any).minQuantity),
                    maxQuantity:
                        (body as any).maxQuantity === null
                            ? null
                            : Number((body as any).maxQuantity),
                    unitPriceMinor: Number((body as any).unitPriceMinor),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }
        async getById(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return { data: { id, minQuantity: 1, maxQuantity: 10, unitPriceMinor: 1000 } };
        }
        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return { data: { id, unitPriceMinor: (body as any).unitPriceMinor } };
        }
        async softDelete(_actor: unknown, id: string) {
            return { data: { id, deletedAt: new Date().toISOString() } };
        }
    }

    class SubscriptionService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'subscription_mock_id',
                    clientId: String((body as any).clientId),
                    pricingPlanId: String((body as any).pricingPlanId),
                    status: String((body as any).status || 'active'),
                    currentPeriodStart:
                        (body as any).currentPeriodStart || new Date().toISOString(),
                    currentPeriodEnd: (body as any).currentPeriodEnd || null,
                    canceledAt: (body as any).canceledAt || null,
                    quantity: Number((body as any).quantity || 1),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }
        async getById(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return { data: { id, status: 'active', quantity: 1 } };
        }
        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return { data: { id, status: (body as any).status } };
        }
        async softDelete(_actor: unknown, id: string) {
            return { data: { id, deletedAt: new Date().toISOString() } };
        }
    }

    class PurchaseService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'purchase_mock_id',
                    clientId: String((body as any).clientId),
                    pricingPlanId: String((body as any).pricingPlanId),
                    amount: Number((body as any).amount),
                    currency: String((body as any).currency),
                    status: String((body as any).status || 'pending'),
                    quantity: Number((body as any).quantity || 1),
                    paymentId: (body as any).paymentId || null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }
        async getById(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return { data: { id, amount: 99.99, currency: 'USD', status: 'completed' } };
        }
        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return { data: { id, status: (body as any).status } };
        }
        async softDelete(_actor: unknown, id: string) {
            return { data: { id, deletedAt: new Date().toISOString() } };
        }
    }

    class SubscriptionItemService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'subscription_item_mock_id',
                    sourceId: String((body as any).sourceId),
                    sourceType: String((body as any).sourceType),
                    linkedEntityId: String((body as any).linkedEntityId),
                    entityType: String((body as any).entityType),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
            return { data: { items: [], total: 0 } };
        }
        async getById(_actor: unknown, id: string) {
            if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return { data: { id, sourceType: 'subscription', entityType: 'product' } };
        }
        async update(_actor: unknown, id: string, body: Record<string, unknown>) {
            return { data: { id, entityType: (body as any).entityType } };
        }
        async softDelete(_actor: unknown, id: string) {
            return { data: { id, deletedAt: new Date().toISOString() } };
        }
    }

    class PaymentService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'payment_mock_id',
                    userId: String((body as any).userId),
                    paymentPlanId: (body as any).paymentPlanId || null,
                    invoiceId: (body as any).invoiceId || null,
                    type: String((body as any).type || 'SUBSCRIPTION'),
                    status: String((body as any).status || 'PENDING'),
                    paymentMethod: (body as any).paymentMethod || null,
                    amount: Number((body as any).amount),
                    currency: String((body as any).currency || 'USD'),
                    description: (body as any).description || null,
                    metadata: (body as any).metadata || null,
                    mercadoPagoPaymentId: (body as any).mercadoPagoPaymentId || null,
                    mercadoPagoPreferenceId: (body as any).mercadoPagoPreferenceId || null,
                    externalReference: (body as any).externalReference || null,
                    processedAt: (body as any).processedAt || null,
                    expiresAt: (body as any).expiresAt || null,
                    failureReason: (body as any).failureReason || null,
                    mercadoPagoResponse: (body as any).mercadoPagoResponse || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    isDeleted:
                        (body as any).isDeleted !== undefined ? (body as any).isDeleted : false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: {
                    items: [],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 0,
                        totalPages: 0
                    }
                }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    userId: 'user_mock_id',
                    amount: 100,
                    currency: 'USD',
                    status: 'COMPLETED',
                    type: 'SUBSCRIPTION',
                    paymentMethod: 'CREDIT_CARD',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    status: (params.data as any).status || 'COMPLETED',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: {
                    id: params.id,
                    deletedAt: new Date().toISOString(),
                    isDeleted: true
                }
            };
        }
    }

    class PaymentMethodService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'payment_method_mock_id',
                    userId: String((body as any).userId),
                    type: String((body as any).type || 'CREDIT_CARD'),
                    provider: (body as any).provider || null,
                    isDefault:
                        (body as any).isDefault !== undefined ? (body as any).isDefault : false,
                    cardBrand: (body as any).cardBrand || null,
                    cardLastFour: (body as any).cardLastFour || null,
                    cardExpiryMonth: (body as any).cardExpiryMonth || null,
                    cardExpiryYear: (body as any).cardExpiryYear || null,
                    cardHolderName: (body as any).cardHolderName || null,
                    mercadoPagoCardId: (body as any).mercadoPagoCardId || null,
                    mercadoPagoCustomerId: (body as any).mercadoPagoCustomerId || null,
                    externalReference: (body as any).externalReference || null,
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    isDeleted:
                        (body as any).isDeleted !== undefined ? (body as any).isDeleted : false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: {
                    items: [],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 0,
                        totalPages: 0
                    }
                }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    userId: 'user_mock_id',
                    type: 'CREDIT_CARD',
                    provider: 'MERCADO_PAGO',
                    isDefault: true,
                    cardBrand: 'VISA',
                    cardLastFour: '4242',
                    cardExpiryMonth: 12,
                    cardExpiryYear: 2025,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    isDefault:
                        (params.data as any).isDefault !== undefined
                            ? (params.data as any).isDefault
                            : false,
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: {
                    id: params.id,
                    deletedAt: new Date().toISOString(),
                    isDeleted: true
                }
            };
        }
    }

    class InvoiceService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'invoice_mock_id',
                    clientId: String((body as any).clientId),
                    subscriptionId: (body as any).subscriptionId || null,
                    invoiceNumber: String((body as any).invoiceNumber || 'INV-001'),
                    status: String((body as any).status || 'DRAFT'),
                    issueDate: (body as any).issueDate || new Date().toISOString(),
                    dueDate: (body as any).dueDate || null,
                    paidDate: (body as any).paidDate || null,
                    subtotal: Number((body as any).subtotal || 0),
                    taxAmount: Number((body as any).taxAmount || 0),
                    totalAmount: Number((body as any).totalAmount || 0),
                    currency: String((body as any).currency || 'USD'),
                    notes: (body as any).notes || null,
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    isDeleted:
                        (body as any).isDeleted !== undefined ? (body as any).isDeleted : false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: {
                    items: [],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 0,
                        totalPages: 0
                    }
                }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    clientId: 'client_mock_id',
                    invoiceNumber: 'INV-001',
                    status: 'PAID',
                    issueDate: '2024-01-01T00:00:00.000Z',
                    totalAmount: 100,
                    currency: 'USD',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    status: (params.data as any).status || 'PAID',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: {
                    id: params.id,
                    deletedAt: new Date().toISOString(),
                    isDeleted: true
                }
            };
        }
    }

    class InvoiceLineService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'invoice_line_mock_id',
                    invoiceId: String((body as any).invoiceId),
                    description: String((body as any).description),
                    quantity: Number((body as any).quantity || 1),
                    unitPrice: Number((body as any).unitPrice || 0),
                    totalAmount: Number((body as any).totalAmount || 0),
                    taxAmount: (body as any).taxAmount || null,
                    discountAmount: (body as any).discountAmount || null,
                    productId: (body as any).productId || null,
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    isDeleted:
                        (body as any).isDeleted !== undefined ? (body as any).isDeleted : false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: {
                    items: [],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 0,
                        totalPages: 0
                    }
                }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    invoiceId: 'invoice_mock_id',
                    description: 'Test invoice line',
                    quantity: 1,
                    unitPrice: 100,
                    totalAmount: 100,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    quantity: (params.data as any).quantity || 1,
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: {
                    id: params.id,
                    deletedAt: new Date().toISOString(),
                    isDeleted: true
                }
            };
        }
    }

    class RefundService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'refund_mock_id',
                    paymentId: String((body as any).paymentId),
                    clientId: String((body as any).clientId),
                    refundNumber: String((body as any).refundNumber || 'REF-001'),
                    amount: Number((body as any).amount || 0),
                    currency: String((body as any).currency || 'USD'),
                    reason: String((body as any).reason || 'CUSTOMER_REQUEST'),
                    status: String((body as any).status || 'PENDING'),
                    description: (body as any).description || null,
                    processedAt: (body as any).processedAt || null,
                    processedById: (body as any).processedById || null,
                    providerRefundId: (body as any).providerRefundId || null,
                    failureReason: (body as any).failureReason || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    isDeleted:
                        (body as any).isDeleted !== undefined ? (body as any).isDeleted : false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: {
                    items: [],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 0,
                        totalPages: 0
                    }
                }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    paymentId: 'payment_mock_id',
                    clientId: 'client_mock_id',
                    refundNumber: 'REF-001',
                    amount: 50,
                    currency: 'USD',
                    reason: 'CUSTOMER_REQUEST',
                    status: 'COMPLETED',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    status: (params.data as any).status || 'COMPLETED',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: {
                    id: params.id,
                    deletedAt: new Date().toISOString(),
                    isDeleted: true
                }
            };
        }
    }

    class AdSlotService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'ad_slot_mock_id',
                    slotIdentifier: String((body as any).slotIdentifier || 'SLOT-001'),
                    placementPage: String((body as any).placementPage || 'HOME'),
                    position: String((body as any).position || 'TOP_BANNER'),
                    dimensions: (body as any).dimensions || { width: 728, height: 90 },
                    pricingModel: String((body as any).pricingModel || 'CPM'),
                    basePrice: Number((body as any).basePrice || 0),
                    currency: String((body as any).currency || 'USD'),
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    isTestSlot:
                        (body as any).isTestSlot !== undefined ? (body as any).isTestSlot : false,
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isDeleted:
                        (body as any).isDeleted !== undefined ? (body as any).isDeleted : false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: {
                    items: [],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 0,
                        totalPages: 0
                    }
                }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    slotIdentifier: 'SLOT-001',
                    placementPage: 'HOME',
                    position: 'TOP_BANNER',
                    pricingModel: 'CPM',
                    basePrice: 10,
                    currency: 'USD',
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    basePrice: (params.data as any).basePrice || 10,
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: {
                    id: params.id,
                    deletedAt: new Date().toISOString(),
                    isDeleted: true
                }
            };
        }
    }

    class AdSlotReservationService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'ad_slot_reservation_mock_id',
                    adSlotId: String((body as any).adSlotId),
                    clientId: String((body as any).clientId),
                    reservationNumber: String((body as any).reservationNumber || 'RES-001'),
                    startDate: (body as any).startDate || new Date().toISOString(),
                    endDate: (body as any).endDate || new Date().toISOString(),
                    status: String((body as any).status || 'PENDING'),
                    totalAmount: Number((body as any).totalAmount || 0),
                    currency: String((body as any).currency || 'USD'),
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isDeleted: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    adSlotId: 'adslot_mock_id',
                    clientId: 'client_mock_id',
                    reservationNumber: 'RES-001',
                    status: 'CONFIRMED',
                    totalAmount: 100,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    status: (params.data as any).status || 'CONFIRMED',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class ProfessionalServiceService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'professional_service_mock_id',
                    providerId: String((body as any).providerId),
                    serviceName: String((body as any).serviceName || 'Mock Service'),
                    serviceType: String((body as any).serviceType || 'CONSULTING'),
                    description: String((body as any).description || ''),
                    basePrice: Number((body as any).basePrice || 0),
                    currency: String((body as any).currency || 'USD'),
                    durationMinutes: Number((body as any).durationMinutes || 60),
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isDeleted: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    providerId: 'provider_mock_id',
                    serviceName: 'Mock Service',
                    serviceType: 'CONSULTING',
                    basePrice: 100,
                    currency: 'USD',
                    durationMinutes: 60,
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    basePrice: (params.data as any).basePrice || 100,
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class ProfessionalServiceOrderService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'service_order_mock_id',
                    clientId: String((body as any).clientId),
                    serviceTypeId: String((body as any).serviceTypeId),
                    pricingPlanId: String((body as any).pricingPlanId),
                    status: 'PENDING',
                    orderedAt: new Date().toISOString(),
                    clientRequirements: String((body as any).clientRequirements || ''),
                    pricing: (body as any).pricing || {},
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    clientId: 'client_mock_id',
                    serviceTypeId: 'service_type_mock_id',
                    pricingPlanId: 'pricing_plan_mock_id',
                    status: 'PENDING',
                    orderedAt: '2024-01-01T00:00:00.000Z',
                    clientRequirements: 'Mock requirements',
                    pricing: {},
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    status: (params.data as any).status || 'PENDING',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class ServiceListingService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'service_listing_mock_id',
                    providerId: String((body as any).providerId),
                    title: String((body as any).title || 'Mock Service Listing'),
                    description: String((body as any).description || ''),
                    serviceCategory: String((body as any).serviceCategory || 'OTHER'),
                    basePrice: Number((body as any).basePrice || 0),
                    currency: String((body as any).currency || 'USD'),
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isDeleted: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    providerId: 'provider_mock_id',
                    title: 'Mock Service Listing',
                    serviceCategory: 'CONSULTING',
                    basePrice: 100,
                    currency: 'USD',
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    basePrice: (params.data as any).basePrice || 100,
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class AccommodationListingService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'accommodation_listing_mock_id',
                    accommodationId: String((body as any).accommodationId),
                    pricingPlanId: String((body as any).pricingPlanId),
                    status: String((body as any).status || 'DRAFT'),
                    isTrial: (body as any).isTrial !== undefined ? (body as any).isTrial : false,
                    trialEndsAt: (body as any).trialEndsAt || null,
                    listingStartDate: (body as any).listingStartDate || new Date().toISOString(),
                    listingEndDate: (body as any).listingEndDate || null,
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isDeleted: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    accommodationId: 'accommodation_mock_id',
                    pricingPlanId: 'pricing_plan_mock_id',
                    status: 'ACTIVE',
                    isTrial: false,
                    listingStartDate: '2024-01-01T00:00:00.000Z',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    status: (params.data as any).status || 'ACTIVE',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class CreditNoteService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'credit_note_mock_id',
                    invoiceId: String((body as any).invoiceId),
                    clientId: String((body as any).clientId),
                    creditNoteNumber: String((body as any).creditNoteNumber || 'CN-001'),
                    amount: Number((body as any).amount || 0),
                    currency: String((body as any).currency || 'USD'),
                    reason: String((body as any).reason || 'REFUND'),
                    status: String((body as any).status || 'DRAFT'),
                    issueDate: (body as any).issueDate || new Date().toISOString(),
                    notes: (body as any).notes || null,
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    isDeleted: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    invoiceId: 'invoice_mock_id',
                    clientId: 'client_mock_id',
                    creditNoteNumber: 'CN-001',
                    amount: 50,
                    currency: 'USD',
                    reason: 'REFUND',
                    status: 'ISSUED',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    status: (params.data as any).status || 'ISSUED',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class PromotionService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'promotion_mock_id',
                    name: String((body as any).name || 'Mock Promotion'),
                    description: (body as any).description || null,
                    promotionType: String((body as any).promotionType || 'PERCENTAGE'),
                    discountPercentage: (body as any).discountPercentage || null,
                    discountAmount: (body as any).discountAmount || null,
                    startDate: (body as any).startDate || new Date().toISOString(),
                    endDate: (body as any).endDate || null,
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isDeleted: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    name: 'Mock Promotion',
                    promotionType: 'PERCENTAGE',
                    discountPercentage: 10,
                    startDate: '2024-01-01T00:00:00.000Z',
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    name: (params.data as any).name || 'Updated Promotion',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class DiscountCodeService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'discount_code_mock_id',
                    code: String((body as any).code || 'MOCK10'),
                    promotionId: (body as any).promotionId || null,
                    discountType: String((body as any).discountType || 'PERCENTAGE'),
                    discountValue: Number((body as any).discountValue || 10),
                    maxUses: (body as any).maxUses || null,
                    usedCount: (body as any).usedCount || 0,
                    validFrom: (body as any).validFrom || new Date().toISOString(),
                    validTo: (body as any).validTo || null,
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isDeleted: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    code: 'MOCK10',
                    discountType: 'PERCENTAGE',
                    discountValue: 10,
                    validFrom: '2024-01-01T00:00:00.000Z',
                    isActive: true,
                    usedCount: 0,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    code: (params.data as any).code || 'UPDATED10',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class DiscountCodeUsageService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'discount_code_usage_mock_id',
                    discountCodeId: String((body as any).discountCodeId),
                    clientId: String((body as any).clientId),
                    subscriptionId: (body as any).subscriptionId || null,
                    purchaseId: (body as any).purchaseId || null,
                    discountAmount: Number((body as any).discountAmount || 0),
                    usedAt: new Date().toISOString(),
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isDeleted: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    discountCodeId: 'discount_code_mock_id',
                    clientId: 'client_mock_id',
                    discountAmount: 10,
                    usedAt: '2024-01-01T00:00:00.000Z',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    discountAmount: (params.data as any).discountAmount || 10,
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class CampaignService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'campaign_mock_id',
                    name: String((body as any).name || 'Mock Campaign'),
                    description: (body as any).description || null,
                    campaignType: String((body as any).campaignType || 'EMAIL'),
                    startDate: (body as any).startDate || new Date().toISOString(),
                    endDate: (body as any).endDate || null,
                    budget: (body as any).budget || null,
                    currency: (body as any).currency || 'USD',
                    status: String((body as any).status || 'DRAFT'),
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    isDeleted: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    name: 'Mock Campaign',
                    campaignType: 'EMAIL',
                    startDate: '2024-01-01T00:00:00.000Z',
                    status: 'ACTIVE',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    status: (params.data as any).status || 'ACTIVE',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class NotificationService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'notification_mock_id',
                    userId: String((body as any).userId),
                    type: String((body as any).type || 'INFO'),
                    title: String((body as any).title || 'Mock Notification'),
                    message: String((body as any).message || 'Mock notification message'),
                    isRead: (body as any).isRead !== undefined ? (body as any).isRead : false,
                    readAt: (body as any).readAt || null,
                    actionUrl: (body as any).actionUrl || null,
                    metadata: (body as any).metadata || null,
                    lifecycleState: (body as any).lifecycleState || 'ACTIVE',
                    isActive: (body as any).isActive !== undefined ? (body as any).isActive : true,
                    isDeleted: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    userId: 'user_mock_id',
                    type: 'INFO',
                    title: 'Mock Notification',
                    message: 'Mock notification message',
                    isRead: false,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    isRead: (params.data as any).isRead || true,
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class AdPricingCatalogService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'ad_pricing_catalog_mock_id',
                    name: String((body as any).name || 'Mock Ad Pricing'),
                    basePrice: Number((body as any).basePrice || 0),
                    currency: String((body as any).currency || 'USD'),
                    pricingModel: String((body as any).pricingModel || 'CPM'),
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    name: 'Mock Ad Pricing',
                    basePrice: 10,
                    currency: 'USD',
                    pricingModel: 'CPM',
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    basePrice: (params.data as any).basePrice || 10,
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class AdMediaAssetService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'ad_media_asset_mock_id',
                    campaignId: String((body as any).campaignId),
                    assetType: String((body as any).assetType || 'IMAGE'),
                    assetUrl: String((body as any).assetUrl || 'https://example.com/asset.jpg'),
                    altText: (body as any).altText || null,
                    metadata: (body as any).metadata || null,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    campaignId: 'campaign_mock_id',
                    assetType: 'IMAGE',
                    assetUrl: 'https://example.com/asset.jpg',
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    assetUrl: (params.data as any).assetUrl || 'https://example.com/updated.jpg',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class SponsorshipService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'sponsorship_mock_id',
                    sponsorId: String((body as any).sponsorId),
                    entityType: String((body as any).entityType || 'POST'),
                    entityId: String((body as any).entityId),
                    startDate: (body as any).startDate || new Date().toISOString(),
                    endDate: (body as any).endDate || null,
                    amount: Number((body as any).amount || 0),
                    currency: String((body as any).currency || 'USD'),
                    status: String((body as any).status || 'ACTIVE'),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    sponsorId: 'sponsor_mock_id',
                    entityType: 'POST',
                    entityId: 'entity_mock_id',
                    amount: 100,
                    currency: 'USD',
                    status: 'ACTIVE',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    status: (params.data as any).status || 'ACTIVE',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class OwnerPromotionService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'owner_promotion_mock_id',
                    ownerId: String((body as any).ownerId),
                    accommodationId: String((body as any).accommodationId),
                    startDate: (body as any).startDate || new Date().toISOString(),
                    endDate: (body as any).endDate || null,
                    type: String((body as any).type || 'HIGHLIGHT'),
                    status: String((body as any).status || 'ACTIVE'),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    ownerId: 'owner_mock_id',
                    accommodationId: 'accommodation_mock_id',
                    type: 'HIGHLIGHT',
                    status: 'ACTIVE',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    status: (params.data as any).status || 'ACTIVE',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class TagService {
        async getBySlug(_actor: unknown, slug: string) {
            if (slug === 'existing-tag') {
                return {
                    data: {
                        id: 'tag-uuid-1234',
                        name: 'Existing Tag',
                        slug: 'existing-tag'
                    },
                    error: null
                };
            }
            return { data: null, error: null };
        }

        async search(_actor: unknown, _opts?: unknown) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }

        async findById(_actor: unknown, params: { id: string }) {
            return {
                data: {
                    id: params.id,
                    name: 'Mock Tag',
                    slug: 'mock-tag',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }

        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'tag_mock_id',

                    name: String((body as any).name || 'Mock Tag'),

                    slug: String((body as any).slug || 'mock-tag'),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }

        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,

                    name: (params.data as any).name || 'Updated Tag',
                    updatedAt: new Date().toISOString()
                }
            };
        }

        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class SponsorshipLevelService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'sponsorship_level_mock_id',
                    name: String((body as any).name || 'Mock Level'),
                    description: (body as any).description || null,
                    benefits: (body as any).benefits || [],
                    sortOrder: Number((body as any).sortOrder || 0),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            return {
                data: {
                    id: params.id,
                    name: 'Mock Level',
                    benefits: [],
                    sortOrder: 0,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    name: (params.data as any).name || 'Updated Level',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class SponsorshipPackageService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'sponsorship_package_mock_id',
                    name: String((body as any).name || 'Mock Package'),
                    description: (body as any).description || null,
                    price: Number((body as any).price || 0),
                    duration: Number((body as any).duration || 30),
                    features: (body as any).features || [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            return {
                data: {
                    id: params.id,
                    name: 'Mock Package',
                    price: 100,
                    duration: 30,
                    features: [],
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    name: (params.data as any).name || 'Updated Package',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class FeaturedAccommodationService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'featured_accommodation_mock_id',
                    accommodationId: String((body as any).accommodationId),
                    startDate: (body as any).startDate || new Date().toISOString(),
                    endDate: (body as any).endDate || null,
                    priority: Number((body as any).priority || 0),
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    accommodationId: 'accommodation_mock_id',
                    priority: 1,
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    priority: (params.data as any).priority || 1,
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class AccommodationListingPlanService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'accommodation_listing_plan_mock_id',
                    name: String((body as any).name || 'Mock Plan'),
                    description: (body as any).description || null,
                    pricingPlanId: String((body as any).pricingPlanId),
                    features: (body as any).features || [],
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    name: 'Mock Plan',
                    pricingPlanId: 'pricing_plan_mock_id',
                    features: [],
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    name: (params.data as any).name || 'Updated Plan',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class ServiceListingPlanService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'service_listing_plan_mock_id',
                    name: String((body as any).name || 'Mock Service Plan'),
                    description: (body as any).description || null,
                    pricingPlanId: String((body as any).pricingPlanId),
                    features: (body as any).features || [],
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    name: 'Mock Service Plan',
                    pricingPlanId: 'pricing_plan_mock_id',
                    features: [],
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    name: (params.data as any).name || 'Updated Service Plan',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class BenefitPartnerService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'benefit_partner_mock_id',
                    name: String((body as any).name || 'Mock Partner'),
                    description: (body as any).description || null,
                    category: String((body as any).category || 'GENERAL'),
                    contactInfo: (body as any).contactInfo || {},
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    name: 'Mock Partner',
                    category: 'GENERAL',
                    contactInfo: {},
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    name: (params.data as any).name || 'Updated Partner',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class BenefitListingPlanService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'benefit_listing_plan_mock_id',
                    name: String((body as any).name || 'Mock Benefit Plan'),
                    description: (body as any).description || null,
                    pricingPlanId: String((body as any).pricingPlanId),
                    maxListings: Number((body as any).maxListings || 10),
                    features: (body as any).features || [],
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    name: 'Mock Benefit Plan',
                    pricingPlanId: 'pricing_plan_mock_id',
                    maxListings: 10,
                    features: [],
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    name: (params.data as any).name || 'Updated Benefit Plan',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class BenefitListingService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'benefit_listing_mock_id',
                    clientId: String((body as any).clientId),
                    benefitPartnerId: String((body as any).benefitPartnerId),
                    benefitListingPlanId: String((body as any).benefitListingPlanId),
                    title: String((body as any).title || 'Mock Benefit'),
                    description: (body as any).description || null,
                    terms: (body as any).terms || '',
                    status: 'ACTIVE',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    clientId: 'client_mock_id',
                    benefitPartnerId: 'partner_mock_id',
                    benefitListingPlanId: 'plan_mock_id',
                    title: 'Mock Benefit',
                    status: 'ACTIVE',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    title: (params.data as any).title || 'Updated Benefit',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    class TouristServiceService {
        async create(_actor: unknown, body: Record<string, unknown>) {
            return {
                data: {
                    id: 'tourist_service_mock_id',
                    clientId: String((body as any).clientId),
                    name: String((body as any).name || 'Mock Tourist Service'),
                    description: (body as any).description || null,
                    category: String((body as any).category || 'TOUR'),
                    pricing: (body as any).pricing || {},
                    schedule: (body as any).schedule || {},
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async search(_actor: unknown, _opts?: any) {
            return {
                data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
            };
        }
        async findById(_actor: unknown, params: { id: string }) {
            if (params.id === '87654321-4321-4321-8765-876543218765') return { data: null };
            return {
                data: {
                    id: params.id,
                    clientId: 'client_mock_id',
                    name: 'Mock Tourist Service',
                    category: 'TOUR',
                    pricing: {},
                    schedule: {},
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            };
        }
        async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
            return {
                data: {
                    id: params.id,
                    name: (params.data as any).name || 'Updated Tourist Service',
                    updatedAt: new Date().toISOString()
                }
            };
        }
        async delete(_actor: unknown, params: { id: string }) {
            return {
                data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
            };
        }
    }

    // Exchange Rate Service
    class ExchangeRateService {
        async create(_actor: unknown, _data: Record<string, unknown>) {
            return {
                data: {
                    id: 'rate_mock_id',
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 1180.5,
                    inverseRate: 0.000847,
                    rateType: 'blue',
                    source: 'MANUAL',
                    isManualOverride: true,
                    fetchedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
    }

    // Exchange Rate Config Service
    class ExchangeRateConfigService {
        async getConfig(_actor: unknown) {
            return {
                data: {
                    id: 'config_mock_id',
                    refreshIntervalMinutes: 60,
                    staleThresholdMinutes: 120,
                    enableDolarApi: true,
                    enableExchangeRateApi: true,
                    enableManualOverrides: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }

        async updateConfig(_actor: unknown, _data: Record<string, unknown>) {
            return {
                data: {
                    id: 'config_mock_id',
                    refreshIntervalMinutes: 60,
                    staleThresholdMinutes: 120,
                    enableDolarApi: true,
                    enableExchangeRateApi: true,
                    enableManualOverrides: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        }
    }

    // Exchange Rate Fetcher
    class ExchangeRateFetcher {
        async fetchAndStore() {
            return {
                stored: 7,
                errors: [],
                fromManualOverride: 1,
                fromDolarApi: 5,
                fromExchangeRateApi: 2,
                fromDbFallback: 0
            };
        }

        async getRate(_params: unknown) {
            return {
                id: 'rate_mock_id',
                fromCurrency: 'USD',
                toCurrency: 'ARS',
                rate: 1180.5,
                inverseRate: 0.000847,
                rateType: 'blue',
                source: 'DOLARAPI',
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }

        async getRateWithFallback(_params: unknown) {
            return {
                rate: {
                    id: 'rate_mock_id',
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 1180.5,
                    inverseRate: 0.000847,
                    rateType: 'blue',
                    source: 'DOLARAPI',
                    isManualOverride: false,
                    fetchedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                quality: 'fresh' as const,
                source: 'DOLARAPI' as const,
                ageMinutes: 0
            };
        }

        getFailureCount(_source: string) {
            return 0;
        }
    }

    // DolarAPI Client
    class DolarApiClient {
        async fetchAll() {
            return {
                rates: [],
                errors: [],
                fetchedAt: new Date()
            };
        }

        async fetchDolarRates() {
            return {
                rates: [],
                errors: [],
                fetchedAt: new Date()
            };
        }

        async fetchAllCotizaciones() {
            return {
                rates: [],
                errors: [],
                fetchedAt: new Date()
            };
        }
    }

    // ExchangeRate-API Client
    class ExchangeRateApiClient {
        async fetchLatestRates() {
            return {
                rates: [],
                errors: [],
                fetchedAt: new Date()
            };
        }
    }

    return {
        PostService,
        AccommodationService,
        DestinationService,
        UserBookmarkService,
        EventService,
        EventLocationService,
        EventOrganizerService,
        UserService,
        AccommodationReviewService,
        DestinationReviewService,
        AttractionService,
        FeatureService,
        AmenityService,
        ClientService,
        ClientAccessRightService,
        ProductService,
        PricingPlanService,
        PricingTierService,
        SubscriptionService,
        PurchaseService,
        SubscriptionItemService,
        PaymentService,
        PaymentMethodService,
        InvoiceService,
        InvoiceLineService,
        RefundService,
        AdSlotService,
        AdSlotReservationService,
        ProfessionalServiceService,
        ProfessionalServiceOrderService,
        ServiceListingService,
        AccommodationListingService,
        CreditNoteService,
        PromotionService,
        DiscountCodeService,
        DiscountCodeUsageService,
        CampaignService,
        NotificationService,
        AdPricingCatalogService,
        AdMediaAssetService,
        SponsorshipService,
        SponsorshipLevelService,
        SponsorshipPackageService,
        OwnerPromotionService,
        TagService,
        FeaturedAccommodationService,
        AccommodationListingPlanService,
        ServiceListingPlanService,
        BenefitPartnerService,
        BenefitListingPlanService,
        BenefitListingService,
        TouristServiceService,
        ExchangeRateService,
        ExchangeRateConfigService,
        ExchangeRateFetcher,
        DolarApiClient,
        ExchangeRateApiClient,
        ServiceError
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
