import type { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types';
import { createGuestActor } from '../../src/utils/actor';

const mocks = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    accommodationGetById: vi.fn(),
    accommodationGetByDestination: vi.fn(),
    accommodationGetTopRatedByDestination: vi.fn(),
    accommodationSearch: vi.fn(),
    destinationGetAccommodations: vi.fn(),
    featureGetAccommodationsByFeature: vi.fn(),
    findMany: vi.fn(),
    mediaByAccommodations: vi.fn(),
    loggerError: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    AccommodationService: class {
        getById = mocks.accommodationGetById;
        getByDestination = mocks.accommodationGetByDestination;
        getTopRatedByDestination = mocks.accommodationGetTopRatedByDestination;
        search = mocks.accommodationSearch;
    },
    DestinationService: class {
        getAccommodations = mocks.destinationGetAccommodations;
    },
    FeatureService: class {
        getAccommodationsByFeature = mocks.featureGetAccommodationsByFeature;
    }
}));
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));
vi.mock('../../src/middlewares/authorization', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    publicAuthMiddleware: () => async (_ctx: unknown, next: () => Promise<void>) => next()
}));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: mocks.loggerError }
}));
vi.mock('../../src/routes/accommodation/public/quick-amenity-resolver', () => ({
    resolveQuickAmenityFlags: vi.fn().mockResolvedValue([])
}));
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    getDb: () => ({
        select: () => {
            const result = [] as unknown as unknown[] & { limit: () => Promise<unknown[]> };
            result.limit = async () => [{ type: 'CABIN', destinationId: DESTINATION_ID }];
            return {
                from() {
                    return this;
                },
                where() {
                    return this;
                },
                limit: result.limit
            };
        },
        query: { accommodations: { findMany: mocks.findMany } }
    }),
    accommodationMediaModel: { findByAccommodations: mocks.mediaByAccommodations },
    accommodations: {
        id: 'acc.id',
        slug: 'acc.slug',
        publicationStatus: 'acc.publicationStatus',
        type: 'acc.type',
        destinationId: 'acc.destinationId',
        averageRating: 'acc.averageRating',
        deletedAt: 'acc.deletedAt'
    }
}));

const OWNER = {
    premium: '11111111-1111-4111-8111-111111111111',
    trial: '44444444-4444-4444-8444-444444444444'
} as const;
const DESTINATION_ID = '55555555-5555-4555-8555-555555555555';
const FEATURE_ID = '66666666-6666-4666-8666-666666666666';
const KEYS = ['can_use_rich_description', 'can_embed_video', 'has_verification_badge'];

function accommodation(ownerId: string) {
    const id =
        ownerId === OWNER.premium
            ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
            : 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const video = { url: 'https://vimeo.com/123', moderationState: 'APPROVED' };
    return {
        id,
        slug: 'public-stay',
        ownerId,
        name: 'Public stay',
        summary: 'A comfortable stay',
        type: 'CABIN',
        isFeatured: false,
        averageRating: 4.5,
        reviewsCount: 3,
        description: 'Plain description',
        nameI18n: null,
        summaryI18n: null,
        descriptionI18n: null,
        richDescription: '<p>Paid description</p>',
        richDescriptionI18n: {
            es: '<p>Descripcion paga</p>',
            en: '<p>Paid description</p>',
            pt: '<p>Descricao paga</p>'
        },
        videos: [video],
        media: { videos: [video] },
        location: null,
        destinationId: DESTINATION_ID,
        seo: null,
        price: null,
        tags: [],
        socialNetworks: null,
        extraInfo: null,
        publicationStatus: 'PUBLISHED',
        isVerified: true,
        contactInfo: { whatsapp: 123 },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        destination: {
            id: DESTINATION_ID,
            name: 'Destination',
            slug: 'destination',
            summary: 'A destination',
            destinationType: 'CITY',
            level: 1,
            path: '/destination',
            pathIds: DESTINATION_ID
        }
    };
}

function appFor(route: Hono<AppBindings>) {
    const app = new Hono<AppBindings>();
    app.onError((error, ctx) =>
        ctx.text(error instanceof Error ? error.message : String(error), 500)
    );
    app.use((ctx, next) => {
        ctx.set('actor', createGuestActor());
        return next();
    });
    app.route('/', route);
    return app;
}

function resultFor(ownerId: string) {
    return { data: accommodation(ownerId) };
}

function listResult() {
    return {
        data: { items: [accommodation(OWNER.premium), accommodation(OWNER.trial)], total: 2 }
    };
}

function assertOwnerGating(items: Array<Record<string, unknown>>) {
    expect(items).toHaveLength(2);
    expect(items[0]?.richDescription).toBe('<p>Paid description</p>');
    expect(items[0]?.richDescriptionI18n).toBeDefined();
    expect(items[1]).not.toHaveProperty('richDescription');
    expect(items[1]).not.toHaveProperty('richDescriptionI18n');
}

