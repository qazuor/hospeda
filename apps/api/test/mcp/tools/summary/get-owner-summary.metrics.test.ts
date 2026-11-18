/**
 * HOS-2331 (spec HOS-2335 §6.6, AC-C30) — `get_owner_summary` metrics: the
 * per-vertical plan gate (D-9), the accommodation metrics, the unanswered count
 * shared with `list_inquiries` (review H-1), a failing entitlement read (M-1)
 * and partial reads (M-3). Same harness and mocks as `get-owner-summary.test.ts`.
 *
 * Real: the tool, the executor, `readMyListingRows`, the stats gate
 * (`stats-entitlement.ts`) over a mocked `user-gate`, the attention and budget
 * logic. Mocked at their module boundary (their own suites cover the queries):
 * the owner review reader, the summary readers and the batch completeness.
 *
 * @module test/mcp/tools/summary/get-owner-summary.metrics
 */

import { ConversationStatusEnum, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import {
    ConversationService,
    entityViewService,
    ServiceError,
    VenueService
} from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    actorFor,
    addInquiries,
    addListing,
    arrangeWorld,
    context,
    emptyWorld,
    mocks,
    OWNER_ID,
    resetMocks,
    unanswered,
    type World
} from './owner-summary.harness';

vi.mock('../../../../src/utils/listing-access/user-gate', () => ({
    enforceUserGate: mocks.enforceGate,
    readEffectiveKeys: mocks.effectiveKeys
}));
vi.mock('../../../../src/mcp/tools/review/owner-review-reader', () => ({
    readOwnerListingReviews: mocks.ownerReviews
}));
vi.mock('../../../../src/mcp/tools/summary/owner-summary-readers', () => ({
    countAccommodationFavorites: mocks.favorites,
    readOpenFixRequestListings: mocks.fixRequests
}));
vi.mock('../../../../src/mcp/tools/inquiry/inquiry-readers', () => ({
    readOwnerAccommodationIds: mocks.ownerAccommodationIds,
    readInquiryListContext: mocks.inquiryListContext
}));
vi.mock('../../../../src/services/listing-publication/listing-publish-completeness-batch', () => ({
    evaluateListingsPublishCompleteness: mocks.completeness
}));

import { listInquiriesTool } from '../../../../src/mcp/tools/inquiry/list-inquiries';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { getOwnerSummaryTool } from '../../../../src/mcp/tools/summary/get-owner-summary';
import { NO_STATS_NOTE } from '../../../../src/mcp/tools/summary/owner-summary-metrics';
import { injectClock } from '../../../../src/utils/clock';
import { validateApiEnv } from '../../../../src/utils/env';

const NOW = new Date('2026-11-18T12:00:00.000Z');
const SITE = 'http://localhost:4321';

let world: World;

/** Runs the tool and returns its data, failing the test on a refusal. */
async function summary(input: Record<string, unknown> = {}) {
    const outcome = await runTool({
        definition: getOwnerSummaryTool,
        actor: actorFor(OWNER_ID),
        input,
        context
    });
    if (!outcome.ok) {
        throw new Error(`summary refused: ${outcome.failure.message}`);
    }
    return outcome.data;
}

