/**
 * Mock implementations for content-related services.
 *
 * Provides happy-path mock classes for PostService and related content
 * services used in unit tests.
 *
 * @module test/helpers/mocks/content-services
 */

import { ServiceErrorCode } from '@repo/schemas';

/**
 * Minimal ServiceError used within mock implementations.
 */
export class ServiceError extends Error {
    constructor(
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'ServiceError';
    }
}

/**
 * Mock PostService - returns predictable happy-path data.
 */
export class PostService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'post_mock_id',
                slug: String((body as Record<string, unknown>).slug || 'post-mock'),
                title: String((body as Record<string, unknown>).title || 'Post Mock'),
                category: (body as Record<string, unknown>).category || 'NEWS',
                isFeatured: Boolean((body as Record<string, unknown>).isFeatured ?? false),
                isNews: Boolean((body as Record<string, unknown>).isNews ?? false),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                authorId: 'user_mock',
                media: { featuredImage: { url: 'https://example.com/post.jpg' } },
                summary: (body as Record<string, unknown>).summary || 'Mock summary'
            }
        };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return {
            data: {
                id,
                slug: String((body as Record<string, unknown>).slug || 'post-updated'),
                title: String((body as Record<string, unknown>).title || 'Post Updated')
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

    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
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

/**
 * Mock TagService - returns predictable happy-path data.
 */
export class TagService {
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

    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
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
                name: String((body as Record<string, unknown>).name || 'Mock Tag'),
                slug: String((body as Record<string, unknown>).slug || 'mock-tag'),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                name: (params.data as Record<string, unknown>).name || 'Updated Tag',
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

/**
 * Mock PostSponsorService - returns predictable happy-path data.
 */
export class PostSponsorService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'post_sponsor_mock_id',
                postId: String((body as Record<string, unknown>).postId || 'post_mock'),
                sponsorName: String(
                    (body as Record<string, unknown>).sponsorName || 'Mock Sponsor'
                ),
                sponsorUrl: String(
                    (body as Record<string, unknown>).sponsorUrl || 'https://example.com'
                ),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return {
            data: {
                id,
                sponsorName: String(
                    (body as Record<string, unknown>).sponsorName || 'Updated Sponsor'
                ),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async patch(_actor: unknown, id: string, body: Record<string, unknown>) {
        return {
            data: {
                id,
                ...body,
                updatedAt: new Date().toISOString()
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

    async list(_actor: unknown, _opts?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
    }

    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
    }

    async getById(_actor: unknown, id: string) {
        if (id === '87654321-4321-4321-8765-876543218765') return { data: null };
        return {
            data: {
                id,
                postId: 'post_mock',
                sponsorName: 'Test Sponsor',
                sponsorUrl: 'https://example.com',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }
}

// Re-export ServiceErrorCode for use in mock implementations
export { ServiceErrorCode };
