import { PermissionEnum, PublicationStatusEnum, RoleEnum, UserSchema } from '@repo/schemas';
import {
    AccommodationService,
    ExperienceService,
    GastronomyService,
    UserService
} from '@repo/service-core';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { clearEntityFetchers } from '../../src/middlewares/ownership';
import { createErrorHandler } from '../../src/middlewares/response';
import { protectedAccommodationRoutes } from '../../src/routes/accommodation/protected/index';
import { protectedBillingSubscriptionReadRoutes } from '../../src/routes/billing-subscription';
import { protectedExperienceRoutes } from '../../src/routes/experience/protected/index';
import { protectedGastronomyRoutes } from '../../src/routes/gastronomy/protected/index';
import { protectedUserRoutes } from '../../src/routes/user/protected/index';
import type { AppBindings } from '../../src/types';
import { registerEntityFetchers } from '../../src/utils/entity-fetchers';

const mocks = vi.hoisted(() => ({
    readSubscription: vi.fn(),
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn()
}));

vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: mocks.loadFacts,
        billing: { coverage: mocks.coverage },
        effectiveSet: mocks.effectiveSet
    })
}));
vi.mock('../../src/routes/billing-subscription/read-subscription', () => ({
    readSubscription: mocks.readSubscription
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>())
}));

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const LISTING_ID = '33333333-3333-4333-8333-333333333333';
const SUBSCRIPTION_ID = '44444444-4444-4444-8444-444444444444';

function buildApp(options: {
    readonly actorId: string;
    readonly emailVerified: boolean;
    readonly permissions: PermissionEnum[];
}) {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use('*', (ctx, next) => {
        ctx.set('actor', {
            id: options.actorId,
            roles: [RoleEnum.USER],
            permissions: options.permissions,
            emailVerified: options.emailVerified
        });
        return next();
    });
    app.route('/api/v1/protected/users', protectedUserRoutes);
    app.route('/api/v1/protected/accommodations', protectedAccommodationRoutes);
    app.route('/api/v1/protected/gastronomies', protectedGastronomyRoutes);
    app.route('/api/v1/protected/experiences', protectedExperienceRoutes);
    app.route('/api/v1/protected/billing-subscription', protectedBillingSubscriptionReadRoutes);
    return app;
}

