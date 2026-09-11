/**
 * Regression tests: the billing-driven visibility reconciler purges the edge
 * cache after flipping a commerce listing (HOS-1337).
 *
 * `reconcileCommerceListingVisibility` is the FOURTH writer of `visibility`
 * (after create, update and media) and the only one driven by the billing
 * lifecycle — the MP webhook and the dunning/finalize crons. Until HOS-1337
 * it was also the only writer that never scheduled
 * `scheduleCommerceListingRevalidation`, so a listing its owner had just paid
 * for stayed out of the public index (`/{lang}/gastronomia`,
 * `/{lang}/experiencias` — cache class `catalog`, `s-maxage 3600`) for up to
 * an hour: correct in the database, invisible on the site, silent everywhere.
 *
 * These tests pin the wiring at the reconciler boundary — the primitive is a
 * best-effort, catch-everything side effect whose guard and tag mapping are
 * covered elsewhere; what matters here is that the reconciler CALLS it, with
 * the right vertical and the right payload, in BOTH directions:
 *
 * - **publish** (PRIVATE → PUBLIC): the payload is the post-write PUBLIC
 *   row, so the primitive's public-visibility guard passes and the index
 *   picks the listing up without waiting for the TTL.
 * - **unpublish** (PUBLIC → PRIVATE): the payload is the PRE-write PUBLIC
 *   row. The post-write row is PRIVATE and the primitive's guard would skip
 *   it — but the cached PUBLIC detail page and index entry are exactly what
 *   must be evicted. This mirrors the accommodation `_afterUpdate` rule
 *   ("an ACTIVE→DRAFT unpublish has to purge the page that just
 *   disappeared"): a listing that stopped being paid and stays on the public
 *   index is worse than the inverse.
 *
 * `isCommerceListingPubliclyVisible` is deliberately NOT stubbed (the mock
 * keeps the real one via `importOriginal`): the unpublish direction only
 * schedules if the real predicate recognises the pre-write row as public, so
 * stubbing it would let a broken predicate pass these tests.
 *
 * @module test/services/commerce/commerce-visibility-revalidation
 */

import { LifecycleStatusEnum, VisibilityEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    CommerceEntityModel,
    ResolveCommerceListingCompleteness
} from '../../../src/services/commerce/commerce-visibility';

const { mockSchedule, mockResolveDestinationSlug } = vi.hoisted(() => ({
    mockSchedule: vi.fn(),
    mockResolveDestinationSlug: vi.fn()
}));

vi.mock('../../../src/services/commerce/commerce-revalidation.js', async (importOriginal) => {
    // Keep the pure predicate and the logger REAL; only the side-effecting
    // pieces are stubbed. Replacing the whole module would stub
    // `isCommerceListingPubliclyVisible` too, and the unpublish direction
    // below would then be asserting a mock against a mock.
    const actual =
        await importOriginal<
            typeof import('../../../src/services/commerce/commerce-revalidation.js')
        >();
    return {
        ...actual,
        scheduleCommerceListingRevalidation: mockSchedule,
        resolveCommerceDestinationSlug: mockResolveDestinationSlug
    };
});

import { standaloneCommerceRevalidationLogger } from '../../../src/services/commerce/commerce-revalidation';
import { reconcileCommerceListingVisibility } from '../../../src/services/commerce/commerce-visibility';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENTITY_ID = '00000000-0000-4000-a000-000000000001';
const ENTITY_SLUG = 'la-parrilla-del-puerto';
const DESTINATION_ID = '00000000-0000-4000-a000-000000000002';

/** Shape the widened `CommerceEntityModel.findById` returns — enough for the
 * reconciler's read plus the purge payload it builds from that row. */
interface FakeRow {
    readonly id: string;
    readonly slug: string;
    readonly destinationId: string | null;
    readonly visibility: string;
    readonly lifecycleState: string;
    readonly moderationState?: string | null;
}

function makeModel(row: FakeRow | null): CommerceEntityModel {
    return {
        findById: vi.fn().mockResolvedValue(row),
        update: vi.fn().mockResolvedValue(row)
    };
}

/** Resolver stub that always reports the listing as complete. */
function makeAlwaysCompleteResolver(): ResolveCommerceListingCompleteness {
    return vi.fn().mockResolvedValue({ complete: true, missing: [] });
}

/** Resolver stub that always reports the listing as incomplete. */
function makeIncompleteResolver(): ResolveCommerceListingCompleteness {
    return vi.fn().mockResolvedValue({ complete: false, missing: ['priceRange'] });
}

// ---------------------------------------------------------------------------
// Publish direction (HOS-1337 — the reported bug)
// ---------------------------------------------------------------------------

