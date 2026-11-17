/**
 * HOS-2327 — `get_listing_amenities`: the catalog of one owned listing grouped by
 * category with the listing's current selection.
 *
 * Covers AC-C7 (vertical scope, grouping, Spanish labels, `selected`), AC-C11
 * (foreign listing: not found, catalog never read) and the response budget of
 * spec §5.3 over a catalog the size of the seeded accommodation one.
 *
 * Services are spied on their prototypes; the catalog-relation readers (the
 * only database access) are mocked at their module boundary.
 *
 * @module test/mcp/tools/listing/get-listing-amenities
 */

import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    AmenityService,
    ExperienceService,
    FeatureService,
    VenueService
} from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    accAmenities: vi.fn(),
    accFeatures: vi.fn(),
    venueAmenities: vi.fn(),
    venueFeatures: vi.fn(),
    expAmenities: vi.fn(),
    expFeatures: vi.fn()
}));

vi.mock('../../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: vi.fn() }));

vi.mock('../../../../src/utils/accommodation-catalog-relations', () => ({
    fetchProtectedAmenities: mocks.accAmenities,
    fetchProtectedFeatures: mocks.accFeatures
}));

vi.mock('../../../../src/utils/listing-catalog-relations', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../src/utils/listing-catalog-relations')>()),
    fetchVenueAmenities: mocks.venueAmenities,
    fetchVenueFeatures: mocks.venueFeatures,
    fetchExperienceAmenities: mocks.expAmenities,
    fetchExperienceFeatures: mocks.expFeatures
}));

import { handleMcpToolCall } from '../../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../../src/lib/mcp/caller';
import type { AmenityGroup } from '../../../../src/mcp/tools/listing/catalog-groups';
import {
    fitGroupsToBudget,
    getListingAmenitiesTool
} from '../../../../src/mcp/tools/listing/get-listing-amenities';
import {
    MCP_RESULT_MAX_CHARS,
    measureResultChars
} from '../../../../src/mcp/tools/response-budget';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { TOOL_NOT_FOUND_MESSAGE } from '../../../../src/mcp/tools/tool-errors';
import { env, validateApiEnv } from '../../../../src/utils/env';

const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
const OTHER_ID = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const LISTING_ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';
const context = { channel: 'mcp' } as const;

const actorFor = (id: string): Actor =>
    ({ id, roles: ['HOST'], permissions: [], emailVerified: true }) as unknown as Actor;

interface CatalogFixture {
    readonly id: string;
    readonly slug: string;
    readonly applicableVerticals: readonly string[];
    readonly type?: string;
    readonly category?: string;
}

const uuid = (prefix: string, n: number) =>
    `${prefix}${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`;

/** A small catalog: a venue-applicable subset and accommodation-only rows. */
const AMENITIES: readonly CatalogFixture[] = [
    {
        id: uuid('a', 1),
        slug: 'wifi',
        type: 'CONNECTIVITY',
        applicableVerticals: ['accommodation', 'venue']
    },
    { id: uuid('a', 2), slug: 'oven', type: 'KITCHEN', applicableVerticals: ['accommodation'] },
    { id: uuid('a', 3), slug: 'pool', type: 'OUTDOORS', applicableVerticals: ['accommodation'] },
    {
        id: uuid('a', 4),
        slug: 'parking_free',
        type: 'PARKING',
        applicableVerticals: ['accommodation', 'venue']
    }
];
const FEATURES: readonly CatalogFixture[] = [
    {
        id: uuid('f', 1),
        slug: 'river_view',
        category: 'VIEW',
        applicableVerticals: ['accommodation', 'venue']
    },
    { id: uuid('f', 2), slug: 'rustic', category: 'STYLE', applicableVerticals: ['accommodation'] }
];

