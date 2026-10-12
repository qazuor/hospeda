import { describe, expect, it } from 'vitest';
import {
    ListingSupportEditsResponseSchema,
    SupportEditPartSchema
} from '../../src/common/listing-support-edit.schema';

describe('TEST:V8a:8 support edits response schema (row 26)', () => {
    it('declares exactly the five parts of H9', () => {
        // Arrange + Act
        const parts = SupportEditPartSchema.options;

        // Assert
        expect(parts).toEqual(['texts', 'photos', 'faq', 'hours', 'other']);
    });

    it('accepts items with an instant and their parts', () => {
        // Arrange
        const body = {
            items: [{ occurredAt: '2026-10-12T15:00:00.000Z', parts: ['texts', 'photos'] }]
        };

        // Act
        const result = ListingSupportEditsResponseSchema.safeParse(body);

        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts an empty list', () => {
        // Arrange + Act
        const result = ListingSupportEditsResponseSchema.safeParse({ items: [] });

        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects a part outside the closed list', () => {
        // Arrange
        const body = { items: [{ occurredAt: '2026-10-12T15:00:00.000Z', parts: ['price'] }] };

        // Act
        const result = ListingSupportEditsResponseSchema.safeParse(body);

        // Assert
        expect(result.success).toBe(false);
    });

    it('strips the admin identity and the reason from an item', () => {
        // Arrange
        const body = {
            items: [
                {
                    occurredAt: '2026-10-12T15:00:00.000Z',
                    parts: ['faq'],
                    actorId: 'admin',
                    reason: 'owner asked'
                }
            ]
        };

        // Act
        const result = ListingSupportEditsResponseSchema.parse(body);

        // Assert
        expect(result.items[0]).toEqual({ occurredAt: '2026-10-12T15:00:00.000Z', parts: ['faq'] });
    });
});
