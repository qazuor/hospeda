import { describe, expect, it } from 'vitest';
import {
    type SubscriptionEvent,
    SubscriptionEventSchema,
    type SubscriptionEventsResponse,
    SubscriptionEventsResponseSchema
} from '../../../src/api/billing/subscription-event.schema.js';

const BASE_EVENT = {
    id: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
    subscriptionId: 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789',
    triggerSource: 'system',
    providerEventId: null,
    metadata: {},
    createdAt: '2026-01-15T10:00:00.000Z'
};

describe('SubscriptionEventSchema', () => {
    describe('state transition event pattern', () => {
        it('should accept a record with previousStatus and newStatus set and eventType absent', () => {
            // Arrange
            const event = {
                ...BASE_EVENT,
                previousStatus: 'active',
                newStatus: 'cancelled'
            };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.previousStatus).toBe('active');
                expect(result.data.newStatus).toBe('cancelled');
                expect(result.data.eventType).toBeUndefined();
            }
        });

        it('should accept a record with previousStatus and newStatus set and eventType explicitly null', () => {
            // Arrange
            const event = {
                ...BASE_EVENT,
                previousStatus: 'trialing',
                newStatus: 'active',
                eventType: null
            };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.eventType).toBeNull();
                expect(result.data.previousStatus).toBe('trialing');
                expect(result.data.newStatus).toBe('active');
            }
        });
    });

    describe('operational event pattern', () => {
        it('should accept a record with eventType set and both status fields null', () => {
            // Arrange
            const event = {
                ...BASE_EVENT,
                eventType: 'payment.retry',
                previousStatus: null,
                newStatus: null
            };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.eventType).toBe('payment.retry');
                expect(result.data.previousStatus).toBeNull();
                expect(result.data.newStatus).toBeNull();
            }
        });

        it('should accept a record with eventType set and both status fields absent', () => {
            // Arrange
            const event = {
                ...BASE_EVENT,
                eventType: 'invoice.generated'
            };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.eventType).toBe('invoice.generated');
                expect(result.data.previousStatus).toBeUndefined();
                expect(result.data.newStatus).toBeUndefined();
            }
        });
    });

    describe('eventType field validation', () => {
        it('should reject eventType longer than 100 characters', () => {
            // Arrange
            const event = {
                ...BASE_EVENT,
                eventType: 'a'.repeat(101)
            };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const issue = result.error.issues.find((i) => i.path.includes('eventType'));
                expect(issue).toBeDefined();
            }
        });

        it('should accept eventType at exactly 100 characters', () => {
            // Arrange
            const event = {
                ...BASE_EVENT,
                eventType: 'a'.repeat(100)
            };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept eventType as null explicitly', () => {
            // Arrange
            const event = {
                ...BASE_EVENT,
                eventType: null
            };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.eventType).toBeNull();
            }
        });

        it('should accept eventType as undefined (field omitted)', () => {
            // Arrange
            const event = { ...BASE_EVENT };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.eventType).toBeUndefined();
            }
        });

        it('should reject non-string eventType', () => {
            // Arrange
            const event = {
                ...BASE_EVENT,
                eventType: 42
            };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('previousStatus field validation', () => {
        it('should accept previousStatus as null', () => {
            // Arrange
            const event = {
                ...BASE_EVENT,
                eventType: 'renewal.skipped',
                previousStatus: null
            };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.previousStatus).toBeNull();
            }
        });

        it('should accept previousStatus when absent (optional)', () => {
            // Arrange
            const event = { ...BASE_EVENT };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject previousStatus exceeding 50 characters', () => {
            // Arrange
            const event = {
                ...BASE_EVENT,
                previousStatus: 'x'.repeat(51)
            };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('newStatus field validation', () => {
        it('should accept newStatus as null', () => {
            // Arrange
            const event = {
                ...BASE_EVENT,
                eventType: 'dunning.started',
                newStatus: null
            };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.newStatus).toBeNull();
            }
        });

        it('should accept newStatus when absent (optional)', () => {
            // Arrange
            const event = { ...BASE_EVENT };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject newStatus exceeding 50 characters', () => {
            // Arrange
            const event = {
                ...BASE_EVENT,
                newStatus: 'y'.repeat(51)
            };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('required fields', () => {
        it('should reject missing id', () => {
            // Arrange
            const { id: _id, ...event } = { ...BASE_EVENT };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject non-uuid id', () => {
            // Arrange
            const event = { ...BASE_EVENT, id: 'not-a-uuid' };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject missing subscriptionId', () => {
            // Arrange
            const { subscriptionId: _sub, ...event } = { ...BASE_EVENT };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid createdAt format', () => {
            // Arrange
            const event = { ...BASE_EVENT, createdAt: 'not-a-date' };

            // Act
            const result = SubscriptionEventSchema.safeParse(event);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('type inference', () => {
        it('should produce a valid SubscriptionEvent type with all optional fields', () => {
            // Arrange & Act
            const event: SubscriptionEvent = {
                id: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
                subscriptionId: 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789',
                eventType: 'payment.retry',
                previousStatus: null,
                newStatus: null,
                triggerSource: 'system',
                providerEventId: null,
                metadata: {},
                createdAt: '2026-01-15T10:00:00.000Z'
            };

            // Assert
            expect(event.eventType).toBe('payment.retry');
            expect(event.previousStatus).toBeNull();
            expect(event.newStatus).toBeNull();
        });
    });
});

describe('SubscriptionEventsResponseSchema', () => {
    it('should validate a paginated response with operational events', () => {
        // Arrange
        const response = {
            data: [
                {
                    ...BASE_EVENT,
                    eventType: 'payment.retry',
                    previousStatus: null,
                    newStatus: null
                }
            ],
            pagination: {
                page: 1,
                pageSize: 10,
                totalItems: 1,
                totalPages: 1
            }
        };

        // Act
        const result = SubscriptionEventsResponseSchema.safeParse(response);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            const first = result.data.data[0];
            expect(first?.eventType).toBe('payment.retry');
            expect(first?.previousStatus).toBeNull();
        }
    });

    it('should validate a paginated response with state transition events', () => {
        // Arrange
        const response = {
            data: [
                {
                    ...BASE_EVENT,
                    previousStatus: 'active',
                    newStatus: 'past_due'
                }
            ],
            pagination: {
                page: 1,
                pageSize: 10,
                totalItems: 1,
                totalPages: 1
            }
        };

        // Act
        const result = SubscriptionEventsResponseSchema.safeParse(response);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            const typed: SubscriptionEventsResponse = result.data;
            expect(typed.data[0]?.previousStatus).toBe('active');
        }
    });

    it('should reject pagination with non-positive page number', () => {
        // Arrange
        const response = {
            data: [],
            pagination: { page: 0, pageSize: 10, totalItems: 0, totalPages: 0 }
        };

        // Act
        const result = SubscriptionEventsResponseSchema.safeParse(response);

        // Assert
        expect(result.success).toBe(false);
    });
});
