import {
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminAddFeaturedMediaRoute } from '../../src/routes/accommodation/admin/addFeaturedMedia';
import { adminAddMediaRoute } from '../../src/routes/accommodation/admin/addMedia';
import { addFaqRoute } from '../../src/routes/accommodation/protected/addFaq';
import { protectedAddFeaturedMediaRoute } from '../../src/routes/accommodation/protected/addFeaturedMedia';
import { protectedAddMediaRoute } from '../../src/routes/accommodation/protected/addMedia';
import { protectedAddOccupancyRoute } from '../../src/routes/accommodation/protected/addOccupancy';
import { protectedBatchOccupancyRoute } from '../../src/routes/accommodation/protected/batchOccupancy';
import { protectedCalendarConnectGoogleRoute } from '../../src/routes/accommodation/protected/calendarConnectGoogle';
import { protectedCalendarConnectIcalRoute } from '../../src/routes/accommodation/protected/calendarConnectIcal';
import { protectedCalendarSyncRoute } from '../../src/routes/accommodation/protected/calendarSync';
import { protectedCreateAccommodationRoute } from '../../src/routes/accommodation/protected/create';
import { protectedCreateAccommodationDraftRoute } from '../../src/routes/accommodation/protected/createDraft';
import { protectedPatchAccommodationRoute } from '../../src/routes/accommodation/protected/patch';
import { removeFaqRoute } from '../../src/routes/accommodation/protected/removeFaq';
import { protectedRemoveMediaRoute } from '../../src/routes/accommodation/protected/removeMedia';
import { protectedRemoveOccupancyRoute } from '../../src/routes/accommodation/protected/removeOccupancy';
import { protectedReorderFaqsRoute } from '../../src/routes/accommodation/protected/reorderFaqs';
import { protectedReorderMediaRoute } from '../../src/routes/accommodation/protected/reorderMedia';
import { protectedSetFeaturedMediaRoute } from '../../src/routes/accommodation/protected/setFeaturedMedia';
import { protectedUpdateAccommodationRoute } from '../../src/routes/accommodation/protected/update';
import { updateFaqRoute } from '../../src/routes/accommodation/protected/updateFaq';
import { protectedUpdateMediaRoute } from '../../src/routes/accommodation/protected/updateMedia';
import { protectedUpdateOccupancyEventRoute } from '../../src/routes/accommodation/protected/updateOccupancyEvent';
import type { AppBindings } from '../../src/types';

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    gallery: vi.fn(),
    service: vi.fn()
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    AccommodationService: class {
        create = mocks.service;
        getById = mocks.service;
        addMedia = mocks.service;
        addFeaturedMedia = mocks.service;
    }
}));
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    accommodationMediaModel: { findByAccommodation: mocks.gallery }
}));
vi.mock('../../src/middlewares/ownership', () => ({
    ownershipMiddleware: () => async (_ctx: unknown, next: () => Promise<void>) => next()
}));
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: mocks.loadFacts,
        billing: { coverage: mocks.coverage },
        effectiveSet: mocks.effectiveSet
    })
}));
const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const LISTING = '33333333-3333-4333-8333-333333333333';
const DESTINATION = '44444444-4444-4444-8444-444444444444';
const FAQ = '55555555-5555-4555-8555-555555555555';
const MEDIA = '66666666-6666-4666-8666-666666666666';
const DAY = '2026-10-10';
const faqCreate = { question: 'What time is check in?', answer: 'After three in the afternoon.' };
const faqUpdate = { answer: 'After four in the afternoon.' };
const faqReorder = { order: [{ faqId: FAQ, displayOrder: 0 }] };
const mediaAdd = { url: 'https://example.com/photo.jpg' };
const mediaUpdate = { caption: 'Updated photo caption' };
const mediaReorder = { orderedIds: [MEDIA] };
const occupancy = { accommodationId: LISTING, date: DAY };
const batch = { accommodationId: LISTING, dates: [DAY], isBlocked: true };
const event = { oldStartDate: DAY, oldEndDate: DAY, newStartDate: DAY, newEndDate: DAY };
const ical = { provider: 'airbnb', feedUrl: 'https://example.com/feed.ics' };
const accommodationCreate = {
    name: 'A valid stay',
    type: 'HOTEL',
    address: 'Main 123',
    latitude: -34.6,
    longitude: -58.4,
    maxGuests: 2,
    bedrooms: 1,
    bathrooms: 1,
    basePrice: 1000,
    destinationId: DESTINATION,
    ownerId: OWNER_A
};
const baseSource = {
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'base' },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2025-01-01'),
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
};
const cases = [
    {
        file: 'protected/addFaq',
        route: addFaqRoute,
        method: 'POST',
        path: '/{id}/faqs',
        body: faqCreate,
        key: 'edit_accommodation_info',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/removeFaq',
        route: removeFaqRoute,
        method: 'DELETE',
        path: '/{id}/faqs/{faqId}',
        body: undefined,
        key: 'edit_accommodation_info',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/updateFaq',
        route: updateFaqRoute,
        method: 'PUT',
        path: '/{id}/faqs/{faqId}',
        body: faqUpdate,
        key: 'edit_accommodation_info',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/reorderFaqs',
        route: protectedReorderFaqsRoute,
        method: 'PUT',
        path: '/{id}/faqs/reorder',
        body: faqReorder,
        key: 'edit_accommodation_info',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/addMedia',
        route: protectedAddMediaRoute,
        method: 'POST',
        path: '/{id}/media',
        body: mediaAdd,
        key: 'edit_accommodation_info',
        photo: true,
        admin: false,
        required: false
    },
    {
        file: 'protected/addFeaturedMedia',
        route: protectedAddFeaturedMediaRoute,
        method: 'POST',
        path: '/{id}/media/featured',
        body: mediaAdd,
        key: 'edit_accommodation_info',
        photo: true,
        admin: false,
        required: false
    },
    {
        file: 'protected/removeMedia',
        route: protectedRemoveMediaRoute,
        method: 'DELETE',
        path: '/{id}/media/{mediaId}',
        body: undefined,
        key: 'edit_accommodation_info',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/reorderMedia',
        route: protectedReorderMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/reorder',
        body: mediaReorder,
        key: 'edit_accommodation_info',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/setFeaturedMedia',
        route: protectedSetFeaturedMediaRoute,
        method: 'PUT',
        path: '/{id}/media/{mediaId}/featured',
        body: undefined,
        key: 'edit_accommodation_info',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/updateMedia',
        route: protectedUpdateMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/{mediaId}',
        body: mediaUpdate,
        key: 'edit_accommodation_info',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/addOccupancy',
        route: protectedAddOccupancyRoute,
        method: 'POST',
        path: '/{id}/occupancy',
        body: occupancy,
        key: 'can_use_calendar',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/batchOccupancy',
        route: protectedBatchOccupancyRoute,
        method: 'PATCH',
        path: '/{id}/occupancy/batch',
        body: batch,
        key: 'can_use_calendar',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/removeOccupancy',
        route: protectedRemoveOccupancyRoute,
        method: 'DELETE',
        path: '/{id}/occupancy/{date}',
        body: undefined,
        key: 'can_use_calendar',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/updateOccupancyEvent',
        route: protectedUpdateOccupancyEventRoute,
        method: 'PATCH',
        path: '/{id}/occupancy/event',
        body: event,
        key: 'can_use_calendar',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/calendarConnectGoogle',
        route: protectedCalendarConnectGoogleRoute,
        method: 'POST',
        path: '/{id}/calendar-sync/connect-google',
        body: {},
        key: 'can_sync_external_calendar',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/calendarConnectIcal',
        route: protectedCalendarConnectIcalRoute,
        method: 'POST',
        path: '/{id}/calendar-sync/connect-ical',
        body: ical,
        key: 'can_sync_external_calendar',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/calendarSync',
        route: protectedCalendarSyncRoute,
        method: 'POST',
        path: '/{id}/calendar-sync/sync',
        body: {},
        key: 'can_sync_external_calendar',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/create',
        route: protectedCreateAccommodationRoute,
        method: 'POST',
        path: '/',
        body: accommodationCreate,
        key: 'none',
        photo: false,
        admin: false,
        required: true
    },
    {
        file: 'protected/createDraft',
        route: protectedCreateAccommodationDraftRoute,
        method: 'POST',
        path: '/draft',
        body: { name: 'Draft stay' },
        key: 'none',
        photo: false,
        admin: false,
        required: true
    },
    {
        file: 'protected/patch',
        route: protectedPatchAccommodationRoute,
        method: 'PATCH',
        path: '/{id}',
        body: { name: 'Updated listing' },
        key: 'edit_accommodation_info',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'protected/update',
        route: protectedUpdateAccommodationRoute,
        method: 'PUT',
        path: '/{id}',
        body: { name: 'Updated listing' },
        key: 'edit_accommodation_info',
        photo: false,
        admin: false,
        required: false
    },
    {
        file: 'admin/addMedia',
        route: adminAddMediaRoute,
        method: 'POST',
        path: '/{id}/media',
        body: mediaAdd,
        key: 'edit_accommodation_info',
        photo: true,
        admin: true,
        required: false
    },
    {
        file: 'admin/addFeaturedMedia',
        route: adminAddFeaturedMediaRoute,
        method: 'POST',
        path: '/{id}/media/featured',
        body: mediaAdd,
        key: 'edit_accommodation_info',
        photo: true,
        admin: true,
        required: false
    }
] as const;

