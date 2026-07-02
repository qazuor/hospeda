/**
 * Unit Tests: featured-entitlement resolver helpers (SPEC-309 T-004 / T-021)
 *
 * Tests `packages/service-core/src/services/accommodation/featured-entitlement.resolver.ts`
 * without a live DB. `getDb()` is mocked to return a stub client exposing
 * `.select()` and `.execute()`; each Drizzle query chain is simulated with a
 * thenable+chainable mock (see `makeChain`) so the same mock works whether
 * the call site chains `.limit(1)` or awaits `.where(...)` directly.
 *
 * Coverage:
 * - `resolveOwnerPlanGrantsFeatured`: no customer / no qualifying subscription
 *   (paused/past_due/cancelled are excluded by the SQL `status IN (...)`
 *   filter itself, simulated here as an empty `db.execute` result) / active,
 *   trialing, comp subscriptions on a FEATURED_LISTING plan / plan missing
 *   the entitlement / plan lookup miss / commerce-domain subscription
 *   excluded (SPEC-239 isolation) / the executed query's status list is
 *   exactly the active/trialing/comp set.
 * - `resolveAccommodationHasActiveFeaturedAddon`: grant found vs none, plus
 *   the WHERE construction includes the status='active' and
 *   (no-expiry OR future-expiry) predicates.
 * - `getOwnerAccommodationIdsWithActiveFeaturedAddon`: protected id set for a
 *   mixed portfolio, empty array when none.
 *
 * @module test/services/accommodation/featured-entitlement.resolver
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mock functions so they are available inside vi.mock() factories.
// ---------------------------------------------------------------------------

const { mockSelect, mockExecute, mockGetDb } = vi.hoisted(() => ({
    mockSelect: vi.fn(),
    mockExecute: vi.fn(),
    mockGetDb: vi.fn()
}));

// ---------------------------------------------------------------------------
// Mock @repo/db so we can intercept the Drizzle chain without a real PG connection.
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => {
    const sqlTag = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values
    }));
    // sql.join(...) — used to build the `status IN (...)` fragment list.
    (sqlTag as unknown as { join: ReturnType<typeof vi.fn> }).join = vi.fn(
        (fragments: unknown[], separator: unknown) => ({ fragments, separator })
    );

    return {
        accommodations: { id: 'id', ownerId: 'owner_id', deletedAt: 'deleted_at' },
        billingCustomers: { id: 'id', externalId: 'external_id', deletedAt: 'deleted_at' },
        billingPlans: { id: 'id', entitlements: 'entitlements', deletedAt: 'deleted_at' },
        billingAddonPurchases: { id: 'id', status: 'status', expiresAt: 'expires_at' },
        featuredListingAddonGrants: {
            id: 'id',
            accommodationId: 'accommodation_id',
            purchaseId: 'purchase_id'
        },
        eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
        and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
        or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
        isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
        gt: vi.fn((col: unknown, val: unknown) => ({ op: 'gt', col, val })),
        sql: sqlTag,
        getDb: mockGetDb
    };
});

// ---------------------------------------------------------------------------
// Import AFTER mocks are in place
// ---------------------------------------------------------------------------

import { EntitlementKey } from '@repo/billing';
import { and, eq, gt, isNull, or } from '@repo/db';
import {
    getOwnerAccommodationIdsWithActiveFeaturedAddon,
    resolveAccommodationHasActiveFeaturedAddon,
    resolveOwnerPlanGrantsFeatured
} from '../../../src/services/accommodation/featured-entitlement.resolver.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A thenable + chainable Drizzle query-builder stub.
 *
 * Every chain method (`from`, `innerJoin`, `where`, `limit`) returns the same
 * object, and the object itself is thenable, resolving to `result`. This
 * lets one factory cover both usage shapes in the resolver module:
 * `select(...).from(...).where(...).limit(1)` and
 * `select(...).from(...).innerJoin(...).innerJoin(...).where(...)` (no `.limit`,
 * awaited directly).
 */