describe('reconcileCommerceListingVisibility schedules the edge purge (HOS-1337)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        'gastronomy',
        'experience'
    ] as const)('schedules a purge when a paid %s listing publishes', async (entityType) => {
        // Arrange: a complete listing, already paid, still hidden.
        const model = makeModel({
            id: ENTITY_ID,
            slug: ENTITY_SLUG,
            destinationId: DESTINATION_ID,
            visibility: VisibilityEnum.PRIVATE,
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });

        // Act: the MP webhook reconciles the confirmed payment.
        const result = await reconcileCommerceListingVisibility(
            { entityType, entityId: ENTITY_ID, subscriptionStatus: 'active' },
            model,
            makeAlwaysCompleteResolver()
        );

        // Assert: the write happened AND the purge was scheduled with the
        // post-write PUBLIC row — the state the primitive's
        // public-visibility guard requires to actually purge.
        expect(result.updated).toBe(true);
        expect(mockSchedule).toHaveBeenCalledTimes(1);
        expect(mockSchedule).toHaveBeenCalledWith(
            expect.objectContaining({
                entityType,
                entity: {
                    id: ENTITY_ID,
                    slug: ENTITY_SLUG,
                    destinationId: DESTINATION_ID,
                    visibility: VisibilityEnum.PUBLIC,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                },
                resolveDestinationSlug: mockResolveDestinationSlug,
                logger: standaloneCommerceRevalidationLogger
            })
        );
    });

    // -----------------------------------------------------------------------
    // Unpublish direction (the inverse gap, fixed in the same place)
    // -----------------------------------------------------------------------

    it.each([
        'gastronomy',
        'experience'
    ] as const)('schedules a purge when a %s listing unpublishes — with the pre-write row that still holds the public footprint', async (entityType) => {
        // Arrange: a live, public listing whose subscription just fell.
        const model = makeModel({
            id: ENTITY_ID,
            slug: ENTITY_SLUG,
            destinationId: DESTINATION_ID,
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        // Act: the dunning cron reconciles the cancelled subscription.
        const result = await reconcileCommerceListingVisibility(
            { entityType, entityId: ENTITY_ID, subscriptionStatus: 'cancelled' },
            model,
            makeAlwaysCompleteResolver()
        );

        // Assert: the purge is scheduled with the PRE-write PUBLIC row.
        // Passing the post-write PRIVATE row would make the primitive's
        // guard skip the purge — leaving a listing nobody is paying for
        // on the public index for up to an hour.
        expect(result.updated).toBe(true);
        expect(mockSchedule).toHaveBeenCalledTimes(1);
        expect(mockSchedule).toHaveBeenCalledWith(
            expect.objectContaining({
                entityType,
                entity: {
                    id: ENTITY_ID,
                    slug: ENTITY_SLUG,
                    destinationId: DESTINATION_ID,
                    visibility: VisibilityEnum.PUBLIC,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                }
            })
        );
    });

    it('schedules the purge when an ACTIVE listing unpublishes because it turned incomplete (R-2 race)', async () => {
        // The other flavour of unpublish: the subscription is still healthy,
        // but the listing no longer meets the completeness gate.
        const model = makeModel({
            id: ENTITY_ID,
            slug: ENTITY_SLUG,
            destinationId: DESTINATION_ID,
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        const result = await reconcileCommerceListingVisibility(
            { entityType: 'gastronomy', entityId: ENTITY_ID, subscriptionStatus: 'active' },
            model,
            makeIncompleteResolver()
        );

        expect(result.updated).toBe(true);
        expect(mockSchedule).toHaveBeenCalledTimes(1);
        expect(mockSchedule).toHaveBeenCalledWith(
            expect.objectContaining({
                entityType: 'gastronomy',
                entity: expect.objectContaining({
                    id: ENTITY_ID,
                    visibility: VisibilityEnum.PUBLIC,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                })
            })
        );
    });

    // -----------------------------------------------------------------------
    // Negative cases: the purge fires on a transition, never on a no-op, and
    // only for verticals that have cached public pages.
    // -----------------------------------------------------------------------

    it('does not schedule when the listing is already in the reconciled state (no write, no purge)', async () => {
        const model = makeModel({
            id: ENTITY_ID,
            slug: ENTITY_SLUG,
            destinationId: DESTINATION_ID,
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        const result = await reconcileCommerceListingVisibility(
            { entityType: 'gastronomy', entityId: ENTITY_ID, subscriptionStatus: 'active' },
            model,
            makeAlwaysCompleteResolver()
        );

        expect(result.updated).toBe(false);
        expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('does not schedule when neither side of the write has a public footprint', async () => {
        // visibility PUBLIC but lifecycle INACTIVE is NOT publicly visible (the
        // guard is the PAIR) — the reconcile still writes over it (the desired
        // PRIVATE differs), and no purge is scheduled: this listing never had
        // a cached public page, so purging one is the HOS-203 waste case.
        const model = makeModel({
            id: ENTITY_ID,
            slug: ENTITY_SLUG,
            destinationId: DESTINATION_ID,
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });

        const result = await reconcileCommerceListingVisibility(
            { entityType: 'gastronomy', entityId: ENTITY_ID, subscriptionStatus: 'cancelled' },
            model,
            makeAlwaysCompleteResolver()
        );

        expect(result.updated).toBe(true);
        expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('does not schedule for a vertical with no cached public pages', async () => {
        const model = makeModel({
            id: ENTITY_ID,
            slug: ENTITY_SLUG,
            destinationId: DESTINATION_ID,
            visibility: VisibilityEnum.PRIVATE,
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });

        await reconcileCommerceListingVisibility(
            { entityType: 'accommodation', entityId: ENTITY_ID, subscriptionStatus: 'active' },
            model,
            makeAlwaysCompleteResolver()
        );

        expect(mockSchedule).not.toHaveBeenCalled();
    });
});