type Case = (typeof cases)[number];
function configureSet(owner: string, keys: readonly string[], max: number | null): void {
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                entries: [
                    ...keys.map((key) => ({ key, value: 1, strategy: 'MAX' as const })),
                    ...(max === null
                        ? []
                        : [
                              {
                                  key: 'max_photos_per_accommodation',
                                  value: max,
                                  strategy: 'SUM' as const
                              }
                          ])
                ]
            })
    );
    mocks.loadFacts.mockResolvedValue({
        facts: { ownerId: owner, publicationStatus: PublicationStatusEnum.PUBLISHED },
        ownerId: owner
    });
}
function makeApp(
    row: Case,
    actorId: string = OWNER_A,
    permissions: PermissionEnum[] = Object.values(PermissionEnum)
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use((ctx, next) => {
        ctx.set('actor', {
            id: actorId,
            roles: [RoleEnum.ADMIN],
            permissions,
            emailVerified: true
        });
        return next();
    });
    app.route('/case', row.route);
    return app;
}
async function request(
    row: Case,
    owner: string = OWNER_A,
    id: string = LISTING,
    actor: string = owner,
    permissions?: PermissionEnum[]
) {
    const app = makeApp(row, actor, permissions);
    const url =
        row.path === '/'
            ? '/case'
            : `/case${row.path.replaceAll('{id}', id).replaceAll('{date}', DAY).replaceAll('{provider}', 'airbnb').replaceAll('{faqId}', FAQ).replaceAll('{mediaId}', MEDIA)}`;
    return app.request(url, {
        method: row.method,
        headers: { 'content-type': 'application/json' },
        body: row.body === undefined ? undefined : JSON.stringify(row.body)
    });
}
beforeEach(() => {
    vi.clearAllMocks();
    mocks.coverage.mockResolvedValue({ covered: false, sources: [baseSource] });
    mocks.gallery.mockResolvedValue({ total: 0 });
    mocks.service.mockResolvedValue({ data: {} });
});

