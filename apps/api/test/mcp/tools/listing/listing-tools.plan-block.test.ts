/**
 * HOS-2184 phase B T-035 (AC-16) — plan status in the listing tools:
 * - `get_listing_stats` carries `plan`, the `get_my_plan` item of the
 *   listing's vertical (status, expiry, what it includes);
 * - `list_my_listings` carries `plans`, one item per listing vertical with a
 *   plan, from ONE plan read per call, never one per listing.
 *
 * Both read through the shared reader (`readMyPlan`), behind
 * `BILLING_VIEW_OWN` like `get_my_plan`: without it the block is left out and
 * no plan is read. A failed plan read omits the block, never the tool.
 *
 * The plan world is the `get_my_plan` harness: an active accommodation
 * subscription and a running venue trial, the effective set resolved by the
 * real resolver over an in-test catalog. Listing services are spied on their
 * prototypes.
 *
 * @module test/mcp/tools/listing/listing-tools.plan-block
 */

import { PermissionEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    ExperienceService,
    entityViewService,
    VenueService
} from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    arrangeSubscriptionAndTrial,
    context,
    OWNER_ID,
    mocks as planMocks,
    resetWorld
} from '../plan/my-plan.harness';

const readerSpy = vi.hoisted(() => ({ calls: [] as unknown[] }));

vi.mock('../../../../src/utils/listing-access/user-gate', () => ({
    enforceUserGate: vi.fn(async () => undefined),
    readEffectiveKeys: vi.fn(async () => ({ view_advanced_stats: false }))
}));
vi.mock('../../../../src/mcp/tools/listing/listing-stats-readers', () => ({
    readLatestListingReviews: vi.fn(async () => [])
}));
vi.mock('../../../../src/mcp/tools/listing/get-listing-stats.accommodation', () => ({
    readAccommodationStatsExtras: vi.fn(async () => ({ extras: {} }))
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    readOwnPlanState: (...args: unknown[]) => planMocks.readOwnPlanState(...args)
}));
vi.mock('../../../../src/services/billing-addon/owner-recurring-addons.service', () => ({
    readOwnerAddonHoldings: (...args: unknown[]) => planMocks.readOwnerAddonHoldings(...args)
}));
vi.mock('../../../../src/services/listing-notices/listing-notices.service', () => ({
    readTrialSummary: (...args: unknown[]) => planMocks.readTrialSummary(...args),
    readOwnTrialPlan: (...args: unknown[]) => planMocks.readOwnTrialPlan(...args)
}));
vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: (...args: unknown[]) => planMocks.effectiveSet(...args),
        billing: { coverage: (...args: unknown[]) => planMocks.coverage(...args) }
    })
}));
vi.mock('../../../../src/routes/plan-catalog/public/read-sellable-catalog', () => ({
    readSellablePlanCatalog: (...args: unknown[]) => planMocks.readSellablePlanCatalog(...args)
}));
vi.mock('../../../../src/services/plan-catalog/plan-of-version.service', () => ({
    readPlanOfVersion: (...args: unknown[]) => planMocks.readPlanOfVersion(...args)
}));
vi.mock('../../../../src/mcp/tools/plan/my-plan-reader', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../../src/mcp/tools/plan/my-plan-reader')>();
    return {
        ...actual,
        readMyPlan: (input: Parameters<typeof actual.readMyPlan>[0]) => {
            readerSpy.calls.push(input);
            return actual.readMyPlan(input);
        }
    };
});

import { getListingStatsTool } from '../../../../src/mcp/tools/listing/get-listing-stats';
import { listMyListingsTool } from '../../../../src/mcp/tools/listing/list-my-listings';
import { getMyPlanTool } from '../../../../src/mcp/tools/plan/get-my-plan';
import type { MyPlanResult } from '../../../../src/mcp/tools/plan/my-plan-types';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import type { ToolDefinition } from '../../../../src/mcp/tools/tool-definition';
import { injectClock } from '../../../../src/utils/clock';
import { validateApiEnv } from '../../../../src/utils/env';

const NOW = new Date('2026-11-18T12:00:00.000Z');
const LISTING_ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';

/** The owner; `billing` false drops `BILLING_VIEW_OWN`. */
function owner({ billing = true }: { readonly billing?: boolean } = {}): Actor {
    return {
        id: OWNER_ID,
        roles: ['HOST'],
        permissions: billing ? [PermissionEnum.BILLING_VIEW_OWN] : [],
        emailVerified: true
    } as unknown as Actor;
}

async function run<T>(
    definition: ToolDefinition,
    actor: Actor,
    input: Record<string, unknown> = {}
): Promise<T> {
    const outcome = await runTool({ definition, actor, input, context });
    if (!outcome.ok) {
        throw new Error(`${definition.name} refused: ${outcome.failure.message}`);
    }
    return outcome.data as T;
}

/** The accommodation the stats are asked for, owned by {@link OWNER_ID}. */
function givenOwnAccommodation(): void {
    vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
        data: {
            id: LISTING_ID,
            ownerId: OWNER_ID,
            name: 'Cabañas del Río',
            slug: 'cabanas-del-rio',
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            reviewsCount: 0,
            averageRating: 0
        }
    } as never);
    vi.spyOn(entityViewService, 'getDailySeriesComparisonForOwnListing').mockResolvedValue({
        data: {
            previous: [{ date: '2026-11-04', total: 1 }],
            current: [{ date: '2026-11-11', total: 2 }]
        }
    } as never);
}

