/**
 * Shared fixtures of the `get_owner_summary` tests (HOS-2331): ids, a world of
 * listings per owner, the spies the `vi.mock` factories point at, and the
 * service-core spies. Each test file keeps its own `vi.mock` calls (vitest
 * hoists them per file) and points them at {@link mocks}.
 *
 * The services are spied on their prototypes (or the `entityViewService`
 * singleton), and every one of them answers ONLY for the actor it is called
 * with, like the real services scope to `actor.id`. So a summary that showed
 * another owner's data could only do so by asking for it.
 *
 * @module test/mcp/tools/summary/owner-summary.harness
 */

import { PublicationStatusEnum, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    ConversationService,
    ExperienceService,
    entityViewService,
    HostTradeService,
    HostTradeUsageService,
    ServiceError,
    VenueService
} from '@repo/service-core';
import { type MockInstance, vi } from 'vitest';

/** The spies every test file hands to its `vi.mock` factories. */
export const mocks = {
    enforceGate: vi.fn(),
    effectiveKeys: vi.fn(),
    ownerReviews: vi.fn(),
    favorites: vi.fn(),
    fixRequests: vi.fn(),
    completeness: vi.fn()
};

export const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
export const OTHER_ID = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
export const TRADE_ID = 't1111111-1111-4111-8111-111111111111';
export const context = { channel: 'mcp' } as const;

export const actorFor = (id: string = OWNER_ID): Actor =>
    ({ id, roles: ['HOST'], permissions: [], emailVerified: true }) as unknown as Actor;

type Vertical = (typeof VerticalEnum)['ACCOMMODATION' | 'VENUE' | 'EXPERIENCE'];

/** A stored listing of the world. */
export interface WorldListing {
    readonly id: string;
    readonly ownerId: string;
    readonly vertical: Vertical;
    readonly name: string;
    readonly publicationStatus: PublicationStatusEnum;
}

/** Everything the services answer, per owner. */
export interface World {
    readonly listings: WorldListing[];
    /** Verticals whose plan lacks `view_basic_stats`, per owner. */
    readonly noBasicStats: Map<string, Set<Vertical>>;
    /** Owners whose plan has `view_advanced_stats`. */
    readonly advancedStats: Set<string>;
    readonly unread: Map<string, number>;
    readonly hostPending: Map<string, number>;
    /** Owner → provider pending count, for owners with a directory listing. */
    readonly providerPending: Map<string, number>;
    /** When set, `getHostResponseRate` answers FORBIDDEN. */
    inquiriesForbidden: boolean;
}

/** A fresh, empty world. */
export function emptyWorld(): World {
    return {
        listings: [],
        noBasicStats: new Map(),
        advancedStats: new Set(),
        unread: new Map(),
        hostPending: new Map(),
        providerPending: new Map(),
        inquiriesForbidden: false
    };
}

let sequence = 0;

/** Adds a listing to the world and returns it. */
export function addListing(
    world: World,
    input: {
        readonly vertical: Vertical;
        readonly status?: PublicationStatusEnum;
        readonly ownerId?: string;
        readonly name?: string;
    }
): WorldListing {
    sequence += 1;
    const listing: WorldListing = {
        id: `${String(sequence).padStart(8, '0')}-0000-4000-8000-000000000000`,
        ownerId: input.ownerId ?? OWNER_ID,
        vertical: input.vertical,
        name: input.name ?? `Publicación ${sequence}`,
        publicationStatus: input.status ?? PublicationStatusEnum.PUBLISHED
    };
    world.listings.push(listing);
    return listing;
}

/** The owner's listings of one vertical. */
const own = (world: World, actor: Actor, vertical: Vertical): WorldListing[] =>
    world.listings.filter((l) => l.ownerId === actor.id && l.vertical === vertical);

type Spy = MockInstance;

