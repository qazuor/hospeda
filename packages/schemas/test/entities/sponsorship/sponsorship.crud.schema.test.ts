import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    SponsorshipCreateInputSchema,
    SponsorshipDeleteInputSchema,
    SponsorshipDeleteOutputSchema,
    SponsorshipPatchInputSchema,
    SponsorshipRestoreInputSchema,
    SponsorshipUpdateInputSchema
} from '../../../src/entities/sponsorship/index.js';
import {
    createMinimalSponsorship,
    createSponsorshipCreateInput,
    createSponsorshipUpdateInput,
    createValidSponsorship
} from '../../fixtures/sponsorship.fixtures.js';

describe('SponsorshipCreateInputSchema', () => {
    it('should validate valid create input', () => {
        // Arrange
        const validInput = createSponsorshipCreateInput();

        // Act
        const result = SponsorshipCreateInputSchema.safeParse(validInput);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept create input without slug (auto-generated)', () => {
        // Arrange
        const inputWithoutSlug = {
            sponsorUserId: '550e8400-e29b-41d4-a716-446655440000',
            targetType: 'event',
            targetId: '660e8400-e29b-41d4-a716-446655440001',
            levelId: '770e8400-e29b-41d4-a716-446655440002',
            status: 'pending',
            startsAt: new Date()
        };

        // Act
        const result = SponsorshipCreateInputSchema.safeParse(inputWithoutSlug);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject create input that includes auto-generated fields', () => {
        // Arrange
        const inputWithAutoFields = {
            ...createSponsorshipCreateInput(),
            id: 'auto-generated-id',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Act
        const result = SponsorshipCreateInputSchema.strict().safeParse(inputWithAutoFields);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(ZodError);
    });

    it('should require sponsorUserId, targetType, targetId, levelId, and startsAt', () => {
        // Arrange
        const incompleteInput = { status: 'pending' };

        // Act
        const result = SponsorshipCreateInputSchema.safeParse(incompleteInput);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject invalid status enum in create input', () => {
        // Arrange
        const invalidInput = {
            ...createSponsorshipCreateInput(),
            status: 'UNKNOWN_STATUS'
        };

        // Act
        const result = SponsorshipCreateInputSchema.safeParse(invalidInput);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject invalid URL in logoUrl during create', () => {
        // Arrange
        const invalidInput = {
            ...createSponsorshipCreateInput(),
            logoUrl: 'not-a-url'
        };

        // Act
        const result = SponsorshipCreateInputSchema.safeParse(invalidInput);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('SponsorshipUpdateInputSchema', () => {
    it('should validate valid update input', () => {
        // Arrange
        const validInput = createSponsorshipUpdateInput();

        // Act
        const result = SponsorshipUpdateInputSchema.safeParse(validInput);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept empty object (all fields optional)', () => {
        // Arrange
        const emptyInput = {};

        // Act
        const result = SponsorshipUpdateInputSchema.safeParse(emptyInput);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept partial update with only status', () => {
        // Arrange
        const partialInput = { status: 'active' };

        // Act
        const result = SponsorshipUpdateInputSchema.safeParse(partialInput);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject invalid enum value in partial update', () => {
        // Arrange
        const invalidInput = { status: 'INVALID_STATUS' };

        // Act
        const result = SponsorshipUpdateInputSchema.safeParse(invalidInput);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject invalid URL in partial update', () => {
        // Arrange
        const invalidInput = { linkUrl: 'not-a-valid-url' };

        // Act
        const result = SponsorshipUpdateInputSchema.safeParse(invalidInput);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('SponsorshipPatchInputSchema', () => {
    it('should behave identically to SponsorshipUpdateInputSchema', () => {
        // Arrange
        const validInput = createSponsorshipUpdateInput();

        // Act
        const updateResult = SponsorshipUpdateInputSchema.safeParse(validInput);
        const patchResult = SponsorshipPatchInputSchema.safeParse(validInput);

        // Assert
        expect(patchResult.success).toBe(updateResult.success);
    });

    it('should accept empty object', () => {
        // Arrange
        const emptyInput = {};

        // Act
        const result = SponsorshipPatchInputSchema.safeParse(emptyInput);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept partial patch with only coupon fields', () => {
        // Arrange
        const partialPatch = {
            couponCode: 'SAVE20',
            couponDiscountPercent: 20
        };

        // Act
        const result = SponsorshipPatchInputSchema.safeParse(partialPatch);

        // Assert
        expect(result.success).toBe(true);
    });
});

describe('SponsorshipDeleteInputSchema', () => {
    it('should validate valid delete input with UUID', () => {
        // Arrange
        const validInput = { id: '550e8400-e29b-41d4-a716-446655440000' };

        // Act
        const result = SponsorshipDeleteInputSchema.safeParse(validInput);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should default force to false', () => {
        // Arrange
        const input = { id: '550e8400-e29b-41d4-a716-446655440000' };

        // Act
        const result = SponsorshipDeleteInputSchema.parse(input);

        // Assert
        expect(result.force).toBe(false);
    });

    it('should accept force: true for hard delete', () => {
        // Arrange
        const input = { id: '550e8400-e29b-41d4-a716-446655440000', force: true };

        // Act
        const result = SponsorshipDeleteInputSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.force).toBe(true);
        }
    });

    it('should reject non-UUID id', () => {
        // Arrange
        const invalidInput = { id: 'not-a-uuid' };

        // Act
        const result = SponsorshipDeleteInputSchema.safeParse(invalidInput);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('SponsorshipDeleteOutputSchema', () => {
    it('should validate valid delete output', () => {
        // Arrange
        const validOutput = { success: true, deletedAt: new Date() };

        // Act
        const result = SponsorshipDeleteOutputSchema.safeParse(validOutput);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should default success to true', () => {
        // Arrange
        const emptyOutput = {};

        // Act
        const result = SponsorshipDeleteOutputSchema.parse(emptyOutput);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept output without deletedAt', () => {
        // Arrange
        const output = { success: true };

        // Act
        const result = SponsorshipDeleteOutputSchema.safeParse(output);

        // Assert
        expect(result.success).toBe(true);
    });
});

describe('SponsorshipRestoreInputSchema', () => {
    it('should validate valid restore input', () => {
        // Arrange
        const validInput = { id: '550e8400-e29b-41d4-a716-446655440000' };

        // Act
        const result = SponsorshipRestoreInputSchema.safeParse(validInput);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject non-UUID id in restore input', () => {
        // Arrange
        const invalidInput = { id: 'not-a-uuid' };

        // Act
        const result = SponsorshipRestoreInputSchema.safeParse(invalidInput);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject missing id', () => {
        // Arrange
        const emptyInput = {};

        // Act
        const result = SponsorshipRestoreInputSchema.safeParse(emptyInput);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('CRUD Integration', () => {
    it('should validate a full create-update-delete lifecycle', () => {
        // Arrange
        const createInput = createSponsorshipCreateInput();
        const updateInput = { status: 'active', endsAt: new Date('2027-01-01') };
        const deleteInput = { id: createValidSponsorship().id };
        const patchInput = { couponDiscountPercent: 15 };

        // Act
        const createResult = SponsorshipCreateInputSchema.safeParse(createInput);
        const updateResult = SponsorshipUpdateInputSchema.safeParse(updateInput);
        const deleteResult = SponsorshipDeleteInputSchema.safeParse(deleteInput);
        const patchResult = SponsorshipPatchInputSchema.safeParse(patchInput);

        // Assert
        expect(createResult.success).toBe(true);
        expect(updateResult.success).toBe(true);
        expect(deleteResult.success).toBe(true);
        expect(patchResult.success).toBe(true);
    });

    it('should verify CreateInput excludes audit fields present in the full schema', () => {
        // Arrange
        const fullEntity = createMinimalSponsorship();

        // Act — CreateInputSchema should fail strict() if audit fields are included
        const result = SponsorshipCreateInputSchema.strict().safeParse({
            ...fullEntity,
            id: fullEntity.id,
            createdAt: fullEntity.createdAt,
            updatedAt: fullEntity.updatedAt,
            createdById: fullEntity.createdById,
            updatedById: fullEntity.updatedById
        });

        // Assert
        expect(result.success).toBe(false);
    });
});