describe('TEST:V5:31 accommodation content gates', () => {
    it('keeps route capability and photo limit active on a draft', async () => {
        const calendar = cases.find((row) => row.file === 'protected/addOccupancy');
        const media = cases.find((row) => row.file === 'protected/addMedia');
        if (!calendar || !media) throw new Error('Required route cases are missing');
        configureSet(OWNER_A, [], null);
        mocks.loadFacts.mockResolvedValue({
            facts: { ownerId: OWNER_A, publicationStatus: PublicationStatusEnum.DRAFT },
            ownerId: OWNER_A
        });
        const calendarDenied = await request(calendar);
        expect((await calendarDenied.json()).error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'can_use_calendar' }
        });
        const mediaDenied = await request(media);
        expect((await mediaDenied.json()).error).toMatchObject({
            code: ServiceErrorCode.LIMIT_REACHED,
            details: { limitKey: 'max_photos_per_accommodation', maxAllowed: 0 }
        });
    });

    it.each(cases)('$file requires its effective key on a published listing', async (row) => {
        if (row.key === 'none') {
            configureSet(OWNER_A, [], null);
            const response = await request(row);
            const payload = await response.json();
            expect(payload.error?.code).not.toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
            expect(payload.error?.code).not.toBe(ServiceErrorCode.LIMIT_REACHED);
            return;
        }
        configureSet(
            OWNER_A,
            row.key === 'edit_accommodation_info' ? [] : ['edit_accommodation_info'],
            15
        );
        const denied = await request(row);
        const deniedBody = await denied.json();
        expect(denied.status, row.file).toBe(403);
        expect(deniedBody.error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: row.key }
        });
        expect(mocks.service).not.toHaveBeenCalled();
        mocks.effectiveSet.mockClear();
        const owner = OWNER_B;
        configureSet(
            owner,
            [
                'edit_accommodation_info',
                'can_use_calendar',
                'can_sync_external_calendar',
                'can_use_rich_description'
            ],
            30
        );
        const allowed = await request(row, owner, LISTING, owner);
        const allowedBody = await allowed.json();
        expect(allowedBody.error?.code).not.toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
        expect(allowedBody.error?.code).not.toBe(ServiceErrorCode.LIMIT_REACHED);
        expect(mocks.effectiveSet).toHaveBeenCalledWith({
            userId: owner,
            vertical: VerticalEnum.ACCOMMODATION
        });
    });
    it.each(
        cases.filter((row) => row.photo)
    )('$file enforces a full and missing photo limit', async (row) => {
        configureSet(OWNER_A, ['edit_accommodation_info'], 15);
        mocks.gallery.mockResolvedValue({ total: row.file.endsWith('addFeaturedMedia') ? 0 : 15 });
        if (!row.file.endsWith('addFeaturedMedia')) {
            const full = await request(row);
            expect(full.status).toBe(403);
            expect((await full.json()).error).toMatchObject({
                code: ServiceErrorCode.LIMIT_REACHED,
                details: { limitKey: 'max_photos_per_accommodation' }
            });
            expect(mocks.service).not.toHaveBeenCalled();
        }
        mocks.gallery.mockResolvedValue({ total: 0 });
        configureSet(OWNER_A, ['edit_accommodation_info'], null);
        const missing = await request(row);
        expect(missing.status).toBe(403);
        expect((await missing.json()).error).toMatchObject({
            code: ServiceErrorCode.LIMIT_REACHED,
            details: { limitKey: 'max_photos_per_accommodation', maxAllowed: 0 }
        });
    });
    it.each(
        cases.filter((row) => row.key !== 'none')
    )('$file preserves earlier auth, shape and ownership failures', async (row) => {
        configureSet(OWNER_A, [], 0);
        const guest = await request(row, OWNER_A, LISTING, '00000000-0000-4000-8000-000000000000');
        expect(guest.status).toBe(401);
        if (row.required) {
            const forbidden = await request(row, OWNER_A, LISTING, OWNER_A, []);
            expect(forbidden.status).toBe(403);
            expect((await forbidden.json()).error.code).toBe(ServiceErrorCode.FORBIDDEN);
        }
        const invalid = await request(row, OWNER_A, 'bad-id');
        expect(invalid.status).toBe(400);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
        mocks.loadFacts.mockResolvedValue({
            facts: { ownerId: OWNER_B, publicationStatus: PublicationStatusEnum.PUBLISHED },
            ownerId: OWNER_B
        });
        const foreign = await request(
            row,
            OWNER_B,
            LISTING,
            OWNER_A,
            Object.values(PermissionEnum).filter(
                (permission) => permission !== PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT
            )
        );
        expect(foreign.status, await foreign.text()).toBe(row.admin ? 403 : 404);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
    });
});
