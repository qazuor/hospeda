/**
 * HOS-2331 (spec HOS-2335 §6.6, AC-C29 to AC-C32) — `get_owner_summary`: listing
 * counts, plan-gated metrics and the "needs your attention" block, in one call
 * whose cost does not grow with the number of listings.
 *
 * Real: the tool, the executor, `readMyListingRows`, the stats gate
 * (`stats-entitlement.ts`) over a mocked `user-gate`, the attention and budget
 * logic. Mocked at their module boundary (their own suites cover the queries):
 * the owner review reader, the summary readers and the batch completeness.
 *
 * @module test/mcp/tools/summary/get-owner-summary
 */

import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { entityViewService, HostTradeUsageService } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    actorFor,
    addListing,
    arrangeWorld,
    context,
    emptyWorld,
    mocks,
    OTHER_ID,
    OWNER_ID,
    resetMocks,
    TRADE_ID,
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
vi.mock('../../../../src/services/listing-publication/listing-publish-completeness-batch', () => ({
    evaluateListingsPublishCompleteness: mocks.completeness
}));

import { buildToolInputJsonSchema } from '../../../../src/lib/mcp/bind-tool';
import { listMyListingsTool } from '../../../../src/mcp/tools/listing/list-my-listings';
import { MCP_TOOL_DEFINITIONS } from '../../../../src/mcp/tools/registry';
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

