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
import { adminAddFaqRoute } from '../../src/routes/accommodation/admin/addFaq';
import { adminAddFeaturedMediaRoute } from '../../src/routes/accommodation/admin/addFeaturedMedia';
import { adminArchiveMediaRoute } from '../../src/routes/accommodation/admin/archiveMedia';
import { adminPatchAccommodationRoute } from '../../src/routes/accommodation/admin/patch';
import { adminRemoveFaqRoute } from '../../src/routes/accommodation/admin/removeFaq';
import { adminRemoveMediaRoute } from '../../src/routes/accommodation/admin/removeMedia';
import { adminReorderAccommodationFaqsRoute } from '../../src/routes/accommodation/admin/reorderFaqs';
import { adminReorderMediaRoute } from '../../src/routes/accommodation/admin/reorderMedia';
import { adminRestoreMediaRoute } from '../../src/routes/accommodation/admin/restoreMedia';
import { adminSetFeaturedMediaRoute } from '../../src/routes/accommodation/admin/setFeaturedMedia';
import { adminUpdateAccommodationRoute } from '../../src/routes/accommodation/admin/update';
import { adminUpdateFaqRoute } from '../../src/routes/accommodation/admin/updateFaq';
import { adminUpdateMediaRoute } from '../../src/routes/accommodation/admin/updateMedia';
import { adminAddExperienceFaqRoute } from '../../src/routes/experience/admin/addFaq';
import { adminAddExperienceFeaturedMediaRoute } from '../../src/routes/experience/admin/addFeaturedMedia';
import { adminAddExperienceMediaRoute } from '../../src/routes/experience/admin/addMedia';
import { adminPatchExperienceRoute } from '../../src/routes/experience/admin/patch';
import { adminRemoveExperienceFaqRoute } from '../../src/routes/experience/admin/removeFaq';
import { adminRemoveExperienceMediaRoute } from '../../src/routes/experience/admin/removeMedia';
import { adminReorderExperienceFaqsRoute } from '../../src/routes/experience/admin/reorderFaqs';
import { adminReorderExperienceMediaRoute } from '../../src/routes/experience/admin/reorderMedia';
import { adminSetFeaturedExperienceMediaRoute } from '../../src/routes/experience/admin/setFeaturedMedia';
import { adminUpdateExperienceRoute } from '../../src/routes/experience/admin/update';
import { adminUpdateExperienceFaqRoute } from '../../src/routes/experience/admin/updateFaq';
import { adminUpdateExperienceMediaRoute } from '../../src/routes/experience/admin/updateMedia';
import { adminAddGastronomyFaqRoute } from '../../src/routes/gastronomy/admin/addFaq';
import { adminAddGastronomyFeaturedMediaRoute } from '../../src/routes/gastronomy/admin/addFeaturedMedia';
import { adminAddGastronomyMediaRoute } from '../../src/routes/gastronomy/admin/addMedia';
import { adminPatchGastronomyRoute } from '../../src/routes/gastronomy/admin/patch';
import { adminRemoveGastronomyFaqRoute } from '../../src/routes/gastronomy/admin/removeFaq';
import { adminRemoveGastronomyMediaRoute } from '../../src/routes/gastronomy/admin/removeMedia';
import { adminReorderGastronomyFaqsRoute } from '../../src/routes/gastronomy/admin/reorderFaqs';
import { adminReorderGastronomyMediaRoute } from '../../src/routes/gastronomy/admin/reorderMedia';
import { adminSetFeaturedGastronomyMediaRoute } from '../../src/routes/gastronomy/admin/setFeaturedMedia';
import { adminUpdateGastronomyRoute } from '../../src/routes/gastronomy/admin/update';
import { adminUpdateGastronomyFaqRoute } from '../../src/routes/gastronomy/admin/updateFaq';
import { adminUpdateGastronomyMediaRoute } from '../../src/routes/gastronomy/admin/updateMedia';
import type { AppBindings } from '../../src/types';

const mocks = vi.hoisted(() => ({ loadFacts: vi.fn(), coverage: vi.fn(), effectiveSet: vi.fn() }));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>())
}));
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: mocks.loadFacts,
        billing: { coverage: mocks.coverage },
        effectiveSet: mocks.effectiveSet
    })
}));

const OWNER = '11111111-1111-4111-8111-111111111111';
const ADMIN = '22222222-2222-4222-8222-222222222222';
const LISTING = '33333333-3333-4333-8333-333333333333';
const FAQ = '55555555-5555-4555-8555-555555555555';
const MEDIA = '66666666-6666-4666-8666-666666666666';
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
const faqCreate = { question: 'What time is check in?', answer: 'After three in the afternoon.' };
const faqUpdate = { answer: 'After four in the afternoon.' };
const faqReorder = { order: [{ faqId: FAQ, displayOrder: 0 }] };
const mediaAdd = { url: 'https://example.com/photo.jpg' };
const mediaUpdate = { caption: 'Updated photo caption' };
const mediaReorder = { orderedIds: [MEDIA] };

