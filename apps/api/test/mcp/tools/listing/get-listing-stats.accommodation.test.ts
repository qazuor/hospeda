/**
 * HOS-2184 T-025 — `get_listing_stats` accommodation extras: favorites of the
 * one accommodation, and the owner's inquiries per month and response rate /
 * time. Venues and experiences carry no such block (AC-9: omitted, not zero).
 *
 * The bookmark service is replaced at the `listing-services` boundary (the
 * global service-core mock has no `countBookmarksForEntity`); the conversation
 * service is spied on its prototype; views and the latest-reviews reader are
 * stubbed as in `get-listing-stats.test.ts`.
 *
 * @module test/mcp/tools/listing/get-listing-stats.accommodation
 */

import { PublicationStatusEnum, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    ConversationService,
    ExperienceService,
    entityViewService,
    ServiceError,
    VenueService
} from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { countBookmarks, effectiveKeys } = vi.hoisted(() => ({
    countBookmarks: vi.fn(),
    effectiveKeys: vi.fn()
}));

vi.mock('../../../../src/utils/listing-access/user-gate', () => ({
    enforceUserGate: vi.fn(async () => undefined),
    readEffectiveKeys: effectiveKeys
}));

vi.mock('../../../../src/mcp/tools/listing/listing-stats-readers', () => ({
    readLatestListingReviews: vi.fn(async () => [])
}));

vi.mock('../../../../src/mcp/tools/listing/listing-services', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../../src/mcp/tools/listing/listing-services')
    >()),
    listingToolBookmarkService: { countBookmarksForEntity: countBookmarks }
}));

import { getListingStatsTool } from '../../../../src/mcp/tools/listing/get-listing-stats';
import { LISTING_STATS_INQUIRY_MONTHS } from '../../../../src/mcp/tools/listing/get-listing-stats.accommodation';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { TOOL_UNEXPECTED_ERROR_MESSAGE } from '../../../../src/mcp/tools/tool-errors';

const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
const LISTING_ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';
const context = { channel: 'mcp' } as const;

const actor = {
    id: OWNER_ID,
    roles: ['HOST'],
    permissions: [],
    emailVerified: true
} as unknown as Actor;

const listingRow = {
    id: LISTING_ID,
    ownerId: OWNER_ID,
    name: 'Cabañas del Río',
    slug: 'cabanas-del-rio',
    publicationStatus: PublicationStatusEnum.PUBLISHED,
    reviewsCount: 0,
    averageRating: 0
};

const SERVICES = {
    [VerticalEnum.ACCOMMODATION]: AccommodationService,
    [VerticalEnum.VENUE]: VenueService,
    [VerticalEnum.EXPERIENCE]: ExperienceService
} as const;

type GetByIdResult = Awaited<ReturnType<VenueService['getById']>>;

function givenOwnListing(vertical: keyof typeof SERVICES): void {
    const prototype = SERVICES[vertical].prototype as unknown as {
        getById: (...args: unknown[]) => Promise<GetByIdResult>;
    };
    vi.spyOn(prototype, 'getById').mockResolvedValue({
        data: listingRow
    } as unknown as GetByIdResult);
    vi.spyOn(entityViewService, 'getDailySeriesComparisonForOwnListing').mockResolvedValue({
        data: {
            previous: [{ date: '2026-06-07', total: 1 }],
            current: [{ date: '2026-06-08', total: 2 }]
        }
    });
}

const monthly = vi.fn();
const responseRate = vi.fn();

const run = (vertical: string) =>
    runTool({
        definition: getListingStatsTool,
        actor,
        input: { vertical, listingId: LISTING_ID },
        context
    });

