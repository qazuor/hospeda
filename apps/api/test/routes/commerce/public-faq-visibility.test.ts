/**
 * HOS-1263 regression: a commerce FAQ the owner marked "not visible on the
 * listing" must be ABSENT from the public payload of the whole-listing reads
 * (`getBySlug` and `getById`), for both gastronomy and experience. The
 * dedicated `/faqs` routes already filtered; the embedded path did not.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

const LISTING_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const HIDDEN_QUESTION = 'HIDDEN-question-must-not-ship';

const faq = (n: number, isVisibleOnListing?: boolean) => ({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    question: n === 3 ? HIDDEN_QUESTION : `Visible question ${n}`,
    answer: `answer ${n}`,
    category: null,
    ...(isVisibleOnListing === undefined ? {} : { isVisibleOnListing })
});

const buildListing = (type: string) => ({
    id: LISTING_ID,
    ownerId: OWNER_ID,
    slug: 'hos-1263-listing',
    name: 'Listing name',
    type,
    summary: 'A summary long enough to satisfy the commerce schema minimums.',
    description:
        'A description long enough to satisfy the commerce schema minimums, repeated. '.repeat(3),
    destinationId: '33333333-3333-4333-8333-333333333333',
    priceFrom: 1000,
    isFeatured: false,
    faqs: [faq(1, true), faq(2), faq(3, false)]
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    const okGastronomy = async () => ({ data: buildListing('RESTAURANT') });
    const okExperience = async () => ({ data: buildListing('EXCURSION') });
    return {
        ...actual,
        GastronomyService: class extends actual.GastronomyService {
            override getBySlug = okGastronomy as never;
            override getById = okGastronomy as never;
        },
        ExperienceService: class extends actual.ExperienceService {
            override getBySlug = okExperience as never;
            override getById = okExperience as never;
        },
        getGastronomyMenu: async () => ({ data: { sections: [] } }),
        getGastronomyEvents: async () => ({ data: { events: [] } }),
        getGastronomyDailySpecials: async () => ({ data: { specials: [] } }),
        resolveOwnerGastronomyPlanEntitlementSet: async () => new Set<string>(),
        resolveOwnerGrantsExperienceDirections: async () => false
    };
});

vi.mock('../../../src/utils/commerce-catalog-relations', () => ({
    fetchGastronomyAmenities: async () => [],
    fetchGastronomyFeatures: async () => [],
    fetchExperienceAmenities: async () => [],
    fetchExperienceFeatures: async () => []
}));

const CASES = [
    ['gastronomy getBySlug', '/api/v1/public/gastronomies/slug/hos-1263-listing'],
    ['gastronomy getById', `/api/v1/public/gastronomies/${LISTING_ID}`],
    ['experience getBySlug', '/api/v1/public/experiences/slug/hos-1263-listing'],
    ['experience getById', `/api/v1/public/experiences/${LISTING_ID}`]
] as const;

describe('public commerce reads hide FAQs marked not visible on the listing', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it.each(CASES)('%s omits the hidden FAQ and keeps the visible ones', async (_name, url) => {
        // Act
        const res = await app.request(url, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        const body = await res.text();

        // Assert
        expect(res.status, body).toBe(200);
        expect(body).not.toContain(HIDDEN_QUESTION);
        expect(body).toContain('Visible question 1');
        expect(body).toContain('Visible question 2');
    });
});