const cases = [
    {
        file: 'accommodation/admin/addFaq.ts',
        route: adminAddFaqRoute,
        method: 'POST',
        path: '/{id}/faqs',
        body: faqCreate,
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/admin/addFeaturedMedia.ts',
        route: adminAddFeaturedMediaRoute,
        method: 'POST',
        path: '/{id}/media/featured',
        body: mediaAdd,
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/admin/archiveMedia.ts',
        route: adminArchiveMediaRoute,
        method: 'POST',
        path: '/{id}/media/{mediaId}/archive',
        body: undefined,
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/admin/patch.ts',
        route: adminPatchAccommodationRoute,
        method: 'PATCH',
        path: '/{id}',
        body: { name: 'Updated listing' },
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/admin/removeFaq.ts',
        route: adminRemoveFaqRoute,
        method: 'DELETE',
        path: '/{id}/faqs/{faqId}',
        body: undefined,
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/admin/removeMedia.ts',
        route: adminRemoveMediaRoute,
        method: 'DELETE',
        path: '/{id}/media/{mediaId}',
        body: undefined,
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/admin/reorderFaqs.ts',
        route: adminReorderAccommodationFaqsRoute,
        method: 'PATCH',
        path: '/{id}/faqs/reorder',
        body: faqReorder,
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/admin/reorderMedia.ts',
        route: adminReorderMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/reorder',
        body: mediaReorder,
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/admin/restoreMedia.ts',
        route: adminRestoreMediaRoute,
        method: 'POST',
        path: '/{id}/media/{mediaId}/restore',
        body: undefined,
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/admin/setFeaturedMedia.ts',
        route: adminSetFeaturedMediaRoute,
        method: 'PUT',
        path: '/{id}/media/{mediaId}/featured',
        body: undefined,
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/admin/update.ts',
        route: adminUpdateAccommodationRoute,
        method: 'PUT',
        path: '/{id}',
        body: { name: 'Updated listing' },
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/admin/updateFaq.ts',
        route: adminUpdateFaqRoute,
        method: 'PUT',
        path: '/{id}/faqs/{faqId}',
        body: faqUpdate,
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'accommodation/admin/updateMedia.ts',
        route: adminUpdateMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/{mediaId}',
        body: mediaUpdate,
        vertical: VerticalEnum.ACCOMMODATION
    },
    {
        file: 'experience/admin/addFaq.ts',
        route: adminAddExperienceFaqRoute,
        method: 'POST',
        path: '/{id}/faqs',
        body: faqCreate,
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/admin/addFeaturedMedia.ts',
        route: adminAddExperienceFeaturedMediaRoute,
        method: 'POST',
        path: '/{id}/media/featured',
        body: mediaAdd,
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/admin/addMedia.ts',
        route: adminAddExperienceMediaRoute,
        method: 'POST',
        path: '/{id}/media',
        body: mediaAdd,
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/admin/patch.ts',
        route: adminPatchExperienceRoute,
        method: 'PATCH',
        path: '/{id}',
        body: { name: 'Updated listing' },
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/admin/removeFaq.ts',
        route: adminRemoveExperienceFaqRoute,
        method: 'DELETE',
        path: '/{id}/faqs/{faqId}',
        body: undefined,
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/admin/removeMedia.ts',
        route: adminRemoveExperienceMediaRoute,
        method: 'DELETE',
        path: '/{id}/media/{mediaId}',
        body: undefined,
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/admin/reorderFaqs.ts',
        route: adminReorderExperienceFaqsRoute,
        method: 'PATCH',
        path: '/{id}/faqs/reorder',
        body: faqReorder,
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/admin/reorderMedia.ts',
        route: adminReorderExperienceMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/reorder',
        body: mediaReorder,
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/admin/setFeaturedMedia.ts',
        route: adminSetFeaturedExperienceMediaRoute,
        method: 'PUT',
        path: '/{id}/media/{mediaId}/featured',
        body: undefined,
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/admin/update.ts',
        route: adminUpdateExperienceRoute,
        method: 'PUT',
        path: '/{id}',
        body: { name: 'Updated listing' },
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/admin/updateFaq.ts',
        route: adminUpdateExperienceFaqRoute,
        method: 'PUT',
        path: '/{id}/faqs/{faqId}',
        body: faqUpdate,
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'experience/admin/updateMedia.ts',
        route: adminUpdateExperienceMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/{mediaId}',
        body: mediaUpdate,
        vertical: VerticalEnum.EXPERIENCE
    },
    {
        file: 'gastronomy/admin/addFaq.ts',
        route: adminAddGastronomyFaqRoute,
        method: 'POST',
        path: '/{id}/faqs',
        body: faqCreate,
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/admin/addFeaturedMedia.ts',
        route: adminAddGastronomyFeaturedMediaRoute,
        method: 'POST',
        path: '/{id}/media/featured',
        body: mediaAdd,
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/admin/addMedia.ts',
        route: adminAddGastronomyMediaRoute,
        method: 'POST',
        path: '/{id}/media',
        body: mediaAdd,
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/admin/patch.ts',
        route: adminPatchGastronomyRoute,
        method: 'PATCH',
        path: '/{id}',
        body: { name: 'Updated listing' },
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/admin/removeFaq.ts',
        route: adminRemoveGastronomyFaqRoute,
        method: 'DELETE',
        path: '/{id}/faqs/{faqId}',
        body: undefined,
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/admin/removeMedia.ts',
        route: adminRemoveGastronomyMediaRoute,
        method: 'DELETE',
        path: '/{id}/media/{mediaId}',
        body: undefined,
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/admin/reorderFaqs.ts',
        route: adminReorderGastronomyFaqsRoute,
        method: 'PATCH',
        path: '/{id}/faqs/reorder',
        body: faqReorder,
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/admin/reorderMedia.ts',
        route: adminReorderGastronomyMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/reorder',
        body: mediaReorder,
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/admin/setFeaturedMedia.ts',
        route: adminSetFeaturedGastronomyMediaRoute,
        method: 'PUT',
        path: '/{id}/media/{mediaId}/featured',
        body: undefined,
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/admin/update.ts',
        route: adminUpdateGastronomyRoute,
        method: 'PUT',
        path: '/{id}',
        body: { name: 'Updated listing' },
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/admin/updateFaq.ts',
        route: adminUpdateGastronomyFaqRoute,
        method: 'PUT',
        path: '/{id}/faqs/{faqId}',
        body: faqUpdate,
        vertical: VerticalEnum.GASTRONOMY
    },
    {
        file: 'gastronomy/admin/updateMedia.ts',
        route: adminUpdateGastronomyMediaRoute,
        method: 'PATCH',
        path: '/{id}/media/{mediaId}',
        body: mediaUpdate,
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
                entries: []
            })
    );
});