describe('get_listing_stats accommodation extras', () => {
    beforeEach(() => {
        effectiveKeys.mockResolvedValue({ view_advanced_stats: true });
        countBookmarks.mockResolvedValue({ data: { count: 7 } });
        monthly.mockResolvedValue({
            data: [
                { month: '2026-05', count: 4 },
                { month: '2026-06', count: 0 }
            ]
        });
        responseRate.mockResolvedValue({
            data: { responseRatePct: 83.3, avgResponseTimeMinutes: 47 }
        });
        vi.spyOn(ConversationService.prototype, 'getHostMonthlyInquiries').mockImplementation(
            monthly
        );
        vi.spyOn(ConversationService.prototype, 'getHostResponseRate').mockImplementation(
            responseRate
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
        for (const fn of [countBookmarks, monthly, responseRate, effectiveKeys]) {
            fn.mockReset();
        }
    });

    it('returns favorites of this accommodation and the owner inquiry and response metrics', async () => {
        // Arrange
        givenOwnListing(VerticalEnum.ACCOMMODATION);

        // Act
        const outcome = await run('accommodation');

        // Assert
        expect(countBookmarks).toHaveBeenCalledWith(actor, {
            entityId: LISTING_ID,
            entityType: 'ACCOMMODATION'
        });
        expect(monthly).toHaveBeenCalledWith(actor, { months: LISTING_STATS_INQUIRY_MONTHS });
        expect(responseRate).toHaveBeenCalledWith(actor);
        expect(outcome).toMatchObject({
            ok: true,
            data: {
                accommodation: {
                    favorites: 7,
                    inquiries: {
                        scope: 'all_my_accommodations',
                        byMonth: [
                            { month: '2026-05', count: 4 },
                            { month: '2026-06', count: 0 }
                        ]
                    },
                    responseTime: {
                        scope: 'all_my_accommodations',
                        responseRatePercent: 83.3,
                        averageMinutes: 47
                    }
                }
            }
        });
    });

    it('reads the advanced capability for the accommodation vertical', async () => {
        // Arrange
        givenOwnListing(VerticalEnum.ACCOMMODATION);

        // Act
        await run('accommodation');

        // Assert
        expect(effectiveKeys).toHaveBeenCalledWith({
            userId: OWNER_ID,
            vertical: VerticalEnum.ACCOMMODATION,
            keys: ['view_advanced_stats']
        });
    });

    it('omits favorites, says why and does not count them without view_advanced_stats', async () => {
        // Arrange
        givenOwnListing(VerticalEnum.ACCOMMODATION);
        effectiveKeys.mockResolvedValue({ view_advanced_stats: false });

        // Act
        const outcome = await run('accommodation');

        // Assert
        expect(countBookmarks).not.toHaveBeenCalled();
        const extras = outcome.ok ? outcome.data.accommodation : undefined;
        expect(extras).not.toHaveProperty('favorites');
        expect(extras).toMatchObject({
            omitted: { favorites: 'not_in_plan' },
            inquiries: { scope: 'all_my_accommodations' }
        });
    });

    it('has no omitted note when the plan includes advanced stats', async () => {
        // Arrange
        givenOwnListing(VerticalEnum.ACCOMMODATION);

        // Act
        const outcome = await run('accommodation');

        // Assert
        expect(outcome.ok && outcome.data.accommodation).not.toHaveProperty('omitted');
    });

    it('keeps a null average response time while no inquiry was answered', async () => {
        // Arrange
        givenOwnListing(VerticalEnum.ACCOMMODATION);
        responseRate.mockResolvedValue({
            data: { responseRatePct: 0, avgResponseTimeMinutes: null }
        });

        // Act
        const outcome = await run('accommodation');

        // Assert
        expect(outcome).toMatchObject({
            ok: true,
            data: {
                accommodation: { responseTime: { responseRatePercent: 0, averageMinutes: null } }
            }
        });
    });

    it.each([
        VerticalEnum.VENUE,
        VerticalEnum.EXPERIENCE
    ] as const)('omits the accommodation block for %s and reads none of its sources', async (vertical) => {
        // Arrange
        givenOwnListing(vertical);

        // Act
        const outcome = await run(vertical);

        // Assert
        expect(outcome.ok).toBe(true);
        expect(outcome.ok && outcome.data).not.toHaveProperty('accommodation');
        expect(outcome.ok && JSON.stringify(outcome.data)).not.toMatch(
            /favorites|inquiries|responseTime/
        );
        expect(countBookmarks).not.toHaveBeenCalled();
        expect(monthly).not.toHaveBeenCalled();
        expect(responseRate).not.toHaveBeenCalled();
    });

    it('omits inquiries and response time, not favorites, when the owner may not read inquiries', async () => {
        // Arrange
        givenOwnListing(VerticalEnum.ACCOMMODATION);
        const forbidden = { error: new ServiceError(ServiceErrorCode.FORBIDDEN, 'no') };
        monthly.mockResolvedValue(forbidden);
        responseRate.mockResolvedValue(forbidden);

        // Act
        const outcome = await run('accommodation');

        // Assert
        expect(outcome).toMatchObject({ ok: true, data: { accommodation: { favorites: 7 } } });
        const extras = outcome.ok ? outcome.data.accommodation : undefined;
        expect(extras).not.toHaveProperty('inquiries');
        expect(extras).not.toHaveProperty('responseTime');
    });

    it('reports a failing conversation read as unexpected, not as zero', async () => {
        // Arrange
        givenOwnListing(VerticalEnum.ACCOMMODATION);
        responseRate.mockResolvedValue({
            error: new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'db down')
        });

        // Act
        const outcome = await run('accommodation');

        // Assert
        expect(outcome.ok ? undefined : outcome.failure.message).toBe(
            TOOL_UNEXPECTED_ERROR_MESSAGE
        );
    });

    it('reports a failing favorites count as unexpected, not as zero', async () => {
        // Arrange
        givenOwnListing(VerticalEnum.ACCOMMODATION);
        countBookmarks.mockResolvedValue({
            error: new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'db down')
        });

        // Act
        const outcome = await run('accommodation');

        // Assert
        expect(outcome.ok ? undefined : outcome.failure.message).toBe(
            TOOL_UNEXPECTED_ERROR_MESSAGE
        );
    });

    it('reads no extras for a listing the caller does not own', async () => {
        // Arrange
        const prototype = AccommodationService.prototype as unknown as {
            getById: (...args: unknown[]) => Promise<GetByIdResult>;
        };
        vi.spyOn(prototype, 'getById').mockResolvedValue({
            data: { ...listingRow, ownerId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d' }
        } as unknown as GetByIdResult);

        // Act
        const outcome = await run('accommodation');

        // Assert
        expect(outcome.ok).toBe(false);
        expect(countBookmarks).not.toHaveBeenCalled();
        expect(monthly).not.toHaveBeenCalled();
        expect(responseRate).not.toHaveBeenCalled();
    });
});
