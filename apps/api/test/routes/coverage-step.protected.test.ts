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
import { addFaqRoute } from '../../src/routes/accommodation/protected/addFaq.ts';
import { protectedAddFeaturedMediaRoute } from '../../src/routes/accommodation/protected/addFeaturedMedia.ts';
import { protectedAddMediaRoute } from '../../src/routes/accommodation/protected/addMedia.ts';
import { protectedAddOccupancyRoute } from '../../src/routes/accommodation/protected/addOccupancy';
import { protectedBatchOccupancyRoute } from '../../src/routes/accommodation/protected/batchOccupancy';
import { protectedCalendarConnectGoogleRoute } from '../../src/routes/accommodation/protected/calendarConnectGoogle';
import { protectedCalendarConnectIcalRoute } from '../../src/routes/accommodation/protected/calendarConnectIcal';
import { protectedCalendarDisconnectRoute } from '../../src/routes/accommodation/protected/calendarDisconnect';
import { protectedCalendarSyncRoute } from '../../src/routes/accommodation/protected/calendarSync';
import { protectedCreateAccommodationRoute } from '../../src/routes/accommodation/protected/create';
import { protectedPatchAccommodationRoute } from '../../src/routes/accommodation/protected/patch';
import { removeFaqRoute } from '../../src/routes/accommodation/protected/removeFaq.ts';
import { protectedRemoveMediaRoute } from '../../src/routes/accommodation/protected/removeMedia.ts';
import { protectedRemoveOccupancyRoute } from '../../src/routes/accommodation/protected/removeOccupancy';
import { protectedReorderFaqsRoute } from '../../src/routes/accommodation/protected/reorderFaqs.ts';
import { protectedReorderMediaRoute } from '../../src/routes/accommodation/protected/reorderMedia.ts';
import { protectedSetFeaturedMediaRoute } from '../../src/routes/accommodation/protected/setFeaturedMedia.ts';
import { protectedSoftDeleteAccommodationRoute } from '../../src/routes/accommodation/protected/softDelete';
import { protectedUnpublishAccommodationRoute } from '../../src/routes/accommodation/protected/unpublish';
import { updateFaqRoute } from '../../src/routes/accommodation/protected/updateFaq.ts';
import { protectedUpdateMediaRoute } from '../../src/routes/accommodation/protected/updateMedia.ts';
import { protectedUpdateOccupancyEventRoute } from '../../src/routes/accommodation/protected/updateOccupancyEvent';
import { protectedAddExperienceFaqRoute } from '../../src/routes/experience/protected/addFaq.ts';
import { protectedAddExperienceFeaturedMediaRoute } from '../../src/routes/experience/protected/addFeaturedMedia.ts';
import { protectedAddExperienceMediaRoute } from '../../src/routes/experience/protected/addMedia.ts';
import { protectedIssueExperienceCertificateRoute } from '../../src/routes/experience/protected/certificates';
import { protectedCreateExperienceListingRoute } from '../../src/routes/experience/protected/create';
import { protectedDeleteExperienceDraftRoute } from '../../src/routes/experience/protected/deleteDraft';
import { protectedPatchExperienceRoute } from '../../src/routes/experience/protected/patch';
import { protectedRemoveExperienceFaqRoute } from '../../src/routes/experience/protected/removeFaq.ts';
import { protectedRemoveExperienceMediaRoute } from '../../src/routes/experience/protected/removeMedia.ts';
import { protectedReorderExperienceFaqsRoute } from '../../src/routes/experience/protected/reorderFaqs.ts';
import { protectedReorderExperienceMediaRoute } from '../../src/routes/experience/protected/reorderMedia.ts';
import { protectedSetFeaturedExperienceMediaRoute } from '../../src/routes/experience/protected/setFeaturedMedia.ts';
import { protectedUpdateExperienceFaqRoute } from '../../src/routes/experience/protected/updateFaq.ts';
import { protectedUpdateExperienceMediaRoute } from '../../src/routes/experience/protected/updateMedia.ts';
import { protectedAddGastronomyFaqRoute } from '../../src/routes/gastronomy/protected/addFaq.ts';
import { protectedAddGastronomyFeaturedMediaRoute } from '../../src/routes/gastronomy/protected/addFeaturedMedia.ts';
import { protectedAddGastronomyMediaRoute } from '../../src/routes/gastronomy/protected/addMedia.ts';
import { protectedCreateGastronomyListingRoute } from '../../src/routes/gastronomy/protected/create';
import { protectedDeleteGastronomyDraftRoute } from '../../src/routes/gastronomy/protected/deleteDraft';
import { protectedDeleteGastronomyMenuFileRoute } from '../../src/routes/gastronomy/protected/deleteMenuFile';
import { protectedPatchGastronomyRoute } from '../../src/routes/gastronomy/protected/patch';
import { protectedPutGastronomyDailySpecialsRoute } from '../../src/routes/gastronomy/protected/putDailySpecials.ts';
import { protectedPutGastronomyEventsRoute } from '../../src/routes/gastronomy/protected/putEvents.ts';
import { protectedPutGastronomyMenuRoute } from '../../src/routes/gastronomy/protected/putMenu.ts';
import { protectedRemoveGastronomyFaqRoute } from '../../src/routes/gastronomy/protected/removeFaq.ts';
import { protectedRemoveGastronomyMediaRoute } from '../../src/routes/gastronomy/protected/removeMedia.ts';
import { protectedReorderGastronomyFaqsRoute } from '../../src/routes/gastronomy/protected/reorderFaqs.ts';
import { protectedReorderGastronomyMediaRoute } from '../../src/routes/gastronomy/protected/reorderMedia.ts';
import { protectedSetFeaturedGastronomyMediaRoute } from '../../src/routes/gastronomy/protected/setFeaturedMedia.ts';
import { protectedUpdateGastronomyFaqRoute } from '../../src/routes/gastronomy/protected/updateFaq.ts';
import { protectedUpdateGastronomyMediaRoute } from '../../src/routes/gastronomy/protected/updateMedia.ts';
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

