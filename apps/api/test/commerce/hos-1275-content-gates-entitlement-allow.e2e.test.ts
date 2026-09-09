/**
 * The eight gastronomy/experience content-editing routes — entitlement gate,
 * ALLOW side, end to end (HOS-1275).
 *
 * ---
 * WHAT THIS PROVES, AND WHAT IT DOES NOT
 *
 * Companion of `hos-1275-content-gates-entitlement-block.e2e.test.ts`; read
 * that file's header first. HOS-1275 mounts
 * `commerceVerticalEntitlementMiddleware(vertical)` +
 * `requireEntitlement(EDIT_<VERTICAL>_INFO)` on `addFaq` / `updateFaq` /
 * `reorderFaqs` / `addMedia` / `updateMedia` / `reorderMedia` /
 * `addFeaturedMedia` / `setFeaturedMedia`, for both gastronomy and experience
 * — mirroring the gate `gastronomy/protected/patch.ts` already carries under
 * HOS-1074.
 *
 * This half asserts a caller who holds the grant reaches the handler — which
 * is what fails if `commerceVerticalEntitlementMiddleware(vertical)` is
 * dropped from a route or mounted AFTER its gate (in either case the gate
 * reads the ACCOMMODATION set, which never carries a commerce key, and
 * refuses everyone).
 *
 * Deliberately NO `@repo/billing` mock and NO billing-customer simulation: an
 * ordinary owner request carries no billing-customer context, which is the
 * EXACT shape a never-subscribed, lapsed, or cancelled owner reaches these
 * routes with in production — `commerceVerticalEntitlementMiddleware`
 * resolves `billingCustomerId` from context, finds none, and falls to the
 * "no customerId" branch of `resolveCommerceVerticalGrants`, which is still
 * the vertical's FLOOR (`ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`). That floor
 * includes `EDIT_GASTRONOMY_INFO` / `EDIT_EXPERIENCE_INFO` UNCONDITIONALLY —
 * see the block-side file's header for why that is deliberate, owner-approved
 * platform behaviour and not a gap this PR introduces or can close.
 *
 * @module test/commerce/hos-1275-content-gates-entitlement-allow.e2e
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    addGastronomyFaq: vi.fn(),
    updateGastronomyFaq: vi.fn(),
    reorderGastronomyFaqs: vi.fn(),
    addGastronomyMedia: vi.fn(),
    updateGastronomyMedia: vi.fn(),
    reorderGastronomyMedia: vi.fn(),
    addGastronomyFeaturedMedia: vi.fn(),
    setFeaturedGastronomyMedia: vi.fn(),
    addExperienceFaq: vi.fn(),
    updateExperienceFaq: vi.fn(),
    reorderExperienceFaqs: vi.fn(),
    addExperienceMedia: vi.fn(),
    updateExperienceMedia: vi.fn(),
    reorderExperienceMedia: vi.fn(),
    addExperienceFeaturedMedia: vi.fn(),
    setFeaturedExperienceMedia: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        ...mocks
    };
});

const { initApp } = await import('../../src/app.js');
const { _resetCommerceBaseLimitCache } = await import(
    '../../src/middlewares/commerce-entitlement.js'
);
type AppOpenAPI = import('../../src/types.js').AppOpenAPI;

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const SECONDARY_ID = '33333333-3333-4333-8333-333333333333';

const ownerHeaders = {
    ...USER_AGENT,
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create', 'commerce.editOwn'])
};

const SUCCESS_RESULT = { data: {}, error: undefined } as never;

interface RouteCase {
    label: string;
    method: 'POST' | 'PUT' | 'PATCH';
    path: string;
    body?: Record<string, unknown>;
    mockKey: keyof typeof mocks;
}

const CASES: readonly RouteCase[] = [
    {
        label: 'gastronomy addFaq',
        method: 'POST',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/faqs`,
        body: { question: 'A valid FAQ question?', answer: 'A valid FAQ answer text.' },
        mockKey: 'addGastronomyFaq'
    },
    {
        label: 'gastronomy updateFaq',
        method: 'PUT',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/faqs/${SECONDARY_ID}`,
        body: { question: 'An updated FAQ question?' },
        mockKey: 'updateGastronomyFaq'
    },
    {
        label: 'gastronomy reorderFaqs',
        method: 'PUT',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/faqs/reorder`,
        body: { order: [{ faqId: SECONDARY_ID, displayOrder: 0 }] },
        mockKey: 'reorderGastronomyFaqs'
    },
    {
        label: 'gastronomy addMedia',
        method: 'POST',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/media`,
        body: { url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg' },
        mockKey: 'addGastronomyMedia'
    },
    {
        label: 'gastronomy updateMedia',
        method: 'PATCH',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/media/${SECONDARY_ID}`,
        body: { alt: 'A valid alt text' },
        mockKey: 'updateGastronomyMedia'
    },
    {
        label: 'gastronomy reorderMedia',
        method: 'PATCH',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/media/reorder`,
        body: { orderedIds: [SECONDARY_ID] },
        mockKey: 'reorderGastronomyMedia'
    },
    {
        label: 'gastronomy addFeaturedMedia',
        method: 'POST',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/media/featured`,
        body: { url: 'https://res.cloudinary.com/demo/image/upload/cover.jpg' },
        mockKey: 'addGastronomyFeaturedMedia'
    },
    {
        label: 'gastronomy setFeaturedMedia',
        method: 'PUT',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/media/${SECONDARY_ID}/featured`,
        mockKey: 'setFeaturedGastronomyMedia'
    },
    {
        label: 'experience addFaq',
        method: 'POST',
        path: `/api/v1/protected/experiences/${LISTING_ID}/faqs`,
        body: { question: 'A valid FAQ question?', answer: 'A valid FAQ answer text.' },
        mockKey: 'addExperienceFaq'
    },
    {
        label: 'experience updateFaq',
        method: 'PUT',
        path: `/api/v1/protected/experiences/${LISTING_ID}/faqs/${SECONDARY_ID}`,
        body: { question: 'An updated FAQ question?' },
        mockKey: 'updateExperienceFaq'
    },
    {
        label: 'experience reorderFaqs',
        method: 'PUT',
        path: `/api/v1/protected/experiences/${LISTING_ID}/faqs/reorder`,
        body: { order: [{ faqId: SECONDARY_ID, displayOrder: 0 }] },
        mockKey: 'reorderExperienceFaqs'
    },
    {
        label: 'experience addMedia',
        method: 'POST',
        path: `/api/v1/protected/experiences/${LISTING_ID}/media`,
        body: { url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg' },
        mockKey: 'addExperienceMedia'
    },
    {
        label: 'experience updateMedia',
        method: 'PATCH',
        path: `/api/v1/protected/experiences/${LISTING_ID}/media/${SECONDARY_ID}`,
        body: { alt: 'A valid alt text' },
        mockKey: 'updateExperienceMedia'
    },
    {
        label: 'experience reorderMedia',
        method: 'PATCH',
        path: `/api/v1/protected/experiences/${LISTING_ID}/media/reorder`,
        body: { orderedIds: [SECONDARY_ID] },
        mockKey: 'reorderExperienceMedia'
    },
    {
        label: 'experience addFeaturedMedia',
        method: 'POST',
        path: `/api/v1/protected/experiences/${LISTING_ID}/media/featured`,
        body: { url: 'https://res.cloudinary.com/demo/image/upload/cover.jpg' },
        mockKey: 'addExperienceFeaturedMedia'
    },
    {
        label: 'experience setFeaturedMedia',
        method: 'PUT',
        path: `/api/v1/protected/experiences/${LISTING_ID}/media/${SECONDARY_ID}/featured`,
        mockKey: 'setFeaturedExperienceMedia'
    }
] as const;

describe('commerce content-gates entitlement gate — allow side (HOS-1275, real floor)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        for (const fn of Object.values(mocks)) {
            fn.mockReset();
        }
        _resetCommerceBaseLimitCache();
    });

    for (const testCase of CASES) {
        it(`lets an owner with no billing-customer context reach the ${testCase.label} handler`, async () => {
            mocks[testCase.mockKey].mockResolvedValue(SUCCESS_RESULT);

            const res = await app.request(testCase.path, {
                method: testCase.method,
                headers: {
                    ...ownerHeaders,
                    ...(testCase.body ? { 'content-type': 'application/json' } : {})
                },
                body: testCase.body ? JSON.stringify(testCase.body) : undefined
            });
            const body = (await res.json().catch(() => ({}))) as {
                error?: { code?: string };
            };

            expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
            expect(res.status).not.toBe(403);
            expect(mocks[testCase.mockKey]).toHaveBeenCalledTimes(1);
        });
    }
});
