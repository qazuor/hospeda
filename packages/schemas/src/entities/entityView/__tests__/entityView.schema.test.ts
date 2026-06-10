import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { EntityTypeEnum } from '../../../enums/entity-type.enum.js';
import { EntityViewCaptureInputSchema } from '../entityView.crud.schema.js';
import {
    EntityViewStatsListResponseSchema,
    EntityViewStatsResponseSchema,
    EntityViewStatsSchema
} from '../entityView.http.schema.js';
import {
    ENTITY_VIEW_DEFAULT_WINDOW,
    EntityViewQuerySchema,
    EntityViewWindowSchema
} from '../entityView.query.schema.js';
import { TrackableEntityTypeSchema } from '../entityView.schema.js';

// ============================================================================
// Fixtures
// ============================================================================

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ANOTHER_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ============================================================================
// TrackableEntityTypeSchema
// ============================================================================

describe('TrackableEntityTypeSchema', () => {
    describe('when given a trackable entity type', () => {
        it('should accept ACCOMMODATION', () => {
            // Arrange / Act
            const result = TrackableEntityTypeSchema.safeParse(EntityTypeEnum.ACCOMMODATION);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept POST', () => {
            const result = TrackableEntityTypeSchema.safeParse(EntityTypeEnum.POST);
            expect(result.success).toBe(true);
        });

        it('should accept EVENT', () => {
            const result = TrackableEntityTypeSchema.safeParse(EntityTypeEnum.EVENT);
            expect(result.success).toBe(true);
        });
    });

    describe('when given a non-trackable entity type', () => {
        it('should reject DESTINATION', () => {
            // Arrange / Act
            const result = TrackableEntityTypeSchema.safeParse(EntityTypeEnum.DESTINATION);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject USER', () => {
            const result = TrackableEntityTypeSchema.safeParse(EntityTypeEnum.USER);
            expect(result.success).toBe(false);
        });

        it('should reject CONVERSATION', () => {
            const result = TrackableEntityTypeSchema.safeParse(EntityTypeEnum.CONVERSATION);
            expect(result.success).toBe(false);
        });

        it('should reject REVIEW', () => {
            const result = TrackableEntityTypeSchema.safeParse(EntityTypeEnum.REVIEW);
            expect(result.success).toBe(false);
        });

        it('should reject BILLING_SUBSCRIPTION', () => {
            const result = TrackableEntityTypeSchema.safeParse(EntityTypeEnum.BILLING_SUBSCRIPTION);
            expect(result.success).toBe(false);
        });

        it('should reject PAYMENT', () => {
            const result = TrackableEntityTypeSchema.safeParse(EntityTypeEnum.PAYMENT);
            expect(result.success).toBe(false);
        });

        it('should reject an arbitrary unknown string', () => {
            const result = TrackableEntityTypeSchema.safeParse('UNKNOWN_TYPE');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = TrackableEntityTypeSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should reject lowercase variant', () => {
            const result = TrackableEntityTypeSchema.safeParse('accommodation');
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// EntityViewCaptureInputSchema
// ============================================================================

describe('EntityViewCaptureInputSchema', () => {
    describe('when given valid input', () => {
        it('should accept ACCOMMODATION + valid uuid', () => {
            // Arrange
            const input = { entityType: 'ACCOMMODATION', entityId: VALID_UUID };

            // Act
            const result = EntityViewCaptureInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept POST + valid uuid', () => {
            const result = EntityViewCaptureInputSchema.safeParse({
                entityType: 'POST',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(true);
        });

        it('should accept EVENT + valid uuid', () => {
            const result = EntityViewCaptureInputSchema.safeParse({
                entityType: 'EVENT',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when entityType is a non-trackable value', () => {
        it('should reject DESTINATION', () => {
            // Arrange / Act
            const result = EntityViewCaptureInputSchema.safeParse({
                entityType: 'DESTINATION',
                entityId: VALID_UUID
            });

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject USER', () => {
            const result = EntityViewCaptureInputSchema.safeParse({
                entityType: 'USER',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(false);
        });

        it('should reject REVIEW', () => {
            const result = EntityViewCaptureInputSchema.safeParse({
                entityType: 'REVIEW',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(false);
        });

        it('should reject BILLING_SUBSCRIPTION', () => {
            const result = EntityViewCaptureInputSchema.safeParse({
                entityType: 'BILLING_SUBSCRIPTION',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when entityId is invalid', () => {
        it('should reject a non-uuid string', () => {
            // Arrange / Act
            const result = EntityViewCaptureInputSchema.safeParse({
                entityType: 'ACCOMMODATION',
                entityId: 'not-a-uuid'
            });

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty string', () => {
            const result = EntityViewCaptureInputSchema.safeParse({
                entityType: 'ACCOMMODATION',
                entityId: ''
            });
            expect(result.success).toBe(false);
        });

        it('should reject a numeric id', () => {
            const result = EntityViewCaptureInputSchema.safeParse({
                entityType: 'ACCOMMODATION',
                entityId: 12345
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when required fields are missing', () => {
        it('should reject when entityType is absent', () => {
            const result = EntityViewCaptureInputSchema.safeParse({ entityId: VALID_UUID });
            expect(result.success).toBe(false);
        });

        it('should reject when entityId is absent', () => {
            const result = EntityViewCaptureInputSchema.safeParse({ entityType: 'ACCOMMODATION' });
            expect(result.success).toBe(false);
        });

        it('should reject an empty object', () => {
            const result = EntityViewCaptureInputSchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });

    describe('when extra fields are present', () => {
        it('should reject extra fields (strict schema)', () => {
            const result = EntityViewCaptureInputSchema.safeParse({
                entityType: 'ACCOMMODATION',
                entityId: VALID_UUID,
                extraField: 'should-fail'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// EntityViewWindowSchema
// ============================================================================

describe('EntityViewWindowSchema', () => {
    describe('when given a valid window', () => {
        it("should accept '7d'", () => {
            // Arrange / Act
            const result = EntityViewWindowSchema.safeParse('7d');

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe('7d');
            }
        });

        it("should accept '30d'", () => {
            const result = EntityViewWindowSchema.safeParse('30d');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe('30d');
            }
        });
    });

    describe('when given an invalid window', () => {
        it("should reject '90d'", () => {
            // Arrange / Act
            const result = EntityViewWindowSchema.safeParse('90d');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it("should reject '1d'", () => {
            const result = EntityViewWindowSchema.safeParse('1d');
            expect(result.success).toBe(false);
        });

        it("should reject '7D' (uppercase)", () => {
            const result = EntityViewWindowSchema.safeParse('7D');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = EntityViewWindowSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should reject a number', () => {
            const result = EntityViewWindowSchema.safeParse(7);
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// EntityViewQuerySchema
// ============================================================================

describe('EntityViewQuerySchema', () => {
    describe("when 'window' param is omitted", () => {
        it(`should default to '${ENTITY_VIEW_DEFAULT_WINDOW}'`, () => {
            // Arrange / Act
            const result = EntityViewQuerySchema.safeParse({});

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.window).toBe(ENTITY_VIEW_DEFAULT_WINDOW);
            }
        });
    });

    describe("when 'window' param is provided", () => {
        it("should accept '7d'", () => {
            const result = EntityViewQuerySchema.safeParse({ window: '7d' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.window).toBe('7d');
            }
        });

        it("should accept '30d'", () => {
            const result = EntityViewQuerySchema.safeParse({ window: '30d' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.window).toBe('30d');
            }
        });

        it("should reject '90d'", () => {
            const result = EntityViewQuerySchema.safeParse({ window: '90d' });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// EntityViewStatsSchema
// ============================================================================

describe('EntityViewStatsSchema', () => {
    describe('when given valid stats', () => {
        it('should accept zero unique and total', () => {
            // Arrange
            const input = { entityId: VALID_UUID, unique: 0, total: 0 };

            // Act
            const result = EntityViewStatsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept positive integer unique and total', () => {
            const result = EntityViewStatsSchema.safeParse({
                entityId: VALID_UUID,
                unique: 42,
                total: 150
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when entityId is invalid', () => {
        it('should reject a non-uuid entityId', () => {
            const result = EntityViewStatsSchema.safeParse({
                entityId: 'not-a-uuid',
                unique: 5,
                total: 10
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when unique is invalid', () => {
        it('should reject a negative unique count', () => {
            // Arrange / Act
            const result = EntityViewStatsSchema.safeParse({
                entityId: VALID_UUID,
                unique: -1,
                total: 10
            });

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject a non-integer unique count (float)', () => {
            const result = EntityViewStatsSchema.safeParse({
                entityId: VALID_UUID,
                unique: 1.5,
                total: 10
            });
            expect(result.success).toBe(false);
        });

        it('should reject a string unique count', () => {
            const result = EntityViewStatsSchema.safeParse({
                entityId: VALID_UUID,
                unique: '5',
                total: 10
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when total is invalid', () => {
        it('should reject a negative total count', () => {
            const result = EntityViewStatsSchema.safeParse({
                entityId: VALID_UUID,
                unique: 5,
                total: -1
            });
            expect(result.success).toBe(false);
        });

        it('should reject a non-integer total count (float)', () => {
            const result = EntityViewStatsSchema.safeParse({
                entityId: VALID_UUID,
                unique: 5,
                total: 9.9
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when fields are missing', () => {
        it('should reject missing entityId', () => {
            const result = EntityViewStatsSchema.safeParse({ unique: 5, total: 10 });
            expect(result.success).toBe(false);
        });

        it('should reject missing unique', () => {
            const result = EntityViewStatsSchema.safeParse({
                entityId: VALID_UUID,
                total: 10
            });
            expect(result.success).toBe(false);
        });

        it('should reject missing total', () => {
            const result = EntityViewStatsSchema.safeParse({
                entityId: VALID_UUID,
                unique: 5
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// EntityViewStatsResponseSchema
// ============================================================================

describe('EntityViewStatsResponseSchema', () => {
    it('should accept a valid single-entity stats response', () => {
        // Arrange
        const input = {
            data: { entityId: VALID_UUID, unique: 10, total: 30 }
        };

        // Act
        const result = EntityViewStatsResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject when data has invalid stats', () => {
        const result = EntityViewStatsResponseSchema.safeParse({
            data: { entityId: VALID_UUID, unique: -1, total: 30 }
        });
        expect(result.success).toBe(false);
    });

    it('should reject when data is absent', () => {
        const result = EntityViewStatsResponseSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// EntityViewStatsListResponseSchema
// ============================================================================

describe('EntityViewStatsListResponseSchema', () => {
    it('should accept a valid list stats response', () => {
        // Arrange
        const input = {
            data: [
                { entityId: VALID_UUID, unique: 10, total: 30 },
                { entityId: ANOTHER_UUID, unique: 5, total: 12 }
            ]
        };

        // Act
        const result = EntityViewStatsListResponseSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept an empty data array', () => {
        const result = EntityViewStatsListResponseSchema.safeParse({ data: [] });
        expect(result.success).toBe(true);
    });

    it('should reject when any item in data has invalid stats', () => {
        const result = EntityViewStatsListResponseSchema.safeParse({
            data: [
                { entityId: VALID_UUID, unique: 10, total: 30 },
                { entityId: ANOTHER_UUID, unique: -5, total: 12 } // negative unique
            ]
        });
        expect(result.success).toBe(false);
    });

    it('should reject when data is absent', () => {
        const result = EntityViewStatsListResponseSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});
