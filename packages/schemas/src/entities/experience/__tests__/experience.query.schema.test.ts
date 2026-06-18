import { describe, expect, it } from 'vitest';
import { ExperienceTypeEnum } from '../../../enums/experience-type.enum.js';
import { ExperienceAdminSearchSchema } from '../experience.admin-search.schema.js';
import { ExperienceSearchSchema } from '../experience.query.schema.js';

// ============================================================================
// ExperienceSearchSchema — public list filters
// ============================================================================

describe('ExperienceSearchSchema', () => {
    it('should parse an empty search (all defaults)', () => {
        const result = ExperienceSearchSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should apply default pagination (page=1, pageSize=10)', () => {
        const result = ExperienceSearchSchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(1);
            // BaseSearchSchema default is 10, not 20
            expect(result.data.pageSize).toBe(10);
        }
    });

    it('should accept type filter', () => {
        const result = ExperienceSearchSchema.safeParse({
            type: ExperienceTypeEnum.KAYAK_RENTAL
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.type).toBe(ExperienceTypeEnum.KAYAK_RENTAL);
        }
    });

    it('should accept destinationId filter', () => {
        const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
        const result = ExperienceSearchSchema.safeParse({ destinationId: uuid });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.destinationId).toBe(uuid);
        }
    });

    it('should accept hasActiveSubscription filter', () => {
        const result = ExperienceSearchSchema.safeParse({ hasActiveSubscription: true });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.hasActiveSubscription).toBe(true);
        }
    });

    it('should accept rating range filter', () => {
        const result = ExperienceSearchSchema.safeParse({ minRating: 3, maxRating: 5 });
        expect(result.success).toBe(true);
    });

    it('should reject invalid type value', () => {
        const result = ExperienceSearchSchema.safeParse({ type: 'UNKNOWN_TYPE' });
        expect(result.success).toBe(false);
    });

    it('should reject invalid destinationId (non-UUID)', () => {
        const result = ExperienceSearchSchema.safeParse({ destinationId: 'not-a-uuid' });
        expect(result.success).toBe(false);
    });

    it('should reject page=0 (minimum page is 1)', () => {
        const result = ExperienceSearchSchema.safeParse({ page: 0 });
        expect(result.success).toBe(false);
    });

    it('should reject minRating > 5', () => {
        const result = ExperienceSearchSchema.safeParse({ minRating: 6 });
        expect(result.success).toBe(false);
    });

    it('should accept opt-in projection flags', () => {
        const result = ExperienceSearchSchema.safeParse({
            includeAmenities: true,
            includeFeatures: false
        });
        expect(result.success).toBe(true);
    });
});

// ============================================================================
// ExperienceAdminSearchSchema — extended admin filters
// ============================================================================

describe('ExperienceAdminSearchSchema', () => {
    it('should parse an empty admin search (all defaults)', () => {
        const result = ExperienceAdminSearchSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should accept type filter', () => {
        const result = ExperienceAdminSearchSchema.safeParse({
            type: ExperienceTypeEnum.GUIDED_VISIT
        });
        expect(result.success).toBe(true);
    });

    it('should accept destinationId UUID filter', () => {
        const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
        const result = ExperienceAdminSearchSchema.safeParse({ destinationId: uuid });
        expect(result.success).toBe(true);
    });

    it('should accept ownerId UUID filter', () => {
        const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
        const result = ExperienceAdminSearchSchema.safeParse({ ownerId: uuid });
        expect(result.success).toBe(true);
    });

    it('should accept isFeatured filter', () => {
        const result = ExperienceAdminSearchSchema.safeParse({ isFeatured: 'true' });
        expect(result.success).toBe(true);
    });

    it('should accept hasActiveSubscription filter', () => {
        const result = ExperienceAdminSearchSchema.safeParse({ hasActiveSubscription: 'false' });
        expect(result.success).toBe(true);
    });

    it('should reject non-UUID destinationId', () => {
        const result = ExperienceAdminSearchSchema.safeParse({ destinationId: 'bad' });
        expect(result.success).toBe(false);
    });

    it('should reject non-UUID ownerId', () => {
        const result = ExperienceAdminSearchSchema.safeParse({ ownerId: 'bad' });
        expect(result.success).toBe(false);
    });

    it('should reject an invalid type', () => {
        const result = ExperienceAdminSearchSchema.safeParse({ type: 'INVALID' });
        expect(result.success).toBe(false);
    });
});
