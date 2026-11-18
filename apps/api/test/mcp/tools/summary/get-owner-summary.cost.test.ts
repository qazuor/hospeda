/**
 * HOS-2331 (spec HOS-2335 §5.3, §6.6, AC-C32) — `get_owner_summary` cost and
 * size: the same number of reads for 1 listing per vertical as for 90, and the
 * largest seeded owner under `MCP_RESULT_MAX_CHARS`. Same harness and mocks as
 * `get-owner-summary.test.ts`.
 *
 * Real: the tool, the executor, `readMyListingRows`, the stats gate
 * (`stats-entitlement.ts`) over a mocked `user-gate`, the attention and budget
 * logic. Mocked at their module boundary (their own suites cover the queries):
 * the owner review reader, the summary readers and the batch completeness.
 *
 * @module test/mcp/tools/summary/get-owner-summary.cost
 */

import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    actorFor,
    addListing,
    arrangeWorld,
    context,
    emptyWorld,
    mocks,
    OWNER_ID,
    resetMocks,
    totalCalls,
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

import {
    MCP_RESULT_MAX_CHARS,
    measureResultChars
} from '../../../../src/mcp/tools/response-budget';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { getOwnerSummaryTool } from '../../../../src/mcp/tools/summary/get-owner-summary';
import type { OwnerSummary } from '../../../../src/mcp/tools/summary/owner-summary-types';
import { injectClock } from '../../../../src/utils/clock';
import { validateApiEnv } from '../../../../src/utils/env';

const NOW = new Date('2026-11-18T12:00:00.000Z');

let world: World;
let spies: ReturnType<typeof arrangeWorld>;

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

describe('get_owner_summary — budget and cost (AC-C32)', () => {
    beforeAll(() => {
        validateApiEnv();
        injectClock({ clock: { now: () => NOW } });
    });

    beforeEach(() => {
        world = emptyWorld();
        spies = arrangeWorld(world);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetMocks();
    });

    /** Seeds `perVertical` listings in each vertical, all drafts with problems. */
    function seed(perVertical: number): void {
        for (const vertical of [
            VerticalEnum.ACCOMMODATION,
            VerticalEnum.VENUE,
            VerticalEnum.EXPERIENCE
        ] as const) {
            for (let n = 0; n < perVertical; n += 1) {
                addListing(world, {
                    vertical,
                    status: PublicationStatusEnum.DRAFT,
                    name: `${'Nombre muy largo de publicación '.repeat(8)}${n}`
                });
            }
        }
        unanswered(world, { ownerId: OWNER_ID, count: 5 });
        world.hostPending.set(OWNER_ID, 2);
        world.providerPending.set(OWNER_ID, 1);
        world.advancedStats.add(OWNER_ID);
        mocks.completeness.mockImplementation(
            async ({ listings }: { listings: { id: string }[] }) =>
                new Map(listings.map((l) => [l.id, ['summary', 'media.featuredImage']]))
        );
        mocks.fixRequests.mockImplementation(async () =>
            world.listings.slice(0, perVertical).map((l) => ({
                id: l.id,
                name: l.name,
                reportedFixed: true
            }))
        );
    }

    it('makes the same number of reads for 1 listing per vertical as for 90', async () => {
        // Arrange / Act
        seed(1);
        await summary();
        const small = totalCalls(spies);
        vi.restoreAllMocks();
        resetMocks();
        world = emptyWorld();
        spies = arrangeWorld(world);
        seed(90);
        await summary();
        const large = totalCalls(spies);

        // Assert
        expect(small).toBeGreaterThan(0);
        expect(large).toBe(small);
    });

    it('keeps the largest seeded owner under MCP_RESULT_MAX_CHARS', async () => {
        // Arrange
        seed(100);

        // Act
        const result: OwnerSummary = await summary();

        // Assert
        expect(measureResultChars({ value: result })).toBeLessThanOrEqual(MCP_RESULT_MAX_CHARS);
        expect(result.attention).toHaveLength(10);
        expect(result.more).toBeGreaterThan(300);
    });
});