describe('get_owner_summary', () => {
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

    it('is a registered read-only READ_OWN tool with one flat input object', () => {
        // Act
        const schema = buildToolInputJsonSchema({ definition: getOwnerSummaryTool });

        // Assert
        expect(MCP_TOOL_DEFINITIONS.map((tool) => tool.name)).toContain('get_owner_summary');
        expect(getOwnerSummaryTool.isWrite).toBe(false);
        expect(getOwnerSummaryTool.emailUnverifiedOperation).toBe('READ_OWN');
        expect(schema.type).toBe('object');
        expect(schema).not.toHaveProperty('oneOf');
        expect(schema).not.toHaveProperty('anyOf');
        expect(getOwnerSummaryTool.inputSchema.safeParse({ period: '90d' }).success).toBe(false);
        expect(getOwnerSummaryTool.inputSchema.safeParse({ id: 'x' }).success).toBe(false);
    });

    describe('listings (AC-C29)', () => {
        it('counts per state match what list_my_listings lists, purged excluded', async () => {
            // Arrange: two verticals, every counted state, plus a purged one
            const { ACCOMMODATION, VENUE } = VerticalEnum;
            const { DRAFT, PUBLISHED, ARCHIVED, MODERATED, PURGED, UNPUBLISHED_BY_BILLING } =
                PublicationStatusEnum;
            for (const status of [DRAFT, DRAFT, PUBLISHED, PURGED]) {
                addListing(world, { vertical: ACCOMMODATION, status });
            }
            for (const status of [ARCHIVED, MODERATED, UNPUBLISHED_BY_BILLING, PUBLISHED]) {
                addListing(world, { vertical: VENUE, status });
            }

            // Act
            const result = await summary();
            const listed = await runTool({
                definition: listMyListingsTool,
                actor: actorFor(),
                input: {},
                context
            });

            // Assert
            expect(listed.ok).toBe(true);
            const listings = listed.ok ? listed.data.listings : [];
            for (const vertical of [ACCOMMODATION, VENUE, VerticalEnum.EXPERIENCE] as const) {
                const counts = result.listings[vertical];
                for (const [status, count] of Object.entries(counts.byStatus)) {
                    expect(count).toBe(
                        listings.filter(
                            (l) => l.vertical === vertical && l.publicationStatus === status
                        ).length
                    );
                }
            }
            expect(result.listings.accommodation).toEqual({
                total: 3,
                byStatus: {
                    DRAFT: 2,
                    PUBLISHED: 1,
                    UNPUBLISHED_BY_BILLING: 0,
                    ARCHIVED: 0,
                    MODERATED: 0
                }
            });
            expect(result.listings.venue.total).toBe(4);
            expect(result.listings.experience.total).toBe(0);
        });

        it("never counts or reads another owner's listings (cross-user isolation)", async () => {
            // Arrange
            addListing(world, { vertical: VerticalEnum.ACCOMMODATION, ownerId: OTHER_ID });
            addListing(world, { vertical: VerticalEnum.VENUE, ownerId: OTHER_ID });
            const mine = addListing(world, { vertical: VerticalEnum.VENUE });
            world.unread.set(OTHER_ID, 9);
            world.hostPending.set(OTHER_ID, 4);
            world.providerPending.set(OTHER_ID, 2);

            // Act
            const result = await summary();

            // Assert
            expect(result.listings.accommodation.total).toBe(0);
            expect(result.listings.venue.total).toBe(1);
            expect(result.attention).toEqual([]);
            expect(Object.keys(result.metrics)).toEqual(['venue']);
            expect(mocks.fixRequests).toHaveBeenCalledWith({
                vertical: VerticalEnum.VENUE,
                ownerId: OWNER_ID
            });
            const reviewScopes = mocks.ownerReviews.mock.calls.flatMap(([args]) => args.scopes);
            expect(reviewScopes).toEqual([{ vertical: VerticalEnum.VENUE, listingIds: [mine.id] }]);
            expect(mocks.favorites).not.toHaveBeenCalled();
        });
    });

    describe('metrics', () => {
        it('without view_basic_stats only that vertical metrics become the plans note (AC-C30)', async () => {
            // Arrange
            addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
            addListing(world, { vertical: VerticalEnum.VENUE });
            world.noBasicStats.set(OWNER_ID, new Set([VerticalEnum.ACCOMMODATION]));
            world.unread.set(OWNER_ID, 2);

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
            world.unread.set(OWNER_ID, 3);
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
    });

    describe('attention (AC-C31)', () => {
        it('lists unanswered inquiries, an open fix request and pending usages with their portal pages', async () => {
            // Arrange
            const listing = addListing(world, {
                vertical: VerticalEnum.VENUE,
                name: 'La Parrilla'
            });
            addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
            world.unread.set(OWNER_ID, 4);
            world.hostPending.set(OWNER_ID, 2);
            mocks.fixRequests.mockImplementation(async ({ vertical }: { vertical: string }) =>
                vertical === VerticalEnum.VENUE
                    ? [{ id: listing.id, name: listing.name, reportedFixed: false }]
                    : []
            );

            // Act
            const result = await summary();

            // Assert
            expect(result.attention).toEqual([
                {
                    kind: 'unanswered_inquiries',
                    count: 4,
                    actionUrl: `${SITE}/es/mi-cuenta/consultas-propietario/`
                },
                {
                    kind: 'pending_benefit_usages',
                    side: 'host',
                    count: 2,
                    actionUrl: `${SITE}/es/mi-cuenta/usos-de-beneficio/`
                },
                {
                    kind: 'open_fix_request',
                    listing: { id: listing.id, vertical: 'venue', name: 'La Parrilla' },
                    reportedFixed: false,
                    actionUrl: `${SITE}/es/mi-cuenta/comercio/venue/${listing.id}/editar/`
                }
            ]);
            expect(result.moreAttention).toBe(0);
        });

        it('has no pending-usages item when nothing waits on the user', async () => {
            // Arrange
            addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
            world.unread.set(OWNER_ID, 1);

            // Act
            const result = await summary();

            // Assert
            expect(result.attention.map((item) => item.kind)).toEqual(['unanswered_inquiries']);
        });

        it('adds the provider inbox (declared by hosts, pending) when the user owns a directory listing', async () => {
            // Arrange
            world.providerPending.set(OWNER_ID, 3);

            // Act
            const result = await summary();

            // Assert
            expect(result.attention).toEqual([
                {
                    kind: 'pending_benefit_usages',
                    side: 'provider',
                    count: 3,
                    actionUrl: `${SITE}/es/mi-cuenta/proveedor/`
                }
            ]);
            expect(HostTradeUsageService.prototype.listForProvider).toHaveBeenCalledWith(
                {
                    hostTradeId: TRADE_ID,
                    status: 'PENDING',
                    declaredBy: 'HOST',
                    page: 1,
                    pageSize: 1
                },
                expect.objectContaining({ id: OWNER_ID })
            );
        });

        it('turns unmet draft requirements into incomplete and missing-photo items', async () => {
            // Arrange
            const draft = addListing(world, {
                vertical: VerticalEnum.ACCOMMODATION,
                status: PublicationStatusEnum.DRAFT,
                name: 'Casa del Río'
            });
            addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
            mocks.completeness.mockImplementation(
                async ({ vertical, listings }: { vertical: string; listings: { id: string }[] }) =>
                    vertical === VerticalEnum.ACCOMMODATION
                        ? new Map(listings.map((l) => [l.id, ['capacity', 'mainImage']]))
                        : new Map()
            );

            // Act
            const result = await summary();

            // Assert
            const accommodationCall = mocks.completeness.mock.calls.find(
                ([args]) => args.vertical === VerticalEnum.ACCOMMODATION
            );
            expect(accommodationCall?.[0].listings.map((l: { id: string }) => l.id)).toEqual([
                draft.id
            ]);
            const listing = { id: draft.id, vertical: 'accommodation', name: 'Casa del Río' };
            const editor = `${SITE}/es/mi-cuenta/propiedades/${draft.id}/editar`;
            expect(result.attention).toEqual([
                {
                    kind: 'incomplete',
                    listing,
                    missing: ['capacity'],
                    actionUrl: `${editor}/capacidad-precio/`
                },
                { kind: 'missing_photos', listing, actionUrl: `${editor}/fotos/` }
            ]);
        });

        it('caps the block at 10 items, most urgent first, and counts the rest', async () => {
            // Arrange: 12 incomplete drafts and one unanswered inquiry
            for (let n = 0; n < 12; n += 1) {
                addListing(world, {
                    vertical: VerticalEnum.VENUE,
                    status: PublicationStatusEnum.DRAFT
                });
            }
            addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
            world.unread.set(OWNER_ID, 1);
            mocks.completeness.mockImplementation(
                async ({ listings }: { listings: { id: string }[] }) =>
                    new Map(listings.map((l) => [l.id, ['summary']]))
            );

            // Act
            const result = await summary();

            // Assert
            expect(result.attention).toHaveLength(10);
            expect(result.attention[0]?.kind).toBe('unanswered_inquiries');
            expect(result.moreAttention).toBe(3);
        });
    });

    it('fails the call instead of reporting a partial summary when a read fails', async () => {
        // Arrange
        addListing(world, { vertical: VerticalEnum.ACCOMMODATION });
        vi.spyOn(HostTradeUsageService.prototype, 'countPendingForHost').mockResolvedValue({
            error: { code: 'INTERNAL_ERROR', message: 'boom' }
        } as never);

        // Act
        const outcome = await runTool({
            definition: getOwnerSummaryTool,
            actor: actorFor(),
            input: {},
            context
        });

        // Assert
        expect(outcome.ok).toBe(false);
    });
});
