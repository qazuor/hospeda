/**
 * Unit tests for `OwnerListingDashboardService` (HOS-2475 / HOS-2476).
 *
 * The properties that matter: counts come from COUNT queries scoped to the
 * caller (no 100-row cap); a locked plan never touches the view service and
 * carries no `traffic` key; a failed entitlement read or view read is
 * `unavailable`, never `locked` and never a zero; a failed count is an error,
 * never zero counts; the permission is checked before any read.
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
const OTHER_ID = getMockId('user', 'od-other-owner');

type Row = { ownerId: string; publicationStatus: PublicationStatusEnum };
const rows = (ownerId: string, status: PublicationStatusEnum, n: number): Row[] =>
    Array.from({ length: n }, () => ({ ownerId, publicationStatus: status }));

/** A fake model whose `count` applies the equality filter to an in-memory table. */
const fakeModel = (table: readonly Row[]) =>
    vi.fn(
        async (where: Record<string, unknown>) =>
            table.filter((row) =>
                Object.entries(where).every(([key, value]) =>
                    key === 'deletedAt' ? value === null : row[key as keyof Row] === value
                )
            ).length
    );

const MIXED: Row[] = [
    ...rows(OWNER.id, PublicationStatusEnum.PUBLISHED, 2),
    ...rows(OWNER.id, PublicationStatusEnum.DRAFT, 1),
    ...rows(OWNER.id, PublicationStatusEnum.ARCHIVED, 1),
    ...rows(OWNER.id, PublicationStatusEnum.UNPUBLISHED_BY_BILLING, 1),
    ...rows(OTHER_ID, PublicationStatusEnum.PUBLISHED, 7)
];

const make = (overrides: {
    venue?: ReturnType<typeof vi.fn>;
    experience?: ReturnType<typeof vi.fn>;
    views?: ReturnType<typeof vi.fn>;
}) => {
    const venueCount = overrides.venue ?? fakeModel(MIXED);
    const experienceCount = overrides.experience ?? fakeModel([]);
    const views = overrides.views ?? vi.fn().mockResolvedValue({ data: [] });
    const service = new OwnerListingDashboardService({
        logger: createLoggerMock(),
        venueModel: { count: venueCount },
        experienceModel: { count: experienceCount },
        entityViewService: { getStatsForOwnListings: views }
    });
    return { service, venueCount, experienceCount, views };
};

const run = (
    service: OwnerListingDashboardService,
    canViewTraffic: () => Promise<boolean>,
    vertical: 'venue' | 'experience' = 'venue',
    window: '7d' | '30d' = '30d'
) => service.getForOwner(OWNER, { vertical, window, canViewTraffic });

describe('OwnerListingDashboardService.getForOwner', () => {
    it.each([
        ['venue', PermissionEnum.EXPERIENCE_EDIT_OWN],
        ['experience', PermissionEnum.VENUE_EDIT_OWN]
    ] as const)('answers FORBIDDEN for %s without its permission and reads nothing', async (vertical, other) => {
        const { service, venueCount, experienceCount, views } = make({});
        const actor = createActor({ id: getMockId('user', 'od-other'), permissions: [other] });
        const out = await service.getForOwner(actor, {
            vertical,
            window: '30d',
            canViewTraffic: async () => true
        });
        expect(out.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(venueCount).not.toHaveBeenCalled();
        expect(experienceCount).not.toHaveBeenCalled();
        expect(views).not.toHaveBeenCalled();
    });

    it("counts the caller's listings by publication state; total includes every state", async () => {
        const { service } = make({});
        const out = await run(service, async () => false);
        expect(out.data?.listings).toEqual({ total: 5, published: 2, draft: 1, archived: 1 });
    });

    it('has no 100-row cap: an owner with 150 listings gets 150', async () => {
        // Arrange
        const big = [
            ...rows(OWNER.id, PublicationStatusEnum.PUBLISHED, 120),
            ...rows(OWNER.id, PublicationStatusEnum.DRAFT, 30)
        ];
        const { service } = make({ venue: fakeModel(big) });
        // Act
        const out = await run(service, async () => false);
        // Assert
        expect(out.data?.listings).toEqual({ total: 150, published: 120, draft: 30, archived: 0 });
    });

    it('scopes every count to the caller and never fetches rows', async () => {
        const { service, venueCount, experienceCount } = make({});
        await run(service, async () => false);
        expect(experienceCount).not.toHaveBeenCalled();
        expect(venueCount).toHaveBeenCalledTimes(4);
        for (const [where] of venueCount.mock.calls) {
            expect(where).toMatchObject({ ownerId: OWNER.id, deletedAt: null });
        }
    });

    it('is locked without traffic key and never calls the view service', async () => {
        const { service, views } = make({});
        const out = await run(service, async () => false, 'venue', '7d');
        expect(out.data?.trafficAccess).toBe('locked');
        expect(out.data).not.toHaveProperty('traffic');
        expect(views).not.toHaveBeenCalled();
    });

    it('is UNAVAILABLE, not locked, when the entitlement read fails', async () => {
        const { service, views } = make({});
        const out = await run(service, async () => {
            throw new Error('effective set down');
        });
        expect(out.data?.trafficAccess).toBe('unavailable');
        expect(out.data).not.toHaveProperty('traffic');
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
        const out = await run(service, async () => true, 'venue', '7d');
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
        const { service } = make({});
        const out = await run(service, async () => true, 'experience');
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
        const out = await run(service, async () => true);
        expect(out.data?.trafficAccess).toBe('unavailable');
        expect(out.data).not.toHaveProperty('traffic');
        expect(out.data?.listings.total).toBe(5);
    });

    it('returns INTERNAL_ERROR, never zero counts, when a count fails', async () => {
        const { service, views } = make({ venue: vi.fn().mockRejectedValue(new Error('boom')) });
        const out = await run(service, async () => true);
        expect(out.data).toBeUndefined();
        expect(out.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(views).not.toHaveBeenCalled();
    });
});
