/**
 * HOS-1263 regression: a commerce FAQ the owner marked "not visible on the
 * listing" must be ABSENT from the public payload, and so must a soft-deleted or non-ACTIVE one of the whole-listing reads
 * (`getBySlug` and `getById`), for both gastronomy and experience. The
 * dedicated `/faqs` routes already filtered; the embedded path did not.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

const LISTING_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
/** Every FAQ whose question starts with this must never reach a public payload. */
const LEAK = 'LEAK';

const faq = (
    n: number,
    overrides: {
        readonly question?: string;
        readonly isVisibleOnListing?: boolean;
        readonly lifecycleState?: string;
        readonly deletedAt?: Date | null;
    } = {}
) => ({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    question: overrides.question ?? `Visible question number ${n}`,
    answer: `A long enough answer number ${n}`,
    gastronomyId: LISTING_ID,
    experienceId: LISTING_ID,
    displayOrder: n,
    category: null,
    lifecycleState: overrides.lifecycleState ?? 'ACTIVE',
    deletedAt: overrides.deletedAt ?? null,
    ...(overrides.isVisibleOnListing === undefined
        ? {}
        : { isVisibleOnListing: overrides.isVisibleOnListing })
});

const FAQS = [
    faq(1, { isVisibleOnListing: true }),
    faq(2),
    faq(3, { question: `${LEAK} hidden`, isVisibleOnListing: false }),
    faq(4, { question: `${LEAK} soft-deleted`, deletedAt: new Date('2026-01-01') }),
    faq(5, { question: `${LEAK} draft`, lifecycleState: 'DRAFT' }),
    faq(6, { question: `${LEAK} archived`, lifecycleState: 'ARCHIVED' })
];

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
    faqs: FAQS
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
        listGastronomyFaqs: async () => ({ data: { faqs: FAQS } }),
        listExperienceFaqs: async () => ({ data: { faqs: FAQS } }),
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
    ['experience getById', `/api/v1/public/experiences/${LISTING_ID}`],
    ['gastronomy /faqs', `/api/v1/public/gastronomies/${LISTING_ID}/faqs`],
    ['experience /faqs', `/api/v1/public/experiences/${LISTING_ID}/faqs`]
] as const;

describe('public commerce reads hide FAQs marked not visible on the listing', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it.each(
        CASES
    )('%s omits hidden, soft-deleted and non-ACTIVE FAQs and keeps the visible ones', async (_name, url) => {
        // Act
        const res = await app.request(url, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        const body = await res.text();

        // Assert
        expect(res.status, body).toBe(200);
        expect(body).not.toContain(LEAK);
        expect(body).toContain('Visible question number 1');
        expect(body).toContain('Visible question number 2');
    });
});
