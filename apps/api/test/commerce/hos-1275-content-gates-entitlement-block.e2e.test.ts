/**
 * The eight gastronomy/experience content-editing routes — entitlement gate,
 * BLOCK side, end to end (HOS-1275).
 *
 * ---
 * WHY THIS MOCK, AND WHAT IT PROVES
 *
 * HOS-1275 mounts `commerceVerticalEntitlementMiddleware(vertical)` +
 * `requireEntitlement(EDIT_<VERTICAL>_INFO)` on `addFaq` / `updateFaq` /
 * `reorderFaqs` / `addMedia` / `updateMedia` / `reorderMedia` /
 * `addFeaturedMedia` / `setFeaturedMedia`, for both gastronomy and experience
 * — mirroring the gate `gastronomy/protected/patch.ts` already carries under
 * HOS-1074. Before this PR none of these 16 routes had ANY commerce
 * entitlement gate at all: a request reached the handler regardless of what
 * `userEntitlements` held.
 *
 * `EDIT_GASTRONOMY_INFO` / `EDIT_EXPERIENCE_INFO` are in
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — the FLOOR every commerce owner
 * gets regardless of subscription state, by deliberate owner decision
 * (2026-09-01, HOS-1074): no subscription, a lagging plan row, and a
 * lapsed/cancelled subscription all resolve to the SAME floor
 * (`commerce-entitlement.ts`'s "three ordinary states" note). So there is NO
 * REAL subscription state in which these keys refuse a commerce owner —
 * exactly the situation `view-basic-stats-entitlement-block.e2e.test.ts`
 * documents for the sibling `VIEW_BASIC_STATS` floor key. Proving the refusal
 * path still exists (rather than `requireEntitlement` having been silently
 * dropped from these routes, which would make the companion allow-side test
 * pass for the wrong reason) requires mocking the catalogue down to a set
 * that does NOT include the key — the same technique that file uses, applied
 * to all 16 routes this issue covers.
 *
 * ## The witness
 *
 * `expect(res.status).toBe(403)` is not enough on its own — a request that
 * dies anywhere before the gate can also fail to reach the handler. Each case
 * asserts BOTH that the refusal NAMES the right key (pinning the right key to
 * the right route) and that the route's own service call — strictly after the
 * gate — was never made.
 *
 * @module test/commerce/hos-1275-content-gates-entitlement-block.e2e
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

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        // What a caller's resolved floor looks like WITHOUT the EDIT_* key —
        // PUBLISH_* stays, so this narrows exactly one key per vertical (the
        // mirror image of the allow-side file, which uses the real,
        // unmocked floor).
        ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL: {
            gastronomy: [actual.EntitlementKey.PUBLISH_GASTRONOMY],
            experience: [actual.EntitlementKey.PUBLISH_EXPERIENCE]
        }
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
    vertical: 'gastronomy' | 'experience';
    method: 'POST' | 'PUT' | 'PATCH';
    path: string;
    body?: Record<string, unknown>;
    mockKey: keyof typeof mocks;
}

const CASES: readonly RouteCase[] = [
    {
        label: 'gastronomy addFaq',
        vertical: 'gastronomy',
        method: 'POST',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/faqs`,
        body: { question: 'A valid FAQ question?', answer: 'A valid FAQ answer text.' },
        mockKey: 'addGastronomyFaq'
    },
    {
        label: 'gastronomy updateFaq',
        vertical: 'gastronomy',
        method: 'PUT',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/faqs/${SECONDARY_ID}`,
        body: { question: 'An updated FAQ question?' },
        mockKey: 'updateGastronomyFaq'
    },
    {
        label: 'gastronomy reorderFaqs',
        vertical: 'gastronomy',
        method: 'PUT',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/faqs/reorder`,
        body: { order: [{ faqId: SECONDARY_ID, displayOrder: 0 }] },
        mockKey: 'reorderGastronomyFaqs'
    },
    {
        label: 'gastronomy addMedia',
        vertical: 'gastronomy',
        method: 'POST',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/media`,
        body: { url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg' },
        mockKey: 'addGastronomyMedia'
    },
    {
        label: 'gastronomy updateMedia',
        vertical: 'gastronomy',
        method: 'PATCH',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/media/${SECONDARY_ID}`,
        body: { alt: 'A valid alt text' },
        mockKey: 'updateGastronomyMedia'
    },
    {
        label: 'gastronomy reorderMedia',
        vertical: 'gastronomy',
        method: 'PATCH',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/media/reorder`,
        body: { orderedIds: [SECONDARY_ID] },
        mockKey: 'reorderGastronomyMedia'
    },
    {
        label: 'gastronomy addFeaturedMedia',
        vertical: 'gastronomy',
        method: 'POST',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/media/featured`,
        body: { url: 'https://res.cloudinary.com/demo/image/upload/cover.jpg' },
        mockKey: 'addGastronomyFeaturedMedia'
    },
    {
        label: 'gastronomy setFeaturedMedia',
        vertical: 'gastronomy',
        method: 'PUT',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/media/${SECONDARY_ID}/featured`,
        mockKey: 'setFeaturedGastronomyMedia'
    },
    {
        label: 'experience addFaq',
        vertical: 'experience',
        method: 'POST',
        path: `/api/v1/protected/experiences/${LISTING_ID}/faqs`,
        body: { question: 'A valid FAQ question?', answer: 'A valid FAQ answer text.' },
        mockKey: 'addExperienceFaq'
    },
    {
        label: 'experience updateFaq',
        vertical: 'experience',
        method: 'PUT',
        path: `/api/v1/protected/experiences/${LISTING_ID}/faqs/${SECONDARY_ID}`,
        body: { question: 'An updated FAQ question?' },
        mockKey: 'updateExperienceFaq'
    },
    {
        label: 'experience reorderFaqs',
        vertical: 'experience',
        method: 'PUT',
        path: `/api/v1/protected/experiences/${LISTING_ID}/faqs/reorder`,
        body: { order: [{ faqId: SECONDARY_ID, displayOrder: 0 }] },
        mockKey: 'reorderExperienceFaqs'
    },
    {
        label: 'experience addMedia',
        vertical: 'experience',
        method: 'POST',
        path: `/api/v1/protected/experiences/${LISTING_ID}/media`,
        body: { url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg' },
        mockKey: 'addExperienceMedia'
    },
    {
        label: 'experience updateMedia',
        vertical: 'experience',
        method: 'PATCH',
        path: `/api/v1/protected/experiences/${LISTING_ID}/media/${SECONDARY_ID}`,
        body: { alt: 'A valid alt text' },
        mockKey: 'updateExperienceMedia'
    },
    {
        label: 'experience reorderMedia',
        vertical: 'experience',
        method: 'PATCH',
        path: `/api/v1/protected/experiences/${LISTING_ID}/media/reorder`,
        body: { orderedIds: [SECONDARY_ID] },
        mockKey: 'reorderExperienceMedia'
    },
    {
        label: 'experience addFeaturedMedia',
        vertical: 'experience',
        method: 'POST',
        path: `/api/v1/protected/experiences/${LISTING_ID}/media/featured`,
        body: { url: 'https://res.cloudinary.com/demo/image/upload/cover.jpg' },
        mockKey: 'addExperienceFeaturedMedia'
    },
    {
        label: 'experience setFeaturedMedia',
        vertical: 'experience',
        method: 'PUT',
        path: `/api/v1/protected/experiences/${LISTING_ID}/media/${SECONDARY_ID}/featured`,
        mockKey: 'setFeaturedExperienceMedia'
    }
] as const;

describe('commerce content-gates entitlement gate — block side (HOS-1275, mocked floor)', () => {
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
        it(`refuses ${testCase.label} when the vertical's floor does not grant edit_${testCase.vertical}_info`, async () => {
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
                error?: { code?: string; message?: string };
            };

            expect(res.status).toBe(403);
            expect(body.error?.code).toBe('ENTITLEMENT_REQUIRED');
            expect(body.error?.message).toContain(`edit_${testCase.vertical}_info`);
            expect(mocks[testCase.mockKey]).not.toHaveBeenCalled();
        });
    }
});