describe('get_owner_summary — metrics', () => {
    beforeAll(() => {
        validateApiEnv();
        injectClock({ clock: { now: () => NOW } });
    });

    beforeEach(() => {
        world = emptyWorld();
        arrangeWorld(world);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetMocks();
    });

    it('without view_basic_stats only that vertical metrics become the plans note (AC-C30)', async () => {
        // Arrange
        addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
        addListing(world, { vertical: VerticalEnum.VENUE });
        world.noBasicStats.set(OWNER_ID, new Set([VerticalEnum.ACCOMMODATION]));
        unanswered(world, { ownerId: OWNER_ID, count: 2 });

        // Act
        const result = await summary();

        // Assert
        expect(result.metrics.accommodation).toEqual({
            omitted: 'NO_STATS_ENTITLEMENT',
            note: NO_STATS_NOTE,
            action: { url: `${SITE}/es/planes/anfitriones/`, label: 'Ver los planes' }
        });
        expect(result.metrics.venue).toMatchObject({ period: '30d', views: 5 });
        expect(result.listings.accommodation.total).toBe(1);
        expect(result.attention.map((item) => item.kind)).toEqual(['unanswered_inquiries']);
        expect(entityViewService.getStatsForHostAccommodations).not.toHaveBeenCalled();
    });

    it('never reads (and so never zeroes) a metric of a gated vertical', async () => {
        // Arrange
        addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
        world.noBasicStats.set(OWNER_ID, new Set([VerticalEnum.ACCOMMODATION]));

        // Act
        const result = await summary();

        // Assert
        const entry = JSON.stringify(result.metrics.accommodation);
        for (const key of ['views', 'newReviews', 'inquiries', 'favorites', 'unanswered']) {
            expect(entry).not.toContain(key);
        }
        expect(mocks.ownerReviews).not.toHaveBeenCalled();
        expect(mocks.favorites).not.toHaveBeenCalled();
    });

    it('reports accommodation metrics with the plan gates and the shared unread count', async () => {
        // Arrange
        addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
        addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
        unanswered(world, { ownerId: OWNER_ID, count: 3 });
        world.advancedStats.add(OWNER_ID);

        // Act
        const result = await summary({ period: '7d' });

        // Assert
        expect(result.metrics.accommodation).toEqual({
            period: '7d',
            views: 20,
            newReviews: {
                total: 3,
                byModerationState: { APPROVED: 2, PENDING: 1, REJECTED: 0 }
            },
            inquiries: {
                scope: 'all_my_accommodations',
                byMonth: [
                    { month: '2026-10', count: 4 },
                    { month: '2026-11', count: 2 }
                ],
                responseRatePercent: 80,
                averageResponseMinutes: 45
            },
            unansweredInquiries: 3,
            favorites: 7
        });
        expect(mocks.ownerReviews.mock.calls[0]?.[0].filters).toEqual({
            since: new Date(NOW.getTime() - 7 * 86_400_000)
        });
    });

    it('omits favorites without view_advanced_stats and inquiries without permission, never zero', async () => {
        // Arrange
        addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
        world.inquiriesForbidden = true;

        // Act
        const result = await summary();

        // Assert
        const metrics = result.metrics.accommodation;
        expect(metrics).not.toHaveProperty('favorites');
        expect(metrics).not.toHaveProperty('inquiries');
        expect(metrics).toMatchObject({
            omitted: { favorites: 'not_in_plan', inquiries: 'not_permitted' }
        });
        expect(mocks.favorites).not.toHaveBeenCalled();
    });

    it.each([
        [
            'an INTERNAL_ERROR service error',
            new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'down')
        ],
        ['a plain error', new Error('effective set down')]
    ])('refuses and reads no metric when the entitlement read rejects with %s (M-1)', async (_label, failure) => {
        // Arrange
        addListing(world, { vertical: VerticalEnum.VENUE });
        mocks.enforceGate.mockRejectedValue(failure);

        // Act
        const outcome = await runTool({
            definition: getOwnerSummaryTool,
            actor: actorFor(),
            input: {},
            context
        });

        // Assert
        expect(outcome.ok).toBe(false);
        expect(entityViewService.getStatsForOwnListings).not.toHaveBeenCalled();
        expect(mocks.ownerReviews).not.toHaveBeenCalled();
    });

    it('flags the metrics of a vertical whose listing read is partial (M-3)', async () => {
        // Arrange: the owner has 150 venues; one read is a full page of 100
        for (let n = 0; n < 100; n += 1) {
            addListing(world, { vertical: VerticalEnum.VENUE });
        }
        addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
        vi.spyOn(VenueService.prototype, 'countOwn').mockResolvedValue({
            data: { count: 150 }
        } as never);

        // Act
        const result = await summary();

        // Assert
        expect(result.listings.venue.partial).toBe(true);
        expect(result.metrics.venue).toMatchObject({ partial: true });
        expect(result.metrics.accommodation).not.toHaveProperty('partial');
    });

    it('counts as unanswered only the inquiries waiting for the owner, like list_inquiries (H-1)', async () => {
        // Arrange: 37 historical inquiries and 2 waiting for a reply
        const house = addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
        const { OPEN, PENDING_GUEST, CLOSED, PENDING_OWNER } = ConversationStatusEnum;
        addInquiries(world, { accommodationId: house.id, count: 15, status: CLOSED });
        addInquiries(world, { accommodationId: house.id, count: 12, status: PENDING_GUEST });
        addInquiries(world, { accommodationId: house.id, count: 10, status: OPEN });
        addInquiries(world, { accommodationId: house.id, count: 2, status: PENDING_OWNER });

        // Act
        const result = await summary();
        const listed = await runTool({
            definition: listInquiriesTool,
            actor: actorFor(),
            input: { status: PENDING_OWNER },
            context
        });

        // Assert
        expect(listed.ok).toBe(true);
        const listedTotal = listed.ok ? listed.data.pagination.total : -1;
        expect(listedTotal).toBe(2);
        expect(result.metrics.accommodation).toMatchObject({
            unansweredInquiries: listedTotal
        });
        expect(result.attention[0]).toMatchObject({
            kind: 'unanswered_inquiries',
            count: listedTotal
        });
        expect(ConversationService.prototype.listForOwner).toHaveBeenCalledWith(
            expect.objectContaining({ id: OWNER_ID }),
            expect.objectContaining({ status: PENDING_OWNER, page: 1, pageSize: 1 })
        );
    });

    it('leaves unanswered inquiries out without the inbox permission', async () => {
        // Arrange
        addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
        unanswered(world, { ownerId: OWNER_ID, count: 2 });

        // Act
        const outcome = await runTool({
            definition: getOwnerSummaryTool,
            actor: { ...actorFor(), permissions: [] },
            input: {},
            context
        });

        // Assert
        expect(outcome.ok).toBe(true);
        const result = outcome.ok ? outcome.data : undefined;
        expect(result?.metrics.accommodation).not.toHaveProperty('unansweredInquiries');
        expect(result?.attention).toEqual([]);
        expect(ConversationService.prototype.listForOwner).not.toHaveBeenCalled();
    });
});
