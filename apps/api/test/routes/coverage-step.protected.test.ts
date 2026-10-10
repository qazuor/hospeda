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
import { protectedAddOccupancyRoute } from '../../src/routes/accommodation/protected/addOccupancy';
import { protectedBatchOccupancyRoute } from '../../src/routes/accommodation/protected/batchOccupancy';
import { protectedCalendarConnectGoogleRoute } from '../../src/routes/accommodation/protected/calendarConnectGoogle';
import { protectedCalendarConnectIcalRoute } from '../../src/routes/accommodation/protected/calendarConnectIcal';
import { protectedCalendarDisconnectRoute } from '../../src/routes/accommodation/protected/calendarDisconnect';
import { protectedCalendarSyncRoute } from '../../src/routes/accommodation/protected/calendarSync';
import { protectedCreateAccommodationRoute } from '../../src/routes/accommodation/protected/create';
import { protectedPatchAccommodationRoute } from '../../src/routes/accommodation/protected/patch';
import { protectedRemoveOccupancyRoute } from '../../src/routes/accommodation/protected/removeOccupancy';
import { protectedSoftDeleteAccommodationRoute } from '../../src/routes/accommodation/protected/softDelete';
import { protectedUnpublishAccommodationRoute } from '../../src/routes/accommodation/protected/unpublish';
import { protectedUpdateOccupancyEventRoute } from '../../src/routes/accommodation/protected/updateOccupancyEvent';
import { protectedIssueExperienceCertificateRoute } from '../../src/routes/experience/protected/certificates';
import { protectedCreateExperienceListingRoute } from '../../src/routes/experience/protected/create';
import { protectedDeleteExperienceDraftRoute } from '../../src/routes/experience/protected/deleteDraft';
import { protectedPatchExperienceRoute } from '../../src/routes/experience/protected/patch';
import { protectedCreateGastronomyListingRoute } from '../../src/routes/gastronomy/protected/create';
import { protectedDeleteGastronomyDraftRoute } from '../../src/routes/gastronomy/protected/deleteDraft';
import { protectedDeleteGastronomyMenuFileRoute } from '../../src/routes/gastronomy/protected/deleteMenuFile';
import { protectedPatchGastronomyRoute } from '../../src/routes/gastronomy/protected/patch';
import { protectedUploadGastronomyMenuFileRoute } from '../../src/routes/gastronomy/protected/uploadMenuFile';
import { protectedUploadGastronomyMenuItemPhotoRoute } from '../../src/routes/gastronomy/protected/uploadMenuItemPhoto';
import type { AppBindings } from '../../src/types';

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    createAccommodation: vi.fn(),
    deleteAccommodation: vi.fn(),
    createGastronomy: vi.fn(),
    deleteGastronomy: vi.fn(),
    createExperience: vi.fn(),
    deleteExperience: vi.fn()
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    AccommodationService: class {
        create = mocks.createAccommodation;
        softDelete = mocks.deleteAccommodation;
    },
    GastronomyService: class {
        createForOwner = mocks.createGastronomy;
        softDeleteOwnDraft = mocks.deleteGastronomy;
    },
    ExperienceService: class {
        createForOwner = mocks.createExperience;
        softDeleteOwnDraft = mocks.deleteExperience;
    }
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

const OWNER = '11111111-1111-4111-8111-111111111111';
const LISTING = '33333333-3333-4333-8333-333333333333';
const DESTINATION = '44444444-4444-4444-8444-444444444444';
const DAY = '2026-10-10';
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
const occupancy = { accommodationId: LISTING, date: DAY };
const batch = { accommodationId: LISTING, dates: [DAY], isBlocked: true };
const event = { oldStartDate: DAY, oldEndDate: DAY, newStartDate: DAY, newEndDate: DAY };
const ical = { provider: 'airbnb', feedUrl: 'https://example.com/feed.ics' };
const certificate = { recipientName: 'A Guest', completedAt: DAY };
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
    ownerId: OWNER
};
const gastronomyCreate = {
    name: 'A valid restaurant',
    summary: 'A good place to eat in town',
    description: 'A welcoming restaurant with local food and careful service.',
    type: 'PARRILLA',
    destinationId: DESTINATION
};
const experienceCreate = {
    name: 'A valid tour',
    summary: 'A guided tour of the city',
    description: 'A guided tour with local history, places and helpful context.',
    type: 'CULTURAL_TOUR',
    priceFrom: 1000,
    priceUnit: 'per_person',
    isPriceOnRequest: false,
    destinationId: DESTINATION
};