async function responseItems(response: Response): Promise<Array<Record<string, unknown>>> {
    const body = (await response.json()) as {
        data?:
            | {
                  items?: Array<Record<string, unknown>>;
                  accommodations?: Array<Record<string, unknown>>;
                  data?: Array<Record<string, unknown>>;
              }
            | Array<Record<string, unknown>>;
        items?: Array<Record<string, unknown>>;
    };
    if (Array.isArray(body.data)) return body.data;
    if (body.data && 'accommodations' in body.data) return body.data.accommodations ?? [];
    if (body.data && 'data' in body.data) return body.data.data ?? [];
    if (body.data && 'items' in body.data) return body.data.items ?? [];
    return body.items ?? [];
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: userId === OWNER.premium,
                inheritsTouristVip: false,
                entries: (userId === OWNER.premium ? KEYS : []).map((key) => ({
                    key,
                    value: 1,
                    strategy: 'MAX' as const
                }))
            })
    );
    mocks.mediaByAccommodations.mockResolvedValue(new Map());
});

describe('TEST:V5:32 public paid fields route callers', () => {
    it('getById applies each owner grant', async () => {
        mocks.accommodationGetById.mockImplementation(async (_actor: unknown, id: string) =>
            resultFor(id === accommodation(OWNER.premium).id ? OWNER.premium : OWNER.trial)
        );
        const { publicGetAccommodationByIdRoute } = await import(
            '../../src/routes/accommodation/public/getById'
        );
        const app = appFor(publicGetAccommodationByIdRoute);
        const premium = await app.request(`/${accommodation(OWNER.premium).id}`);
        const trial = await app.request(`/${accommodation(OWNER.trial).id}`);
        expect(premium.status).toBe(200);
        expect(trial.status).toBe(200);
        expect(
            ((await premium.json()) as { data: Record<string, unknown> }).data.richDescription
        ).toBe('<p>Paid description</p>');
        expect(((await trial.json()) as { data: Record<string, unknown> }).data).not.toHaveProperty(
            'richDescription'
        );
    });

    it('getByDestination applies each owner grant', async () => {
        mocks.accommodationGetByDestination.mockResolvedValue({
            data: { accommodations: [accommodation(OWNER.premium), accommodation(OWNER.trial)] }
        });
        const { getByDestinationRoute } = await import(
            '../../src/routes/accommodation/public/getByDestination'
        );
        const response = await appFor(getByDestinationRoute).request(
            `/destination/${DESTINATION_ID}`
        );
        expect(response.status).toBe(200);
        assertOwnerGating(await responseItems(response));
    });

    it('getTopRatedByDestination applies each owner grant', async () => {
        mocks.accommodationGetTopRatedByDestination.mockResolvedValue({
            data: { accommodations: [accommodation(OWNER.premium), accommodation(OWNER.trial)] }
        });
        const { getTopRatedByDestinationRoute } = await import(
            '../../src/routes/accommodation/public/getTopRatedByDestination'
        );
        const response = await appFor(getTopRatedByDestinationRoute).request(
            `/destination/${DESTINATION_ID}/top-rated`
        );
        expect(response.status, await response.clone().text()).toBe(200);
        assertOwnerGating(await responseItems(response));
    });

    it('similar applies each owner grant', async () => {
        mocks.findMany.mockResolvedValue([
            { ...accommodation(OWNER.premium), videos: [] },
            { ...accommodation(OWNER.trial), videos: [] }
        ]);
        const { publicGetSimilarRoute } = await import(
            '../../src/routes/accommodation/public/similar'
        );
        const response = await appFor(publicGetSimilarRoute).request(
            `/${accommodation(OWNER.trial).id}/similar`
        );
        expect(
            response.status,
            `${await response.clone().text()} ${JSON.stringify(mocks.loggerError.mock.calls)}`
        ).toBe(200);
        assertOwnerGating(await responseItems(response));
    });

    it('destination public accommodations applies each owner grant', async () => {
        mocks.destinationGetAccommodations.mockResolvedValue({
            data: { accommodations: [accommodation(OWNER.premium), accommodation(OWNER.trial)] }
        });
        const { publicGetDestinationAccommodationsRoute } = await import(
            '../../src/routes/destination/public/getAccommodations'
        );
        const response = await appFor(publicGetDestinationAccommodationsRoute).request(
            `/${DESTINATION_ID}/accommodations`
        );
        expect(response.status).toBe(200);
        assertOwnerGating(await responseItems(response));
    });

    it('feature public accommodations applies each owner grant', async () => {
        mocks.featureGetAccommodationsByFeature.mockResolvedValue({
            data: { accommodations: [accommodation(OWNER.premium), accommodation(OWNER.trial)] }
        });
        const { publicGetAccommodationsByFeatureRoute } = await import(
            '../../src/routes/feature/public/getAccommodationsByFeature'
        );
        const response = await appFor(publicGetAccommodationsByFeatureRoute).request(
            `/${FEATURE_ID}/accommodations`
        );
        expect(response.status).toBe(200);
        assertOwnerGating(await responseItems(response));
    });

    it('user public accommodations applies each owner grant', async () => {
        mocks.accommodationSearch.mockResolvedValue(listResult());
        const { publicGetUserAccommodationsRoute } = await import(
            '../../src/routes/user/public/getAccommodations'
        );
        const response = await appFor(publicGetUserAccommodationsRoute).request(
            `/${OWNER.premium}/accommodations`
        );
        expect(response.status).toBe(200);
        assertOwnerGating(await responseItems(response));
    });
});
