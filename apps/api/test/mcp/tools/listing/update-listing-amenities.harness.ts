/**
 * Shared fixtures of the `update_listing_amenities` tests (HOS-2327): ids, a
 * small catalog, the actor builder, and the answers of the listing-access ports,
 * relation readers and services. Each test file keeps its own `vi.mock` calls
 * (vitest hoists them per file) and points them at {@link mocks}, so the helpers
 * here and the assertions there see the same spies.
 *
 * @module test/mcp/tools/listing/update-listing-amenities.harness
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
import { rehydrateEffectiveSet } from '@repo/verticals';
import { vi } from 'vitest';

/** The spies every test file hands to its `vi.mock` factories. */
export const mocks = {
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    preTrialDraftLimits: vi.fn(),
    record: vi.fn(),
    invalidateCache: vi.fn(),
    accAmenities: vi.fn(),
    accFeatures: vi.fn(),
    venueAmenities: vi.fn(),
    venueFeatures: vi.fn(),
    expAmenities: vi.fn(),
    expFeatures: vi.fn()
};

export const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
export const OTHER_ID = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
export const LISTING_ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';
export const SITE_URL = 'https://hospeda.test';
export const context = { channel: 'mcp' } as const;

export const uuid = (prefix: string, n: number) =>
    `${prefix}000000${n}-0000-4000-8000-000000000000`;
export const KITCHEN_1 = uuid('a', 1);
export const KITCHEN_2 = uuid('a', 2);
export const KITCHEN_3 = uuid('a', 3);
export const KITCHEN_ACC_ONLY = uuid('a', 4);
export const PARKING_1 = uuid('a', 5);
export const VIEW_1 = uuid('f', 1);
export const VIEW_2 = uuid('f', 2);
export const STYLE_1 = uuid('f', 3);
export const STYLE_ACC_ONLY = uuid('f', 4);
export const UNKNOWN_ID = uuid('d', 9);

interface Fixture {
    readonly id: string;
    readonly slug: string;
    readonly applicableVerticals: readonly string[];
    readonly type?: string;
    readonly category?: string;
}

const ALL = ['accommodation', 'venue', 'experience'];
export const AMENITIES: readonly Fixture[] = [
    { id: KITCHEN_1, slug: 'oven', type: 'KITCHEN', applicableVerticals: ALL },
    { id: KITCHEN_2, slug: 'fridge', type: 'KITCHEN', applicableVerticals: ALL },
    { id: KITCHEN_3, slug: 'microwave', type: 'KITCHEN', applicableVerticals: ALL },
    {
        id: KITCHEN_ACC_ONLY,
        slug: 'dishwasher',
        type: 'KITCHEN',
        applicableVerticals: ['accommodation']
    },
    { id: PARKING_1, slug: 'parking_free', type: 'PARKING', applicableVerticals: ALL }
];
export const FEATURES: readonly Fixture[] = [
    { id: VIEW_1, slug: 'river_view', category: 'VIEW', applicableVerticals: ALL },
    { id: VIEW_2, slug: 'mountain_view', category: 'VIEW', applicableVerticals: ALL },
    { id: STYLE_1, slug: 'rustic', category: 'STYLE', applicableVerticals: ALL },
    {
        id: STYLE_ACC_ONLY,
        slug: 'themed_rooms',
        category: 'STYLE',
        applicableVerticals: ['accommodation']
    }
];

export const actorFor = (
    id: string,
    options: { readonly permissions?: readonly string[]; readonly emailVerified?: boolean } = {}
): Actor =>
    ({
        id,
        roles: ['HOST'],
        permissions: options.permissions ?? [],
        emailVerified: options.emailVerified ?? true
    }) as unknown as Actor;

export const VERTICALS = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;
export type Vertical = (typeof VERTICALS)[number];

export const SERVICES = {
    [VerticalEnum.ACCOMMODATION]: AccommodationService,
    [VerticalEnum.VENUE]: VenueService,
    [VerticalEnum.EXPERIENCE]: ExperienceService
} as const;

export const EDIT_KEY = {
    [VerticalEnum.ACCOMMODATION]: 'edit_accommodation_info',
    [VerticalEnum.VENUE]: 'edit_venue_info',
    [VerticalEnum.EXPERIENCE]: 'edit_experience_info'
} as const;

