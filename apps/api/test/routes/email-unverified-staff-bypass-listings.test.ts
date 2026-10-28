import { PermissionEnum, PublicationStatusEnum } from '@repo/schemas';
import { AccommodationService, ExperienceService, VenueService } from '@repo/service-core';
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

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>())
}));

beforeAll(() => registerTestEntityFetchers({}));
afterAll(() => clearTestEntityFetchers({}));
afterEach(() => {
    vi.restoreAllMocks();
    listingMocks.loadFacts.mockReset();
    listingMocks.coverage.mockReset();
    listingMocks.effectiveSet.mockReset();
});

describe('TEST:V5:3 TEST:1692:5 an unverified actor uses no staff bypass on the closed-list routes', () => {
    describe('K5 LISTING_FOREIGN_CONTENT_EDIT bypass in accommodation ownership', () => {
        it('unverified with and without the permission gets the same 404', async () => {
            const getById = vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: listing({
                    ownerId: OTHER_ID,
                    publicationStatus: PublicationStatusEnum.ARCHIVED
                })
            } as never);
            setPorts({
                ownerId: OTHER_ID,
                publicationStatus: PublicationStatusEnum.ARCHIVED,
                ports: listingMocks
            });
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
            setPorts({
                ownerId: OTHER_ID,
                publicationStatus: PublicationStatusEnum.ARCHIVED,
                ports: listingMocks
            });
            vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: listing({
                    ownerId: OTHER_ID,
                    publicationStatus: PublicationStatusEnum.ARCHIVED
                })
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
            setPorts({
                ownerId: OWNER_ID,
                publicationStatus: PublicationStatusEnum.ARCHIVED,
                ports: listingMocks
            });
            vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: listing({
                    ownerId: OWNER_ID,
                    publicationStatus: PublicationStatusEnum.ARCHIVED
                })
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
            expectNotEmailNotVerified({ result: unverified });
        });
    });

    describe('K6 LISTING_FOREIGN_CONTENT_EDIT bypass in venue action 15', () => {
        it('unverified with and without the permission gets the same 404', async () => {
            setPorts({
                ownerId: OTHER_ID,
                publicationStatus: PublicationStatusEnum.ARCHIVED,
                ports: listingMocks
            });
            const path = `/api/v1/protected/venues/${LISTING_ID}/reactivate`;
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
            setPorts({
                ownerId: OTHER_ID,
                publicationStatus: PublicationStatusEnum.ARCHIVED,
                ports: listingMocks
            });
            const result = await probe({
                actorId: OWNER_ID,
                emailVerified: true,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                path: `/api/v1/protected/venues/${LISTING_ID}/reactivate`
            });
            expect(result.status, JSON.stringify(result)).toBe(403);
            expect((result.body.error as { code: string }).code).toBe('FORBIDDEN');
        });

        it('an unverified owner with the permission has the same non-email result as a verified owner', async () => {
            setPorts({
                ownerId: OWNER_ID,
                publicationStatus: PublicationStatusEnum.ARCHIVED,
                ports: listingMocks
            });
            vi.spyOn(VenueService.prototype, 'getById').mockResolvedValue({
                data: listing({
                    ownerId: OWNER_ID,
                    publicationStatus: PublicationStatusEnum.ARCHIVED
                })
            } as never);
            const path = `/api/v1/protected/venues/${LISTING_ID}/reactivate`;
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
            expectNotEmailNotVerified({ result: unverified });
        });
    });

    describe('K7 LISTING_FOREIGN_CONTENT_EDIT bypass in experience action 15', () => {
        it('unverified with and without the permission gets the same 404', async () => {
            setPorts({
                ownerId: OTHER_ID,
                publicationStatus: PublicationStatusEnum.ARCHIVED,
                ports: listingMocks
            });
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
            setPorts({
                ownerId: OTHER_ID,
                publicationStatus: PublicationStatusEnum.ARCHIVED,
                ports: listingMocks
            });
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
            setPorts({
                ownerId: OWNER_ID,
                publicationStatus: PublicationStatusEnum.ARCHIVED,
                ports: listingMocks
            });
            vi.spyOn(ExperienceService.prototype, 'getById').mockResolvedValue({
                data: listing({
                    ownerId: OWNER_ID,
                    publicationStatus: PublicationStatusEnum.ARCHIVED
                })
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
            expectNotEmailNotVerified({ result: unverified });
        });
    });
});
