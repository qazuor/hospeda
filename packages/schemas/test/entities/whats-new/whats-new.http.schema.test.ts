/**
 * Unit tests for `WhatsNewSeenBodySchema` and `WhatsNewGetResponseSchema` (SPEC-175 T-001).
 *
 * Covers the HTTP request/response schemas defined in
 * `packages/schemas/src/entities/whats-new/whats-new.http.schema.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
    WhatsNewGetResponseSchema,
    WhatsNewSeenBodySchema
} from '../../../src/entities/whats-new/whats-new.http.schema.js';

// ---------------------------------------------------------------------------
// WhatsNewSeenBodySchema
// ---------------------------------------------------------------------------

describe('WhatsNewSeenBodySchema', () => {
    describe('when given valid input', () => {
        it('should parse a single-id array', () => {
            // Arrange
            const input = { ids: ['2026-05-29-feature-x'] };

            // Act
            const result = WhatsNewSeenBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toEqual(['2026-05-29-feature-x']);
            }
        });

        it('should parse a multi-id array', () => {
            // Arrange
            const input = { ids: ['entry-001', 'entry-002', 'entry-003'] };

            // Act
            const result = WhatsNewSeenBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an empty ids array', () => {
            // Arrange — at least one id is required
            const input = { ids: [] };

            // Act
            const result = WhatsNewSeenBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when ids contains an empty string', () => {
            // Arrange
            const input = { ids: [''] };

            // Act
            const result = WhatsNewSeenBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when ids is missing', () => {
            // Arrange
            const input = {};

            // Act
            const result = WhatsNewSeenBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// WhatsNewGetResponseSchema
// ---------------------------------------------------------------------------

describe('WhatsNewGetResponseSchema', () => {
    const BASE_ITEM = {
        id: 'entry-001',
        publishedAt: '2026-05-29T00:00:00Z',
        highlight: false,
        title: 'Test title',
        body: 'Test body',
        seen: false
    };

    describe('when given valid input', () => {
        it('should parse a response with unseen items', () => {
            // Arrange
            const input = {
                items: [BASE_ITEM],
                unseenCount: 1
            };

            // Act
            const result = WhatsNewGetResponseSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.unseenCount).toBe(1);
                expect(result.data.items).toHaveLength(1);
                expect(result.data.items[0]?.seen).toBe(false);
            }
        });

        it('should parse an empty items response', () => {
            // Arrange
            const input = { items: [], unseenCount: 0 };

            // Act
            const result = WhatsNewGetResponseSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse an item with an optional image', () => {
            // Arrange
            const input = {
                items: [
                    {
                        ...BASE_ITEM,
                        image: 'https://cdn.example.com/screenshot.png'
                    }
                ],
                unseenCount: 1
            };

            // Act
            const result = WhatsNewGetResponseSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse a seen item', () => {
            // Arrange
            const input = {
                items: [{ ...BASE_ITEM, seen: true }],
                unseenCount: 0
            };

            // Act
            const result = WhatsNewGetResponseSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items[0]?.seen).toBe(true);
            }
        });
    });

    describe('when given invalid input', () => {
        it('should reject a negative unseenCount', () => {
            // Arrange
            const input = { items: [], unseenCount: -1 };

            // Act
            const result = WhatsNewGetResponseSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a non-integer unseenCount', () => {
            // Arrange
            const input = { items: [], unseenCount: 1.5 };

            // Act
            const result = WhatsNewGetResponseSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an item with a non-URL image', () => {
            // Arrange
            const input = {
                items: [{ ...BASE_ITEM, image: 'not-a-url' }],
                unseenCount: 0
            };

            // Act
            const result = WhatsNewGetResponseSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when items is missing', () => {
            // Arrange
            const input = { unseenCount: 0 };

            // Act
            const result = WhatsNewGetResponseSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
