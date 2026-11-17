/**
 * HOS-2327 — `update_listing_amenities`: the vertical scope of the catalog and the public cache eviction.
 *
 * Covers AC-C9 (an id that does not apply to the vertical) and AC-C10 (C-1).
 *
 * Same harness as the other `update-listing-amenities` files: listing access
 * runs for real over mocked ports; services are spied on their prototypes.
 *
 * @module test/mcp/tools/listing/update-listing-amenities.scope
 */

import { VerticalEnum } from '@repo/schemas';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCOMMODATION_CACHE_INVALIDATION_PREFIXES } from '../../../../src/middlewares/accommodation-cache-invalidation';
import { validateApiEnv } from '../../../../src/utils/env';
import {
    failureOf,
    givenCapability,
    givenCatalog,
    givenFacts,
    givenRelations,
    givenRow,
    KITCHEN_1,
    KITCHEN_ACC_ONLY,
    LISTING_ID,
    mocks,
    run,
    STYLE_ACC_ONLY,
    writeSpy
} from './update-listing-amenities.harness';

vi.mock('../../../../src/utils/listing-access/ports', async () => {
    const { mocks } = await import('./update-listing-amenities.harness');
    return {
        getListingAccessPorts: () => ({
            loadFacts: mocks.loadFacts,
            billing: { coverage: mocks.coverage },
            effectiveSet: mocks.effectiveSet,
            preTrialDraftLimits: mocks.preTrialDraftLimits
        })
    };
});

vi.mock('../../../../src/middlewares/cache', async (importOriginal) => {
    const { mocks } = await import('./update-listing-amenities.harness');
    const actual = await importOriginal<typeof import('../../../../src/middlewares/cache')>();
    return { ...actual, invalidateCacheByPathPrefix: mocks.invalidateCache };
});

vi.mock('../../../../src/lib/mcp/record-tool-call', async () => {
    const { mocks } = await import('./update-listing-amenities.harness');
    return { recordMcpToolCall: mocks.record };
});

vi.mock('../../../../src/utils/accommodation-catalog-relations', async () => {
    const { mocks } = await import('./update-listing-amenities.harness');
    return {
        fetchProtectedAmenities: mocks.accAmenities,
        fetchProtectedFeatures: mocks.accFeatures
    };
});

vi.mock('../../../../src/utils/listing-catalog-relations', async (importOriginal) => {
    const { mocks } = await import('./update-listing-amenities.harness');
    return {
        ...(await importOriginal<
            typeof import('../../../../src/utils/listing-catalog-relations')
        >()),
        fetchVenueAmenities: mocks.venueAmenities,
        fetchVenueFeatures: mocks.venueFeatures,
        fetchExperienceAmenities: mocks.expAmenities,
        fetchExperienceFeatures: mocks.expFeatures
    };
});

describe('update_listing_amenities', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.coverage.mockResolvedValue({ covered: true, sources: [{ type: 'BASE' }] });
        mocks.preTrialDraftLimits.mockResolvedValue(new Map());
        mocks.expAmenities.mockResolvedValue([]);
        mocks.expFeatures.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('vertical scope (AC-C9)', () => {
        it.each([
            VerticalEnum.VENUE,
            VerticalEnum.EXPERIENCE
        ] as const)('refuses an accommodation-only amenity on a %s, naming it', async (vertical) => {
            // Arrange
            givenFacts(vertical);
            givenCapability(vertical, true);
            givenRow(vertical);
            givenCatalog();
            const write = writeSpy(vertical);
            givenRelations({ vertical, before: { amenities: [], features: [] } });

            // Act
            const failure = await failureOf({
                vertical,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_ACC_ONLY]
            });

            // Assert
            expect(failure.code).toBe('VALIDATION_ERROR');
            expect(failure.message).toContain(KITCHEN_ACC_ONLY);
            expect(write).not.toHaveBeenCalled();
        });

        it('refuses an accommodation-only feature on a venue, but accepts it on an accommodation', async () => {
            // Arrange
            givenFacts(VerticalEnum.VENUE);
            givenCapability(VerticalEnum.VENUE, true);
            givenRow(VerticalEnum.VENUE);
            givenCatalog();
            const venueWrite = writeSpy(VerticalEnum.VENUE);
            givenRelations({
                vertical: VerticalEnum.VENUE,
                before: { amenities: [], features: [] }
            });

            // Act
            const failure = await failureOf({
                vertical: VerticalEnum.VENUE,
                id: LISTING_ID,
                kind: 'feature',
                category: 'STYLE',
                add: [STYLE_ACC_ONLY]
            });

            // Assert
            expect(failure.message).toContain(STYLE_ACC_ONLY);
            expect(venueWrite).not.toHaveBeenCalled();
        });

        it('asks the catalog for the listing vertical, not for every vertical', async () => {
            // Arrange
            givenFacts(VerticalEnum.EXPERIENCE);
            givenCapability(VerticalEnum.EXPERIENCE, true);
            givenRow(VerticalEnum.EXPERIENCE);
            const { amenitySearch } = givenCatalog();
            writeSpy(VerticalEnum.EXPERIENCE);
            givenRelations({
                vertical: VerticalEnum.EXPERIENCE,
                before: { amenities: [], features: [] }
            });

            // Act
            await run({
                vertical: VerticalEnum.EXPERIENCE,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_1]
            });

            // Assert
            expect(amenitySearch).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ applicableVertical: 'experience' })
            );
        });
    });

    describe('public cache (AC-C10, C-1)', () => {
        const input = {
            id: LISTING_ID,
            kind: 'amenity',
            category: 'KITCHEN',
            add: [KITCHEN_1]
        } as const;

        it('evicts the public accommodation response cache after a successful write, as the PATCH route does', async () => {
            // Arrange
            givenFacts(VerticalEnum.ACCOMMODATION);
            givenCapability(VerticalEnum.ACCOMMODATION, true);
            givenRow(VerticalEnum.ACCOMMODATION);
            givenCatalog();
            writeSpy(VerticalEnum.ACCOMMODATION);
            givenRelations({
                vertical: VerticalEnum.ACCOMMODATION,
                before: { amenities: [], features: [] }
            });

            // Act
            const outcome = await run({ vertical: VerticalEnum.ACCOMMODATION, ...input });

            // Assert
            expect(outcome.ok).toBe(true);
            expect(mocks.invalidateCache.mock.calls.map(([arg]) => arg.pathPrefix)).toEqual([
                ...ACCOMMODATION_CACHE_INVALIDATION_PREFIXES
            ]);
        });

        it.each([
            VerticalEnum.VENUE,
            VerticalEnum.EXPERIENCE
        ] as const)('evicts nothing for a %s: its routes mount no such middleware', async (vertical) => {
            // Arrange
            givenFacts(vertical);
            givenCapability(vertical, true);
            givenRow(vertical);
            givenCatalog();
            writeSpy(vertical);
            givenRelations({ vertical, before: { amenities: [], features: [] } });

            // Act
            const outcome = await run({ vertical, ...input });

            // Assert
            expect(outcome.ok).toBe(true);
            expect(mocks.invalidateCache).not.toHaveBeenCalled();
        });
    });
});
