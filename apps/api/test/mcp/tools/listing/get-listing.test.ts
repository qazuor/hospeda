/**
 * HOS-2184 T-014 — `get_listing`: one owned listing projected to the editable
 * set, through the get-own authorization of the protected routes (service
 * `getById` + resource step `READ_OWN`), with every foreign or missing id
 * answering the same not-found error (AC-6).
 *
 * Services are spied on their prototypes; the catalog-relation readers (the
 * only database access) are mocked at their module boundary.
 *
 * @module test/mcp/tools/listing/get-listing
 */

import {
    PermissionEnum,
    PublicationStatusEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    DestinationService,
    ExperienceService,
    ServiceError,
    VenueService
} from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { accAmenities, accFeatures, venueAmenities, venueFeatures, expAmenities, expFeatures } =
    vi.hoisted(() => ({
        accAmenities: vi.fn(),
        accFeatures: vi.fn(),
        venueAmenities: vi.fn(),
        venueFeatures: vi.fn(),
        expAmenities: vi.fn(),
        expFeatures: vi.fn()
    }));

vi.mock('../../../../src/utils/accommodation-catalog-relations', () => ({
    fetchProtectedAmenities: accAmenities,
    fetchProtectedFeatures: accFeatures
}));

vi.mock('../../../../src/utils/listing-catalog-relations', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../src/utils/listing-catalog-relations')>()),
    fetchVenueAmenities: venueAmenities,
    fetchVenueFeatures: venueFeatures,
    fetchExperienceAmenities: expAmenities,
    fetchExperienceFeatures: expFeatures
}));

import { getListingTool } from '../../../../src/mcp/tools/listing/get-listing';
import { GET_LISTING_MAX_CATALOG_NAMES } from '../../../../src/mcp/tools/listing/get-listing-context';
import { MCP_RESULT_MAX_CHARS } from '../../../../src/mcp/tools/response-budget';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import {
    TOOL_NOT_FOUND_MESSAGE,
    TOOL_UNEXPECTED_ERROR_MESSAGE
} from '../../../../src/mcp/tools/tool-errors';
import { env, validateApiEnv } from '../../../../src/utils/env';

const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
const OTHER_ID = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const LISTING_ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';
const AMENITY_ID = '44444444-4444-4444-8444-444444444444';
const FEATURE_ID = '55555555-5555-4555-8555-555555555555';
const DESTINATION_ID = '77777777-7777-4777-8777-777777777777';
const SITE_URL = 'https://hospeda.test';
const context = { channel: 'mcp' } as const;

const actorFor = (id: string, permissions: readonly string[] = []): Actor =>
    ({ id, roles: ['HOST'], permissions, emailVerified: true }) as unknown as Actor;

const OPENING_HOURS = {
    monday: { isOpen: true, shifts: [{ open: '09:00', close: '18:00' }] }
};
const CONTACT_INFO = { mobilePhone: '+5493442123456', website: 'https://example.com' };

const accommodationRow = (overrides: Record<string, unknown> = {}) => ({
    id: LISTING_ID,
    ownerId: OWNER_ID,
    name: 'Cabañas del Río',
    slug: 'cabanas-del-rio',
    publicationStatus: PublicationStatusEnum.PUBLISHED,
    summary: 'Cabañas frente al río',
    description: 'Cabañas equipadas a metros del río Uruguay.',
    richDescription: 'NOT EDITABLE HERE',
    contactInfo: CONTACT_INFO,
    destinationId: DESTINATION_ID,
    location: { street: 'Calle Urquiza', number: '123', floor: '2', apartment: 'B' },
    ...overrides
});

const scheduledRow = (overrides: Record<string, unknown> = {}) => ({
    id: LISTING_ID,
    ownerId: OWNER_ID,
    name: 'La Parrilla',
    slug: 'la-parrilla',
    publicationStatus: PublicationStatusEnum.DRAFT,
    summary: 'NOT EDITABLE HERE',
    description: 'Parrilla de barrio.',
    openingHours: OPENING_HOURS,
    contactInfo: CONTACT_INFO,
    destinationId: DESTINATION_ID,
    ...overrides
});

type GetByIdResult = Awaited<ReturnType<VenueService['getById']>>;
const asResult = (value: unknown) => value as GetByIdResult;

const SERVICES = {
    [VerticalEnum.ACCOMMODATION]: AccommodationService,
    [VerticalEnum.VENUE]: VenueService,
    [VerticalEnum.EXPERIENCE]: ExperienceService
} as const;

const ROW_FOR = {
    [VerticalEnum.ACCOMMODATION]: accommodationRow,
    [VerticalEnum.VENUE]: scheduledRow,
    [VerticalEnum.EXPERIENCE]: scheduledRow
} as const;

const VERTICALS = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;

