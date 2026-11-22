/**
 * Unit tests for `OwnerListingDashboardService` (HOS-2475 / HOS-2476).
 *
 * The properties that matter: counts follow `publicationStatus`; a locked plan
 * never touches the view service and carries no `traffic` key; a failed view
 * read is `unavailable`, never a zero; a failed listings read is an error, never
 * zero counts; and both reads receive the caller's actor and nothing else.
 */
import {
    EntityTypeEnum,
    PermissionEnum,
    PublicationStatusEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { OwnerListingDashboardService } from '../../../src/services/owner-dashboard/owner-listing-dashboard.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const OWNER = createActor({
    id: getMockId('user', 'od-owner'),
    permissions: [PermissionEnum.VENUE_EDIT_OWN, PermissionEnum.EXPERIENCE_EDIT_OWN]
});

const listing = (publicationStatus: PublicationStatusEnum) => ({ publicationStatus });
const MIXED = [
    listing(PublicationStatusEnum.PUBLISHED),
    listing(PublicationStatusEnum.PUBLISHED),
    listing(PublicationStatusEnum.DRAFT),
    listing(PublicationStatusEnum.ARCHIVED),
    listing(PublicationStatusEnum.UNPUBLISHED_BY_BILLING)
];

const make = (overrides: {
    venue?: ReturnType<typeof vi.fn>;
    experience?: ReturnType<typeof vi.fn>;
    views?: ReturnType<typeof vi.fn>;
}) => {
    const venueList = overrides.venue ?? vi.fn().mockResolvedValue({ data: { listings: MIXED } });
    const experienceList =
        overrides.experience ?? vi.fn().mockResolvedValue({ data: { listings: [] } });
    const views = overrides.views ?? vi.fn().mockResolvedValue({ data: [] });
    const service = new OwnerListingDashboardService({
        logger: createLoggerMock(),
        venueService: { listOwn: venueList },
        experienceService: { listOwn: experienceList },
        entityViewService: { getStatsForOwnListings: views }
    });
    return { service, venueList, experienceList, views };
};

describe('OwnerListingDashboardService.getForOwner', () => {
    it.each([
        ['venue', PermissionEnum.EXPERIENCE_EDIT_OWN],
        ['experience', PermissionEnum.VENUE_EDIT_OWN]
    ] as const)('answers FORBIDDEN for %s without its permission and reads nothing', async (vertical, other) => {
        // Arrange: the actor holds only the other vertical's permission.
        const { service, venueList, experienceList, views } = make({});
        const actor = createActor({ id: getMockId('user', 'od-other'), permissions: [other] });
        // Act
        const out = await service.getForOwner(actor, {
            vertical,
            window: '30d',
            canViewTraffic: async () => true
        });
        // Assert
        expect(out.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(venueList).not.toHaveBeenCalled();
        expect(experienceList).not.toHaveBeenCalled();
        expect(views).not.toHaveBeenCalled();
    });

    it('counts listings by publication state, total includes every state', async () => {
        // Arrange
        const { service } = make({});
        // Act
        const out = await service.getForOwner(OWNER, {
            vertical: 'venue',
            window: '30d',
            canViewTraffic: async () => false
        });
        // Assert
        expect(out.data?.listings).toEqual({ total: 5, published: 2, draft: 1, archived: 1 });
    });

    it('is locked without traffic key and never calls the view service', async () => {
        const { service, views } = make({});
        const out = await service.getForOwner(OWNER, {
            vertical: 'venue',
            window: '7d',
            canViewTraffic: async () => false
        });
        expect(out.data?.trafficAccess).toBe('locked');
        expect(out.data).not.toHaveProperty('traffic');
        expect(views).not.toHaveBeenCalled();
    });

    it('is locked when the entitlement probe throws', async () => {
        const { service, views } = make({});
        const out = await service.getForOwner(OWNER, {
            vertical: 'venue',
            window: '7d',
            canViewTraffic: async () => {
                throw new Error('boom');
            }
        });
        expect(out.data?.trafficAccess).toBe('locked');
        expect(views).not.toHaveBeenCalled();
    });

    it('sums unique and total over the listings when granted', async () => {
        const views = vi.fn().mockResolvedValue({
            data: [
                { entityId: 'a', unique: 2, total: 5 },
                { entityId: 'b', unique: 1, total: 3 }
            ]
        });
        const { service } = make({ views });
        const out = await service.getForOwner(OWNER, {
            vertical: 'venue',
            window: '7d',
            canViewTraffic: async () => true
        });
        expect(out.data).toMatchObject({
            trafficAccess: 'granted',
            traffic: { windowDays: 7, unique: 3, total: 8 }
        });
        expect(views).toHaveBeenCalledWith({
            actor: OWNER,
            entityType: EntityTypeEnum.VENUE,
            window: '7d'
        });
    });

    it('gives a granted owner with no listings an honest zero', async () => {
        const { service } = make({
            experience: vi.fn().mockResolvedValue({ data: { listings: [] } }),
            views: vi.fn().mockResolvedValue({ data: [] })
        });
        const out = await service.getForOwner(OWNER, {
            vertical: 'experience',
            window: '30d',
            canViewTraffic: async () => true
        });
        expect(out.data).toMatchObject({
            listings: { total: 0, published: 0, draft: 0, archived: 0 },
            trafficAccess: 'granted',
            traffic: { windowDays: 30, unique: 0, total: 0 }
        });
    });

    it.each([
        ['an error result', vi.fn().mockResolvedValue({ error: { code: 'X', message: 'm' } })],
        ['a throw', vi.fn().mockRejectedValue(new Error('db down'))]
    ])('is unavailable without traffic when the view read is %s', async (_n, views) => {
        const { service } = make({ views });
        const out = await service.getForOwner(OWNER, {
            vertical: 'venue',
            window: '30d',
            canViewTraffic: async () => true
        });
        expect(out.data?.trafficAccess).toBe('unavailable');
        expect(out.data).not.toHaveProperty('traffic');
        expect(out.data?.listings.total).toBe(5);
    });

    it('returns a service error, never zero counts, when the listings read fails', async () => {
        const venue = vi
            .fn()
            .mockResolvedValue({ error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'x' } });
        const { service, views } = make({ venue });
        const out = await service.getForOwner(OWNER, {
            vertical: 'venue',
            window: '30d',
            canViewTraffic: async () => true
        });
        expect(out.data).toBeUndefined();
        expect(out.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(views).not.toHaveBeenCalled();
    });

    it('turns a throwing listings read into INTERNAL_ERROR', async () => {
        const { service } = make({ venue: vi.fn().mockRejectedValue(new Error('boom')) });
        const out = await service.getForOwner(OWNER, {
            vertical: 'venue',
            window: '30d',
            canViewTraffic: async () => true
        });
        expect(out.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('scopes both reads to the caller actor, picks the vertical reader, and takes no other id', async () => {
        const { service, venueList, experienceList, views } = make({});
        await service.getForOwner(OWNER, {
            vertical: 'experience',
            window: '30d',
            canViewTraffic: async () => true
        });
        expect(venueList).not.toHaveBeenCalled();
        expect(experienceList).toHaveBeenCalledExactlyOnceWith(OWNER);
        expect(views).toHaveBeenCalledWith(
            expect.objectContaining({ actor: OWNER, entityType: EntityTypeEnum.EXPERIENCE })
        );
    });
});