/** Points the catalog services at fixtures, honouring `applicableVertical` like the SQL does. */
function givenCatalog(input: {
    readonly amenities: readonly CatalogFixture[];
    readonly features: readonly CatalogFixture[];
}) {
    const scoped = (rows: readonly CatalogFixture[], params: unknown) => {
        const vertical = (params as { applicableVertical?: string }).applicableVertical;
        const page = (params as { page: number }).page;
        const pageSize = (params as { pageSize: number }).pageSize;
        const items = rows.filter(
            (row) => vertical === undefined || row.applicableVerticals.includes(vertical)
        );
        return {
            data: {
                items: items.slice((page - 1) * pageSize, page * pageSize),
                total: items.length
            }
        } as never;
    };
    return {
        amenitySearch: vi
            .spyOn(AmenityService.prototype, 'search')
            .mockImplementation(async (_actor, params) => scoped(input.amenities, params)),
        featureSearch: vi
            .spyOn(FeatureService.prototype, 'search')
            .mockImplementation(async (_actor, params) => scoped(input.features, params))
    };
}

const SERVICES = {
    [VerticalEnum.ACCOMMODATION]: AccommodationService,
    [VerticalEnum.VENUE]: VenueService,
    [VerticalEnum.EXPERIENCE]: ExperienceService
} as const;

/** Points a vertical's `getById` at an owned (or foreign) row. */
function givenListing(vertical: keyof typeof SERVICES, ownerId: string = OWNER_ID) {
    const prototype = SERVICES[vertical].prototype as unknown as {
        getById: (...args: unknown[]) => Promise<unknown>;
    };
    return vi.spyOn(prototype, 'getById').mockResolvedValue({
        data: {
            id: LISTING_ID,
            ownerId,
            name: 'Cabañas del Río',
            slug: 'cabanas-del-rio',
            publicationStatus: PublicationStatusEnum.DRAFT
        }
    });
}

/** The junction rows the listing currently has (by catalog id). */
function givenSelected(input: {
    readonly amenities: readonly string[];
    readonly features: readonly string[];
}) {
    mocks.accAmenities.mockResolvedValue(input.amenities.map((id) => ({ id, slug: 'x' })));
    mocks.accFeatures.mockResolvedValue(input.features.map((id) => ({ id, slug: 'x' })));
    mocks.venueAmenities.mockResolvedValue(
        input.amenities.map((amenityId) => ({ amenityId, slug: 'x' }))
    );
    mocks.venueFeatures.mockResolvedValue(
        input.features.map((featureId) => ({ featureId, slug: 'x' }))
    );
    mocks.expAmenities.mockResolvedValue([]);
    mocks.expFeatures.mockResolvedValue([]);
}

const run = (input: Record<string, unknown>, actor: Actor = actorFor(OWNER_ID)) =>
    runTool({ definition: getListingAmenitiesTool, actor, input, context });

const dataOf = async (input: Record<string, unknown>) => {
    const outcome = await run(input);
    if (!outcome.ok) throw new Error(`expected success, got ${outcome.failure.code}`);
    return outcome.data;
};