function makeChain(result: unknown) {
    const resolved = Promise.resolve(result);
    const chain: {
        from: ReturnType<typeof vi.fn>;
        innerJoin: ReturnType<typeof vi.fn>;
        where: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
        then: Promise<unknown>['then'];
    } = {
        from: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of Drizzle's awaitable query builder
        then: resolved.then.bind(resolved)
    };
    return chain;
}

// ---------------------------------------------------------------------------
// resolveOwnerPlanGrantsFeatured
// ---------------------------------------------------------------------------

describe('resolveOwnerPlanGrantsFeatured', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDb.mockReturnValue({ select: mockSelect, execute: mockExecute });
    });

    it('returns false when the owner has no billing customer', async () => {
        mockSelect.mockReturnValueOnce(makeChain([]));

        const result = await resolveOwnerPlanGrantsFeatured({ ownerId: 'owner-1' });

        expect(result).toBe(false);
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it.each(['paused', 'past_due', 'cancelled'] as const)(
        'returns false when the customer has no active/trialing/comp subscription (e.g. only a %s one exists, excluded by the SQL status filter)',
        async (_status) => {
            mockSelect.mockReturnValueOnce(makeChain([{ id: 'cust-1' }]));
            mockExecute.mockResolvedValueOnce({ rows: [] });

            const result = await resolveOwnerPlanGrantsFeatured({ ownerId: 'owner-1' });

            expect(result).toBe(false);
        }
    );

    it.each(['active', 'trialing', 'comp'] as const)(
        'returns true for a %s subscription on a FEATURED_LISTING plan',
        async (status) => {
            mockSelect
                .mockReturnValueOnce(makeChain([{ id: 'cust-1' }]))
                .mockReturnValueOnce(
                    makeChain([{ entitlements: [EntitlementKey.FEATURED_LISTING] }])
                );
            mockExecute.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'sub-1',
                        plan_id: 'plan-1',
                        status,
                        product_domain: 'accommodation'
                    }
                ]
            });

            const result = await resolveOwnerPlanGrantsFeatured({ ownerId: 'owner-1' });

            expect(result).toBe(true);
        }
    );

    it('returns false when the plan does not include FEATURED_LISTING', async () => {
        mockSelect
            .mockReturnValueOnce(makeChain([{ id: 'cust-1' }]))
            .mockReturnValueOnce(makeChain([{ entitlements: ['some_other_entitlement'] }]));
        mockExecute.mockResolvedValueOnce({
            rows: [
                {
                    id: 'sub-1',
                    plan_id: 'plan-1',
                    status: 'active',
                    product_domain: 'accommodation'
                }
            ]
        });

        const result = await resolveOwnerPlanGrantsFeatured({ ownerId: 'owner-1' });

        expect(result).toBe(false);
    });

    it('returns false when the plan lookup finds no matching plan', async () => {
        mockSelect
            .mockReturnValueOnce(makeChain([{ id: 'cust-1' }]))
            .mockReturnValueOnce(makeChain([]));
        mockExecute.mockResolvedValueOnce({
            rows: [
                {
                    id: 'sub-1',
                    plan_id: 'plan-1',
                    status: 'active',
                    product_domain: 'accommodation'
                }
            ]
        });

        const result = await resolveOwnerPlanGrantsFeatured({ ownerId: 'owner-1' });

        expect(result).toBe(false);
    });

    it('excludes a commerce-domain subscription (SPEC-239 isolation) even if returned by the query', async () => {
        mockSelect.mockReturnValueOnce(makeChain([{ id: 'cust-1' }]));
        mockExecute.mockResolvedValueOnce({
            rows: [{ id: 'sub-1', plan_id: 'plan-1', status: 'active', product_domain: 'commerce' }]
        });

        const result = await resolveOwnerPlanGrantsFeatured({ ownerId: 'owner-1' });

        // No accommodation-domain subscription found → returns false before
        // ever reaching the plan lookup.
        expect(result).toBe(false);
        expect(mockSelect).toHaveBeenCalledTimes(1);
    });

    it('queries billing_subscriptions filtered to exactly the active/trialing/comp statuses', async () => {
        mockSelect.mockReturnValueOnce(makeChain([{ id: 'cust-1' }]));
        mockExecute.mockResolvedValueOnce({ rows: [] });

        await resolveOwnerPlanGrantsFeatured({ ownerId: 'owner-1' });

        expect(mockExecute).toHaveBeenCalledTimes(1);
        const executedQuery = mockExecute.mock.calls[0]?.[0] as { values: unknown[] };
        // The status list is built via sql.join(['active','trialing','comp'].map(sql`${s}`), ...)
        // — the interpolated sql fragments carry the raw status strings as their `values`.
        const statusFragments = executedQuery.values[1] as {
            fragments: { values: unknown[] }[];
        };
        const statuses = statusFragments.fragments.flatMap((f) => f.values);
        expect(statuses).toEqual(['active', 'trialing', 'comp']);
    });
});

