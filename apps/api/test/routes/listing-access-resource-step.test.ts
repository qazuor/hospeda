/** TEST:V5:1 — the protected listing routes share one resource-step decision. */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    eq: (left: unknown, right: unknown) => ({ left, right }),
    amenities: {
        id: 'amenities.id',
        slug: 'amenities.slug',
        description: 'amenities.description',
        icon: 'amenities.icon',
        applicableVerticals: 'amenities.applicableVerticals',
        type: 'amenities.type',
        isFeatured: 'amenities.isFeatured',
        displayWeight: 'amenities.displayWeight',
        isBuiltin: 'amenities.isBuiltin',
        lifecycleState: 'amenities.lifecycleState',
        createdAt: 'amenities.createdAt',
        updatedAt: 'amenities.updatedAt'
    },
    features: {
        id: 'features.id',
        slug: 'features.slug',
        description: 'features.description',
        icon: 'features.icon',
        applicableVerticals: 'features.applicableVerticals',
        isFeatured: 'features.isFeatured',
        displayWeight: 'features.displayWeight',
        isBuiltin: 'features.isBuiltin',
        lifecycleState: 'features.lifecycleState',
        createdAt: 'features.createdAt',
        updatedAt: 'features.updatedAt'
    },
    rAccommodationAmenity: { amenityId: 'raa.amenityId', accommodationId: 'raa.accommodationId' },
    rAccommodationFeature: { featureId: 'raf.featureId', accommodationId: 'raf.accommodationId' },
    getDb: vi.fn()
}));

import { getDb } from '@repo/db';
import {
    AccommodationProtectedSchema,
    ExperienceProtectedSchema,
    type PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ExperienceService, GastronomyService } from '@repo/service-core';
import { Hono } from 'hono';
import type { AppBindings } from '../../src/types';

const CALLER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const LISTING_ID = '33333333-3333-4333-8333-333333333333';
const INVENTED_ID = '44444444-4444-4444-8444-444444444444';

const common = {
    id: LISTING_ID,
    slug: 'test-listing',
    name: 'Test Listing',
    type: 'HOTEL',
    summary: 'A test listing',
    description: 'A sufficiently detailed description for the protected listing schema.',
    ownerId: CALLER_ID,
    destinationId: '55555555-5555-4555-8555-555555555555',
    lifecycleState: 'ACTIVE',
    visibility: 'PUBLIC',
    averageRating: 4.5,
    reviewsCount: 0,
    isFeatured: false,
    media: null,
    seo: null,
    socialNetworks: null,
    contactInfo: null,
    nameI18n: null,
    summaryI18n: null,
    descriptionI18n: null,
    richDescription: null,
    deletedAt: null,
    deletedById: null,
    createdById: null,
    updatedById: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z')
};
const fixtures = {
    accommodation: {
        ...common,
        type: 'HOTEL',
        media: { featuredImage: { url: 'https://example.com/i.jpg', moderationState: 'APPROVED' } },
        location: { street: 'Main', number: '123' },
        price: { price: 150, currency: 'ARS' },
        tags: [],
        extraInfo: { capacity: 4, minNights: 1, bedrooms: 2, bathrooms: 1 },
        faqs: []
    },
    gastronomy: {
        ...common,
        type: 'PARRILLA',
        isPriceOnRequest: false,
        featuredByEntitlement: false,
        moderationState: 'APPROVED',
        openingHours: null
    },
    experience: {
        ...common,
        type: 'EXCURSION',
        priceFrom: 1500000,
        priceUnit: 'per_person',
        isPriceOnRequest: false,
        featuredByEntitlement: false,
        moderationState: 'APPROVED'
    }
} as const;

const cases = [
    {
        label: 'accommodation',
        service: AccommodationService,
        route: async () =>
            (await import('../../src/routes/accommodation/protected/getById.js'))
                .protectedGetOwnAccommodationByIdRoute
    },
    {
        label: 'gastronomy',
        service: GastronomyService,
        route: async () =>
            (await import('../../src/routes/gastronomy/protected/getById.js'))
                .protectedGetGastronomyByIdRoute
    },
    {
        label: 'experience',
        service: ExperienceService,
        route: async () =>
            (await import('../../src/routes/experience/protected/getById.js'))
                .protectedGetExperienceByIdRoute
    }
] as const;

