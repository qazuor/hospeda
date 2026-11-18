/**
 * @file whatsapp.test.ts
 * @description HOS-2256 section 7.8 (AC-17, AC-18, AC-20) — the public
 * `getBySlug` RESPONSE carries the WhatsApp number only when the owner chose
 * `PUBLIC`, never in `contactInfo`, and a stored number with no choice publishes
 * nothing (the behaviour before the setting existed).
 *
 * Reads the serialized HTTP body as text: a number that leaked through ANY key
 * would be found, which a field-by-field assertion would not.
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

const SECRET_NUMBER = '+54 9 343 7654321';
const OWNER_ID = 'eeeeeeee-0000-4000-8000-000000001849';
const VENUE_ID = 'aaaaaaaa-0000-4000-8000-000000001849';
const DESTINATION_ID = 'dddddddd-0000-4000-8000-000000001849';

const NIGHT_INFO_VALUES = {
    entryKind: 'paid',
    entryNoteI18n: { es: 'Hasta la 1', en: 'Until 1 am', pt: 'Até a 1' },
    entryPriceFrom: 500000,
    entryPriceUpdatedAt: new Date('2026-03-01T00:00:00Z'),
    policies: {
        paymentMethods: ['cash', 'debit'],
        minAge: 18,
        minAgeScope: { kind: 'from_time', from: '00:00' },
        dressCode: 'smart_casual',
        dressCodeNote: { es: 'Salvo verano', en: 'Except summer', pt: 'Exceto verão' }
    }
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
        contactInfo: { mobilePhone: '+54 9 343 1111111', whatsapp: SECRET_NUMBER },
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

beforeEach(async () => {
    vi.clearAllMocks();
    menu.mockResolvedValue({ data: { sections: [] }, error: null });
    events.mockResolvedValue({ data: { events: [] }, error: null });
    specials.mockResolvedValue({ data: { specials: [] }, error: null });
    grantMenu(false);
    validateApiEnv();
    app = await initApp();
});

async function getBody(
    mode: string | null
): Promise<{ text: string; data: Record<string, unknown> }> {
    venueSvc.getBySlug.mockResolvedValue({
        data: {
            ...makeVenue({ slug: 'bar', type: 'BAR', businessLines: ['food'] }),
            whatsappVisibility: mode
        }
    });
    const res = await app.request('/api/v1/public/venues/slug/bar', { headers: PUBLIC_HEADERS });
    expect(res.status).toBe(200);
    const text = await res.text();
    return { text, data: (JSON.parse(text) as { data: Record<string, unknown> }).data };
}

describe('GET /public/venues/slug/:slug — WhatsApp (HOS-2256)', () => {
    it('AC-17 publishes the number in the whatsapp block when the owner chose PUBLIC', async () => {
        const { data } = await getBody('PUBLIC');

        expect(data.whatsapp).toEqual({ mode: 'PUBLIC', number: SECRET_NUMBER });
    });

    it('AC-18 never puts the number anywhere in the response for LOGGED_IN_ONLY', async () => {
        const { text, data } = await getBody('LOGGED_IN_ONLY');

        expect(data.whatsapp).toEqual({ mode: 'LOGGED_IN_ONLY' });
        expect(text).not.toContain('7654321');
    });

    it('publishes nothing while the owner has not decided, even with a stored number', async () => {
        const { text, data } = await getBody(null);

        expect(data).not.toHaveProperty('whatsapp');
        expect(text).not.toContain('7654321');
    });

    it('AC-20 keeps whatsapp out of contactInfo in every mode', async () => {
        for (const mode of ['PUBLIC', 'LOGGED_IN_ONLY', null]) {
            const { data } = await getBody(mode);
            expect(data.contactInfo).not.toHaveProperty('whatsapp');
            expect(data.contactInfo).toMatchObject({ mobilePhone: '+54 9 343 1111111' });
        }
    });
});