/** What the vertical's write service is called as. */
export function writeSpy(vertical: Vertical, result: unknown = { data: { id: LISTING_ID } }) {
    const prototype = SERVICES[vertical].prototype as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
    >;
    return vi
        .spyOn(prototype, vertical === VerticalEnum.ACCOMMODATION ? 'update' : 'updateOwn')
        .mockResolvedValue(result);
}

/** Points the vertical's `getById` at an owned row (read before and after the write). */
export function givenRow(vertical: Vertical) {
    const prototype = SERVICES[vertical].prototype as unknown as {
        getById: (...args: unknown[]) => Promise<unknown>;
    };
    return vi.spyOn(prototype, 'getById').mockResolvedValue({
        data: {
            id: LISTING_ID,
            ownerId: OWNER_ID,
            name: 'Cabañas del Río',
            slug: 'cabanas-del-rio',
            publicationStatus: PublicationStatusEnum.DRAFT
        }
    });
}

/** The junction rows a vertical's relation readers return, per read (before, then after). */
export function givenRelations(input: {
    readonly vertical: Vertical;
    readonly before: {
        readonly amenities: readonly string[];
        readonly features: readonly string[];
    };
    readonly after?: {
        readonly amenities: readonly string[];
        readonly features: readonly string[];
    };
}) {
    const { vertical, before, after = before } = input;
    const rows = (ids: readonly string[], key: 'id' | 'amenityId' | 'featureId') =>
        ids.map((id) => ({ [key]: id, slug: 'x' }));
    const [amenityMock, featureMock, amenityKey, featureKey] =
        vertical === VerticalEnum.ACCOMMODATION
            ? ([mocks.accAmenities, mocks.accFeatures, 'id', 'id'] as const)
            : vertical === VerticalEnum.VENUE
              ? ([mocks.venueAmenities, mocks.venueFeatures, 'amenityId', 'featureId'] as const)
              : ([mocks.expAmenities, mocks.expFeatures, 'amenityId', 'featureId'] as const);
    amenityMock
        .mockResolvedValueOnce(rows(before.amenities, amenityKey))
        .mockResolvedValue(rows(after.amenities, amenityKey));
    featureMock
        .mockResolvedValueOnce(rows(before.features, featureKey))
        .mockResolvedValue(rows(after.features, featureKey));
}

/** Points the catalog services at the fixtures, honouring `applicableVertical` like the SQL does. */
export function givenCatalog() {
    const scoped = (rows: readonly Fixture[], params: unknown) => {
        const vertical = (params as { applicableVertical?: string }).applicableVertical;
        const items = rows.filter(
            (row) => vertical === undefined || row.applicableVerticals.includes(vertical)
        );
        return { data: { items, total: items.length } } as never;
    };
    return {
        amenitySearch: vi
            .spyOn(AmenityService.prototype, 'search')
            .mockImplementation(async (_a, params) => scoped(AMENITIES, params)),
        featureSearch: vi
            .spyOn(FeatureService.prototype, 'search')
            .mockImplementation(async (_a, params) => scoped(FEATURES, params))
    };
}

/** Listing facts: an existing PUBLISHED listing owned by `ownerId`. */
export function givenFacts(vertical: Vertical, ownerId: string = OWNER_ID): void {
    mocks.loadFacts.mockResolvedValue({
        facts: {
            ownerId,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            businessLines: vertical === VerticalEnum.VENUE ? ['food'] : ['standard']
        },
        ownerId
    });
}

/** The owner's effective set, with or without the vertical's edit capability. */
export function givenCapability(vertical: Vertical, granted: boolean): void {
    mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical,
            hasLiveNonTrialTitle: true,
            inheritsTouristVip: false,
            entries: granted ? [{ key: EDIT_KEY[vertical], value: 1, strategy: 'MAX' }] : []
        })
    );
}

/**
 * Runs the tool. The tool modules are imported lazily: the `vi.mock` factories
 * import this file, and a top-level import of the tool (which imports the mocked
 * modules) would make the two wait on each other.
 */
export const run = async (input: Record<string, unknown>, actor: Actor = actorFor(OWNER_ID)) => {
    const { updateListingAmenitiesTool } = await import(
        '../../../../src/mcp/tools/listing/update-listing-amenities'
    );
    const { runTool } = await import('../../../../src/mcp/tools/run-tool');
    return runTool({ definition: updateListingAmenitiesTool, actor, input, context });
};

export const failureOf = async (input: Record<string, unknown>, actor?: Actor) => {
    const outcome = await run(input, actor);
    if (outcome.ok) throw new Error('expected a failure');
    return outcome.failure;
};
