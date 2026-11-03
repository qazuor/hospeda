import { PermissionEnum, PublicationStatusEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

const mocks = vi.hoisted(() => ({
    getById: vi.fn(),
    replaceVenueMenu: vi.fn(),
    update: vi.fn()
}));
let entitlementKeys = ['edit_venue_info'];
let businessLines: ('food' | 'nightlife')[] = ['food'];

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        VenueService: Object.assign(
            vi.fn().mockImplementation(function () {
                return { getById: mocks.getById, model: { update: mocks.update } };
            }),
            { ENTITY_NAME: 'venue' }
        ),
        replaceVenueMenu: mocks.replaceVenueMenu
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () => ({
            facts: {
                ownerId: OWNER_ID,
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                businessLines
            },
            ownerId: OWNER_ID
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

vi.mock('../../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedPutVenueMenuRoute } = await import(
    '../../../../src/routes/venue/protected/putMenu.js'
);
const { protectedDeleteVenueMenuFileRoute } = await import(
    '../../../../src/routes/venue/protected/deleteMenuFile.js'
);
const { createErrorHandler } = await import('../../../../src/middlewares/response.js');
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const VENUE_ID = '22222222-2222-4222-8222-222222222222';

function buildApp() {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((context, next) => {
        context.set('actor', {
            id: OWNER_ID,
            roles: [],
            permissions: [PermissionEnum.VENUE_EDIT_OWN]
        } as never);
        return next();
    });
    app.route('/', protectedPutVenueMenuRoute);
    app.route('/', protectedDeleteVenueMenuFileRoute);
    return app;
}

beforeEach(() => {
    vi.clearAllMocks();
    entitlementKeys = ['edit_venue_info'];
    businessLines = ['food'];
    mocks.getById.mockResolvedValue({
        data: { id: VENUE_ID, ownerId: OWNER_ID, menuFilePublicId: null }
    });
    mocks.replaceVenueMenu.mockResolvedValue({
        data: { sections: [], file: null, externalUrl: null }
    });
    mocks.update.mockResolvedValue(undefined);
});

describe('TEST:3.3:1 locked menu delete and replacement', () => {
    it('allows file delete and an empty replacement without the section key', async () => {
        const app = buildApp();
        const deleted = await app.request(`/${VENUE_ID}/menu-file`, { method: 'DELETE' });
        const emptied = await app.request(`/${VENUE_ID}/menu`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sections: [] })
        });

        expect(deleted.status).toBe(200);
        expect(emptied.status).toBe(200);
        expect(mocks.replaceVenueMenu).toHaveBeenCalledTimes(1);
    });

    it('rejects non-empty content with manage_venue_menu', async () => {
        const response = await buildApp().request(`/${VENUE_ID}/menu`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                sections: [{ name: 'Entradas', items: [{ name: 'Empanada' }] }]
            })
        });
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toMatchObject({
            code: 'ENTITLEMENT_REQUIRED',
            details: { entitlementKey: 'manage_venue_menu' }
        });
        expect(mocks.replaceVenueMenu).not.toHaveBeenCalled();
    });
});

describe('TEST:3.3:3 menu trait gates', () => {
    it('requires photo and translation trait entitlements from the submitted body', async () => {
        entitlementKeys = ['edit_venue_info', 'manage_venue_menu'];
        const app = buildApp();
        const photo = await app.request(`/${VENUE_ID}/menu`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                sections: [
                    {
                        name: 'Entradas',
                        items: [
                            {
                                name: 'Empanada',
                                photoUrl: 'https://res.cloudinary.com/demo/image/upload/menu.jpg'
                            }
                        ]
                    }
                ]
            })
        });
        const photoBody = await photo.json();
        expect(photo.status).toBe(403);
        expect(photoBody.error.details.entitlementKey).toBe('menu_item_photos');

        const translated = await app.request(`/${VENUE_ID}/menu`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                sections: [
                    {
                        name: 'Entradas',
                        items: [
                            {
                                name: 'Empanada',
                                nameI18n: { es: 'Empanada', en: 'Pie', pt: 'Pastel' }
                            }
                        ]
                    }
                ]
            })
        });
        const translatedBody = await translated.json();
        expect(translated.status).toBe(403);
        expect(translatedBody.error.details.entitlementKey).toBe('multilingual_venue_menu');
    });

    it('returns SECTION_ABSENT for a nightlife venue writing menu content', async () => {
        businessLines = ['nightlife'];
        const app = buildApp();
        const response = await app.request(`/${VENUE_ID}/menu`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                sections: [{ name: 'Entradas', items: [{ name: 'Empanada' }] }]
            })
        });
        const body = await response.json();
        expect(response.status).toBe(409);
        expect(body.error).toMatchObject({
            code: 'ALREADY_EXISTS',
            details: { reason: 'SECTION_ABSENT' }
        });
    });
});
