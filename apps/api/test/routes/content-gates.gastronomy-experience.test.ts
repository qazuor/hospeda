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
import { protectedAddExperienceFaqRoute } from '../../src/routes/experience/protected/addFaq';
import { protectedAddExperienceFeaturedMediaRoute } from '../../src/routes/experience/protected/addFeaturedMedia';
import { protectedAddExperienceMediaRoute } from '../../src/routes/experience/protected/addMedia';
import { protectedGetExperienceBrochureRoute } from '../../src/routes/experience/protected/brochure';
import {
    protectedGetExperienceCertificatePdfRoute,
    protectedIssueExperienceCertificateRoute,
    protectedListExperienceCertificatesRoute
} from '../../src/routes/experience/protected/certificates';
import { protectedPatchExperienceRoute } from '../../src/routes/experience/protected/patch';
import { protectedRemoveExperienceFaqRoute } from '../../src/routes/experience/protected/removeFaq';
import { protectedRemoveExperienceMediaRoute } from '../../src/routes/experience/protected/removeMedia';
import { protectedReorderExperienceFaqsRoute } from '../../src/routes/experience/protected/reorderFaqs';
import { protectedReorderExperienceMediaRoute } from '../../src/routes/experience/protected/reorderMedia';
import { protectedSetFeaturedExperienceMediaRoute } from '../../src/routes/experience/protected/setFeaturedMedia';
import { protectedUpdateExperienceFaqRoute } from '../../src/routes/experience/protected/updateFaq';
import { protectedUpdateExperienceMediaRoute } from '../../src/routes/experience/protected/updateMedia';
import { protectedAddGastronomyFaqRoute } from '../../src/routes/gastronomy/protected/addFaq';
import { protectedAddGastronomyFeaturedMediaRoute } from '../../src/routes/gastronomy/protected/addFeaturedMedia';
import { protectedAddGastronomyMediaRoute } from '../../src/routes/gastronomy/protected/addMedia';
import { protectedGetGastronomyBrochureRoute } from '../../src/routes/gastronomy/protected/brochure';
import { protectedDeleteGastronomyMenuFileRoute } from '../../src/routes/gastronomy/protected/deleteMenuFile';
import { protectedPatchGastronomyRoute } from '../../src/routes/gastronomy/protected/patch';
import { protectedPutGastronomyDailySpecialsRoute } from '../../src/routes/gastronomy/protected/putDailySpecials';
import { protectedPutGastronomyEventsRoute } from '../../src/routes/gastronomy/protected/putEvents';
import { protectedPutGastronomyMenuRoute } from '../../src/routes/gastronomy/protected/putMenu';
import { protectedRemoveGastronomyFaqRoute } from '../../src/routes/gastronomy/protected/removeFaq';
import { protectedRemoveGastronomyMediaRoute } from '../../src/routes/gastronomy/protected/removeMedia';
import { protectedReorderGastronomyFaqsRoute } from '../../src/routes/gastronomy/protected/reorderFaqs';
import { protectedReorderGastronomyMediaRoute } from '../../src/routes/gastronomy/protected/reorderMedia';
import { protectedSetFeaturedGastronomyMediaRoute } from '../../src/routes/gastronomy/protected/setFeaturedMedia';
import { protectedUpdateGastronomyFaqRoute } from '../../src/routes/gastronomy/protected/updateFaq';
import { protectedUpdateGastronomyMediaRoute } from '../../src/routes/gastronomy/protected/updateMedia';
import { protectedUploadGastronomyMenuFileRoute } from '../../src/routes/gastronomy/protected/uploadMenuFile';
import { protectedUploadGastronomyMenuItemPhotoRoute } from '../../src/routes/gastronomy/protected/uploadMenuItemPhoto';
import type { AppBindings } from '../../src/types';

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    service: vi.fn()
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    GastronomyService: class {
        getById = mocks.service;
        updateOwn = mocks.service;
        addMedia = mocks.service;
        addFeaturedMedia = mocks.service;
    },
    ExperienceService: class {
        getById = mocks.service;
        updateOwn = mocks.service;
        addMedia = mocks.service;
        addFeaturedMedia = mocks.service;
    },
    addGastronomyFaq: mocks.service,
    removeGastronomyFaq: mocks.service,
    updateGastronomyFaq: mocks.service,
    reorderGastronomyFaqs: mocks.service,
    addExperienceFaq: mocks.service,
    removeExperienceFaq: mocks.service,
    updateExperienceFaq: mocks.service,
    reorderExperienceFaqs: mocks.service,
    replaceGastronomyMenu: mocks.service,
    replaceGastronomyDailySpecials: mocks.service,
    replaceGastronomyEvents: mocks.service,
    issueExperienceCertificate: mocks.service,
    listExperienceCertificates: mocks.service,
    getExperienceCertificate: mocks.service
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
const FAQ = '44444444-4444-4444-8444-444444444444';
const MEDIA = '55555555-5555-4555-8555-555555555555';
const CERTIFICATE = '66666666-6666-4666-8666-666666666666';
const faqCreate = { question: 'When does it start?', answer: 'At twelve noon.' };
const faqUpdate = { answer: 'At one in afternoon.' };
const faqReorder = { order: [{ faqId: FAQ, displayOrder: 0 }] };
const mediaAdd = { url: 'https://example.com/photo.jpg' };
const mediaUpdate = { caption: 'Updated photo' };
const mediaReorder = { orderedIds: [MEDIA] };
const patchBody = { name: 'Updated listing' };
const menuPlain = { sections: [] };
const specials = { specials: [] };
const events = { events: [] };
const certificate = { recipientName: 'Jane Guest', completedAt: '2026-10-10' };
const baseSource = {
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'basic' },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2025-01-01'),
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
};