const cases = [
    {
        file: 'accommodation/protected/addOccupancy.ts',
        route: protectedAddOccupancyRoute,
        method: 'POST',
        path: '/{id}/occupancy',
        body: occupancy,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/batchOccupancy.ts',
        route: protectedBatchOccupancyRoute,
        method: 'PATCH',
        path: '/{id}/occupancy/batch',
        body: batch,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/calendarConnectGoogle.ts',
        route: protectedCalendarConnectGoogleRoute,
        method: 'POST',
        path: '/{id}/calendar-sync/connect-google',
        body: {},
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/calendarConnectIcal.ts',
        route: protectedCalendarConnectIcalRoute,
        method: 'POST',
        path: '/{id}/calendar-sync/connect-ical',
        body: ical,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/calendarDisconnect.ts',
        route: protectedCalendarDisconnectRoute,
        method: 'DELETE',
        path: '/{id}/calendar-sync/{provider}',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/calendarSync.ts',
        route: protectedCalendarSyncRoute,
        method: 'POST',
        path: '/{id}/calendar-sync/sync',
        body: {},
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/create.ts',
        route: protectedCreateAccommodationRoute,
        method: 'POST',
        path: '/',
        body: accommodationCreate,
        operation: 'CREATE',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/patch.ts',
        route: protectedPatchAccommodationRoute,
        method: 'PATCH',
        path: '/{id}',
        body: { name: 'Updated listing' },
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/removeOccupancy.ts',
        route: protectedRemoveOccupancyRoute,
        method: 'DELETE',
        path: '/{id}/occupancy/{date}',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/softDelete.ts',
        route: protectedSoftDeleteAccommodationRoute,
        method: 'DELETE',
        path: '/{id}',
        body: undefined,
        operation: 'DELETE',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/unpublish.ts',
        route: protectedUnpublishAccommodationRoute,
        method: 'POST',
        path: '/{id}/unpublish',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/updateOccupancyEvent.ts',
        route: protectedUpdateOccupancyEventRoute,
        method: 'PATCH',
        path: '/{id}/occupancy/event',
        body: event,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'experience/protected/certificates.ts',
        route: protectedIssueExperienceCertificateRoute,
        method: 'POST',
        path: '/{id}/certificates',
        body: certificate,
        operation: 'EDIT',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/protected/create.ts',
        route: protectedCreateExperienceListingRoute,
        method: 'POST',
        path: '/',
        body: experienceCreate,
        operation: 'CREATE',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/protected/deleteDraft.ts',
        route: protectedDeleteExperienceDraftRoute,
        method: 'DELETE',
        path: '/{id}',
        body: undefined,
        operation: 'DELETE',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/protected/patch.ts',
        route: protectedPatchExperienceRoute,
        method: 'PATCH',
        path: '/{id}',
        body: { name: 'Updated listing' },
        operation: 'EDIT',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'gastronomy/protected/create.ts',
        route: protectedCreateGastronomyListingRoute,
        method: 'POST',
        path: '/',
        body: gastronomyCreate,
        operation: 'CREATE',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/deleteDraft.ts',
        route: protectedDeleteGastronomyDraftRoute,
        method: 'DELETE',
        path: '/{id}',
        body: undefined,
        operation: 'DELETE',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/deleteMenuFile.ts',
        route: protectedDeleteGastronomyMenuFileRoute,
        method: 'DELETE',
        path: '/{id}/menu-file',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/patch.ts',
        route: protectedPatchGastronomyRoute,
        method: 'PATCH',
        path: '/{id}',
        body: { name: 'Updated listing' },
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/uploadMenuFile.ts',
        route: protectedUploadGastronomyMenuFileRoute,
        method: 'POST',
        path: '/{id}/menu-file',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/uploadMenuItemPhoto.ts',
        route: protectedUploadGastronomyMenuItemPhotoRoute,
        method: 'POST',
        path: '/{id}/menu-item-photo',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    }
] as const;

beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadFacts.mockResolvedValue({
        facts: { ownerId: OWNER, publicationStatus: PublicationStatusEnum.PUBLISHED },
        ownerId: OWNER
    });
    mocks.coverage.mockResolvedValue({ covered: false, sources: [baseSource] });
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                entries: [{ key: 'recover_own_listing', value: 1, strategy: 'MAX' }]
            })
    );
    for (const service of [
        mocks.createAccommodation,
        mocks.deleteAccommodation,
        mocks.createGastronomy,
        mocks.deleteGastronomy,
        mocks.createExperience,
        mocks.deleteExperience
    ]) {
        service.mockResolvedValue({ data: {} });
    }
});

describe('TEST:V5:10 protected listing write coverage step', () => {
    it.each(cases)('TEST:V5:10 $file', async ({
        file,
        route,
        method,
        path,
        body,
        operation,
        vertical
    }) => {
        const app = new Hono<AppBindings>();
        app.use((ctx, next) => {
            ctx.set('actor', {
                id: OWNER,
                roles: [RoleEnum.USER],
                permissions: Object.values(PermissionEnum),
                emailVerified: true
            });
            return next();
        });
        app.route('/case', route);
        const url =
            path === '/'
                ? '/case'
                : `/case${path.replaceAll('{id}', LISTING).replaceAll('{date}', DAY).replaceAll('{provider}', 'airbnb')}`;
        const response = await app.request(url, {
            method,
            headers: { 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        expect(
            mocks.coverage,
            `${file}: step 5 was not reached (HTTP ${response.status})`
        ).toHaveBeenCalledWith({ userId: OWNER, vertical });
        if (operation === 'EDIT') {
            const result = (await response.json()) as {
                error?: { code?: string; details?: { entitlementKey?: string } };
            };
            expect(response.status).toBe(403);
            expect(result.error).toMatchObject({
                code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                details: { entitlementKey: `edit_${vertical.toLowerCase()}_info` }
            });
            expect(
                [
                    mocks.createAccommodation,
                    mocks.deleteAccommodation,
                    mocks.createGastronomy,
                    mocks.deleteGastronomy,
                    mocks.createExperience,
                    mocks.deleteExperience
                ].every((service) => service.mock.calls.length === 0)
            ).toBe(true);
        } else {
            const service =
                operation === 'CREATE'
                    ? vertical === VerticalEnum.ACCOMMODATION
                        ? mocks.createAccommodation
                        : vertical === VerticalEnum.GASTRONOMY
                          ? mocks.createGastronomy
                          : mocks.createExperience
                    : vertical === VerticalEnum.ACCOMMODATION
                      ? mocks.deleteAccommodation
                      : vertical === VerticalEnum.GASTRONOMY
                        ? mocks.deleteGastronomy
                        : mocks.deleteExperience;
            expect(
                service,
                `${file}: service was not reached (HTTP ${response.status})`
            ).toHaveBeenCalledOnce();
        }
    });
});
