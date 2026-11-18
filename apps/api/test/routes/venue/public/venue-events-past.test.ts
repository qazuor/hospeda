/**
 * @file venue-events-past.test.ts
 * @description HOS-2254: the public `getBySlug` response must not carry a
 * one-off event that already ended (venue zone, `America/Argentina/Buenos_Aires`),
 * must keep `weekly` events, and must drop the whole `venueEvents` key when
 * nothing is left.
 *
 * Reads the HTTP response, not the projector's return value, same as
 * `night-info.test.ts`.
 */
import type { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const OWNER_ID = 'eeeeeeee-0000-4000-8000-000000002254';
const VENUE_ID = 'aaaaaaaa-0000-4000-8000-000000002254';
const DESTINATION_ID = 'dddddddd-0000-4000-8000-000000002254';

/** 2026-11-17 (Tuesday) 12:00 in AR (UTC-3). */
const NOON = new Date('2026-11-17T15:00:00Z');

function makeVenue(): Record<string, unknown> {
    return {
        id: VENUE_ID,
        ownerId: OWNER_ID,
        slug: 'boliche',
        name: 'Test venue',
        type: 'BOLICHE',
        businessLines: ['nightlife'],
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
        updatedById: null
    };
}

let eventSeq = 0;
/** A stored agenda entry as `getVenueEvents` returns it. */
function event(over: Record<string, unknown>): Record<string, unknown> {
    eventSeq += 1;
    return {
        id: `bbbbbbbb-0000-4000-8000-${String(eventSeq).padStart(12, '0')}`,
        venueId: VENUE_ID,
        title: `Evento ${eventSeq}`,
        description: null,
        recurrence: 'once',
        date: '2026-11-17',
        weekday: null,
        startTime: '21:00',
        endTime: '23:00',
        isActive: true,
        displayOrder: eventSeq,
        createdAt: new Date('2026-10-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z'),
        ...over
    };
}

let app: AppOpenAPI;

async function getTitles(): Promise<string[] | undefined> {
    const res = await app.request('/api/v1/public/venues/slug/boliche', {
        headers: PUBLIC_HEADERS
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
        data: { venueEvents?: Array<{ title: string }> };
    };
    return body.data.venueEvents?.map((e) => e.title);
}

function serve(list: Array<Record<string, unknown>>): void {
    events.mockResolvedValue({ data: { events: list }, error: null });
}

beforeEach(async () => {
    vi.clearAllMocks();
    eventSeq = 0;
    menu.mockResolvedValue({ data: { sections: [] }, error: null });
    specials.mockResolvedValue({ data: { specials: [] }, error: null });
    effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical: vertical as VerticalEnum,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [{ key: 'manage_venue_events', value: 1, strategy: 'MAX' }]
            })
    );
    venueSvc.getBySlug.mockResolvedValue({ data: makeVenue() });
    validateApiEnv();
    app = await initApp();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOON);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('GET /public/venues/slug/:slug: past one-off events (HOS-2254)', () => {
    it('TEST:AC-1 hides a one-off event that ended yesterday and keeps a future one', async () => {
        serve([
            event({ title: 'Ayer', date: '2026-11-16' }),
            event({ title: 'Manana', date: '2026-11-18' })
        ]);

        expect(await getTitles()).toEqual(['Manana']);
    });

    it('TEST:AC-2 keeps a midnight-crossing event until its end (01:00 next day) and drops it after (02:01)', async () => {
        serve([event({ title: 'Cena show', startTime: '22:00', endTime: '02:00' })]);

        vi.setSystemTime(new Date('2026-11-18T04:00:00Z')); // 01:00 AR
        expect(await getTitles()).toEqual(['Cena show']);

        vi.setSystemTime(new Date('2026-11-18T05:01:00Z')); // 02:01 AR
        expect(await getTitles()).toBeUndefined();
    });

    it('TEST:AC-3 keeps an event without end time until 06:00 of the next day', async () => {
        serve([event({ title: 'Fiesta', startTime: '23:00', endTime: null })]);

        vi.setSystemTime(new Date('2026-11-18T02:30:00Z')); // 23:30 AR, same day
        expect(await getTitles()).toEqual(['Fiesta']);

        vi.setSystemTime(new Date('2026-11-18T09:01:00Z')); // 06:01 AR next day
        expect(await getTitles()).toBeUndefined();
    });

    it('TEST:AC-4 never hides a weekly event by date', async () => {
        serve([
            event({ title: 'Jueves', recurrence: 'weekly', date: null, weekday: 4, endTime: null })
        ]);

        expect(await getTitles()).toEqual(['Jueves']);
    });

    it('TEST:AC-5 drops venueEvents altogether when every event is past', async () => {
        serve([event({ title: 'Viejo', date: '2026-09-01' })]);

        expect(await getTitles()).toBeUndefined();
    });

    it('TEST:AC-6 uses the AR zone, not UTC: 21:30 AR (00:30 UTC next day) still shows a 22:00 event', async () => {
        serve([event({ title: 'Hoy 22', startTime: '22:00', endTime: '23:30' })]);
        vi.setSystemTime(new Date('2026-11-18T00:30:00Z'));

        expect(await getTitles()).toEqual(['Hoy 22']);
    });

    it('still drops a switched-off future event', async () => {
        serve([event({ title: 'Apagado', date: '2026-11-20', isActive: false })]);

        expect(await getTitles()).toBeUndefined();
    });
});