// ---------------------------------------------------------------------------
// resolveAccommodationHasActiveFeaturedAddon
// ---------------------------------------------------------------------------

describe('resolveAccommodationHasActiveFeaturedAddon', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDb.mockReturnValue({ select: mockSelect, execute: mockExecute });
    });

    it('returns true when an active grant row is found', async () => {
        mockSelect.mockReturnValueOnce(makeChain([{ id: 'grant-1' }]));

        const result = await resolveAccommodationHasActiveFeaturedAddon({
            accommodationId: 'acc-1'
        });

        expect(result).toBe(true);
    });

    it('returns false when no grant row is found (covers expired, cancelled-status, and no-link-row cases — all excluded by the WHERE clause)', async () => {
        mockSelect.mockReturnValueOnce(makeChain([]));

        const result = await resolveAccommodationHasActiveFeaturedAddon({
            accommodationId: 'acc-1'
        });

        expect(result).toBe(false);
    });

    it('builds the WHERE clause with status=active and (no-expiry OR future-expiry)', async () => {
        mockSelect.mockReturnValueOnce(makeChain([]));

        await resolveAccommodationHasActiveFeaturedAddon({ accommodationId: 'acc-1' });

        expect(eq).toHaveBeenCalledWith('accommodation_id', 'acc-1');
        expect(eq).toHaveBeenCalledWith('status', 'active');
        expect(isNull).toHaveBeenCalledWith('expires_at');
        expect(gt).toHaveBeenCalledWith('expires_at', expect.any(Date));
        expect(or).toHaveBeenCalledTimes(1);
        expect(and).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// getOwnerAccommodationIdsWithActiveFeaturedAddon
// ---------------------------------------------------------------------------

describe('getOwnerAccommodationIdsWithActiveFeaturedAddon', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDb.mockReturnValue({ select: mockSelect, execute: mockExecute });
    });

    it('returns exactly the protected accommodation ids for a mixed portfolio', async () => {
        mockSelect.mockReturnValueOnce(
            makeChain([{ accommodationId: 'acc-1' }, { accommodationId: 'acc-3' }])
        );

        const result = await getOwnerAccommodationIdsWithActiveFeaturedAddon({
            ownerId: 'owner-1'
        });

        expect(result).toEqual(['acc-1', 'acc-3']);
    });

    it('returns an empty array when the owner has no active featured-listing addon grants', async () => {
        mockSelect.mockReturnValueOnce(makeChain([]));

        const result = await getOwnerAccommodationIdsWithActiveFeaturedAddon({
            ownerId: 'owner-1'
        });

        expect(result).toEqual([]);
    });

    it('filters by ownerId, non-deleted accommodations, and an active/unexpired grant', async () => {
        mockSelect.mockReturnValueOnce(makeChain([]));

        await getOwnerAccommodationIdsWithActiveFeaturedAddon({ ownerId: 'owner-1' });

        expect(eq).toHaveBeenCalledWith('owner_id', 'owner-1');
        expect(eq).toHaveBeenCalledWith('status', 'active');
        expect(isNull).toHaveBeenCalledWith('deleted_at');
        expect(isNull).toHaveBeenCalledWith('expires_at');
        expect(gt).toHaveBeenCalledWith('expires_at', expect.any(Date));
    });
});