async function probe(options: {
    readonly actorId: string;
    readonly emailVerified: boolean;
    readonly permissions: PermissionEnum[];
    readonly path: string;
    readonly method?: 'GET' | 'POST';
}) {
    const response = await buildApp(options).request(options.path, {
        method: options.method ?? (options.path.includes('/reactivate') ? 'POST' : 'GET')
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    delete body.metadata;
    return { status: response.status, body };
}

function setPorts(ownerId: string, publicationStatus = PublicationStatusEnum.DRAFT) {
    mocks.loadFacts.mockResolvedValue({
        facts: { ownerId, publicationStatus },
        ownerId
    });
    mocks.coverage.mockResolvedValue({ covered: false, sources: [] });
    mocks.effectiveSet.mockResolvedValue({ entitlements: { get: () => 0 } });
}

function listing(ownerId: string, publicationStatus = PublicationStatusEnum.DRAFT) {
    return { id: LISTING_ID, ownerId, publicationStatus };
}

function expectNotEmailNotVerified(result: Awaited<ReturnType<typeof probe>>) {
    expect((result.body.error as { code?: string } | undefined)?.code).not.toBe(
        'EMAIL_NOT_VERIFIED'
    );
}

beforeAll(() => registerEntityFetchers());
afterAll(() => clearEntityFetchers());
afterEach(() => {
    vi.restoreAllMocks();
    mocks.readSubscription.mockReset();
    mocks.loadFacts.mockReset();
    mocks.coverage.mockReset();
    mocks.effectiveSet.mockReset();
});

describe('TEST:V5:3 TEST:1692:5 an unverified actor uses no staff bypass on the closed-list routes', () => {
    describe('K1 USER_READ_ALL bypass in Mi Cuenta', () => {
        it('unverified with and without the permission gets the same 404 without a service read', async () => {
            const spy = vi.spyOn(UserService.prototype, 'getById');
            const without = await probe({
                actorId: OTHER_ID,
                emailVerified: false,
                permissions: [],
                path: `/api/v1/protected/users/${OWNER_ID}`
            });
            const withPermission = await probe({
                actorId: OTHER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.USER_READ_ALL],
                path: `/api/v1/protected/users/${OWNER_ID}`
            });
            expect(withPermission).toEqual(without);
            expect(without.status).toBe(404);
            expect(spy).not.toHaveBeenCalled();
        });

        it('verified with the permission can read the other profile', async () => {
            const profile = UserSchema.parse({
                id: OWNER_ID,
                slug: 'owner',
                firstName: 'Owner',
                email: 'owner@example.test',
                createdAt: new Date('2026-01-01T00:00:00Z'),
                updatedAt: new Date('2026-01-01T00:00:00Z'),
                createdById: null,
                updatedById: null
            });
            const spy = vi
                .spyOn(UserService.prototype, 'getById')
                .mockImplementation(
                    async (_actor, id) => ({ data: { ...profile, id: id as string } }) as never
                );
            const path = `/api/v1/protected/users/${OWNER_ID}`;
            const without = await probe({
                actorId: OTHER_ID,
                emailVerified: false,
                permissions: [],
                path
            });
            const result = await probe({
                actorId: OTHER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.USER_READ_ALL],
                path
            });
            expect(result).not.toEqual(without);
            expect(result.status).toBe(200);
            expect(spy).toHaveBeenCalledWith(expect.anything(), OWNER_ID);
        });

        it('an unverified owner with the permission can still read their own profile', async () => {
            const profile = UserSchema.parse({
                id: OWNER_ID,
                slug: 'owner',
                firstName: 'Owner',
                email: 'owner@example.test',
                createdAt: new Date('2026-01-01T00:00:00Z'),
                updatedAt: new Date('2026-01-01T00:00:00Z'),
                createdById: null,
                updatedById: null
            });
            vi.spyOn(UserService.prototype, 'getById').mockResolvedValue({
                data: profile
            } as never);
            const unverified = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.USER_READ_ALL],
                path: `/api/v1/protected/users/${OWNER_ID}`
            });
            const verified = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.USER_READ_ALL],
                path: `/api/v1/protected/users/${OWNER_ID}`
            });
            expect(unverified).toEqual(verified);
            expect(unverified.status).toBe(200);
        });
    });

    describe('K2 ACCOMMODATION_UPDATE_ANY bypass in accommodation detail', () => {
        it('unverified with and without the permission gets the same 404', async () => {
            const spy = vi
                .spyOn(AccommodationService.prototype, 'getById')
                .mockResolvedValue({ data: listing(OTHER_ID) } as never);
            const path = `/api/v1/protected/accommodations/${LISTING_ID}`;
            const without = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [],
                path
            });
            const withPermission = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
                path
            });
            expect(withPermission).toEqual(without);
            expect(without.status).toBe(404);
            expect(spy).toHaveBeenCalled();
        });

        it('verified with the permission differs from the unverified refusal', async () => {
            setPorts(OTHER_ID);
            vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: listing(OTHER_ID)
            } as never);
            const path = `/api/v1/protected/accommodations/${LISTING_ID}`;
            const without = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [],
                path
            });
            const result = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
                path
            });
            expect(result).not.toEqual(without);
        });

        it('an unverified owner with the permission has the same non-email result as a verified owner', async () => {
            setPorts(OWNER_ID);
            vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: listing(OWNER_ID)
            } as never);
            const path = `/api/v1/protected/accommodations/${LISTING_ID}`;
            const unverified = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
                path
            });
            const verified = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
                path
            });
            expect(unverified).toEqual(verified);
            expectNotEmailNotVerified(unverified);
        });
    });

    describe('K3 GASTRONOMY_VIEW_ALL bypass in gastronomy detail', () => {
        it('unverified with and without the permission gets the same 404', async () => {
            const getById = vi
                .spyOn(GastronomyService.prototype, 'getById')
                .mockResolvedValue({ data: listing(OTHER_ID) } as never);
            vi.spyOn(GastronomyService.prototype, 'loadJunctionIds').mockResolvedValue({
                amenityIds: [],
                featureIds: []
            } as never);
            const path = `/api/v1/protected/gastronomies/${LISTING_ID}`;
            const without = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [],
                path
            });
            const withPermission = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.GASTRONOMY_VIEW_ALL],
                path
            });
            expect(withPermission).toEqual(without);
            expect(without.status).toBe(404);
            expect(getById).toHaveBeenCalled();
        });

        it('verified with the permission differs from the unverified refusal', async () => {
            vi.spyOn(GastronomyService.prototype, 'getById').mockResolvedValue({
                data: listing(OTHER_ID)
            } as never);
            vi.spyOn(GastronomyService.prototype, 'loadJunctionIds').mockResolvedValue({
                amenityIds: [],
                featureIds: []
            } as never);
            const path = `/api/v1/protected/gastronomies/${LISTING_ID}`;
            const without = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [],
                path
            });
            const result = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.GASTRONOMY_VIEW_ALL],
                path
            });
            expect(result).not.toEqual(without);
        });

        it('an unverified owner with the permission has the same non-email result as a verified owner', async () => {
            vi.spyOn(GastronomyService.prototype, 'getById').mockResolvedValue({
                data: listing(OWNER_ID)
            } as never);
            vi.spyOn(GastronomyService.prototype, 'loadJunctionIds').mockResolvedValue({
                amenityIds: [],
                featureIds: []
            } as never);
            const path = `/api/v1/protected/gastronomies/${LISTING_ID}`;
            const unverified = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.GASTRONOMY_VIEW_ALL],
                path
            });
            const verified = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.GASTRONOMY_VIEW_ALL],
                path
            });
            expect(unverified).toEqual(verified);
            expectNotEmailNotVerified(unverified);
        });
    });

    describe('K4 EXPERIENCE_VIEW_ALL bypass in experience detail', () => {
        it('unverified with and without the permission gets the same 404', async () => {
            const getById = vi
                .spyOn(ExperienceService.prototype, 'getById')
                .mockResolvedValue({ data: listing(OTHER_ID) } as never);
            vi.spyOn(ExperienceService.prototype, 'loadJunctionIds').mockResolvedValue({
                amenityIds: [],
                featureIds: []
            } as never);
            const path = `/api/v1/protected/experiences/${LISTING_ID}`;
            const without = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [],
                path
            });
            const withPermission = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.EXPERIENCE_VIEW_ALL],
                path
            });
            expect(withPermission).toEqual(without);
            expect(without.status).toBe(404);
            expect(getById).toHaveBeenCalled();
        });

        it('verified with the permission differs from the unverified refusal', async () => {
            vi.spyOn(ExperienceService.prototype, 'getById').mockResolvedValue({
                data: listing(OTHER_ID)
            } as never);
            vi.spyOn(ExperienceService.prototype, 'loadJunctionIds').mockResolvedValue({
                amenityIds: [],
                featureIds: []
            } as never);
            const path = `/api/v1/protected/experiences/${LISTING_ID}`;
            const without = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [],
                path
            });
            const result = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.EXPERIENCE_VIEW_ALL],
                path
            });
            expect(result).not.toEqual(without);
        });

        it('an unverified owner with the permission has the same non-email result as a verified owner', async () => {
            vi.spyOn(ExperienceService.prototype, 'getById').mockResolvedValue({
                data: listing(OWNER_ID)
            } as never);
            vi.spyOn(ExperienceService.prototype, 'loadJunctionIds').mockResolvedValue({
                amenityIds: [],
                featureIds: []
            } as never);
            const path = `/api/v1/protected/experiences/${LISTING_ID}`;
            const unverified = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.EXPERIENCE_VIEW_ALL],
                path
            });
            const verified = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.EXPERIENCE_VIEW_ALL],
                path
            });
            expect(unverified).toEqual(verified);
            expectNotEmailNotVerified(unverified);
        });
    });

    describe('K5 LISTING_FOREIGN_CONTENT_EDIT bypass in accommodation ownership', () => {
        it('unverified with and without the permission gets the same 404', async () => {
            const getById = vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: listing(OTHER_ID, PublicationStatusEnum.ARCHIVED)
            } as never);
            setPorts(OTHER_ID, PublicationStatusEnum.ARCHIVED);
            const path = `/api/v1/protected/accommodations/${LISTING_ID}/reactivate`;
            const without = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [],
                path
            });
            const withPermission = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path
            });
            expect(withPermission).toEqual(without);
            expect(without.status).toBe(404);
            expect(getById).toHaveBeenCalled();
        });

        it('verified with the permission reaches the action and gets FORBIDDEN', async () => {
            setPorts(OTHER_ID, PublicationStatusEnum.ARCHIVED);
            vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: listing(OTHER_ID, PublicationStatusEnum.ARCHIVED)
            } as never);
            const result = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path: `/api/v1/protected/accommodations/${LISTING_ID}/reactivate`
            });
            expect(result.status, JSON.stringify(result)).toBe(403);
            expect((result.body.error as { code: string }).code).toBe('FORBIDDEN');
        });

        it('an unverified owner with the permission has the same non-email result as a verified owner', async () => {
            setPorts(OWNER_ID, PublicationStatusEnum.ARCHIVED);
            vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: listing(OWNER_ID, PublicationStatusEnum.ARCHIVED)
            } as never);
            const path = `/api/v1/protected/accommodations/${LISTING_ID}/reactivate`;
            const unverified = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path
            });
            const verified = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path
            });
            expect(unverified).toEqual(verified);
            expectNotEmailNotVerified(unverified);
        });
    });

    describe('K6 LISTING_FOREIGN_CONTENT_EDIT bypass in gastronomy action 15', () => {
        it('unverified with and without the permission gets the same 404', async () => {
            setPorts(OTHER_ID, PublicationStatusEnum.ARCHIVED);
            const path = `/api/v1/protected/gastronomies/${LISTING_ID}/reactivate`;
            const without = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [],
                path
            });
            const withPermission = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path
            });
            expect(withPermission).toEqual(without);
            expect(without.status).toBe(404);
        });

        it('verified with the permission reaches the action and gets FORBIDDEN', async () => {
            setPorts(OTHER_ID, PublicationStatusEnum.ARCHIVED);
            const result = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path: `/api/v1/protected/gastronomies/${LISTING_ID}/reactivate`
            });
            expect(result.status, JSON.stringify(result)).toBe(403);
            expect((result.body.error as { code: string }).code).toBe('FORBIDDEN');
        });

        it('an unverified owner with the permission has the same non-email result as a verified owner', async () => {
            setPorts(OWNER_ID, PublicationStatusEnum.ARCHIVED);
            vi.spyOn(GastronomyService.prototype, 'getById').mockResolvedValue({
                data: listing(OWNER_ID, PublicationStatusEnum.ARCHIVED)
            } as never);
            const path = `/api/v1/protected/gastronomies/${LISTING_ID}/reactivate`;
            const unverified = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path
            });
            const verified = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path
            });
            expect(unverified).toEqual(verified);
            expectNotEmailNotVerified(unverified);
        });
    });

    describe('K7 LISTING_FOREIGN_CONTENT_EDIT bypass in experience action 15', () => {
        it('unverified with and without the permission gets the same 404', async () => {
            setPorts(OTHER_ID, PublicationStatusEnum.ARCHIVED);
            const path = `/api/v1/protected/experiences/${LISTING_ID}/reactivate`;
            const without = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [],
                path
            });
            const withPermission = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path
            });
            expect(withPermission).toEqual(without);
            expect(without.status).toBe(404);
        });

        it('verified with the permission reaches the action and gets FORBIDDEN', async () => {
            setPorts(OTHER_ID, PublicationStatusEnum.ARCHIVED);
            const result = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path: `/api/v1/protected/experiences/${LISTING_ID}/reactivate`
            });
            expect(result.status, JSON.stringify(result)).toBe(403);
            expect((result.body.error as { code: string }).code).toBe('FORBIDDEN');
        });

        it('an unverified owner with the permission has the same non-email result as a verified owner', async () => {
            setPorts(OWNER_ID, PublicationStatusEnum.ARCHIVED);
            vi.spyOn(ExperienceService.prototype, 'getById').mockResolvedValue({
                data: listing(OWNER_ID, PublicationStatusEnum.ARCHIVED)
            } as never);
            const path = `/api/v1/protected/experiences/${LISTING_ID}/reactivate`;
            const unverified = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path
            });
            const verified = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path
            });
            expect(unverified).toEqual(verified);
            expectNotEmailNotVerified(unverified);
        });
    });

    describe('K8 BILLING_VIEW_OWN stays available on an own subscription read', () => {
        it('allows an unverified owner with the own permission and every staff bypass permission', async () => {
            mocks.readSubscription.mockResolvedValue({
                row: {
                    id: SUBSCRIPTION_ID,
                    userId: OWNER_ID,
                    vertical: 'accommodation',
                    status: 'ACTIVE',
                    class: 'PRINCIPAL',
                    paymentMethod: 'CARD',
                    nextChargeAt: null,
                    serviceEndsAt: null,
                    createdAt: new Date('2026-10-01T00:00:00.000Z')
                },
                subjectId: OWNER_ID
            });
            const result = await probe({
                actorId: OWNER_ID,
                emailVerified: false,
                permissions: [
                    PermissionEnum.BILLING_VIEW_OWN,
                    PermissionEnum.USER_READ_ALL,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY,
                    PermissionEnum.ACCOMMODATION_VIEW_ALL,
                    PermissionEnum.GASTRONOMY_VIEW_ALL,
                    PermissionEnum.EXPERIENCE_VIEW_ALL,
                    PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
                    PermissionEnum.LISTING_PURGE_ON_REQUEST
                ],
                path: `/api/v1/protected/billing-subscription/${SUBSCRIPTION_ID}`
            });
            expect(result.status).toBe(200);
            expect(mocks.readSubscription).toHaveBeenCalledWith(SUBSCRIPTION_ID);
        });
    });
});
