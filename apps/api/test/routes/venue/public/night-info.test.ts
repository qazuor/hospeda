/**
 * @file night-info.test.ts
 * @description HOS-1849 / 4.5 (AC:4:4) — the public `getBySlug` response must
 * carry the seven `nightInfo` fields when the section is `available`, must
 * omit every one of them when it is not, and must always expose the resolved
 * `multiLine` fact.
 *
 * This test reads the HTTP response, not the projector's return value. That is
 * the point: `VenuePublicSchema` is the route's `responseSchema`, so a field
 * missing from its `.pick` is silently discarded and only an end-to-end
 * assertion catches it.
 */
import type { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { venueSvc, menu, events, specials, effectiveSet } = vi.hoisted(() => ({
    venueSvc: { getBySlug: vi.fn() },
    menu: vi.fn(),
    events: vi.fn(),
    specials: vi.fn(),
    effectiveSet: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        VenueService: vi.fn().mockImplementation(function () {
            return {
                getBySlug: (...args: unknown[]) => venueSvc.getBySlug(...args),
                model: {}
            };
        }),
        getVenueMenu: menu,
        getVenueEvents: events,
        getVenueDailySpecials: specials
    };
});

vi.mock('../../../../src/utils/listing-catalog-relations', () => ({
    fetchVenueAmenities: vi.fn(async () => []),
    fetchVenueFeatures: vi.fn(async () => [])
}));

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet })
}));

import { initApp } from '../../../../src/app';
import type { AppOpenAPI } from '../../../../src/types';
import { validateApiEnv } from '../../../../src/utils/env';

const PUBLIC_HEADERS: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'vitest'
};

const OWNER_ID = 'eeeeeeee-0000-4000-8000-000000001849';
const VENUE_ID = 'aaaaaaaa-0000-4000-8000-000000001849';
const DESTINATION_ID = 'dddddddd-0000-4000-8000-000000001849';

/** The seven fields the section owns: six writable plus the server-managed date. */
const NIGHT_INFO_FIELDS = [
    'entryKind',
    'entryNoteI18n',
    'entryPriceFrom',
    'entryPriceUpdatedAt',
    'minAge',
    'dressCode',
    'dressCodeNoteI18n'
] as const;

const NIGHT_INFO_VALUES = {
    entryKind: 'paid',
    entryNoteI18n: { es: 'Hasta la 1', en: 'Until 1 am', pt: 'Até a 1' },
    entryPriceFrom: 500000,
    entryPriceUpdatedAt: new Date('2026-03-01T00:00:00Z'),
    minAge: 18,
    dressCode: 'smart_casual',
    dressCodeNoteI18n: { es: 'Salvo verano', en: 'Except summer', pt: 'Exceto verão' }
} as const;

type VenueOverrides = {
    readonly slug: string;
    readonly type: string;
    readonly businessLines: readonly string[];
};

/**
 * The minimum a public venue row must carry to survive `VenuePublicSchema`.
 * `businessLines` is not in the response schema; it is read by the resolver
 * before projection, exactly as the real service row provides it.
 */
function makeVenue({ slug, type, businessLines }: VenueOverrides): Record<string, unknown> {
    return {
        id: VENUE_ID,
        ownerId: OWNER_ID,
        slug,
        name: 'Test venue',
        type,
        businessLines,
        summary: 'A test venue.',
        description: 'A detailed test description for this venue listing.',
        destinationId: DESTINATION_ID,
        publicationStatus: 'PUBLISHED',
        averageRating: 4.5,
        reviewsCount: 0,
        isFeatured: false,
        featuredByEntitlement: false,
        media: null,
        seo: null,
        socialNetworks: null,
        nameI18n: null,
        summaryI18n: null,
        descriptionI18n: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        createdById: null,
        updatedById: null,
        ...NIGHT_INFO_VALUES
    };
}

/** Grants `manage_venue_menu` to the owner so the `menu` section is `available`. */
function grantMenu(granted: boolean): void {
    effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical: vertical as VerticalEnum,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: granted ? [{ key: 'manage_venue_menu', value: 1, strategy: 'MAX' }] : []
            })
    );
}

let app: AppOpenAPI;

/** Reads the `data` envelope of the public route. */
async function getVenue(slug: string): Promise<Record<string, unknown>> {
    const res = await app.request(`/api/v1/public/venues/slug/${slug}`, {
        headers: PUBLIC_HEADERS
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    return body.data;
}

beforeEach(async () => {
    vi.clearAllMocks();
    menu.mockResolvedValue({ data: { sections: [] }, error: null });
    events.mockResolvedValue({ data: { events: [] }, error: null });
    specials.mockResolvedValue({ data: { specials: [] }, error: null });
    grantMenu(false);
    validateApiEnv();
    app = await initApp();
});

describe('GET /public/venues/slug/:slug — nightInfo (HOS-1849)', () => {
    it('TEST:4.5:1 publishes the seven fields and multiLine false for a nightclub', async () => {
        venueSvc.getBySlug.mockResolvedValue({
            data: makeVenue({ slug: 'boliche', type: 'BOLICHE', businessLines: ['nightlife'] })
        });

        const data = await getVenue('boliche');

        expect(data.entryKind).toBe('paid');
        expect(data.entryNoteI18n).toEqual(NIGHT_INFO_VALUES.entryNoteI18n);
        expect(data.entryPriceFrom).toBe(500000);
        // The schema coerces to Date; JSON brings it back as ISO text.
        expect(typeof data.entryPriceUpdatedAt).toBe('string');
        expect(data.minAge).toBe(18);
        expect(data.dressCode).toBe('smart_casual');
        expect(data.dressCodeNoteI18n).toEqual(NIGHT_INFO_VALUES.dressCodeNoteI18n);
        expect(data.multiLine).toBe(false);
    });

    it('TEST:4.5:1 publishes multiLine true for a bar whose carta is available', async () => {
        grantMenu(true);
        menu.mockResolvedValue({
            data: {
                sections: [
                    {
                        id: 'cccccccc-0000-4000-8000-000000001849',
                        venueId: VENUE_ID,
                        name: 'Carta',
                        description: null,
                        displayOrder: 0,
                        items: [],
                        createdAt: '2026-10-01T00:00:00.000Z',
                        updatedAt: '2026-10-01T00:00:00.000Z'
                    }
                ]
            },
            error: null
        });
        venueSvc.getBySlug.mockResolvedValue({
            data: makeVenue({ slug: 'bar', type: 'BAR', businessLines: ['food', 'nightlife'] })
        });

        const data = await getVenue('bar');

        expect(data.multiLine).toBe(true);
        expect(data.entryKind).toBe('paid');
    });

    it('TEST:4.5:1 omits every nightInfo field for a restaurant', async () => {
        venueSvc.getBySlug.mockResolvedValue({
            data: makeVenue({
                slug: 'restaurant',
                type: 'RESTAURANT',
                businessLines: ['food']
            })
        });

        const data = await getVenue('restaurant');

        for (const field of NIGHT_INFO_FIELDS) {
            expect(data).not.toHaveProperty(field);
        }
        expect(data.multiLine).toBe(false);
    });
});
