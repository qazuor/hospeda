import { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types';
import { createGuestActor } from '../../src/utils/actor';
import { filterPublicPaidFields } from '../../src/utils/entitlement-filter';

const mocks = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    getBySlug: vi.fn(),
    search: vi.fn(),
    loggerError: vi.fn(),
    historyRecord: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    AccommodationService: class {
        getBySlug = mocks.getBySlug;
        search = mocks.search;
    },
    SearchHistoryService: class {
        record = mocks.historyRecord;
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
vi.mock('@repo/db', () => ({
    getDb: () => ({
        select: () => {
            const result = [] as unknown as unknown[] & { limit: () => Promise<unknown[]> };
            result.limit = async () => [];
            return {
                from() {
                    return this;
                },
                innerJoin() {
                    return this;
                },
                where() {
                    return result;
                }
            };
        }
    }),
    accommodationFaqs: {
        id: 'faq.id',
        question: 'faq.question',
        answer: 'faq.answer',
        category: 'faq.category',
        questionI18n: 'faq.questionI18n',
        answerI18n: 'faq.answerI18n',
        accommodationId: 'faq.accommodationId',
        lifecycleState: 'faq.lifecycleState',
        isVisibleOnListing: 'faq.isVisibleOnListing',
        deletedAt: 'faq.deletedAt'
    },
    amenities: { id: 'amenities.id', slug: 'amenities.slug', icon: 'amenities.icon' },
    features: { id: 'features.id', slug: 'features.slug', icon: 'features.icon' },
    rAccommodationAmenity: {
        amenityId: 'raa.amenityId',
        isOptional: 'raa.isOptional',
        additionalCost: 'raa.additionalCost',
        accommodationId: 'raa.accommodationId'
    },
    rAccommodationFeature: {
        featureId: 'raf.featureId',
        hostReWriteName: 'raf.hostReWriteName',
        comments: 'raf.comments',
        accommodationId: 'raf.accommodationId'
    },
    users: {
        id: 'users.id',
        displayName: 'users.displayName',
        firstName: 'users.firstName',
        lastName: 'users.lastName',
        image: 'users.image',
        profile: 'users.profile',
        createdAt: 'users.createdAt'
    },
    RRolePermissionModel: class {
        findAll() {
            return Promise.resolve([]);
        }
    },
    RUserPermissionModel: class {
        findAll() {
            return Promise.resolve([]);
        }
    }
}));

const OWNER = {
    premium: '11111111-1111-4111-8111-111111111111',
    pro: '22222222-2222-4222-8222-222222222222',
    basic: '33333333-3333-4333-8333-333333333333',
    trial: '44444444-4444-4444-8444-444444444444',
    touristVip: '77777777-7777-4777-8777-777777777777',
    touristFloor: '88888888-8888-4888-8888-888888888888'
} as const;
const KEYS = ['can_use_rich_description', 'can_embed_video', 'has_verification_badge', 'ai_chat'];

function entriesFor(userId: string): string[] {
    if (userId === OWNER.touristVip) return ['can_view_search_history'];
    if (userId === OWNER.premium) return KEYS;
    if (userId === OWNER.pro) return ['can_use_rich_description', 'can_embed_video'];
    if (userId === OWNER.basic) return ['ai_chat'];
    return [];
}

function accommodation(ownerId: string) {
    const video = { url: 'https://vimeo.com/123', moderationState: 'APPROVED' };
    return {
        id: ownerId
            .replace('11111111', 'aaaaaaaa')
            .replace('22222222', 'bbbbbbbb')
            .replace('33333333', 'cccccccc')
            .replace('44444444', 'dddddddd'),
        slug: 'public-stay',
        ownerId,
        name: 'Public stay',
        summary: 'A comfortable stay',
        type: 'CABIN',
        isFeatured: false,
        averageRating: 4.5,
        reviewsCount: 3,
        description: 'Plain https://youtu.be/abc123',
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
        destinationId: '55555555-5555-4555-8555-555555555555',
        seo: null,
        price: null,
        tags: [],
        socialNetworks: null,
        extraInfo: null,
        visibility: 'PUBLIC',
        isVerified: true,
        contactInfo: { whatsapp: 123 },
        createdAt: new Date('2026-01-01T00:00:00.000Z')
    };
}

function appFor(route: Hono<AppBindings>, userId?: string) {
    const app = new Hono<AppBindings>();
    app.onError((error, ctx) =>
        ctx.text(error instanceof Error ? (error.stack ?? error.message) : String(error), 500)
    );
    app.use((ctx, next) => {
        ctx.set(
            'actor',
            userId
                ? { id: userId, roles: [], permissions: [], emailVerified: true }
                : createGuestActor()
        );
        return next();
    });
    app.route('/', route);
    return app;
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.historyRecord.mockResolvedValue({ data: undefined });
    mocks.search.mockResolvedValue({ data: { items: [], total: 0 } });
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: true,
                inheritsTouristVip: false,
                entries: entriesFor(userId).map((key) => ({
                    key,
                    value: 1,
                    strategy: 'MAX' as const
                }))
            })
    );
});