function requestRoute(args: {
    route: (typeof cases)[number]['route'];
    method: string;
    path: string;
    body: unknown;
    actorId: string;
    foreignEdit: boolean;
}) {
    const app = new Hono<AppBindings>();
    app.use((ctx, next) => {
        ctx.set('actor', {
            id: args.actorId,
            roles: [RoleEnum.ADMIN],
            permissions: Object.values(PermissionEnum).filter(
                (permission) =>
                    args.foreignEdit || permission !== PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT
            ),
            emailVerified: true
        });
        return next();
    });
    app.route('/case', args.route);
    return app.request(
        `/case${args.path.replaceAll('{id}', LISTING).replaceAll('{faqId}', FAQ).replaceAll('{mediaId}', MEDIA)}`,
        {
            method: args.method,
            headers: { 'content-type': 'application/json' },
            body: args.body === undefined ? undefined : JSON.stringify(args.body)
        }
    );
}

describe('AC:V5:9 TEST:V5:10 admin listing write coverage step', () => {
    it.each(cases)('TEST:V5:10 $file', async ({ file, route, method, path, body, vertical }) => {
        const owner = await requestRoute({
            route,
            method,
            path,
            body,
            actorId: OWNER,
            foreignEdit: true
        });
        expect(
            mocks.coverage,
            `${file}: owner did not reach step 5 (HTTP ${owner.status})`
        ).toHaveBeenCalledWith({ userId: OWNER, vertical });
        expect(owner.status).toBe(403);
        expect((await owner.json()).error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: `edit_${vertical.toLowerCase()}_info` }
        });
        if (vertical === VerticalEnum.ACCOMMODATION) {
            vi.clearAllMocks();
            const foreign = await requestRoute({
                route,
                method,
                path,
                body,
                actorId: ADMIN,
                foreignEdit: true
            });
            expect(foreign.status).toBe(403);
            expect((await foreign.json()).error).toMatchObject({
                code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                details: { entitlementKey: 'edit_accommodation_info' }
            });
            expect(mocks.coverage).toHaveBeenCalledWith({ userId: OWNER, vertical });
            expect(mocks.effectiveSet).toHaveBeenCalledWith(
                expect.objectContaining({ userId: OWNER, vertical })
            );
            vi.clearAllMocks();
            const forbidden = await requestRoute({
                route,
                method,
                path,
                body,
                actorId: ADMIN,
                foreignEdit: false
            });
            expect(forbidden.status).toBe(403);
            expect((await forbidden.json()).error).toMatchObject({
                code: ServiceErrorCode.FORBIDDEN
            });
            expect(mocks.coverage).not.toHaveBeenCalled();
        }
    });
});
