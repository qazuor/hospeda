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
    process.env.CLERK_PUBLISHABLE_KEY = 'test_clerk_publishable';

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

    // Mock @repo/service-core to force 2xx happy paths without DB/auth
    vi.mock('@repo/service-core', () => {
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

        return { AccommodationService, DestinationService, UserService };
    });
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
