import { PermissionEnum, UserSchema } from '@repo/schemas';
import {
    AccommodationService,
    ExperienceService,
    GastronomyService,
    UserService
} from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    clearTestEntityFetchers,
    expectNotEmailNotVerified,
    LISTING_ID,
    listing,
    OTHER_ID,
    OWNER_ID,
    probe,
    registerTestEntityFetchers,
    setPorts
} from './email-unverified-staff-bypass.helpers';

const listingMocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn()
}));

vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: listingMocks.loadFacts,
        billing: { coverage: listingMocks.coverage },
        effectiveSet: listingMocks.effectiveSet
    })
}));

const billingMocks = vi.hoisted(() => ({
    readSubscription: vi.fn()
}));

vi.mock('../../src/routes/billing-subscription/read-subscription', () => ({
    readSubscription: billingMocks.readSubscription
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>())
}));

const SUBSCRIPTION_ID = '44444444-4444-4444-8444-444444444444';

beforeAll(() => registerTestEntityFetchers({}));
afterAll(() => clearTestEntityFetchers({}));
afterEach(() => {
    vi.restoreAllMocks();
    billingMocks.readSubscription.mockReset();
    listingMocks.loadFacts.mockReset();
    listingMocks.coverage.mockReset();
    listingMocks.effectiveSet.mockReset();
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
                .mockResolvedValue({ data: listing({ ownerId: OTHER_ID }) } as never);
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
            setPorts({ ownerId: OTHER_ID, ports: listingMocks });
            vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: listing({ ownerId: OTHER_ID })
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
            setPorts({ ownerId: OWNER_ID, ports: listingMocks });
            vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: listing({ ownerId: OWNER_ID })
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
            expectNotEmailNotVerified({ result: unverified });
        });
    });

    describe('K3 GASTRONOMY_VIEW_ALL bypass in gastronomy detail', () => {
        it('unverified with and without the permission gets the same 404', async () => {
            const getById = vi
                .spyOn(GastronomyService.prototype, 'getById')
                .mockResolvedValue({ data: listing({ ownerId: OTHER_ID }) } as never);
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
                data: listing({ ownerId: OTHER_ID })
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
                data: listing({ ownerId: OWNER_ID })
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
            expectNotEmailNotVerified({ result: unverified });
        });
    });

    describe('K4 EXPERIENCE_VIEW_ALL bypass in experience detail', () => {
        it('unverified with and without the permission gets the same 404', async () => {
            const getById = vi
                .spyOn(ExperienceService.prototype, 'getById')
                .mockResolvedValue({ data: listing({ ownerId: OTHER_ID }) } as never);
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
                data: listing({ ownerId: OTHER_ID })
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
                data: listing({ ownerId: OWNER_ID })
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
            expectNotEmailNotVerified({ result: unverified });
        });
    });

    describe('K8 BILLING_VIEW_OWN stays available on an own subscription read', () => {
        it('allows an unverified owner with the own permission and every staff bypass permission', async () => {
            billingMocks.readSubscription.mockResolvedValue({
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
            expect(billingMocks.readSubscription).toHaveBeenCalledWith(SUBSCRIPTION_ID);
        });
    });
});
