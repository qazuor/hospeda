/**
 * Tests for RecommendationService.getFeed (SPEC-284 T-005 / T-005b).
 *
 * Covers: cold-start (no signals -> popular fallback via the same scorer),
 * personalized path with already-known-id exclusion, degraded search-history
 * (favorites/viewed still present -> feed still built), destination-path
 * batch resolution (no N+1 — `DestinationModel.findByIds` called at most once),
 * and the service-level `RECOMMENDATION_VIEW` permission gate (T-005b) added
 * alongside the (already-covered-at-the-route-level) entitlement gate.
 *
 * Mocking style mirrors `userSearchHistory` service tests: `createTypedModelMock`
 * for every injected `@repo/db` model, plus a hand-rolled `{ list: vi.fn() }`
 * stand-in for the composed `SearchHistoryService` (constructor-injected, same
 * pattern `AccommodationService` uses for its composed `DestinationService`).
 */
import {
    AccommodationMediaModel,
    AccommodationModel,
    DestinationModel,
    EntityViewModel,
    UserBookmarkModel
} from '@repo/db';
import {
    AccommodationTypeEnum,
    EntityTypeEnum,
    PermissionEnum,
    PriceCurrencyEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationService } from '../../../src/services/recommendation/recommendation.service';
import type { SearchHistoryService } from '../../../src/services/userSearchHistory/userSearchHistory.service';
import {
    createMockAccommodation,
    getMockDestinationId
} from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectForbiddenError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A raw joined row shape as returned by `findTopRated` / `findAllWithRelations`. */
const createJoinedRow = (
    overrides: {
        id?: string;
        destinationId?: string;
        destinationPath?: string;
        amenityIds?: string[];
        isFeatured?: boolean;
        averageRating?: number;
    } = {}
) => {
    const destinationId = overrides.destinationId ?? getMockDestinationId();
    return {
        ...createMockAccommodation({
            id: overrides.id ?? getMockId('accommodation'),
            destinationId,
            isFeatured: overrides.isFeatured ?? false,
            averageRating: overrides.averageRating ?? 4,
            price: { price: 20000, currency: PriceCurrencyEnum.ARS }
        }),
        destination: { path: overrides.destinationPath ?? '/argentina/entre-rios/cdu' },
        amenities: (overrides.amenityIds ?? []).map((amenityId) => ({ amenityId }))
    };
};