describe('TEST:V5:32 public paid fields', () => {
    it('filters the pure projection from owner grants and keeps the rich pair atomic', () => {
        const premium = filterPublicPaidFields(accommodation(OWNER.premium), {
            richDescription: true,
            video: true,
            verification: true,
            aiChat: true
        });
        const pro = filterPublicPaidFields(accommodation(OWNER.pro), {
            richDescription: true,
            video: true,
            verification: false,
            aiChat: false
        });
        const basic = filterPublicPaidFields(accommodation(OWNER.basic), {
            richDescription: false,
            video: false,
            verification: false,
            aiChat: true
        });
        const trial = filterPublicPaidFields(accommodation(OWNER.trial), {
            richDescription: false,
            video: false,
            verification: false,
            aiChat: false
        });

        expect(premium.isVerified).toBe(true);
        expect(pro.isVerified).toBe(false);
        expect(pro.richDescription).toBe('<p>Paid description</p>');
        expect('richDescription' in basic).toBe(false);
        expect('richDescriptionI18n' in basic).toBe(false);
        expect('richDescription' in trial).toBe(false);
        expect((trial as typeof trial & { hasWhatsapp: boolean }).hasWhatsapp).toBe(false);
        expect(
            (
                filterPublicPaidFields(
                    { contactInfo: { whatsapp: '  123  ' } },
                    {
                        richDescription: false,
                        video: false,
                        verification: false,
                        aiChat: false
                    }
                ) as unknown as { hasWhatsapp: boolean }
            ).hasWhatsapp
        ).toBe(true);
    });

    it('uses the owner effective set for slug details, independent of the visitor', async () => {
        mocks.getBySlug.mockImplementation(async () => ({ data: accommodation(OWNER.premium) }));
        const { publicGetAccommodationBySlugRoute } = await import(
            '../../src/routes/accommodation/public/getBySlug'
        );
        const app = appFor(publicGetAccommodationBySlugRoute);
        const first = await app.request('/slug/public-stay', {
            headers: { 'x-visitor': 'visitor-one' }
        });
        const firstText = await first.text();
        expect(mocks.effectiveSet).toHaveBeenCalled();
        if (first.status !== 200) throw new Error(JSON.stringify(mocks.loggerError.mock.calls));
        expect(first.status, firstText).toBe(200);
        const firstBody = JSON.parse(firstText) as { data: Record<string, unknown> };
        const second = await app.request('/slug/public-stay', {
            headers: { 'x-visitor': 'visitor-two' }
        });
        const secondBody = (await second.json()) as { data: Record<string, unknown> };
        expect(first.status).toBe(200);
        expect(firstBody.data.richDescription).toBe('<p>Paid description</p>');
        expect(firstBody.data.isVerified).toBe(true);
        expect(secondBody.data).toEqual(firstBody.data);
        expect(mocks.effectiveSet.mock.calls.every(([args]) => args.userId === OWNER.premium)).toBe(
            true
        );
        expect(
            mocks.effectiveSet.mock.calls.every(
                ([args]) => args.vertical === VerticalEnum.ACCOMMODATION
            )
        ).toBe(true);
    });

    it('resolves one effective set per distinct owner for a list page', async () => {
        mocks.search.mockResolvedValue({
            data: {
                items: [
                    accommodation(OWNER.premium),
                    accommodation(OWNER.pro),
                    accommodation(OWNER.premium)
                ],
                total: 3
            }
        });
        const { publicListAccommodationsRoute } = await import(
            '../../src/routes/accommodation/public/list'
        );
        const response = await appFor(publicListAccommodationsRoute).request('/');
        const responseText = await response.text();
        expect(response.status, responseText).toBe(200);
        const body = JSON.parse(responseText) as {
            data?: { items?: Array<Record<string, unknown>> };
            items?: Array<Record<string, unknown>>;
        };
        expect(response.status).toBe(200);
        expect(body.data?.items ?? body.items).toHaveLength(3);
        const items = body.data?.items ?? body.items ?? [];
        expect(items[0]?.hasAiChat).toBe(true);
        expect(items[1]?.hasAiChat).toBe(false);
        expect(mocks.effectiveSet).toHaveBeenCalledTimes(2);
        expect(mocks.effectiveSet.mock.calls.map(([args]) => args.userId).sort()).toEqual(
            [OWNER.premium, OWNER.pro].sort()
        );
    });

    it('TEST:V5:33 records public searches only for tourists with history access and never blocks search', async () => {
        const { publicListAccommodationsRoute } = await import(
            '../../src/routes/accommodation/public/list'
        );
        for (const userId of [OWNER.touristVip, OWNER.touristFloor, undefined]) {
            vi.clearAllMocks();
            mocks.effectiveSet.mockImplementation(
                async ({ userId: id, vertical }: { userId: string; vertical: VerticalEnum }) =>
                    rehydrateEffectiveSet({
                        version: 1,
                        userId: id,
                        vertical,
                        hasLiveNonTrialTitle: false,
                        inheritsTouristVip: false,
                        entries: (id === OWNER.touristVip ? ['can_view_search_history'] : []).map(
                            (key) => ({ key, value: 1, strategy: 'MAX' as const })
                        )
                    })
            );
            mocks.search.mockResolvedValue({ data: { items: [], total: 0 } });
            mocks.historyRecord.mockResolvedValue({ data: undefined });
            const response = await appFor(publicListAccommodationsRoute, userId).request('/');
            expect(response.status).toBe(200);
            await new Promise((resolve) => setTimeout(resolve, 0));
            if (userId === OWNER.touristVip) {
                expect(mocks.historyRecord).toHaveBeenCalledTimes(1);
                expect(mocks.effectiveSet).toHaveBeenCalledWith({
                    userId,
                    vertical: VerticalEnum.TOURIST
                });
            } else {
                expect(mocks.historyRecord).not.toHaveBeenCalled();
                if (userId === undefined) {
                    expect(mocks.effectiveSet).not.toHaveBeenCalled();
                } else {
                    expect(mocks.effectiveSet).toHaveBeenCalledWith({
                        userId,
                        vertical: VerticalEnum.TOURIST
                    });
                }
            }
        }
        vi.clearAllMocks();
        mocks.search.mockResolvedValue({ data: { items: [], total: 0 } });
        mocks.effectiveSet.mockRejectedValue(new Error('lookup failed'));
        const response = await appFor(publicListAccommodationsRoute, OWNER.touristVip).request('/');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(response.status).toBe(200);
        expect(mocks.historyRecord).not.toHaveBeenCalled();
    });

    it('returns 200 with paid fields hidden when reading the effective set fails', async () => {
        mocks.getBySlug.mockResolvedValue({ data: accommodation(OWNER.premium) });
        mocks.effectiveSet.mockRejectedValue(new Error('lookup failed'));
        const { publicGetAccommodationBySlugRoute } = await import(
            '../../src/routes/accommodation/public/getBySlug'
        );
        const response = await appFor(publicGetAccommodationBySlugRoute).request(
            '/slug/public-stay'
        );
        const responseText = await response.text();
        expect(response.status, responseText).toBe(200);
        const body = JSON.parse(responseText) as { data: Record<string, unknown> };
        expect(response.status).toBe(200);
        expect('richDescription' in body.data).toBe(false);
        expect('richDescriptionI18n' in body.data).toBe(false);
        expect(body.data.isVerified).toBe(false);
    });

    it('resolves the basic-plan AI chat badge and leaves it off for trial owners', async () => {
        mocks.search.mockResolvedValue({
            data: { items: [accommodation(OWNER.basic), accommodation(OWNER.trial)], total: 2 }
        });
        const { publicListAccommodationsRoute } = await import(
            '../../src/routes/accommodation/public/list'
        );
        const response = await appFor(publicListAccommodationsRoute).request('/');
        const responseText = await response.text();
        expect(response.status, responseText).toBe(200);
        const body = JSON.parse(responseText) as {
            data?: { items?: Array<Record<string, unknown>> };
            items?: Array<Record<string, unknown>>;
        };
        const items = body.data?.items ?? body.items ?? [];
        expect(items.map((item) => item.hasAiChat)).toEqual([true, false]);
    });
});
