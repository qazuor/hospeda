import { PermissionEnum, PublicationStatusEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ADMIN = '22222222-2222-4222-8222-222222222222';
const VENUE = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => ({
    getMenu: vi.fn(),
    getDaily: vi.fn(),
    getEvents: vi.fn(),
    putMenu: vi.fn(),
    updateVenue: vi.fn(),
    putDaily: vi.fn(),
    putEvents: vi.fn()
}));
let actorId = OWNER;
let actorPermissions: PermissionEnum[] = [];
let ownerId = OWNER;
let businessLines: ('food' | 'nightlife')[] = ['food'];
let entitlementKeys = [
    'edit_venue_info',
    'manage_venue_menu',
    'manage_venue_daily_special',
    'manage_venue_events'
];
vi.mock('@repo/service-core', async (original) => ({
    ...(await original<typeof import('@repo/service-core')>()),
    VenueService: class {
        model = { update: mocks.updateVenue };
        getById = async () => ({ data: { ownerId: OWNER, menuFilePublicId: null } });
    },
    getVenueMenu: mocks.getMenu,
    replaceVenueMenu: mocks.putMenu,
    getVenueDailySpecials: mocks.getDaily,
    getVenueEvents: mocks.getEvents,
    replaceVenueDailySpecials: mocks.putDaily,
    replaceVenueEvents: mocks.putEvents
}));
vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () => ({
            facts: { ownerId, publicationStatus: PublicationStatusEnum.PUBLISHED, businessLines },
            ownerId
        }),
        billing: { coverage: async () => ({ covered: false, sources: [{ type: 'BASE' }] }) },
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: entitlementKeys.map((key) => ({ key, value: 1, strategy: 'MAX' }))
            })
    })
}));
const { protectedGetVenueMenuRoute } = await import(
    '../../../../src/routes/venue/protected/getMenu.js'
);
const { protectedPutVenueMenuRoute } = await import(
    '../../../../src/routes/venue/protected/putMenu.js'
);
const { protectedDeleteVenueMenuFileRoute } = await import(
    '../../../../src/routes/venue/protected/deleteMenuFile.js'
);
const { protectedGetVenueDailySpecialsRoute } = await import(
    '../../../../src/routes/venue/protected/getDailySpecials.js'
);
const { protectedGetVenueEventsRoute } = await import(
    '../../../../src/routes/venue/protected/getEvents.js'
);
const { protectedPutVenueDailySpecialsRoute } = await import(
    '../../../../src/routes/venue/protected/putDailySpecials.js'
);
const { protectedPutVenueEventsRoute } = await import(
    '../../../../src/routes/venue/protected/putEvents.js'
);
const { createErrorHandler } = await import('../../../../src/middlewares/response.js');
const payloads = {
    daily: {
        specials: [{ title: 'Menú del día', validFrom: '2026-10-10', validUntil: '2026-10-10' }]
    },
    events: {
        events: [
            { title: 'Música en vivo', recurrence: 'once', date: '2026-10-10', startTime: '20:00' }
        ]
    }
};
function app() {
    const result = new Hono<AppBindings>();
    result.onError(createErrorHandler());
    result.use((c, next) => {
        c.set('actor', { id: actorId, roles: [], permissions: actorPermissions } as never);
        return next();
    });
    result.route('/', protectedGetVenueMenuRoute);
    result.route('/', protectedPutVenueMenuRoute);
    result.route('/', protectedDeleteVenueMenuFileRoute);
    result.route('/', protectedGetVenueDailySpecialsRoute);
    result.route('/', protectedGetVenueEventsRoute);
    result.route('/', protectedPutVenueDailySpecialsRoute);
    result.route('/', protectedPutVenueEventsRoute);
    return result;
}
const json = { headers: { 'content-type': 'application/json' } };
beforeEach(() => {
    vi.clearAllMocks();
    actorId = OWNER;
    ownerId = OWNER;
    actorPermissions = [];
    businessLines = ['food'];
    entitlementKeys = [
        'edit_venue_info',
        'manage_venue_menu',
        'manage_venue_daily_special',
        'manage_venue_events'
    ];
    mocks.getMenu.mockResolvedValue({ data: { sections: [], file: null, externalUrl: null } });
    mocks.putMenu.mockResolvedValue({ data: { sections: [], file: null, externalUrl: null } });
    mocks.getDaily.mockResolvedValue({ data: { specials: [] } });
    mocks.getEvents.mockResolvedValue({ data: { events: [] } });
    mocks.putDaily.mockResolvedValue({ data: { specials: [] } });
    mocks.putEvents.mockResolvedValue({ data: { events: [] } });
});

