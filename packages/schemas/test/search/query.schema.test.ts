import { describe, expect, it } from 'vitest';
import {
    PublicSearchQuerySchema,
    PublicSearchResponseSchema,
    PublicSearchResultItemSchema
} from '../../src/search/query.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeValidItem = (overrides: Record<string, unknown> = {}) => ({
    id: VALID_UUID,
    slug: 'hotel-del-litoral',
    name: 'Hotel del Litoral',
    ...overrides
});

const makeValidGroup = (overrides: Record<string, unknown> = {}) => ({
    items: [],
    total: 0,
    ...overrides
});

// ---------------------------------------------------------------------------
// PublicSearchQuerySchema
// ---------------------------------------------------------------------------

describe('PublicSearchQuerySchema', () => {
    describe('happy path', () => {
        it('should accept a query with q >= 2 chars and default limit to 5', () => {
            // Arrange
            const input = { q: 'pl' };

            // Act
            const result = PublicSearchQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.q).toBe('pl');
                expect(result.data.limit).toBe(5);
            }
        });

        it('should accept an explicit limit within range', () => {
            const result = PublicSearchQuerySchema.safeParse({ q: 'playa', limit: 10 });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(10);
            }
        });

        it('should coerce a string limit to a number', () => {
            const result = PublicSearchQuerySchema.safeParse({ q: 'playa', limit: '8' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(8);
            }
        });

        it('should accept limit = 1 (minimum)', () => {
            const result = PublicSearchQuerySchema.safeParse({ q: 'ab', limit: 1 });
            expect(result.success).toBe(true);
        });

        it('should accept limit = 20 (maximum)', () => {
            const result = PublicSearchQuerySchema.safeParse({ q: 'ab', limit: 20 });
            expect(result.success).toBe(true);
        });

        it('should accept q with exactly 100 chars', () => {
            const result = PublicSearchQuerySchema.safeParse({ q: 'a'.repeat(100) });
            expect(result.success).toBe(true);
        });
    });

    describe('q validation', () => {
        it('should reject q with fewer than 2 characters', () => {
            // Arrange
            const input = { q: 'a' };

            // Act
            const result = PublicSearchQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const paths = result.error.issues.map((i) => i.path.join('.'));
                expect(paths).toContain('q');
            }
        });

        it('should reject an empty q', () => {
            const result = PublicSearchQuerySchema.safeParse({ q: '' });
            expect(result.success).toBe(false);
        });

        it('should reject q exceeding 100 characters', () => {
            const result = PublicSearchQuerySchema.safeParse({ q: 'a'.repeat(101) });
            expect(result.success).toBe(false);
        });

        it('should reject when q is missing entirely', () => {
            const result = PublicSearchQuerySchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });

    describe('limit validation', () => {
        it('should reject limit = 0', () => {
            const result = PublicSearchQuerySchema.safeParse({ q: 'ab', limit: 0 });
            expect(result.success).toBe(false);
        });

        it('should reject limit = 21 (above maximum)', () => {
            const result = PublicSearchQuerySchema.safeParse({ q: 'ab', limit: 21 });
            expect(result.success).toBe(false);
        });

        it('should reject a non-numeric limit string', () => {
            const result = PublicSearchQuerySchema.safeParse({ q: 'ab', limit: 'much' });
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// PublicSearchResultItemSchema
// ---------------------------------------------------------------------------

describe('PublicSearchResultItemSchema', () => {
    describe('happy path', () => {
        it('should accept an item with only the required fields', () => {
            // Arrange
            const input = makeValidItem();

            // Act
            const result = PublicSearchResultItemSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe(VALID_UUID);
                expect(result.data.slug).toBe('hotel-del-litoral');
                expect(result.data.name).toBe('Hotel del Litoral');
            }
        });

        it('should accept an item with all optional fields populated', () => {
            const result = PublicSearchResultItemSchema.safeParse(
                makeValidItem({
                    coverImage: 'https://cdn.example.com/img.jpg',
                    type: 'HOTEL',
                    category: 'accommodation'
                })
            );
            expect(result.success).toBe(true);
        });

        it('should accept missing optional fields (coverImage, type, category)', () => {
            const result = PublicSearchResultItemSchema.safeParse(makeValidItem());
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.coverImage).toBeUndefined();
                expect(result.data.type).toBeUndefined();
                expect(result.data.category).toBeUndefined();
            }
        });
    });

    describe('invalid items', () => {
        it('should reject a malformed id (non-UUID)', () => {
            // Arrange
            const input = makeValidItem({ id: 'not-a-uuid' });

            // Act
            const result = PublicSearchResultItemSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((i) => i.path.includes('id'))).toBe(true);
            }
        });

        it('should reject when id is missing', () => {
            const { id: _id, ...rest } = makeValidItem();
            const result = PublicSearchResultItemSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject an empty slug', () => {
            const result = PublicSearchResultItemSchema.safeParse(makeValidItem({ slug: '' }));
            expect(result.success).toBe(false);
        });

        it('should reject an empty name', () => {
            const result = PublicSearchResultItemSchema.safeParse(makeValidItem({ name: '' }));
            expect(result.success).toBe(false);
        });

        it('should reject coverImage that is not a valid URL', () => {
            const result = PublicSearchResultItemSchema.safeParse(
                makeValidItem({ coverImage: 'not-a-url' })
            );
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// PublicSearchResponseSchema
// ---------------------------------------------------------------------------

describe('PublicSearchResponseSchema', () => {
    describe('happy path', () => {
        it('should accept a response with all four groups empty', () => {
            // Arrange
            const input = {
                accommodations: makeValidGroup(),
                destinations: makeValidGroup(),
                events: makeValidGroup(),
                posts: makeValidGroup()
            };

            // Act
            const result = PublicSearchResponseSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a response with populated items in each group', () => {
            const item = makeValidItem();
            const group = makeValidGroup({ items: [item], total: 1 });

            const result = PublicSearchResponseSchema.safeParse({
                accommodations: group,
                destinations: group,
                events: group,
                posts: group
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.accommodations.items).toHaveLength(1);
                expect(result.data.accommodations.total).toBe(1);
            }
        });

        it('should accept mixed — some groups empty, some populated', () => {
            const item = makeValidItem();
            const result = PublicSearchResponseSchema.safeParse({
                accommodations: makeValidGroup({ items: [item], total: 3 }),
                destinations: makeValidGroup(),
                events: makeValidGroup({ items: [item], total: 1 }),
                posts: makeValidGroup()
            });
            expect(result.success).toBe(true);
        });
    });

    describe('invalid responses', () => {
        it('should reject when a group is missing (e.g. destinations absent)', () => {
            const result = PublicSearchResponseSchema.safeParse({
                accommodations: makeValidGroup(),
                events: makeValidGroup(),
                posts: makeValidGroup()
                // destinations missing
            });
            expect(result.success).toBe(false);
        });

        it('should reject when a group item has a malformed id', () => {
            // Arrange
            const badItem = makeValidItem({ id: 'bad-id' });

            // Act
            const result = PublicSearchResponseSchema.safeParse({
                accommodations: makeValidGroup({ items: [badItem], total: 1 }),
                destinations: makeValidGroup(),
                events: makeValidGroup(),
                posts: makeValidGroup()
            });

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a negative total', () => {
            const result = PublicSearchResponseSchema.safeParse({
                accommodations: makeValidGroup({ total: -1 }),
                destinations: makeValidGroup(),
                events: makeValidGroup(),
                posts: makeValidGroup()
            });
            expect(result.success).toBe(false);
        });
    });
});
