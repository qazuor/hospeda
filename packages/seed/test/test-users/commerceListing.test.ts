/**
 * Unit tests for the pure builder in `commerceListing.ts` (HOS-694).
 *
 * `ensureGastronomyAtCapListing` itself (the DB-orchestrating idempotency
 * check + `GastronomyService.create` call) is NOT unit tested here — it
 * requires a live database, matching the existing precedent in this package:
 * `hostAccommodation.ts`'s `ensureHostAccommodation` and `testUsers.seed.ts`'s
 * own DB-touching helpers have no unit test coverage either, and are
 * exercised through a real `pnpm db:seed:test-users` run / the seed
 * integration suite instead. Only the pure `buildAtCapGastronomyListingInput`
 * builder is unit tested — mirrors `hostAccommodation.test.ts`'s split.
 */
import { GastronomyAdminCreateInputSchema, GastronomyTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildAtCapGastronomyListingInput } from '../../src/test-users/commerceListing.js';

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
