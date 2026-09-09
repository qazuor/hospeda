/**
 * Unit tests for the pure builders in `commerceListing.ts` (HOS-694,
 * extended to experiences by HOS-1268).
 *
 * `ensureGastronomyAtCapListing` / `ensureExperienceAtCapListing` themselves
 * (the DB-orchestrating idempotency check + `*Service.create` call) are NOT
 * unit tested here — they require a live database, matching the existing
 * precedent in this package: `hostAccommodation.ts`'s `ensureHostAccommodation`
 * and `testUsers.seed.ts`'s own DB-touching helpers have no unit test
 * coverage either, and are exercised through a real `pnpm db:seed:test-users`
 * run / the seed integration suite instead. Only the pure builders are unit
 * tested — mirrors `hostAccommodation.test.ts`'s split.
 */
import {
    ExperienceAdminCreateInputSchema,
    ExperienceTypeEnum,
    GastronomyAdminCreateInputSchema,
    GastronomyTypeEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildAtCapExperienceListingInput,
    buildAtCapGastronomyListingInput
} from '../../src/test-users/commerceListing.js';

const VALID_OWNER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_DESTINATION_ID = '22222222-2222-4222-8222-222222222222';
const SPEC = {
    email: 'commerce-gastronomy-at-cap@local.test',
    displayName: 'Comercio Gastronomía Al Tope'
} as const;

describe('buildAtCapGastronomyListingInput', () => {
    it('should build a schema-valid GastronomyAdminCreateInput payload', () => {
        // Arrange / Act
        const input = buildAtCapGastronomyListingInput({
            spec: SPEC,
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID
        });
        const result = GastronomyAdminCreateInputSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should set the owner and destination ids from the input, not hardcoded values', () => {
        // Arrange / Act
        const input = buildAtCapGastronomyListingInput({
            spec: SPEC,
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID
        });

        // Assert
        expect(input.ownerId).toBe(VALID_OWNER_ID);
        expect(input.destinationId).toBe(VALID_DESTINATION_ID);
    });

    it('should start the listing PRIVATE / DRAFT, matching the real owner-create route (D-3)', () => {
        // Arrange / Act
        const input = buildAtCapGastronomyListingInput({
            spec: SPEC,
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID
        });

        // Assert
        expect(input.visibility).toBe('PRIVATE');
        expect(input.lifecycleState).toBe('DRAFT');
    });

    it('should use a valid GastronomyTypeEnum value', () => {
        // Arrange / Act
        const input = buildAtCapGastronomyListingInput({
            spec: SPEC,
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID
        });

        // Assert
        expect(Object.values(GastronomyTypeEnum)).toContain(input.type);
    });

    it('should identify the fixture as seed/test content tied to the owner in name and description', () => {
        // Arrange / Act
        const input = buildAtCapGastronomyListingInput({
            spec: SPEC,
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID
        });

        // Assert
        expect(input.name).toContain(SPEC.displayName);
        expect(input.description).toContain('HOS-694');
        expect(input.description).toContain('No representa');
    });
});

const EXPERIENCE_SPEC = {
    email: 'commerce-experience-at-cap@local.test',
    displayName: 'Comercio Experiencia Al Tope'
} as const;

describe('buildAtCapExperienceListingInput (HOS-1268)', () => {
    it('should build a schema-valid ExperienceAdminCreateInput payload', () => {
        // Arrange / Act
        const input = buildAtCapExperienceListingInput({
            spec: EXPERIENCE_SPEC,
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID
        });
        const result = ExperienceAdminCreateInputSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should set the owner and destination ids from the input, not hardcoded values', () => {
        // Arrange / Act
        const input = buildAtCapExperienceListingInput({
            spec: EXPERIENCE_SPEC,
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID
        });

        // Assert
        expect(input.ownerId).toBe(VALID_OWNER_ID);
        expect(input.destinationId).toBe(VALID_DESTINATION_ID);
    });

    it('should start the listing PRIVATE / DRAFT, matching the real owner-create route (D-3)', () => {
        // Arrange / Act
        const input = buildAtCapExperienceListingInput({
            spec: EXPERIENCE_SPEC,
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID
        });

        // Assert
        expect(input.visibility).toBe('PRIVATE');
        expect(input.lifecycleState).toBe('DRAFT');
    });

    it('should use a valid ExperienceTypeEnum value', () => {
        // Arrange / Act
        const input = buildAtCapExperienceListingInput({
            spec: EXPERIENCE_SPEC,
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID
        });

        // Assert
        expect(Object.values(ExperienceTypeEnum)).toContain(input.type);
    });

    it('should declare isPriceOnRequest so the required priceFrom/priceUnit pair never blocks the fixture', () => {
        // Arrange / Act
        const input = buildAtCapExperienceListingInput({
            spec: EXPERIENCE_SPEC,
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID
        });

        // Assert
        expect(input.isPriceOnRequest).toBe(true);
        expect(input.priceFrom).toBe(0);
    });

    it('should identify the fixture as seed/test content tied to the owner in name and description', () => {
        // Arrange / Act
        const input = buildAtCapExperienceListingInput({
            spec: EXPERIENCE_SPEC,
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID
        });

        // Assert
        expect(input.name).toContain(EXPERIENCE_SPEC.displayName);
        expect(input.description).toContain('HOS-1268');
        expect(input.description).toContain('No representa');
    });
});