// These verticals have no content quota in this sheet; the photo quota belongs only to accommodation.
const cases = [
    {
        file: 'gastronomy/addFaq',
        route: protectedAddGastronomyFaqRoute,
        method: 'POST',
        path: '/{id}/faqs',
        body: faqCreate,
        key: 'edit_gastronomy_info',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/removeFaq',
        route: protectedRemoveGastronomyFaqRoute,
        method: 'DELETE',
        path: '/{id}/faqs/{faqId}',
        body: undefined,
        key: 'edit_gastronomy_info',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/updateFaq',
        route: protectedUpdateGastronomyFaqRoute,
        method: 'PUT',
        path: '/{id}/faqs/{faqId}',
        body: faqUpdate,
        key: 'edit_gastronomy_info',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/reorderFaqs',
        route: protectedReorderGastronomyFaqsRoute,
        method: 'PUT',
        path: '/{id}/faqs/reorder',
        body: faqReorder,
        key: 'edit_gastronomy_info',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/addMedia',
        route: protectedAddGastronomyMediaRoute,
        method: 'POST',
        path: '/{id}/media',
        body: mediaAdd,
        key: 'edit_gastronomy_info',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/addFeaturedMedia',
        route: protectedAddGastronomyFeaturedMediaRoute,
        method: 'POST',
        path: '/{id}/media/featured',
        body: mediaAdd,
        key: 'edit_gastronomy_info',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/removeMedia',
        route: protectedRemoveGastronomyMediaRoute,
        method: 'DELETE',
        path: '/{id}/media/{mediaId}',
        body: undefined,
        key: 'edit_gastronomy_info',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/reorderMedia',
        route: protectedReorderGastronomyMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/reorder',
        body: mediaReorder,
        key: 'edit_gastronomy_info',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/setFeaturedMedia',
        route: protectedSetFeaturedGastronomyMediaRoute,
        method: 'PUT',
        path: '/{id}/media/{mediaId}/featured',
        body: undefined,
        key: 'edit_gastronomy_info',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/updateMedia',
        route: protectedUpdateGastronomyMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/{mediaId}',
        body: mediaUpdate,
        key: 'edit_gastronomy_info',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/patch',
        route: protectedPatchGastronomyRoute,
        method: 'PATCH',
        path: '/{id}',
        body: patchBody,
        key: 'edit_gastronomy_info',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/uploadMenuFile',
        route: protectedUploadGastronomyMenuFileRoute,
        method: 'POST',
        path: '/{id}/menu-file',
        body: undefined,
        key: 'manage_gastronomy_menu',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/deleteMenuFile',
        route: protectedDeleteGastronomyMenuFileRoute,
        method: 'DELETE',
        path: '/{id}/menu-file',
        body: undefined,
        key: 'manage_gastronomy_menu',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/putMenu',
        route: protectedPutGastronomyMenuRoute,
        method: 'PUT',
        path: '/{id}/menu',
        body: menuPlain,
        key: 'manage_gastronomy_menu',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/uploadMenuItemPhoto',
        route: protectedUploadGastronomyMenuItemPhotoRoute,
        method: 'POST',
        path: '/{id}/menu-item-photo',
        body: undefined,
        key: 'menu_item_photos',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/putDailySpecials',
        route: protectedPutGastronomyDailySpecialsRoute,
        method: 'PUT',
        path: '/{id}/daily-specials',
        body: specials,
        key: 'manage_gastronomy_daily_special',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/putEvents',
        route: protectedPutGastronomyEventsRoute,
        method: 'PUT',
        path: '/{id}/events',
        body: events,
        key: 'manage_gastronomy_events',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/brochure',
        route: protectedGetGastronomyBrochureRoute,
        method: 'GET',
        path: '/{id}/brochure',
        body: undefined,
        key: 'download_listing_pdf',
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'experience/addFaq',
        route: protectedAddExperienceFaqRoute,
        method: 'POST',
        path: '/{id}/faqs',
        body: faqCreate,
        key: 'edit_experience_info',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/removeFaq',
        route: protectedRemoveExperienceFaqRoute,
        method: 'DELETE',
        path: '/{id}/faqs/{faqId}',
        body: undefined,
        key: 'edit_experience_info',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/updateFaq',
        route: protectedUpdateExperienceFaqRoute,
        method: 'PUT',
        path: '/{id}/faqs/{faqId}',
        body: faqUpdate,
        key: 'edit_experience_info',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/reorderFaqs',
        route: protectedReorderExperienceFaqsRoute,
        method: 'PUT',
        path: '/{id}/faqs/reorder',
        body: faqReorder,
        key: 'edit_experience_info',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/addMedia',
        route: protectedAddExperienceMediaRoute,
        method: 'POST',
        path: '/{id}/media',
        body: mediaAdd,
        key: 'edit_experience_info',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/addFeaturedMedia',
        route: protectedAddExperienceFeaturedMediaRoute,
        method: 'POST',
        path: '/{id}/media/featured',
        body: mediaAdd,
        key: 'edit_experience_info',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/removeMedia',
        route: protectedRemoveExperienceMediaRoute,
        method: 'DELETE',
        path: '/{id}/media/{mediaId}',
        body: undefined,
        key: 'edit_experience_info',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/reorderMedia',
        route: protectedReorderExperienceMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/reorder',
        body: mediaReorder,
        key: 'edit_experience_info',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/setFeaturedMedia',
        route: protectedSetFeaturedExperienceMediaRoute,
        method: 'PUT',
        path: '/{id}/media/{mediaId}/featured',
        body: undefined,
        key: 'edit_experience_info',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/updateMedia',
        route: protectedUpdateExperienceMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/{mediaId}',
        body: mediaUpdate,
        key: 'edit_experience_info',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/patch',
        route: protectedPatchExperienceRoute,
        method: 'PATCH',
        path: '/{id}',
        body: patchBody,
        key: 'edit_experience_info',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/certificates post issue',
        route: protectedIssueExperienceCertificateRoute,
        method: 'POST',
        path: '/{id}/certificates',
        body: certificate,
        key: 'issue_experience_certificate',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/certificates get list',
        route: protectedListExperienceCertificatesRoute,
        method: 'GET',
        path: '/{id}/certificates',
        body: undefined,
        key: 'issue_experience_certificate',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/certificates get pdf',
        route: protectedGetExperienceCertificatePdfRoute,
        method: 'GET',
        path: '/{id}/certificates/{certificateId}/pdf',
        body: undefined,
        key: 'issue_experience_certificate',
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/brochure',
        route: protectedGetExperienceBrochureRoute,
        method: 'GET',
        path: '/{id}/brochure',
        body: undefined,
        key: 'download_listing_pdf',
        vertical: VerticalEnum.EXPERIENCE
    }
] as const;
type Case = (typeof cases)[number];
function configureSet(owner: string, keys: readonly string[]): void {
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                entries: keys.map((key) => ({ key, value: 1, strategy: 'MAX' as const }))
            })
    );
    mocks.coverage.mockResolvedValue({
        covered: false,
        sources: [
            {
                ...baseSource,
                reference: {
                    kind: 'PLAN_VERSION',
                    planVersionId: owner === OWNER_A ? 'basic' : 'premium'
                }
            }
        ]
    });
    mocks.loadFacts.mockResolvedValue({
        facts: { ownerId: owner, publicationStatus: PublicationStatusEnum.PUBLISHED },
        ownerId: owner
    });
}
function makeApp(
    row: Case,
    actorId: string,
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
    actor = OWNER_A,
    id = LISTING,
    body: unknown = row.body,
    permissions?: PermissionEnum[]
) {
    const url = `/case${row.path.replaceAll('{id}', id).replaceAll('{faqId}', FAQ).replaceAll('{mediaId}', MEDIA).replaceAll('{certificateId}', CERTIFICATE)}`;
    return makeApp(row, actor, permissions).request(url, {
        method: row.method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}
beforeEach(() => {
    vi.clearAllMocks();
    mocks.coverage.mockResolvedValue({ covered: false, sources: [baseSource] });
    mocks.service.mockResolvedValue({ data: {} });
});

describe('TEST:V5:31 gastronomy and experience content gates', () => {
    it.each(cases)('$file requires its effective key on the published listing', async (row) => {
        configureSet(
            OWNER_A,
            row.key.startsWith('edit_') ? [] : [`edit_${row.vertical.toLowerCase()}_info`]
        );
        const denied = await request(row);
        expect(denied.status, row.file).toBe(403);
        expect((await denied.json()).error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: row.key }
        });
        expect(mocks.service).not.toHaveBeenCalled();
        mocks.effectiveSet.mockClear();
        const full = [
            'edit_gastronomy_info',
            'edit_experience_info',
            'manage_gastronomy_menu',
            'manage_gastronomy_daily_special',
            'manage_gastronomy_events',
            'menu_item_photos',
            'multilingual_gastronomy_menu',
            'manage_experience_directions',
            'issue_experience_certificate',
            'download_listing_pdf'
        ];
        configureSet(OWNER_B, full);
        const allowed = await request(row, OWNER_B);
        const allowedBody = await allowed
            .clone()
            .json()
            .catch(() => ({}));
        expect(allowedBody.error?.code).not.toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
        expect(mocks.effectiveSet).toHaveBeenCalledWith({
            userId: OWNER_B,
            vertical: row.vertical
        });
    });
    it.each(cases)('$file preserves guest, shape and foreign-owner priority', async (row) => {
        configureSet(OWNER_A, []);
        expect((await request(row, '00000000-0000-4000-8000-000000000000')).status).toBe(401);
        expect((await request(row, OWNER_A, 'bad-id')).status).toBe(400);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
        mocks.loadFacts.mockResolvedValue({
            facts: { ownerId: OWNER_B, publicationStatus: PublicationStatusEnum.PUBLISHED },
            ownerId: OWNER_B
        });
        expect(
            (
                await request(
                    row,
                    OWNER_A,
                    LISTING,
                    row.body,
                    Object.values(PermissionEnum).filter(
                        (permission) => permission !== PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT
                    )
                )
            ).status
        ).toBe(404);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
    });
    it('requires dish-photo and translation keys only when the validated menu carries them', async () => {
        const row = cases.find((item) => item.file === 'gastronomy/putMenu');
        if (!row) throw new Error('Menu route missing');
        configureSet(OWNER_A, ['edit_gastronomy_info', 'manage_gastronomy_menu']);
        const photo = {
            sections: [
                {
                    name: 'Mains',
                    items: [{ name: 'Soup', photoUrl: 'https://example.com/soup.jpg' }]
                }
            ]
        };
        const translated = {
            sections: [
                { name: 'Mains', nameI18n: { es: 'Platos', en: 'Mains', pt: 'Pratos' }, items: [] }
            ]
        };
        expect((await (await request(row, OWNER_A, LISTING, photo)).json()).error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'menu_item_photos' }
        });
        expect(
            (await (await request(row, OWNER_A, LISTING, translated)).json()).error
        ).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'multilingual_gastronomy_menu' }
        });
        const plain = await request(row);
        expect((await plain.json()).error?.code).not.toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
    });
    it('requires directions only when the patch includes meetingPointDirections', async () => {
        const row = cases.find((item) => item.file === 'experience/patch');
        if (!row) throw new Error('Experience patch route missing');
        configureSet(OWNER_A, ['edit_experience_info']);
        expect(
            (
                await (
                    await request(row, OWNER_A, LISTING, { meetingPointDirections: ['Go north'] })
                ).json()
            ).error
        ).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'manage_experience_directions' }
        });
        const plain = await request(row);
        expect((await plain.json()).error?.code).not.toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
    });
});