/** Points every service the tool reads at the world; returns every spy. */
export function arrangeWorld(world: World): readonly Spy[] {
    const ok = <T>(data: T) => ({ data });
    const spies: Spy[] = [
        vi.spyOn(AccommodationService.prototype, 'list').mockImplementation((async (
            _actor: Actor,
            params: { where?: { ownerId?: string } }
        ) => {
            // Like the real list: scoped by the `ownerId` asked for, all rows without one.
            const ownerId = params.where?.ownerId;
            const items = world.listings.filter(
                (l) =>
                    l.vertical === VerticalEnum.ACCOMMODATION &&
                    (ownerId === undefined || l.ownerId === ownerId)
            );
            return ok({ items, total: items.length });
        }) as never),
        vi
            .spyOn(VenueService.prototype, 'listOwn')
            .mockImplementation((async (actor: Actor) =>
                ok({ listings: own(world, actor, VerticalEnum.VENUE) })) as never),
        vi
            .spyOn(ExperienceService.prototype, 'listOwn')
            .mockImplementation((async (actor: Actor) =>
                ok({ listings: own(world, actor, VerticalEnum.EXPERIENCE) })) as never),
        vi
            .spyOn(VenueService.prototype, 'countOwn')
            .mockImplementation((async (actor: Actor) =>
                ok({ count: own(world, actor, VerticalEnum.VENUE).length })) as never),
        vi
            .spyOn(ExperienceService.prototype, 'countOwn')
            .mockImplementation((async (actor: Actor) =>
                ok({ count: own(world, actor, VerticalEnum.EXPERIENCE).length })) as never),
        vi.spyOn(entityViewService, 'getStatsForHostAccommodations').mockImplementation((async ({
            actor
        }: {
            actor: Actor;
        }) =>
            ok(
                own(world, actor, VerticalEnum.ACCOMMODATION).map((l) => ({
                    entityId: l.id,
                    unique: 1,
                    total: 10
                }))
            )) as never),
        vi
            .spyOn(entityViewService, 'getStatsForOwnListings')
            .mockImplementation((async ({
                actor,
                entityType
            }: {
                actor: Actor;
                entityType: string;
            }) =>
                ok(
                    own(
                        world,
                        actor,
                        entityType === 'VENUE' ? VerticalEnum.VENUE : VerticalEnum.EXPERIENCE
                    ).map((l) => ({ entityId: l.id, unique: 1, total: 5 }))
                )) as never),
        vi
            .spyOn(ConversationService.prototype, 'getHostMonthlyInquiries')
            .mockImplementation((async () =>
                ok([
                    { month: '2026-10', count: 4 },
                    { month: '2026-11', count: 2 }
                ])) as never),
        vi
            .spyOn(ConversationService.prototype, 'getHostResponseRate')
            .mockImplementation((async () =>
                world.inquiriesForbidden
                    ? { error: new ServiceError(ServiceErrorCode.FORBIDDEN, 'no') }
                    : ok({ responseRatePct: 80, avgResponseTimeMinutes: 45 })) as never),
        vi
            .spyOn(ConversationService.prototype, 'getUnreadCount')
            .mockImplementation((async (actor: Actor) =>
                ok({ count: world.unread.get(actor.id) ?? 0 })) as never),
        vi
            .spyOn(HostTradeUsageService.prototype, 'countPendingForHost')
            .mockImplementation((async (actor: Actor) =>
                ok({ count: world.hostPending.get(actor.id) ?? 0 })) as never),
        vi.spyOn(HostTradeService.prototype, 'getOwn').mockImplementation((async (actor: Actor) =>
            ok({
                trade: world.providerPending.has(actor.id)
                    ? { id: TRADE_ID, ownerUserId: actor.id }
                    : null
            })) as never),
        vi
            .spyOn(HostTradeUsageService.prototype, 'listForProvider')
            .mockImplementation((async (_input: unknown, actor: Actor) =>
                ok({ items: [], total: world.providerPending.get(actor.id) ?? 0 })) as never)
    ];

    mocks.enforceGate.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: Vertical }) => {
            if (world.noBasicStats.get(userId)?.has(vertical)) {
                throw new ServiceError(
                    ServiceErrorCode.ENTITLEMENT_REQUIRED,
                    'Entitlement required'
                );
            }
        }
    );
    mocks.effectiveKeys.mockImplementation(async ({ userId }: { userId: string }) => ({
        view_advanced_stats: world.advancedStats.has(userId)
    }));
    mocks.ownerReviews.mockResolvedValue({
        rows: [],
        total: 3,
        countsByState: { APPROVED: 2, PENDING: 1, REJECTED: 0 }
    });
    mocks.favorites.mockResolvedValue(7);
    mocks.fixRequests.mockResolvedValue([]);
    mocks.completeness.mockResolvedValue(new Map());
    return spies;
}

/** Total calls the tool made to every service spy and module mock. */
export function totalCalls(spies: readonly Spy[]): number {
    return (
        spies.reduce((sum, spy) => sum + spy.mock.calls.length, 0) +
        Object.values(mocks).reduce((sum, mock) => sum + mock.mock.calls.length, 0)
    );
}

/** Clears every module mock between tests. */
export function resetMocks(): void {
    for (const mock of Object.values(mocks)) {
        mock.mockReset();
    }
}