const FAQ = '55555555-5555-4555-8555-555555555555';
const MEDIA = '66666666-6666-4666-8666-666666666666';
const faqCreate = { question: 'What time is check in?', answer: 'After three in the afternoon.' };
const faqUpdate = { answer: 'After four in the afternoon.' };
const faqReorder = { order: [{ faqId: FAQ, displayOrder: 0 }] };
const mediaAdd = { url: 'https://example.com/photo.jpg' };
const mediaUpdate = { caption: 'Updated photo caption' };
const mediaReorder = { orderedIds: [MEDIA] };

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
    },
    {
        file: 'accommodation/protected/addFaq.ts',
        route: addFaqRoute,
        method: 'POST',
        path: '/{id}/faqs',
        body: faqCreate,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/addFeaturedMedia.ts',
        route: protectedAddFeaturedMediaRoute,
        method: 'POST',
        path: '/{id}/media/featured',
        body: mediaAdd,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/addMedia.ts',
        route: protectedAddMediaRoute,
        method: 'POST',
        path: '/{id}/media',
        body: mediaAdd,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/removeFaq.ts',
        route: removeFaqRoute,
        method: 'DELETE',
        path: '/{id}/faqs/{faqId}',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/removeMedia.ts',
        route: protectedRemoveMediaRoute,
        method: 'DELETE',
        path: '/{id}/media/{mediaId}',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/reorderFaqs.ts',
        route: protectedReorderFaqsRoute,
        method: 'PUT',
        path: '/{id}/faqs/reorder',
        body: faqReorder,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/reorderMedia.ts',
        route: protectedReorderMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/reorder',
        body: mediaReorder,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/setFeaturedMedia.ts',
        route: protectedSetFeaturedMediaRoute,
        method: 'PUT',
        path: '/{id}/media/{mediaId}/featured',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/updateFaq.ts',
        route: updateFaqRoute,
        method: 'PUT',
        path: '/{id}/faqs/{faqId}',
        body: faqUpdate,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/protected/updateMedia.ts',
        route: protectedUpdateMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/{mediaId}',
        body: mediaUpdate,
        operation: 'EDIT',
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'experience/protected/addFaq.ts',
        route: protectedAddExperienceFaqRoute,
        method: 'POST',
        path: '/{id}/faqs',
        body: faqCreate,
        operation: 'EDIT',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/protected/addFeaturedMedia.ts',
        route: protectedAddExperienceFeaturedMediaRoute,
        method: 'POST',
        path: '/{id}/media/featured',
        body: mediaAdd,
        operation: 'EDIT',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/protected/addMedia.ts',
        route: protectedAddExperienceMediaRoute,
        method: 'POST',
        path: '/{id}/media',
        body: mediaAdd,
        operation: 'EDIT',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/protected/removeFaq.ts',
        route: protectedRemoveExperienceFaqRoute,
        method: 'DELETE',
        path: '/{id}/faqs/{faqId}',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/protected/removeMedia.ts',
        route: protectedRemoveExperienceMediaRoute,
        method: 'DELETE',
        path: '/{id}/media/{mediaId}',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/protected/reorderFaqs.ts',
        route: protectedReorderExperienceFaqsRoute,
        method: 'PUT',
        path: '/{id}/faqs/reorder',
        body: faqReorder,
        operation: 'EDIT',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/protected/reorderMedia.ts',
        route: protectedReorderExperienceMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/reorder',
        body: mediaReorder,
        operation: 'EDIT',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/protected/setFeaturedMedia.ts',
        route: protectedSetFeaturedExperienceMediaRoute,
        method: 'PUT',
        path: '/{id}/media/{mediaId}/featured',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/protected/updateFaq.ts',
        route: protectedUpdateExperienceFaqRoute,
        method: 'PUT',
        path: '/{id}/faqs/{faqId}',
        body: faqUpdate,
        operation: 'EDIT',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/protected/updateMedia.ts',
        route: protectedUpdateExperienceMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/{mediaId}',
        body: mediaUpdate,
        operation: 'EDIT',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'gastronomy/protected/addFaq.ts',
        route: protectedAddGastronomyFaqRoute,
        method: 'POST',
        path: '/{id}/faqs',
        body: faqCreate,
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/addFeaturedMedia.ts',
        route: protectedAddGastronomyFeaturedMediaRoute,
        method: 'POST',
        path: '/{id}/media/featured',
        body: mediaAdd,
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/addMedia.ts',
        route: protectedAddGastronomyMediaRoute,
        method: 'POST',
        path: '/{id}/media',
        body: mediaAdd,
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/putDailySpecials.ts',
        route: protectedPutGastronomyDailySpecialsRoute,
        method: 'PUT',
        path: '/{id}/daily-specials',
        body: { specials: [] },
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/putEvents.ts',
        route: protectedPutGastronomyEventsRoute,
        method: 'PUT',
        path: '/{id}/events',
        body: { events: [] },
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/putMenu.ts',
        route: protectedPutGastronomyMenuRoute,
        method: 'PUT',
        path: '/{id}/menu',
        body: { sections: [] },
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/removeFaq.ts',
        route: protectedRemoveGastronomyFaqRoute,
        method: 'DELETE',
        path: '/{id}/faqs/{faqId}',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/removeMedia.ts',
        route: protectedRemoveGastronomyMediaRoute,
        method: 'DELETE',
        path: '/{id}/media/{mediaId}',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/reorderFaqs.ts',
        route: protectedReorderGastronomyFaqsRoute,
        method: 'PUT',
        path: '/{id}/faqs/reorder',
        body: faqReorder,
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/reorderMedia.ts',
        route: protectedReorderGastronomyMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/reorder',
        body: mediaReorder,
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/setFeaturedMedia.ts',
        route: protectedSetFeaturedGastronomyMediaRoute,
        method: 'PUT',
        path: '/{id}/media/{mediaId}/featured',
        body: undefined,
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/updateFaq.ts',
        route: protectedUpdateGastronomyFaqRoute,
        method: 'PUT',
        path: '/{id}/faqs/{faqId}',
        body: faqUpdate,
        operation: 'EDIT',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/protected/updateMedia.ts',
        route: protectedUpdateGastronomyMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/{mediaId}',
        body: mediaUpdate,
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
                : `/case${path.replaceAll('{id}', LISTING).replaceAll('{date}', DAY).replaceAll('{provider}', 'airbnb').replaceAll('{faqId}', FAQ).replaceAll('{mediaId}', MEDIA)}`;
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