describe('TEST:3.4:1 AC:3:2 section chain through HTTP routes', () => {
    it('write to an absent dailySpecials section returns 409 SECTION_ABSENT', async () => {
        const path = 'daily-specials';
        const body = payloads.daily;
        businessLines = ['nightlife'];
        const response = await app().request(`/${VENUE}/${path}`, {
            method: 'PUT',
            ...json,
            body: JSON.stringify(body)
        });
        expect(response.status).toBe(409);
        expect((await response.json()).error.details.reason).toBe('SECTION_ABSENT');
    });
    it.each([
        ['daily-specials', payloads.daily, 'manage_venue_daily_special'],
        ['events', payloads.events, 'manage_venue_events']
    ])('requires the declared key for nonempty %s writes and succeeds with it', async (path, body, key) => {
        entitlementKeys = ['edit_venue_info'];
        const denied = await app().request(`/${VENUE}/${path}`, {
            method: 'PUT',
            ...json,
            body: JSON.stringify(body)
        });
        expect(denied.status).toBe(403);
        expect((await denied.json()).error.details.entitlementKey).toBe(key);
        entitlementKeys = ['edit_venue_info', key];
        expect(
            (
                await app().request(`/${VENUE}/${path}`, {
                    method: 'PUT',
                    ...json,
                    body: JSON.stringify(body)
                })
            ).status
        ).toBe(200);
    });
    it.each([
        ['daily-specials', payloads.daily],
        ['events', payloads.events]
    ])('hides a foreign write target at %s', async (path, body) => {
        actorId = ADMIN;
        const response = await app().request(`/${VENUE}/${path}`, {
            method: 'PUT',
            ...json,
            body: JSON.stringify(body)
        });
        expect(response.status).toBe(404);
    });
    it.each([
        '/menu',
        '/daily-specials',
        '/events'
    ])('hides foreign listing from an unauthorized actor at %s', async (path) => {
        actorId = ADMIN;
        ownerId = OWNER;
        expect((await app().request(`/${VENUE}${path}`)).status).toBe(404);
    });
    it.each([
        '/menu',
        '/daily-specials',
        '/events'
    ])('owner can read absent section at %s', async (path) => {
        businessLines = ['nightlife'];
        expect((await app().request(`/${VENUE}${path}`)).status).toBe(200);
    });
});

describe('TEST:3.4:2 action 15 staff read regression', () => {
    it.each([
        '/menu',
        '/daily-specials',
        '/events'
    ])('seed ADMIN permission reads a foreign listing at %s', async (path) => {
        actorId = ADMIN;
        ownerId = OWNER;
        actorPermissions = [
            PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
            PermissionEnum.VENUE_VIEW_ALL
        ];
        expect((await app().request(`/${VENUE}${path}`)).status).toBe(200);
    });
});

describe('TEST:3.7:1 AC:3:12 absent menu owner content over HTTP routes', () => {
    it('lets the owner read and clear saved content, rejects new content, and hides all routes from a third party', async () => {
        businessLines = ['nightlife'];
        const savedMenu = {
            sections: [
                {
                    id: '44444444-4444-4444-8444-444444444444',
                    venueId: VENUE,
                    name: 'Carta guardada',
                    description: null,
                    displayOrder: 0,
                    items: [],
                    createdAt: '2026-10-01T00:00:00.000Z',
                    updatedAt: '2026-10-01T00:00:00.000Z'
                }
            ],
            file: { url: 'https://cdn.example/menu.pdf', kind: 'pdf' },
            externalUrl: null
        };
        mocks.getMenu.mockResolvedValue({ data: savedMenu });

        const read = await app().request(`/${VENUE}/menu`);
        expect(read.status).toBe(200);
        expect((await read.json()).data).toEqual(savedMenu);

        const cleared = await app().request(`/${VENUE}/menu`, {
            method: 'PUT',
            ...json,
            body: JSON.stringify({ sections: [] })
        });
        expect(cleared.status).toBe(200);
        actorPermissions = [PermissionEnum.VENUE_EDIT_OWN];
        const fileCleared = await app().request(`/${VENUE}/menu-file`, { method: 'DELETE' });
        expect(fileCleared.status).toBe(200);
        actorPermissions = [];

        const deniedWrite = await app().request(`/${VENUE}/menu`, {
            method: 'PUT',
            ...json,
            body: JSON.stringify({
                sections: [{ id: 'main', name: 'Carta', items: [{ name: 'Pizza', price: 2000 }] }]
            })
        });
        expect(deniedWrite.status).toBe(409);
        expect((await deniedWrite.json()).error.details).toMatchObject({
            reason: 'SECTION_ABSENT',
            section: 'menu'
        });

        actorId = ADMIN;
        for (const response of [
            await app().request(`/${VENUE}/menu`),
            await app().request(`/${VENUE}/menu`, {
                method: 'PUT',
                ...json,
                body: JSON.stringify({ sections: [] })
            }),
            await app().request(`/${VENUE}/menu-file`, { method: 'DELETE' })
        ])
            expect(response.status).toBe(404);
    });
});

describe('TEST:3.7:2 AC:3:16 action 15 absent menu access over HTTP routes', () => {
    it('lets support read but not clear the absent section, while the owner can clear it', async () => {
        businessLines = ['nightlife'];
        actorId = ADMIN;
        actorPermissions = [
            PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
            PermissionEnum.VENUE_VIEW_ALL
        ];

        const read = await app().request(`/${VENUE}/menu`);
        expect(read.status).toBe(200);

        const supportClear = await app().request(`/${VENUE}/menu`, {
            method: 'PUT',
            ...json,
            body: JSON.stringify({ sections: [] })
        });
        expect(supportClear.status).toBe(409);
        expect((await supportClear.json()).error.details).toMatchObject({
            reason: 'SECTION_ABSENT',
            section: 'menu'
        });

        actorId = OWNER;
        actorPermissions = [];
        const ownerClear = await app().request(`/${VENUE}/menu`, {
            method: 'PUT',
            ...json,
            body: JSON.stringify({ sections: [] })
        });
        expect(ownerClear.status).toBe(200);
    });
});
