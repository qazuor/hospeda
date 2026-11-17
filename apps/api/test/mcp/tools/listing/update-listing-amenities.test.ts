/**
 * HOS-2327 — `update_listing_amenities`: per vertical: category isolation, ids of other categories, ownership and the authorization matrix.
 *
 * Covers AC-C8, AC-C9, AC-C11 and the authorization matrix of the owner PATCH route.
 *
 * Same harness as the other `update-listing-amenities` files: listing access
 * runs for real over mocked ports; services are spied on their prototypes.
 *
 * @module test/mcp/tools/listing/update-listing-amenities
 */

import { httpToDomainAccommodationUpdate, PermissionEnum, VerticalEnum } from '@repo/schemas';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    TOOL_NOT_FOUND_MESSAGE,
    TOOL_VALIDATION_MESSAGE
} from '../../../../src/mcp/tools/tool-errors';
import { validateApiEnv } from '../../../../src/utils/env';
import {
    actorFor,
    failureOf,
    givenCapability,
    givenCatalog,
    givenFacts,
    givenRelations,
    givenRow,
    KITCHEN_1,
    KITCHEN_2,
    KITCHEN_3,
    LISTING_ID,
    mocks,
    OTHER_ID,
    OWNER_ID,
    PARKING_1,
    run,
    SERVICES,
    STYLE_1,
    UNKNOWN_ID,
    VERTICALS,
    VIEW_1,
    VIEW_2,
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

    describe.each(VERTICALS)('%s', (vertical) => {
        beforeEach(() => {
            givenFacts(vertical);
            givenCapability(vertical, true);
            givenRow(vertical);
            givenCatalog();
        });

        it('AC-C8: adding and removing in one category leaves other categories and all features alone', async () => {
            // Arrange
            const write = writeSpy(vertical);
            givenRelations({
                vertical,
                before: { amenities: [KITCHEN_1, KITCHEN_2, PARKING_1], features: [VIEW_1] },
                after: { amenities: [KITCHEN_2, KITCHEN_3, PARKING_1], features: [VIEW_1] }
            });

            // Act
            const outcome = await run({
                vertical,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_3],
                remove: [KITCHEN_1]
            });

            // Assert: the PARKING amenity is carried over, and features are not in the patch.
            expect(outcome.ok).toBe(true);
            expect(write).toHaveBeenCalledTimes(1);
            const nextIds = [KITCHEN_2, PARKING_1, KITCHEN_3];
            if (vertical === VerticalEnum.ACCOMMODATION) {
                expect(write).toHaveBeenCalledWith(
                    expect.objectContaining({ id: OWNER_ID }),
                    LISTING_ID,
                    httpToDomainAccommodationUpdate({ amenityIds: nextIds })
                );
                expect(write.mock.calls[0]?.[2]).not.toHaveProperty('featureIds');
            } else {
                expect(write).toHaveBeenCalledWith(
                    LISTING_ID,
                    { amenityIds: nextIds },
                    expect.objectContaining({ id: OWNER_ID })
                );
            }
        });

        it('edits features through featureIds only, leaving amenities out of the patch', async () => {
            // Arrange
            const write = writeSpy(vertical);
            givenRelations({
                vertical,
                before: { amenities: [KITCHEN_1], features: [VIEW_1, STYLE_1] },
                after: { amenities: [KITCHEN_1], features: [VIEW_1, VIEW_2, STYLE_1] }
            });

            // Act
            const outcome = await run({
                vertical,
                id: LISTING_ID,
                kind: 'feature',
                category: 'VIEW',
                add: [VIEW_2]
            });

            // Assert
            expect(outcome.ok).toBe(true);
            const patch =
                vertical === VerticalEnum.ACCOMMODATION
                    ? httpToDomainAccommodationUpdate({
                          featureIds: [VIEW_1, STYLE_1, VIEW_2]
                      })
                    : { featureIds: [VIEW_1, STYLE_1, VIEW_2] };
            if (vertical === VerticalEnum.ACCOMMODATION) {
                expect(write.mock.calls[0]?.[2]).toEqual(patch);
                expect(write.mock.calls[0]?.[2]).not.toHaveProperty('amenityIds');
            } else {
                expect(write.mock.calls[0]?.[1]).toEqual(patch);
            }
        });

        it('answers with the category as stored, and the counts it changed', async () => {
            // Arrange
            writeSpy(vertical);
            givenRelations({
                vertical,
                before: { amenities: [KITCHEN_1, PARKING_1], features: [] },
                after: { amenities: [KITCHEN_2, PARKING_1], features: [] }
            });

            // Act
            const outcome = await run({
                vertical,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_2, KITCHEN_1],
                remove: [KITCHEN_3]
            });

            // Assert: KITCHEN_1 was already linked and KITCHEN_3 was not, so neither counts.
            if (!outcome.ok) throw new Error('expected success');
            expect(outcome.data).toMatchObject({
                listing: { vertical, id: LISTING_ID, name: 'Cabañas del Río' },
                added: 1,
                removed: 0
            });
            expect(outcome.data.group.category).toBe('KITCHEN');
            expect(outcome.data.group.label).toBe('Cocina');
            const selected = outcome.data.group.items.filter((i) => i.selected).map((i) => i.id);
            expect(selected).toEqual([KITCHEN_2]);
            // Only KITCHEN rows, scoped to the vertical.
            expect(outcome.data.group.items.every((i) => i.slug !== 'parking_free')).toBe(true);
        });

        it('AC-C9: refuses an id of another category, naming it, and writes nothing', async () => {
            // Arrange
            const write = writeSpy(vertical);
            givenRelations({ vertical, before: { amenities: [], features: [] } });

            // Act
            const failure = await failureOf({
                vertical,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_1, PARKING_1]
            });

            // Assert
            expect(failure.code).toBe('VALIDATION_ERROR');
            expect(failure.message.startsWith(TOOL_VALIDATION_MESSAGE)).toBe(true);
            expect(failure.message).toContain(PARKING_1);
            expect(write).not.toHaveBeenCalled();
        });

        it('AC-C9: refuses an id of another category in `remove` too', async () => {
            // Arrange
            const write = writeSpy(vertical);
            givenRelations({ vertical, before: { amenities: [PARKING_1], features: [] } });

            // Act
            const failure = await failureOf({
                vertical,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                remove: [PARKING_1]
            });

            // Assert
            expect(failure.code).toBe('VALIDATION_ERROR');
            expect(failure.message).toContain(PARKING_1);
            expect(write).not.toHaveBeenCalled();
        });

        it('AC-C9: refuses an id that does not exist, naming it', async () => {
            // Arrange
            const write = writeSpy(vertical);
            givenRelations({ vertical, before: { amenities: [], features: [] } });

            // Act
            const failure = await failureOf({
                vertical,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [UNKNOWN_ID]
            });

            // Assert
            expect(failure.code).toBe('VALIDATION_ERROR');
            expect(failure.message).toContain(UNKNOWN_ID);
            expect(write).not.toHaveBeenCalled();
        });

        it('AC-C9: an id of the wrong kind (a feature id with kind amenity) is refused', async () => {
            // Arrange
            const write = writeSpy(vertical);
            givenRelations({ vertical, before: { amenities: [], features: [] } });

            // Act
            const failure = await failureOf({
                vertical,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [VIEW_1]
            });

            // Assert
            expect(failure.code).toBe('VALIDATION_ERROR');
            expect(failure.message).toContain(VIEW_1);
            expect(write).not.toHaveBeenCalled();
        });

        it('sends an id named twice once', async () => {
            // Arrange
            const write = writeSpy(vertical);
            givenRelations({ vertical, before: { amenities: [], features: [] } });

            // Act
            await run({
                vertical,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_1, KITCHEN_1]
            });

            // Assert
            const sent =
                vertical === VerticalEnum.ACCOMMODATION
                    ? write.mock.calls[0]?.[2]
                    : write.mock.calls[0]?.[1];
            const ids = (sent as { amenityIds: string[] }).amenityIds;
            expect(ids).toEqual([KITCHEN_1]);
        });

        it("answers another user's listing as not found, without reading the catalog or writing (AC-C11)", async () => {
            // Arrange
            givenFacts(vertical, OTHER_ID);
            vi.spyOn(
                SERVICES[vertical].prototype as unknown as {
                    getById: (...a: unknown[]) => Promise<unknown>;
                },
                'getById'
            ).mockResolvedValue({
                data: { id: LISTING_ID, ownerId: OTHER_ID, name: 'Ajena', slug: 'a' }
            });
            const write = writeSpy(vertical);
            const { amenitySearch } = givenCatalog();

            // Act
            const failure = await failureOf({
                vertical,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_1]
            });

            // Assert
            expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
            expect(write).not.toHaveBeenCalled();
            expect(amenitySearch).not.toHaveBeenCalled();
            expect(mocks.invalidateCache).not.toHaveBeenCalled();
        });

        it('stays owner-only for staff holding the foreign-edit permission (AC-C11)', async () => {
            // Arrange
            givenFacts(vertical, OTHER_ID);
            vi.spyOn(
                SERVICES[vertical].prototype as unknown as {
                    getById: (...a: unknown[]) => Promise<unknown>;
                },
                'getById'
            ).mockResolvedValue({
                data: { id: LISTING_ID, ownerId: OTHER_ID, name: 'Ajena', slug: 'a' }
            });
            const write = writeSpy(vertical);

            // Act
            const failure = await failureOf(
                {
                    vertical,
                    id: LISTING_ID,
                    kind: 'amenity',
                    category: 'KITCHEN',
                    add: [KITCHEN_1]
                },
                actorFor(OWNER_ID, { permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT] })
            );

            // Assert
            expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
            expect(write).not.toHaveBeenCalled();
        });

        it('answers a missing listing with the same not found', async () => {
            // Arrange
            vi.spyOn(
                SERVICES[vertical].prototype as unknown as {
                    getById: (...a: unknown[]) => Promise<unknown>;
                },
                'getById'
            ).mockResolvedValue({ error: { code: 'NOT_FOUND', message: 'missing' } });
            const write = writeSpy(vertical);

            // Act
            const failure = await failureOf({
                vertical,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_1]
            });

            // Assert
            expect(failure).toMatchObject({ code: 'NOT_FOUND', message: TOOL_NOT_FOUND_MESSAGE });
            expect(write).not.toHaveBeenCalled();
        });

        it('refuses an owner whose plan lacks the edit capability (EDIT, step 6)', async () => {
            // Arrange
            givenCapability(vertical, false);
            const write = writeSpy(vertical);
            givenRelations({ vertical, before: { amenities: [], features: [] } });

            // Act
            const failure = await failureOf({
                vertical,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_1]
            });

            // Assert
            expect(failure).toMatchObject({ code: 'ENTITLEMENT_REQUIRED', kind: 'denied' });
            expect(write).not.toHaveBeenCalled();
        });

        it('refuses an unverified email before touching anything (write tool)', async () => {
            // Arrange
            const write = writeSpy(vertical);

            // Act
            const failure = await failureOf(
                {
                    vertical,
                    id: LISTING_ID,
                    kind: 'amenity',
                    category: 'KITCHEN',
                    add: [KITCHEN_1]
                },
                actorFor(OWNER_ID, { emailVerified: false })
            );

            // Assert
            expect(failure.code).toBe('EMAIL_NOT_VERIFIED');
            expect(write).not.toHaveBeenCalled();
            expect(mocks.loadFacts).not.toHaveBeenCalled();
        });

        it('reports a service refusal without evicting the cache', async () => {
            // Arrange
            writeSpy(vertical, { error: { code: 'VALIDATION_ERROR', message: 'invalid' } });
            givenRelations({ vertical, before: { amenities: [], features: [] } });

            // Act
            const failure = await failureOf({
                vertical,
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_1]
            });

            // Assert
            expect(failure.code).toBe('VALIDATION_ERROR');
            expect(mocks.invalidateCache).not.toHaveBeenCalled();
        });
    });
});
