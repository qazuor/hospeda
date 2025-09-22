import type { EventSchema } from '@repo/schemas';
import {
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/event/event.normalizers';
import { getMockId } from '../../factories/utilsFactory';

/**
 * Helper para crear un input compatible con EventSchema (fechas string, IDs y enums correctos).
 */
const createMockEventSchemaInput = (
    overrides: Partial<z.infer<typeof EventSchema>> = {}
): z.infer<typeof EventSchema> => ({
    id: getMockId('event'),
    slug: 'test-event',
    name: 'Test Event',
    summary: 'A test event for normalization',
    description: 'A test event description',
    media: undefined,
    category: EventCategoryEnum.FESTIVAL,
    date: { start: new Date('2024-01-01T10:00:00Z'), end: new Date('2024-01-01T12:00:00Z') },
    authorId: getMockId('user'),
    locationId: getMockId('event'),
    organizerId: getMockId('event'),
    pricing: undefined,
    contactInfo: undefined,
    visibility: VisibilityEnum.PUBLIC,
    isFeatured: false,
    createdAt: new Date('2024-01-01T09:00:00Z'),
    updatedAt: new Date('2024-01-01T09:00:00Z'),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.PENDING,
    createdById: getMockId('user'),
    updatedById: getMockId('user'),
    deletedAt: undefined,
    deletedById: undefined,
    adminInfo: undefined,
    tags: [],
    seo: undefined,
    ...overrides
});

/**
 * Tests for EventService normalizers (normalizeCreateInput, normalizeUpdateInput).
 * Covers: correct normalization, type safety, edge cases.
 */
describe('EventService normalizers', () => {
    it('should normalize create input (dates and IDs)', () => {
        // Arrange
        const input = createMockEventSchemaInput();
        // Act
        const result = normalizeCreateInput(input);
        // Assert
        expect(result.date).toBeDefined();
        if (result.date) {
            expect(result.date.start).toBeInstanceOf(Date);
            expect(result.date.end).toBeInstanceOf(Date);
        }
        expect(result.locationId).toBe(input.locationId);
        expect(result.organizerId).toBe(input.organizerId);
    });

    it('should normalize update input (dates and IDs as string)', () => {
        // Arrange
        const input = {
            id: getMockId('event'),
            name: 'Updated Event',
            date: {
                start: new Date('2024-01-01T10:00:00Z'),
                end: new Date('2024-01-01T12:00:00Z')
            },
            locationId: getMockId('event'),
            organizerId: getMockId('event')
        };
        // Act
        const result = normalizeUpdateInput(input);
        // Assert
        expect(result.date).toBeDefined();
        if (result.date) {
            expect(result.date.start).toBeInstanceOf(Date);
            expect(result.date.end).toBeInstanceOf(Date);
        }
        expect(result.locationId).toBe(input.locationId);
        expect(result.organizerId).toBe(input.organizerId);
    });
});