/** Points one vertical's `getById` at a canned result. */
function givenGetById(
    vertical: (typeof VERTICALS)[number],
    result: unknown
): ReturnType<typeof vi.spyOn> {
    const prototype = SERVICES[vertical].prototype as unknown as {
        getById: (...args: unknown[]) => Promise<GetByIdResult>;
    };
    return vi.spyOn(prototype, 'getById').mockResolvedValue(asResult(result));
}

const run = (input: Record<string, unknown>, actor: Actor = actorFor(OWNER_ID)) =>
    runTool({ definition: getListingTool, actor, input, context });

describe('get_listing', () => {
    let originalSiteUrl: string;

    beforeAll(() => {
        validateApiEnv();
        originalSiteUrl = env.HOSPEDA_SITE_URL;
    });

    afterAll(() => {
        env.HOSPEDA_SITE_URL = originalSiteUrl;
    });

    beforeEach(() => {
        env.HOSPEDA_SITE_URL = SITE_URL;
        vi.spyOn(DestinationService.prototype, 'getById').mockResolvedValue({
            data: { id: DESTINATION_ID, name: 'Concepción del Uruguay' }
        } as never);
        accAmenities.mockResolvedValue([{ id: AMENITY_ID, slug: 'wifi' }]);
        accFeatures.mockResolvedValue([{ id: FEATURE_ID, slug: 'river_view' }]);
        venueAmenities.mockResolvedValue([{ amenityId: AMENITY_ID, slug: 'wifi' }]);
        venueFeatures.mockResolvedValue([{ featureId: FEATURE_ID, slug: 'live_music' }]);
        expAmenities.mockResolvedValue([{ amenityId: AMENITY_ID, slug: 'parking' }]);
        expFeatures.mockResolvedValue([{ featureId: FEATURE_ID, slug: 'guided' }]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        for (const fn of [
            accAmenities,
            accFeatures,
            venueAmenities,
            venueFeatures,
            expAmenities,
            expFeatures
        ]) {
            fn.mockReset();
        }
    });

    it('is a read-only tool available to unverified emails as READ_OWN', () => {
        // Assert
        expect(getListingTool.name).toBe('get_listing');
        expect(getListingTool.isWrite).toBe(false);
        expect(getListingTool.emailUnverifiedOperation).toBe('READ_OWN');
    });

    describe('accommodation', () => {
        it('returns the editable set and the public URL of an own published listing', async () => {
            // Arrange
            const getById = givenGetById(VerticalEnum.ACCOMMODATION, {
                data: accommodationRow()
            });
            const actor = actorFor(OWNER_ID);

            // Act
            const outcome = await run({ vertical: 'accommodation', id: LISTING_ID }, actor);

            // Assert
            expect(getById).toHaveBeenCalledWith(actor, LISTING_ID);
            expect(accAmenities).toHaveBeenCalledWith(LISTING_ID);
            expect(outcome).toEqual({
                ok: true,
                data: {
                    id: LISTING_ID,
                    vertical: 'accommodation',
                    name: 'Cabañas del Río',
                    publicationStatus: PublicationStatusEnum.PUBLISHED,
                    publicUrl: `${SITE_URL}/es/alojamientos/cabanas-del-rio/`,
                    summary: 'Cabañas frente al río',
                    description: 'Cabañas equipadas a metros del río Uruguay.',
                    phone: CONTACT_INFO.mobilePhone,
                    website: CONTACT_INFO.website,
                    amenities: [{ id: AMENITY_ID, slug: 'wifi' }],
                    features: [{ id: FEATURE_ID, slug: 'river_view' }],
                    address: 'Calle Urquiza 123, piso 2, depto B',
                    destination: 'Concepción del Uruguay',
                    amenityNames: { names: [expect.any(String)], total: 1 },
                    featureNames: { names: [expect.any(String)], total: 1 }
                }
            });
        });

        it('has no opening hours or contactInfo block', async () => {
            // Arrange
            givenGetById(VerticalEnum.ACCOMMODATION, {
                data: accommodationRow({ openingHours: OPENING_HOURS })
            });

            // Act
            const outcome = await run({ vertical: 'accommodation', id: LISTING_ID });

            // Assert
            expect(outcome.ok).toBe(true);
            const data: object = outcome.ok ? outcome.data : {};
            expect(data).not.toHaveProperty('openingHours');
            expect(data).not.toHaveProperty('contactInfo');
            expect(data).not.toHaveProperty('richDescription');
        });

        it('reports missing contact fields as null', async () => {
            // Arrange
            givenGetById(VerticalEnum.ACCOMMODATION, {
                data: accommodationRow({ contactInfo: null, summary: undefined })
            });

            // Act
            const outcome = await run({ vertical: 'accommodation', id: LISTING_ID });

            // Assert
            expect(outcome).toMatchObject({
                ok: true,
                data: { phone: null, website: null, summary: null }
            });
        });
    });

    describe('location and amenity names (HOS-2377)', () => {
        it('answers with the destination name, the address and Spanish amenity names', async () => {
            // Arrange
            givenGetById(VerticalEnum.ACCOMMODATION, { data: accommodationRow() });

            // Act
            const outcome = await run({ vertical: 'accommodation', id: LISTING_ID });

            // Assert
            const data = outcome.ok ? outcome.data : undefined;
            expect(data).toMatchObject({
                address: 'Calle Urquiza 123, piso 2, depto B',
                destination: 'Concepción del Uruguay'
            });
            expect(JSON.stringify(data?.amenityNames)).not.toContain('wifi');
        });

        it('uses the meeting point as the address of an experience', async () => {
            // Arrange
            givenGetById(VerticalEnum.EXPERIENCE, {
                data: scheduledRow({ meetingPoint: 'Muelle 3 del puerto' })
            });

            // Act
            const outcome = await run({ vertical: 'experience', id: LISTING_ID });

            // Assert
            expect(outcome).toMatchObject({ ok: true, data: { address: 'Muelle 3 del puerto' } });
        });

        it('reports a null destination when it cannot be read', async () => {
            // Arrange
            givenGetById(VerticalEnum.ACCOMMODATION, { data: accommodationRow() });
            vi.spyOn(DestinationService.prototype, 'getById').mockResolvedValue({
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'x' }
            } as never);

            // Act
            const outcome = await run({ vertical: 'accommodation', id: LISTING_ID });

            // Assert
            expect(outcome).toMatchObject({ ok: true, data: { destination: null } });
        });

        it('caps the amenity names and points to get_listing_amenities', async () => {
            // Arrange
            givenGetById(VerticalEnum.ACCOMMODATION, { data: accommodationRow() });
            accAmenities.mockResolvedValue(
                Array.from({ length: GET_LISTING_MAX_CATALOG_NAMES + 7 }, (_, i) => ({
                    id: `a-${i}`,
                    slug: `amenity_${i}`
                }))
            );

            // Act
            const outcome = await run({ vertical: 'accommodation', id: LISTING_ID });

            // Assert
            const data = outcome.ok ? outcome.data : undefined;
            expect(data?.amenityNames.names).toHaveLength(GET_LISTING_MAX_CATALOG_NAMES);
            expect(data?.amenityNames.total).toBe(GET_LISTING_MAX_CATALOG_NAMES + 7);
            expect(data?.moreInfo).toContain('get_listing_amenities');
            expect(JSON.stringify(data).length).toBeLessThan(MCP_RESULT_MAX_CHARS);
        });

        it('mentions the Spanish routing words in its description', () => {
            // Assert
            for (const word of ['características', 'servicios', 'comodidades', 'dónde queda']) {
                expect(getListingTool.description).toContain(word);
            }
        });

        it('reads no address or destination for a foreign listing', async () => {
            // Arrange
            givenGetById(VerticalEnum.ACCOMMODATION, {
                data: accommodationRow({ ownerId: OTHER_ID })
            });

            // Act
            const outcome = await run({ vertical: 'accommodation', id: LISTING_ID });

            // Assert
            expect(outcome.ok).toBe(false);
            expect(DestinationService.prototype.getById).not.toHaveBeenCalled();
        });
    });

    describe.each([VerticalEnum.VENUE, VerticalEnum.EXPERIENCE] as const)('%s', (vertical) => {
        it('returns description, opening hours, contact and catalog refs', async () => {
            // Arrange
            givenGetById(vertical, { data: scheduledRow() });
            const amenities = vertical === VerticalEnum.VENUE ? venueAmenities : expAmenities;

            // Act
            const outcome = await run({ vertical, id: LISTING_ID });

            // Assert
            expect(amenities).toHaveBeenCalledWith(LISTING_ID);
            expect(outcome).toEqual({
                ok: true,
                data: {
                    id: LISTING_ID,
                    vertical,
                    name: 'La Parrilla',
                    publicationStatus: PublicationStatusEnum.DRAFT,
                    publicUrl: null,
                    description: 'Parrilla de barrio.',
                    openingHours: OPENING_HOURS,
                    contactInfo: CONTACT_INFO,
                    amenities: [
                        {
                            id: AMENITY_ID,
                            slug: vertical === VerticalEnum.VENUE ? 'wifi' : 'parking'
                        }
                    ],
                    features: [
                        {
                            id: FEATURE_ID,
                            slug: vertical === VerticalEnum.VENUE ? 'live_music' : 'guided'
                        }
                    ],
                    address: null,
                    destination: 'Concepción del Uruguay',
                    amenityNames: { names: [expect.any(String)], total: 1 },
                    featureNames: { names: [expect.any(String)], total: 1 }
                }
            });
        });

        it('builds the public URL once the listing is published', async () => {
            // Arrange
            givenGetById(vertical, {
                data: scheduledRow({ publicationStatus: PublicationStatusEnum.PUBLISHED })
            });
            const segment = vertical === VerticalEnum.VENUE ? 'comer-y-salir' : 'experiencias';

            // Act
            const outcome = await run({ vertical, id: LISTING_ID });

            // Assert
            expect(outcome).toMatchObject({
                ok: true,
                data: { publicUrl: `${SITE_URL}/es/${segment}/la-parrilla/` }
            });
        });
    });

    describe.each(VERTICALS)('%s — not found (AC-6)', (vertical) => {
        const expectNotFound = (outcome: Awaited<ReturnType<typeof run>>) => {
            expect(outcome.ok).toBe(false);
            expect(outcome.ok ? undefined : outcome.failure).toMatchObject({
                code: ServiceErrorCode.NOT_FOUND,
                message: TOOL_NOT_FOUND_MESSAGE
            });
        };
        const loaders = () =>
            vertical === VerticalEnum.ACCOMMODATION
                ? [accAmenities, accFeatures]
                : vertical === VerticalEnum.VENUE
                  ? [venueAmenities, venueFeatures]
                  : [expAmenities, expFeatures];

        it("answers not found for another user's listing and loads nothing", async () => {
            // Arrange
            givenGetById(vertical, { data: ROW_FOR[vertical]({ ownerId: OTHER_ID }) });

            // Act
            const outcome = await run({ vertical, id: LISTING_ID });

            // Assert
            expectNotFound(outcome);
            for (const loader of loaders()) {
                expect(loader).not.toHaveBeenCalled();
            }
        });

        it('answers not found for a foreign PUBLISHED listing too', async () => {
            // Arrange
            givenGetById(vertical, {
                data: ROW_FOR[vertical]({
                    ownerId: OTHER_ID,
                    publicationStatus: PublicationStatusEnum.PUBLISHED
                })
            });

            // Act / Assert
            expectNotFound(await run({ vertical, id: LISTING_ID }));
        });

        it('does not honour the staff VIEW_ALL bypass of the HTTP route', async () => {
            // Arrange
            givenGetById(vertical, { data: ROW_FOR[vertical]({ ownerId: OTHER_ID }) });
            const staff = actorFor(OWNER_ID, Object.values(PermissionEnum));

            // Act / Assert
            expectNotFound(await run({ vertical, id: LISTING_ID }, staff));
        });

        it('answers not found for a missing id (service NOT_FOUND)', async () => {
            // Arrange
            givenGetById(vertical, {
                error: new ServiceError(ServiceErrorCode.NOT_FOUND, `${vertical} not found`)
            });

            // Act / Assert
            expectNotFound(await run({ vertical, id: LISTING_ID }));
        });

        it('answers not found for a missing id (service returns null)', async () => {
            // Arrange
            givenGetById(vertical, { data: null });

            // Act / Assert
            expectNotFound(await run({ vertical, id: LISTING_ID }));
        });

        it('answers not found, never forbidden, when the service refuses the read', async () => {
            // Arrange
            givenGetById(vertical, {
                error: new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden')
            });

            // Act / Assert
            expectNotFound(await run({ vertical, id: LISTING_ID }));
        });

        it('answers not found for an own purged listing', async () => {
            // Arrange
            givenGetById(vertical, {
                data: ROW_FOR[vertical]({ publicationStatus: PublicationStatusEnum.PURGED })
            });

            // Act / Assert
            expectNotFound(await run({ vertical, id: LISTING_ID }));
        });
    });

    it('reports any other service error as unexpected', async () => {
        // Arrange
        givenGetById(VerticalEnum.VENUE, {
            error: new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'db down')
        });

        // Act
        const outcome = await run({ vertical: 'venue', id: LISTING_ID });

        // Assert
        expect(outcome.ok ? undefined : outcome.failure.message).toBe(
            TOOL_UNEXPECTED_ERROR_MESSAGE
        );
    });

    it.each([
        {
            name: 'a vertical without owner listings',
            input: { vertical: 'tourist', id: LISTING_ID }
        },
        { name: 'a non-uuid id', input: { vertical: 'venue', id: 'abc' } },
        {
            name: 'an extra field',
            input: { vertical: 'venue', id: LISTING_ID, ownerId: OTHER_ID }
        }
    ])('rejects $name as invalid input', async ({ input }) => {
        // Arrange
        const getById = givenGetById(VerticalEnum.VENUE, { data: scheduledRow() });

        // Act
        const outcome = await run(input);

        // Assert
        expect(outcome.ok ? undefined : outcome.failure.code).toBe(
            ServiceErrorCode.VALIDATION_ERROR
        );
        expect(getById).not.toHaveBeenCalled();
    });
});