describe('get_listing_amenities', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        givenSelected({ amenities: [], features: [] });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('is a read-only tool available to unverified emails as READ_OWN', () => {
        expect(getListingAmenitiesTool.isWrite).toBe(false);
        expect(getListingAmenitiesTool.emailUnverifiedOperation).toBe('READ_OWN');
    });

    it('AC-C7: a venue only sees the rows applicable to venues, grouped with Spanish labels', async () => {
        // Arrange
        givenCatalog({ amenities: AMENITIES, features: FEATURES });
        givenListing(VerticalEnum.VENUE);
        givenSelected({ amenities: [uuid('a', 1)], features: [] });

        // Act
        const data = await dataOf({ vertical: 'venue', id: LISTING_ID });

        // Assert
        expect(data.groups.map((g) => [g.kind, g.category, g.label])).toEqual([
            ['amenity', 'CONNECTIVITY', 'Conectividad'],
            ['amenity', 'PARKING', 'Estacionamiento'],
            ['feature', 'VIEW', 'Vistas']
        ]);
        const slugs = data.groups.flatMap((g) => g.items.map((i) => i.slug));
        expect(slugs).toEqual(['wifi', 'parking_free', 'river_view']);
        expect(slugs).not.toContain('oven');
        expect(slugs).not.toContain('rustic');
    });

    it('AC-C7: `selected` matches the stored junction rows', async () => {
        // Arrange
        givenCatalog({ amenities: AMENITIES, features: FEATURES });
        givenListing(VerticalEnum.ACCOMMODATION);
        givenSelected({ amenities: [uuid('a', 2)], features: [uuid('f', 1)] });

        // Act
        const data = await dataOf({ vertical: 'accommodation', id: LISTING_ID });

        // Assert
        const selected = data.groups.flatMap((g) =>
            g.items.filter((i) => i.selected).map((i) => i.slug)
        );
        expect(selected.sort()).toEqual(['oven', 'river_view']);
        const unselected = data.groups.flatMap((g) =>
            g.items.filter((i) => !i.selected).map((i) => i.slug)
        );
        expect(unselected.sort()).toEqual(['parking_free', 'pool', 'rustic', 'wifi']);
    });

    it('names the listing and shows Spanish item names, never raw slugs', async () => {
        // Arrange
        givenCatalog({ amenities: AMENITIES, features: FEATURES });
        givenListing(VerticalEnum.ACCOMMODATION);

        // Act
        const data = await dataOf({ vertical: 'accommodation', id: LISTING_ID });

        // Assert
        expect(data.listing).toEqual({
            vertical: 'accommodation',
            id: LISTING_ID,
            name: 'Cabañas del Río'
        });
        const names = data.groups.flatMap((g) => g.items.map((i) => i.name));
        expect(names).not.toContain('wifi');
        expect(names).not.toContain('pool');
    });

    it('omits empty groups', async () => {
        // Arrange
        givenCatalog({ amenities: AMENITIES, features: [] });
        givenListing(VerticalEnum.ACCOMMODATION);

        // Act
        const data = await dataOf({ vertical: 'accommodation', id: LISTING_ID });

        // Assert
        expect(data.groups.every((g) => g.items.length > 0)).toBe(true);
        expect(data.groups.some((g) => g.kind === 'feature')).toBe(false);
    });

    it('`category` returns that group only and reads only its kind', async () => {
        // Arrange
        const { amenitySearch, featureSearch } = givenCatalog({
            amenities: AMENITIES,
            features: FEATURES
        });
        givenListing(VerticalEnum.ACCOMMODATION);

        // Act
        const data = await dataOf({ vertical: 'accommodation', id: LISTING_ID, category: 'VIEW' });

        // Assert
        expect(data.groups.map((g) => g.category)).toEqual(['VIEW']);
        expect(featureSearch).toHaveBeenCalled();
        expect(amenitySearch).not.toHaveBeenCalled();
    });

    it('`kind` returns only that kind', async () => {
        // Arrange
        givenCatalog({ amenities: AMENITIES, features: FEATURES });
        givenListing(VerticalEnum.ACCOMMODATION);

        // Act
        const data = await dataOf({ vertical: 'accommodation', id: LISTING_ID, kind: 'amenity' });

        // Assert
        expect(new Set(data.groups.map((g) => g.kind))).toEqual(new Set(['amenity']));
    });

    it('refuses a category that is not of the given kind', async () => {
        // Act
        const outcome = await run({
            vertical: 'accommodation',
            id: LISTING_ID,
            kind: 'amenity',
            category: 'VIEW'
        });

        // Assert
        expect(outcome.ok).toBe(false);
        if (!outcome.ok) {
            expect(outcome.failure.code).toBe('VALIDATION_ERROR');
            expect(outcome.failure.message).toContain('VIEW');
        }
    });

    it('refuses a value that is no category at all', async () => {
        const outcome = await run({ vertical: 'accommodation', id: LISTING_ID, category: 'NOPE' });
        expect(outcome.ok).toBe(false);
    });

    describe('ownership (AC-C11)', () => {
        it.each([
            VerticalEnum.ACCOMMODATION,
            VerticalEnum.VENUE,
            VerticalEnum.EXPERIENCE
        ] as const)("answers another user's %s as not found, without reading the catalog", async (vertical) => {
            // Arrange
            const { amenitySearch, featureSearch } = givenCatalog({
                amenities: AMENITIES,
                features: FEATURES
            });
            givenListing(vertical, OTHER_ID);

            // Act
            const outcome = await run({ vertical, id: LISTING_ID });

            // Assert
            expect(outcome.ok).toBe(false);
            if (!outcome.ok) {
                expect(outcome.failure).toMatchObject({
                    code: 'NOT_FOUND',
                    message: TOOL_NOT_FOUND_MESSAGE
                });
            }
            expect(amenitySearch).not.toHaveBeenCalled();
            expect(featureSearch).not.toHaveBeenCalled();
        });

        it('answers a missing listing with the same not found', async () => {
            // Arrange
            givenCatalog({ amenities: AMENITIES, features: FEATURES });
            vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                error: { code: 'NOT_FOUND', message: 'missing' }
            } as never);

            // Act
            const outcome = await run({ vertical: 'accommodation', id: LISTING_ID });

            // Assert
            expect(outcome.ok).toBe(false);
            if (!outcome.ok) {
                expect(outcome.failure).toMatchObject({
                    code: 'NOT_FOUND',
                    message: TOOL_NOT_FOUND_MESSAGE
                });
            }
        });

        it('links a not-found refusal to the owner list, never to the id editor (AC-C4)', async () => {
            // Arrange
            givenCatalog({ amenities: AMENITIES, features: FEATURES });
            givenListing(VerticalEnum.ACCOMMODATION, OTHER_ID);
            const original = env.HOSPEDA_SITE_URL;
            env.HOSPEDA_SITE_URL = 'https://hospeda.test';
            const actor = actorFor(OWNER_ID);

            // Act
            const result = await handleMcpToolCall({
                definition: getListingAmenitiesTool,
                input: { vertical: 'accommodation', id: LISTING_ID },
                ctx: {
                    http: {
                        authInfo: buildMcpAuthInfo({
                            token: 'tok',
                            actor,
                            mcpAuth: {
                                userId: OWNER_ID,
                                clientId: 'https://claude.ai/oauth/mcp-client-metadata',
                                clientName: 'Claude',
                                scopes: ['openid']
                            },
                            resourceUrl: 'https://api.test/mcp'
                        })
                    }
                }
            });
            env.HOSPEDA_SITE_URL = original;

            // Assert
            expect(result.isError).toBe(true);
            expect(result.structuredContent).toMatchObject({
                action: { url: 'https://hospeda.test/es/mi-cuenta/propiedades/' }
            });
            expect(JSON.stringify(result)).not.toContain(LISTING_ID);
        });
    });

    describe('response budget (spec §5.3)', () => {
        /** Catalog sized like the seeded accommodation one: 143 amenities, 70 features. */
        function seededSizedCatalog() {
            const amenityTypes = [
                ['KITCHEN', 17],
                ['OUTDOORS', 21],
                ['SAFETY', 8],
                ['CLIMATE_CONTROL', 9],
                ['DINING', 6],
                ['ENTERTAINMENT', 21],
                ['ACCESSIBILITY', 7],
                ['WATER_ACTIVITIES', 4],
                ['BED_AND_BATH', 12],
                ['LAUNDRY', 5],
                ['WELLNESS', 6],
                ['SERVICES', 8],
                ['GENERAL_APPLIANCES', 4],
                ['FAMILY_FRIENDLY', 6],
                ['WORK_FRIENDLY', 3],
                ['PARKING', 4],
                ['CONNECTIVITY', 2]
            ] as const;
            const featureCategories = [
                ['OFFER_PROFILE', 15],
                ['AUDIENCE', 10],
                ['LOCATION', 11],
                ['SUSTAINABILITY', 7],
                ['STYLE', 6],
                ['LANGUAGE', 1],
                ['ACTIVITIES', 9],
                ['ACCESS', 4],
                ['VIEW', 7]
            ] as const;
            let n = 0;
            const amenities = amenityTypes.flatMap(([type, count]) =>
                Array.from({ length: count }, () => ({
                    id: uuid('a', ++n),
                    slug: `amenity_with_a_long_slug_${n}`,
                    type,
                    applicableVerticals: ['accommodation']
                }))
            );
            const features = featureCategories.flatMap(([category, count]) =>
                Array.from({ length: count }, () => ({
                    id: uuid('f', ++n),
                    slug: `feature_with_a_long_slug_${n}`,
                    category,
                    applicableVerticals: ['accommodation']
                }))
            );
            return { amenities, features };
        }

        it('keeps the largest seeded result within the budget and lists what it left out', async () => {
            // Arrange
            givenCatalog(seededSizedCatalog());
            givenListing(VerticalEnum.ACCOMMODATION);

            // Act
            const data = await dataOf({ vertical: 'accommodation', id: LISTING_ID });

            // Assert
            expect(measureResultChars({ value: data })).toBeLessThanOrEqual(MCP_RESULT_MAX_CHARS);
            const all = [...(data.groups ?? []), ...(data.omittedGroups ?? [])];
            expect(all).toHaveLength(26);
            if (data.truncated) {
                expect(data.omittedGroups?.length).toBeGreaterThan(0);
            }
        });

        it('every single category fits the budget on its own', async () => {
            // Arrange
            givenCatalog(seededSizedCatalog());
            givenListing(VerticalEnum.ACCOMMODATION);

            // Act
            const data = await dataOf({
                vertical: 'accommodation',
                id: LISTING_ID,
                category: 'OUTDOORS'
            });

            // Assert
            expect(data.truncated).toBeUndefined();
            expect(data.groups).toHaveLength(1);
            expect(data.groups[0]?.items).toHaveLength(21);
        });

        const group = (category: string, items: number): AmenityGroup => ({
            kind: 'amenity',
            category,
            label: category,
            items: Array.from({ length: items }, (_, i) => ({
                id: uuid('a', i),
                slug: `s${i}`,
                name: `Nombre ${i}`,
                selected: false
            }))
        });
        const listing = {
            vertical: VerticalEnum.ACCOMMODATION,
            id: LISTING_ID,
            name: 'X'
        } as const;

        it('fitGroupsToBudget keeps leading groups while they fit and omits the rest with counts', () => {
            // Arrange
            const groups = [group('KITCHEN', 5), group('OUTDOORS', 5), group('SAFETY', 5)];
            const oneGroupChars = measureResultChars({ value: { listing, groups: [groups[0]] } });

            // Act
            const result = fitGroupsToBudget({ listing, groups, maxChars: oneGroupChars + 400 });

            // Assert
            expect(result.groups.map((g) => g.category)).toEqual(['KITCHEN']);
            expect(result.truncated).toBe(true);
            expect(result.omittedGroups).toEqual([
                { kind: 'amenity', category: 'OUTDOORS', label: 'OUTDOORS', itemCount: 5 },
                { kind: 'amenity', category: 'SAFETY', label: 'SAFETY', itemCount: 5 }
            ]);
            expect(measureResultChars({ value: result })).toBeLessThanOrEqual(oneGroupChars + 400);
        });

        it('fitGroupsToBudget returns everything, untruncated, when it all fits', () => {
            const groups = [group('KITCHEN', 2), group('OUTDOORS', 2)];
            const result = fitGroupsToBudget({ listing, groups });
            expect(result.groups).toHaveLength(2);
            expect(result).not.toHaveProperty('truncated');
            expect(result).not.toHaveProperty('omittedGroups');
        });

        it('fitGroupsToBudget never returns an empty result: the first group is always kept', () => {
            const result = fitGroupsToBudget({
                listing,
                groups: [group('KITCHEN', 30)],
                maxChars: 10
            });
            expect(result.groups).toHaveLength(1);
        });
    });
});
