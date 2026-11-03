import { describe, expect, it } from 'vitest';
import {
    AccommodationCreateInputSchema,
    AccommodationUpdateInputSchema,
    ExperienceAdminCreateInputSchema,
    ExperienceOwnerCreateInputSchema,
    ExperienceUpdateInputSchema,
    VenueAdminCreateInputSchema,
    VenueOwnerCreateInputSchema,
    VenueOwnerUpdateInputSchema,
    VenueUpdateInputSchema
} from '../../src/index.js';

describe('business-line request shape', () => {
    it('accepts only the enum values owned by each vertical', () => {
        for (const schema of [
            VenueAdminCreateInputSchema,
            VenueOwnerCreateInputSchema,
            VenueUpdateInputSchema,
            VenueOwnerUpdateInputSchema
        ]) {
            const businessLinesSchema = schema.shape.businessLines;
            expect(businessLinesSchema.safeParse(['food', 'nightlife']).success).toBe(true);
            expect(businessLinesSchema.safeParse(['standard']).success).toBe(false);
        }
        for (const schema of [
            ExperienceAdminCreateInputSchema,
            ExperienceOwnerCreateInputSchema,
            ExperienceUpdateInputSchema,
            AccommodationCreateInputSchema,
            AccommodationUpdateInputSchema
        ]) {
            const businessLinesSchema = schema.shape.businessLines;
            expect(businessLinesSchema.safeParse(['standard']).success).toBe(true);
            expect(businessLinesSchema.safeParse(['food']).success).toBe(false);
        }
    });

    it('does not accept vertical as a request field', () => {
        for (const schema of [
            VenueOwnerCreateInputSchema,
            ExperienceOwnerCreateInputSchema,
            AccommodationCreateInputSchema
        ])
            expect('vertical' in schema.shape).toBe(false);
    });
});