describe('RecommendationService.getFeed', () => {
    let service: RecommendationService;
    let accommodationModelMock: AccommodationModel;
    let destinationModelMock: DestinationModel;
    let userBookmarkModelMock: UserBookmarkModel;
    let entityViewModelMock: EntityViewModel;
    let accommodationMediaModelMock: AccommodationMediaModel;
    let searchHistoryServiceMock: SearchHistoryService;

    // T-005b: the service now requires RECOMMENDATION_VIEW in addition to the
    // route-level entitlement gate — every actor fixture that expects a
    // successful getFeed() call must carry it.
    const actor = createActor({
        id: getMockId('user'),
        permissions: [PermissionEnum.RECOMMENDATION_VIEW]
    });

    beforeEach(() => {
        accommodationModelMock = createTypedModelMock(AccommodationModel);
        destinationModelMock = createTypedModelMock(DestinationModel);
        userBookmarkModelMock = createTypedModelMock(UserBookmarkModel);
        entityViewModelMock = createTypedModelMock(EntityViewModel);
        accommodationMediaModelMock = createTypedModelMock(AccommodationMediaModel);
        searchHistoryServiceMock = { list: vi.fn() } as unknown as SearchHistoryService;

        // Defaults: no signals, no pool, no media rows, no destination top-up.
        asMock(userBookmarkModelMock.findAll).mockResolvedValue({ items: [], total: 0 });
        asMock(entityViewModelMock.getRecentlyViewedByUser).mockResolvedValue({
            accommodationIds: []
        });
        asMock(searchHistoryServiceMock.list).mockResolvedValue({ data: { items: [], total: 0 } });
        asMock(accommodationModelMock.findTopRated).mockResolvedValue([]);
        asMock(accommodationModelMock.findAllWithRelations).mockResolvedValue({
            items: [],
            total: 0
        });
        asMock(accommodationMediaModelMock.findByAccommodations).mockResolvedValue(new Map());
        asMock(destinationModelMock.findByIds).mockResolvedValue([]);

        service = new RecommendationService(
            { logger: createLoggerMock() },
            accommodationModelMock,
            destinationModelMock,
            userBookmarkModelMock,
            entityViewModelMock,
            accommodationMediaModelMock,
            searchHistoryServiceMock
        );
    });

    // -------------------------------------------------------------------------
    // Cold-start
    // -------------------------------------------------------------------------

    describe('cold-start (spec §5.5)', () => {
        it('returns isColdStart=true and a popularity-ranked feed when the actor has no signals', async () => {
            const poolRows = [
                createJoinedRow({ averageRating: 3, isFeatured: false }),
                createJoinedRow({ averageRating: 5, isFeatured: true })
            ];
            asMock(accommodationModelMock.findTopRated).mockResolvedValue(poolRows);

            const result = await service.getFeed(actor);

            expectSuccess(result);
            expect(result.data?.isColdStart).toBe(true);
            expect(result.data?.items).toHaveLength(2);
            // Higher rating + featured should outrank the lower-rating item —
            // the quality component is the only non-zero score against an
            // empty profile, so it fully determines ordering.
            expect(result.data?.items[0]?.accommodation.id).toBe(poolRows[1]?.id);
        });

        it('returns an empty feed (still success) when the pool itself is empty', async () => {
            const result = await service.getFeed(actor);

            expectSuccess(result);
            expect(result.data?.isColdStart).toBe(true);
            expect(result.data?.items).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // Personalized path + exclusion
    // -------------------------------------------------------------------------

    describe('personalized path (favorites/viewed present)', () => {
        it('excludes already-favorited/viewed accommodations from the returned items', async () => {
            const favoriteId = getMockId('accommodation', 'favorite-1');
            const poolExtraId = getMockId('accommodation', 'pool-extra');
            const destinationId = getMockDestinationId();

            asMock(userBookmarkModelMock.findAll).mockResolvedValue({
                items: [{ entityId: favoriteId }],
                total: 1
            });

            // The known accommodation, resolved via findAllWithRelations for
            // profile-signal purposes (destination + amenities attributes).
            const favoriteRow = createJoinedRow({
                id: favoriteId,
                destinationId,
                amenityIds: [getMockId('amenity', 'pool-wifi')]
            });
            asMock(accommodationModelMock.findAllWithRelations).mockResolvedValue({
                items: [favoriteRow],
                total: 1
            });

            // The candidate pool includes the SAME favorited id (findTopRated has
            // no native exclusion clause — the service must filter it out) plus
            // one genuinely new accommodation.
            const poolRows = [
                createJoinedRow({ id: favoriteId, destinationId }),
                createJoinedRow({ id: poolExtraId, destinationId })
            ];
            asMock(accommodationModelMock.findTopRated).mockResolvedValue(poolRows);

            const result = await service.getFeed(actor);

            expectSuccess(result);
            expect(result.data?.isColdStart).toBe(false);
            const returnedIds = result.data?.items.map((item) => item.accommodation.id) ?? [];
            expect(returnedIds).not.toContain(favoriteId);
            expect(returnedIds).toContain(poolExtraId);
        });

        it('scores the new-discovery pool against the built profile (destination match ranks higher)', async () => {
            const favoriteId = getMockId('accommodation', 'favorite-2');
            const likedDestinationId = getMockDestinationId('liked-destination');
            const otherDestinationId = getMockDestinationId('other-destination');

            asMock(userBookmarkModelMock.findAll).mockResolvedValue({
                items: [{ entityId: favoriteId }],
                total: 1
            });

            const favoriteRow = createJoinedRow({
                id: favoriteId,
                destinationId: likedDestinationId,
                destinationPath: '/argentina/entre-rios/cdu'
            });
            asMock(accommodationModelMock.findAllWithRelations).mockResolvedValue({
                items: [favoriteRow],
                total: 1
            });

            const matchingId = getMockId('accommodation', 'matching');
            const nonMatchingId = getMockId('accommodation', 'non-matching');
            const poolRows = [
                createJoinedRow({
                    id: nonMatchingId,
                    destinationId: otherDestinationId,
                    destinationPath: '/uruguay/canelones/atlantida',
                    averageRating: 0
                }),
                createJoinedRow({
                    id: matchingId,
                    destinationId: likedDestinationId,
                    destinationPath: '/argentina/entre-rios/cdu',
                    averageRating: 0
                })
            ];
            asMock(accommodationModelMock.findTopRated).mockResolvedValue(poolRows);

            const result = await service.getFeed(actor);

            expectSuccess(result);
            expect(result.data?.items[0]?.accommodation.id).toBe(matchingId);
            expect(result.data?.items[0]?.score.destination).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    // Degraded search history
    // -------------------------------------------------------------------------

    describe('degraded search history (spec §5.2)', () => {
        it('still succeeds when SearchHistoryService.list rejects, using favorites/viewed only', async () => {
            const favoriteId = getMockId('accommodation', 'favorite-3');
            asMock(userBookmarkModelMock.findAll).mockResolvedValue({
                items: [{ entityId: favoriteId }],
                total: 1
            });
            asMock(accommodationModelMock.findAllWithRelations).mockResolvedValue({
                items: [createJoinedRow({ id: favoriteId })],
                total: 1
            });
            asMock(searchHistoryServiceMock.list).mockRejectedValue(new Error('DB unavailable'));
            asMock(accommodationModelMock.findTopRated).mockResolvedValue([createJoinedRow()]);

            const result = await service.getFeed(actor);

            expectSuccess(result);
            expect(result.data?.isColdStart).toBe(false);
        });

        it('still succeeds when SearchHistoryService.list returns a ServiceOutput error', async () => {
            const favoriteId = getMockId('accommodation', 'favorite-4');
            asMock(userBookmarkModelMock.findAll).mockResolvedValue({
                items: [{ entityId: favoriteId }],
                total: 1
            });
            asMock(accommodationModelMock.findAllWithRelations).mockResolvedValue({
                items: [createJoinedRow({ id: favoriteId })],
                total: 1
            });
            asMock(searchHistoryServiceMock.list).mockResolvedValue({
                error: { code: 'INTERNAL_ERROR', message: 'boom' }
            });
            asMock(accommodationModelMock.findTopRated).mockResolvedValue([createJoinedRow()]);

            const result = await service.getFeed(actor);

            expectSuccess(result);
            expect(result.data?.isColdStart).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Destination-path batch resolution (no N+1)
    // -------------------------------------------------------------------------

    describe('destination-path resolution', () => {
        it('does NOT call DestinationModel.findByIds when every referenced destination is already covered by candidates', async () => {
            const destinationId = getMockDestinationId();
            asMock(accommodationModelMock.findTopRated).mockResolvedValue([
                createJoinedRow({ destinationId, destinationPath: '/ar/er/cdu' })
            ]);

            const result = await service.getFeed(actor);

            expectSuccess(result);
            expect(destinationModelMock.findByIds).not.toHaveBeenCalled();
        });

        it('calls DestinationModel.findByIds exactly ONCE for the missing preferred-destination ids, regardless of pool size', async () => {
            const favoriteId = getMockId('accommodation', 'favorite-5');
            const searchOnlyDestinationId = getMockDestinationId('search-only-destination');

            asMock(userBookmarkModelMock.findAll).mockResolvedValue({
                items: [{ entityId: favoriteId }],
                total: 1
            });
            asMock(accommodationModelMock.findAllWithRelations).mockResolvedValue({
                items: [createJoinedRow({ id: favoriteId })],
                total: 1
            });
            // Search history references a destination that never appears as a
            // candidate's own destinationId — its path can only come from the
            // top-up query.
            asMock(searchHistoryServiceMock.list).mockResolvedValue({
                data: {
                    items: [
                        {
                            id: getMockId('userSearchHistory'),
                            userId: actor.id,
                            queryText: null,
                            filtersJson: { destinationId: searchOnlyDestinationId },
                            resultCount: 3,
                            createdAt: new Date()
                        }
                    ],
                    total: 1
                }
            });
            asMock(accommodationModelMock.findTopRated).mockResolvedValue(
                Array.from({ length: 5 }, () => createJoinedRow())
            );
            asMock(destinationModelMock.findByIds).mockResolvedValue([
                { id: searchOnlyDestinationId, path: '/argentina/misiones/iguazu' }
            ]);

            const result = await service.getFeed(actor);

            expectSuccess(result);
            expect(destinationModelMock.findByIds).toHaveBeenCalledTimes(1);
            const calls = asMock(destinationModelMock.findByIds).mock.calls;
            const calledWith = calls[0]?.[0] as string[];
            expect(calledWith).toEqual([searchOnlyDestinationId]);
        });
    });

    // -------------------------------------------------------------------------
    // Actor scoping
    // -------------------------------------------------------------------------

    it('always fetches signals scoped to the actor id (never a caller-supplied userId)', async () => {
        await service.getFeed(actor);

        const bookmarkCallArgs = asMock(userBookmarkModelMock.findAll).mock.calls[0]?.[0] as {
            userId: string;
            entityType: string;
        };
        expect(bookmarkCallArgs.userId).toBe(actor.id);
        expect(bookmarkCallArgs.entityType).toBe(EntityTypeEnum.ACCOMMODATION);

        const viewedCallArgs = asMock(entityViewModelMock.getRecentlyViewedByUser).mock
            .calls[0]?.[0] as {
            userId: string;
        };
        expect(viewedCallArgs.userId).toBe(actor.id);
    });

    it('never throws — returns a FORBIDDEN ServiceOutput (not a rejected promise) for an actor with no permissions', async () => {
        const bareActor = createActor({ id: getMockId('user', 'bare'), permissions: [] });
        const result = await service.getFeed(bareActor);
        expectForbiddenError(result);
    });

    // -------------------------------------------------------------------------
    // Authorization (SPEC-284 T-005b — service-level RECOMMENDATION_VIEW gate,
    // in addition to the route-level entitlement gate)
    // -------------------------------------------------------------------------

    describe('authorization: RECOMMENDATION_VIEW permission gate (T-005b)', () => {
        it('returns FORBIDDEN and never touches the signal models when the actor lacks RECOMMENDATION_VIEW', async () => {
            const unauthorizedActor = createActor({
                id: getMockId('user', 'no-recommendation-permission'),
                permissions: []
            });

            const result = await service.getFeed(unauthorizedActor);

            expectForbiddenError(result);
            expect(userBookmarkModelMock.findAll).not.toHaveBeenCalled();
            expect(entityViewModelMock.getRecentlyViewedByUser).not.toHaveBeenCalled();
            expect(accommodationModelMock.findTopRated).not.toHaveBeenCalled();
        });

        it('succeeds for an actor holding ONLY RECOMMENDATION_VIEW (no other permission needed for a self-scoped feed)', async () => {
            const minimalActor = createActor({
                id: getMockId('user', 'minimal-recommendation-permission'),
                permissions: [PermissionEnum.RECOMMENDATION_VIEW]
            });

            const result = await service.getFeed(minimalActor);

            expectSuccess(result);
        });

        it('the FORBIDDEN error carries ServiceErrorCode.FORBIDDEN as its code', async () => {
            const unauthorizedActor = createActor({
                id: getMockId('user', 'no-recommendation-permission-2'),
                permissions: []
            });

            const result = await service.getFeed(unauthorizedActor);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    it('produces items whose type reference AccommodationTypeEnum values from the raw rows', async () => {
        asMock(accommodationModelMock.findTopRated).mockResolvedValue([
            createJoinedRow({ isFeatured: true })
        ]);

        const result = await service.getFeed(actor);

        expectSuccess(result);
        expect(result.data?.items[0]?.accommodation.type).toBe(AccommodationTypeEnum.HOTEL);
    });
});