/** Two listings in two verticals, and none in the third. */
function givenOwnListings(): void {
    const row = (id: string, name: string) => ({
        id,
        ownerId: OWNER_ID,
        name,
        publicationStatus: PublicationStatusEnum.PUBLISHED
    });
    vi.spyOn(AccommodationService.prototype, 'list').mockResolvedValue({
        data: {
            items: [
                row('a1111111-1111-4111-8111-111111111111', 'Cabañas'),
                row('a2222222-2222-4222-8222-222222222222', 'Hostel')
            ],
            total: 2
        }
    } as never);
    vi.spyOn(VenueService.prototype, 'listOwn').mockResolvedValue({
        data: { listings: [row('b1111111-1111-4111-8111-111111111111', 'La Parrilla')] }
    } as never);
    vi.spyOn(ExperienceService.prototype, 'listOwn').mockResolvedValue({
        data: { listings: [] }
    } as never);
}

/** `get_my_plan`'s items keyed by vertical: what the blocks must equal. */
async function myPlanItems(): Promise<Record<string, unknown>> {
    const plan = await run<MyPlanResult>(getMyPlanTool, owner());
    return Object.fromEntries(plan.items.map((item) => [item.vertical, item]));
}

describe('plan status in the listing tools (HOS-2184 T-035, AC-16)', () => {
    beforeAll(() => {
        validateApiEnv();
        injectClock({ clock: { now: () => NOW } });
    });

    beforeEach(() => {
        resetWorld();
        arrangeSubscriptionAndTrial();
        readerSpy.calls = [];
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('get_listing_stats', () => {
        it('carries the get_my_plan item of the listing vertical: expiry and what it includes', async () => {
            // Arrange
            givenOwnAccommodation();
            const expected = await myPlanItems();
            readerSpy.calls = [];

            // Act
            const stats = await run<Record<string, unknown>>(getListingStatsTool, owner(), {
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: LISTING_ID,
                period: '7d'
            });

            // Assert
            expect(stats.plan).toEqual(expected.accommodation);
            expect(stats.plan).toMatchObject({
                status: 'ACTIVE',
                nextChargeAt: '2026-12-01T10:00:00.000Z',
                includes: { entitlements: expect.any(Array), limits: expect.any(Array) }
            });
            expect(stats).not.toHaveProperty('omitted');
            expect(readerSpy.calls).toEqual([
                expect.objectContaining({ userId: OWNER_ID, vertical: VerticalEnum.ACCOMMODATION })
            ]);
        });

        it('answers plan null when the owner has no plan in that vertical', async () => {
            // Arrange
            resetWorld();
            givenOwnAccommodation();

            // Act
            const stats = await run<Record<string, unknown>>(getListingStatsTool, owner(), {
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: LISTING_ID
            });

            // Assert
            expect(stats.plan).toBeNull();
        });

        it('leaves the block out without BILLING_VIEW_OWN and reads no plan', async () => {
            // Arrange
            givenOwnAccommodation();

            // Act
            const stats = await run<Record<string, unknown>>(
                getListingStatsTool,
                owner({ billing: false }),
                { vertical: VerticalEnum.ACCOMMODATION, listingId: LISTING_ID }
            );

            // Assert
            expect(stats).not.toHaveProperty('plan');
            expect(stats).not.toHaveProperty('omitted');
            expect(readerSpy.calls).toHaveLength(0);
        });

        it('omits the block, never the stats, when the plan cannot be read', async () => {
            // Arrange
            givenOwnAccommodation();
            planMocks.readOwnPlanState.mockRejectedValue(new Error('db down'));

            // Act
            const stats = await run<Record<string, unknown>>(getListingStatsTool, owner(), {
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: LISTING_ID
            });

            // Assert
            expect(stats).not.toHaveProperty('plan');
            expect(stats.omitted).toEqual({ plan: 'unavailable' });
            expect(stats.views).toBeDefined();
        });
    });

    describe('list_my_listings', () => {
        it('carries one get_my_plan item per listing vertical with a plan, from ONE plan read', async () => {
            // Arrange
            givenOwnListings();
            const expected = await myPlanItems();
            readerSpy.calls = [];

            // Act
            const result = await run<Record<string, unknown>>(listMyListingsTool, owner());

            // Assert
            expect(result.plans).toEqual({
                accommodation: expected.accommodation,
                venue: expected.venue
            });
            expect(result.plans).toMatchObject({ venue: { status: 'TRIAL', trialDaysLeft: 7 } });
            expect(readerSpy.calls).toHaveLength(1);
            expect((result.listings as unknown[]).length).toBe(3);
        });

        it('leaves the block out without BILLING_VIEW_OWN and reads no plan', async () => {
            // Arrange
            givenOwnListings();

            // Act
            const result = await run<Record<string, unknown>>(
                listMyListingsTool,
                owner({ billing: false })
            );

            // Assert
            expect(result).not.toHaveProperty('plans');
            expect(readerSpy.calls).toHaveLength(0);
        });

        it('omits the block, never the list, when the plan cannot be read', async () => {
            // Arrange
            givenOwnListings();
            planMocks.readOwnPlanState.mockRejectedValue(new Error('db down'));

            // Act
            const result = await run<Record<string, unknown>>(listMyListingsTool, owner());

            // Assert
            expect(result).not.toHaveProperty('plans');
            expect(result.omitted).toEqual({ plans: 'unavailable' });
            expect(result.total).toBe(3);
        });
    });
});
