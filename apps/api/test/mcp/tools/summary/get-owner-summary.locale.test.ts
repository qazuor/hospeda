/**
 * HOS-2335 follow-up (known gap U-5) — every portal link of `get_owner_summary`
 * (attention items: pending usages of both sides, open fix requests, drafts,
 * unanswered inquiries; and the plans link of a vertical without stats)
 * carries the locale of the call context.
 *
 * @module test/mcp/tools/summary/get-owner-summary.locale
 */

import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { injectClock } from '../../../../src/utils/clock';
import { validateApiEnv } from '../../../../src/utils/env';
import { expectEveryPortalUrlInLocale, PORTAL_LOCALES } from '../portal-locale.helper';
import {
    actorFor,
    addListing,
    arrangeWorld,
    emptyWorld,
    mocks,
    OWNER_ID,
    resetMocks,
    unanswered
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

import { runTool } from '../../../../src/mcp/tools/run-tool';
import { getOwnerSummaryTool } from '../../../../src/mcp/tools/summary/get-owner-summary';

const NOW = new Date('2026-11-18T12:00:00.000Z');

describe('get_owner_summary links in the caller locale', () => {
    beforeAll(() => {
        validateApiEnv();
        injectClock({ clock: { now: () => NOW } });
    });

    beforeEach(() => {
        const world = emptyWorld();
        const venue = addListing(world, { vertical: VerticalEnum.VENUE, name: 'La Parrilla' });
        const draft = addListing(world, {
            vertical: VerticalEnum.ACCOMMODATION,
            status: PublicationStatusEnum.DRAFT,
            name: 'Casa del Río'
        });
        unanswered(world, { ownerId: OWNER_ID, count: 2 });
        world.hostPending.set(OWNER_ID, 1);
        world.providerPending.set(OWNER_ID, 1);
        // The venue plan has no stats: its metrics become the plans link.
        world.noBasicStats.set(OWNER_ID, new Set([VerticalEnum.VENUE]));
        arrangeWorld(world);
        mocks.fixRequests.mockImplementation(async ({ vertical }: { vertical: string }) =>
            vertical === VerticalEnum.VENUE
                ? [{ id: venue.id, name: venue.name, reportedFixed: false }]
                : []
        );
        mocks.completeness.mockImplementation(
            async ({ vertical, listings }: { vertical: string; listings: { id: string }[] }) =>
                vertical === VerticalEnum.ACCOMMODATION
                    ? new Map(listings.map((l) => [l.id, ['capacity', 'mainImage']]))
                    : new Map()
        );
        expect(draft.id).toBeDefined();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetMocks();
    });

    it.each(PORTAL_LOCALES)('every attention and metrics link uses %s', async (locale) => {
        const outcome = await runTool({
            definition: getOwnerSummaryTool,
            actor: actorFor(OWNER_ID),
            input: {},
            context: { channel: 'mcp', locale }
        });

        if (!outcome.ok) {
            throw new Error(`summary refused: ${outcome.failure.message}`);
        }
        // Every builder was exercised, so none can drop the locale unseen.
        expect(outcome.data.attention.map((item) => item.kind).sort()).toEqual(
            [
                'incomplete',
                'missing_photos',
                'open_fix_request',
                'pending_benefit_usages',
                'pending_benefit_usages',
                'unanswered_inquiries'
            ].sort()
        );
        expect(outcome.data.metrics.venue).toMatchObject({ omitted: 'NO_STATS_ENTITLEMENT' });
        // 6 attention links + the plans link of the venue
        expectEveryPortalUrlInLocale({ output: outcome.data, locale, minUrls: 7 });
    });
});