type Probe = { readonly status: number; readonly body: unknown };
function buildApp(
    route: Awaited<ReturnType<(typeof cases)[number]['route']>>,
    emailVerified = true
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', {
            id: CALLER_ID,
            roles: [RoleEnum.USER],
            permissions: [] as PermissionEnum[],
            emailVerified
        });
        return next();
    });
    app.route('/', route);
    return app;
}
async function probe(app: Hono<AppBindings>, id: string): Promise<Probe> {
    const response = await app.request(`/${id}`);
    const raw = await response.text();
    let body: unknown;
    try {
        body = JSON.parse(raw);
    } catch {
        body = raw;
    }
    if (body && typeof body === 'object' && 'metadata' in body) {
        const { metadata, ...rest } = body as Record<string, unknown>;
        body = { ...rest, metadataKeys: Object.keys(metadata as object).sort() };
    }
    return { status: response.status, body };
}

function expectNotFound(result: Probe): void {
    expect(result.status).toBe(404);
    const error = (result.body as { error: { code: string; message: string } }).error;
    expect(error.code).toBe(ServiceErrorCode.NOT_FOUND);
    expect(error.message).not.toMatch(/permission|VIEW_ALL|UPDATE_ANY/i);
    expect(error.message).not.toContain(LISTING_ID);
    expect(error.message).not.toContain(INVENTED_ID);
}

afterEach(() => vi.restoreAllMocks());

describe.each(cases)('TEST:V5:1 $label resource step', ({ label, service, route }) => {
    it('answers identically for foreign PUBLISHED, ARCHIVED, DRAFT and invented', async () => {
        const app = buildApp(await route());
        const missingMessage = `${service.ENTITY_NAME} not found`;
        const getById = vi.spyOn(service.prototype, 'getById');
        const results: Probe[] = [];
        for (const publicationStatus of ['PUBLISHED', 'ARCHIVED', 'DRAFT'] as const) {
            getById.mockResolvedValueOnce({
                data: { ...fixtures[label], ownerId: OTHER_ID, publicationStatus } as never
            });
            results.push(await probe(app, LISTING_ID));
        }
        getById.mockResolvedValueOnce({
            error: { code: ServiceErrorCode.NOT_FOUND, message: missingMessage }
        });
        const invented = await probe(app, INVENTED_ID);
        for (const result of results) {
            expect(result).toEqual(invented);
            expectNotFound(result);
        }
    });

    it.each([
        'ARCHIVED',
        'LEGACY',
        'EMAIL_UNVERIFIED'
    ] as const)('lets the owner read %s', async (variant) => {
        const app = buildApp(await route(), variant !== 'EMAIL_UNVERIFIED');
        const row =
            variant === 'LEGACY'
                ? { ...fixtures[label] }
                : { ...fixtures[label], publicationStatus: 'ARCHIVED' };
        if (label === 'accommodation' || label === 'experience') {
            const schema =
                label === 'accommodation'
                    ? AccommodationProtectedSchema
                    : ExperienceProtectedSchema;
            const parsed = schema.safeParse(row);
            expect(parsed.success, parsed.error?.message).toBe(true);
        }
        vi.spyOn(service.prototype, 'getById').mockResolvedValue({ data: row as never });
        if (label === 'accommodation') {
            vi.mocked(getDb).mockReturnValue({
                select: () => ({ from: () => ({ innerJoin: () => ({ where: async () => [] }) }) })
            } as never);
        } else {
            vi.spyOn(service.prototype, 'loadJunctionIds').mockResolvedValue({
                amenityIds: [],
                featureIds: []
            });
        }
        const result = await probe(app, LISTING_ID);
        expect(result.status, JSON.stringify(result.body)).toBe(200);
    });

    it("hides the owner's PURGED row exactly like an invented id", async () => {
        const app = buildApp(await route());
        const getById = vi.spyOn(service.prototype, 'getById');
        getById.mockResolvedValueOnce({
            data: { ...fixtures[label], publicationStatus: 'PURGED' } as never
        });
        const purged = await probe(app, LISTING_ID);
        getById.mockResolvedValueOnce({
            error: { code: ServiceErrorCode.NOT_FOUND, message: `${service.ENTITY_NAME} not found` }
        });
        const invented = await probe(app, INVENTED_ID);
        expect(purged).toEqual(invented);
        expectNotFound(purged);
    });
});
