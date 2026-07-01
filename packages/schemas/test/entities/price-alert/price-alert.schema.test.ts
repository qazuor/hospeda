import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import {
    CreatePriceAlertInputSchema,
    DeletePriceAlertInputSchema,
    PriceAlertUpdateInputSchema
} from '../../../src/entities/price-alert/price-alert.crud.schema.js';
import {
    ListPriceAlertsInputSchema,
    PriceAlertResponseSchema
} from '../../../src/entities/price-alert/price-alert.query.schema.js';
import { PriceAlertSchema } from '../../../src/entities/price-alert/price-alert.schema.js';

const validPriceAlertBase = () => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    accommodationId: faker.string.uuid(),
    basePriceSnapshot: 1_500_00,
    targetPercentDrop: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
});

describe('PriceAlertSchema', () => {
    describe('when given valid input', () => {
        it('should validate a complete valid price alert', () => {
            // Arrange
            const data = validPriceAlertBase();

            // Act
            const result = PriceAlertSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept null targetPercentDrop (any-drop alert)', () => {
            // Arrange
            const data = { ...validPriceAlertBase(), targetPercentDrop: null };

            // Act
            const result = PriceAlertSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.targetPercentDrop).toBeNull();
            }
        });

        it('should validate a soft-deleted alert (deletedAt set)', () => {
            // Arrange
            const data = { ...validPriceAlertBase(), deletedAt: new Date() };

            // Act
            const result = PriceAlertSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should validate a live alert without deletedAt (field omitted)', () => {
            // Arrange
            const data = validPriceAlertBase();

            // Act
            const result = PriceAlertSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.deletedAt).toBeUndefined();
            }
        });
    });

    describe('when given invalid input', () => {
        it('should reject targetPercentDrop = 0', () => {
            // Arrange
            const data = { ...validPriceAlertBase(), targetPercentDrop: 0 };

            // Act
            const result = PriceAlertSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject targetPercentDrop = 101', () => {
            // Arrange
            const data = { ...validPriceAlertBase(), targetPercentDrop: 101 };

            // Act
            const result = PriceAlertSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a non-integer targetPercentDrop', () => {
            // Arrange
            const data = { ...validPriceAlertBase(), targetPercentDrop: 12.5 };

            // Act
            const result = PriceAlertSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a negative basePriceSnapshot', () => {
            // Arrange
            const data = { ...validPriceAlertBase(), basePriceSnapshot: -1 };

            // Act
            const result = PriceAlertSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a missing accommodationId', () => {
            // Arrange
            const { accommodationId: _accommodationId, ...data } = validPriceAlertBase();

            // Act
            const result = PriceAlertSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

describe('CreatePriceAlertInputSchema', () => {
    it('should validate input with targetPercentDrop', () => {
        // Arrange
        const data = { accommodationId: faker.string.uuid(), targetPercentDrop: 15 };

        // Act
        const result = CreatePriceAlertInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should validate input without targetPercentDrop (any-drop alert)', () => {
        // Arrange
        const data = { accommodationId: faker.string.uuid() };

        // Act
        const result = CreatePriceAlertInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.targetPercentDrop).toBeUndefined();
        }
    });

    it('should reject targetPercentDrop = 0', () => {
        // Arrange
        const data = { accommodationId: faker.string.uuid(), targetPercentDrop: 0 };

        // Act
        const result = CreatePriceAlertInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject targetPercentDrop = 101', () => {
        // Arrange
        const data = { accommodationId: faker.string.uuid(), targetPercentDrop: 101 };

        // Act
        const result = CreatePriceAlertInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject an invalid accommodationId', () => {
        // Arrange
        const data = { accommodationId: 'not-a-uuid' };

        // Act
        const result = CreatePriceAlertInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('DeletePriceAlertInputSchema', () => {
    it('should validate a valid alertId', () => {
        // Arrange
        const data = { alertId: faker.string.uuid() };

        // Act
        const result = DeletePriceAlertInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject a missing alertId', () => {
        // Arrange
        const data = {};

        // Act
        const result = DeletePriceAlertInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('PriceAlertUpdateInputSchema', () => {
    it('should validate input with a targetPercentDrop', () => {
        // Arrange
        const data = { targetPercentDrop: 20 };

        // Act
        const result = PriceAlertUpdateInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should validate an empty object (no changes)', () => {
        // Arrange
        const data = {};

        // Act
        const result = PriceAlertUpdateInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept a null targetPercentDrop (reset to any-drop)', () => {
        // Arrange
        const data = { targetPercentDrop: null };

        // Act
        const result = PriceAlertUpdateInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject targetPercentDrop = 0', () => {
        // Arrange
        const data = { targetPercentDrop: 0 };

        // Act
        const result = PriceAlertUpdateInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject targetPercentDrop = 101', () => {
        // Arrange
        const data = { targetPercentDrop: 101 };

        // Act
        const result = PriceAlertUpdateInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('ListPriceAlertsInputSchema', () => {
    it('should default page and pageSize when omitted', () => {
        // Arrange
        const data = {};

        // Act
        const result = ListPriceAlertsInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(1);
            expect(result.data.pageSize).toBe(10);
        }
    });

    it('should reject a pageSize above the max', () => {
        // Arrange
        const data = { page: 1, pageSize: 101 };

        // Act
        const result = ListPriceAlertsInputSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('PriceAlertResponseSchema', () => {
    it('should validate the core entity plus accommodationName', () => {
        // Arrange
        const data = { ...validPriceAlertBase(), accommodationName: 'Cabaña del Río' };

        // Act
        const result = PriceAlertResponseSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject a response missing accommodationName', () => {
        // Arrange
        const data = validPriceAlertBase();

        // Act
        const result = PriceAlertResponseSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
    });
});
