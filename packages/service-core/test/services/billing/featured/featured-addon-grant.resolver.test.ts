/**
 * Unit tests: entity-generic featured-addon grant reads (HOS-1286).
 *
 * `featured_listing_addon_grants` used to have a foreign key to
 * `accommodations.id`. That key, and not any line of code, was what guaranteed
 * a grant could only ever name an accommodation. HOS-1286 dropped it to make
 * the link polymorphic, and moved the guarantee into every query in
 * `featured-addon-grant.resolver.ts`: each one filters on `entity_type` AND
 * `entity_id`.
 *
 * **These tests exist to hold that relocation.** A query that matched on the id
 * alone would still pass every pre-HOS-1286 test — the ids are the same, the
 * joins are the same, and the only difference is a grant of the WRONG VERTICAL
 * quietly matching. So the assertions below check both columns explicitly, and
 * the cross-vertical cases feed the resolver a grant store where the same id
 * exists under two verticals.
 *
 * @module test/services/billing/featured/featured-addon-grant.resolver
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSelect, mockSelectDistinct, mockGetDb } = vi.hoisted(() => ({
    mockSelect: vi.fn(),
    mockSelectDistinct: vi.fn(),
    mockGetDb: vi.fn()
}));

vi.mock('@repo/db', () => ({
    billingAddonPurchases: { id: 'id', status: 'status', expiresAt: 'expires_at' },
    featuredListingAddonGrants: {
        id: 'id',
        purchaseId: 'purchase_id',
        entityType: 'entity_type',
        entityId: 'entity_id'
    },
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    gt: vi.fn((col: unknown, val: unknown) => ({ op: 'gt', col, val })),
    inArray: vi.fn((col: unknown, vals: unknown) => ({ op: 'inArray', col, vals })),
    getDb: mockGetDb
}));

import { and, eq, inArray } from '@repo/db';
import {
    FEATURABLE_ENTITY_TYPES,
    getActiveFeaturedGrantEntityIds,
    getEntityIdsWithActiveFeaturedAddon,
    getFeaturedAddonGrantTarget,
    resolveEntityHasActiveFeaturedAddon,
    resolveFeaturableEntityType
} from '../../../../src/services/billing/featured/featured-addon-grant.resolver.js';

/**
 * A thenable + chainable Drizzle query-builder stub, resolving to `result`.
 * Covers both shapes the module uses: `.where(...).limit(1)` and a bare
 * `.where(...)` awaited directly.
 */
function makeChain(result: unknown) {
    const resolved = Promise.resolve(result);
    const chain: Record<string, unknown> = {
        from: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of Drizzle's awaitable builder
        then: resolved.then.bind(resolved)
    };
    return chain;
}

/**
 * Reads back every `eq(col, val)` the module built for the last call.
 *
 * Asserting through the recorded calls rather than the returned rows is what
 * makes the cross-vertical cases meaningful: the stub cannot execute SQL, so
 * "did the query carry the type filter" is only answerable at this level.
 */
function eqCalls(): [unknown, unknown][] {
    return vi.mocked(eq).mock.calls as unknown as [unknown, unknown][];
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockReturnValue({ select: mockSelect, selectDistinct: mockSelectDistinct });
});

// ---------------------------------------------------------------------------
// resolveFeaturableEntityType
// ---------------------------------------------------------------------------

describe('resolveFeaturableEntityType', () => {
    it('passes through each of the three verticals that own featurable listings', () => {
        expect(resolveFeaturableEntityType({ productDomain: 'accommodation' })).toBe(
            'accommodation'
        );
        expect(resolveFeaturableEntityType({ productDomain: 'gastronomy' })).toBe('gastronomy');
        expect(resolveFeaturableEntityType({ productDomain: 'experience' })).toBe('experience');
    });

    it('exposes exactly those three, and no billing-mechanism domain', () => {
        // Frozen deliberately: `partner`, `tourist` and `addon` are
        // `ProductDomainEnum` members with no featurable listing, and a fourth
        // entry appearing here would silently make grants writable against a
        // table that does not exist.
        expect([...FEATURABLE_ENTITY_TYPES]).toEqual(['accommodation', 'gastronomy', 'experience']);
    });

    it('FAILS CLOSED for an add-on that declares no domain', () => {
        // This is the case an operator creates through the SPEC-168 admin UI:
        // a slug the catalogue does not know. Answering `'accommodation'` here
        // is the `??` default HOS-1078 removed one layer down, and it would
        // write a grant against a table the add-on has nothing to do with.
        expect(resolveFeaturableEntityType({ productDomain: undefined })).toBeUndefined();
    });

    it.each([
        'partner',
        'tourist',
        'addon'
    ] as const)('FAILS CLOSED for the non-listing domain %s', (domain) => {
        expect(resolveFeaturableEntityType({ productDomain: domain })).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// resolveEntityHasActiveFeaturedAddon
// ---------------------------------------------------------------------------

describe('resolveEntityHasActiveFeaturedAddon', () => {
    it.each([
        'accommodation',
        'gastronomy',
        'experience'
    ] as const)('scopes the read to BOTH entity_type and entity_id for %s', async (entityType) => {
        mockSelect.mockReturnValueOnce(makeChain([{ id: 'grant-1' }]));

        const held = await resolveEntityHasActiveFeaturedAddon({
            entityType,
            entityId: 'listing-1'
        });

        expect(held).toBe(true);
        // The pair, not just the id. An `entity_id`-only filter is exactly
        // what the dropped foreign key used to make impossible.
        expect(eqCalls()).toContainEqual(['entity_type', entityType]);
        expect(eqCalls()).toContainEqual(['entity_id', 'listing-1']);
        // …and still only counts a LIVE purchase.
        expect(eqCalls()).toContainEqual(['status', 'active']);
    });

    it('never asks a question that could match another vertical', async () => {
        // The sharpest case, and the one a pre-HOS-1286 query passes: a
        // gastronomy id and an accommodation id can collide (nothing in the
        // schema forbids it now that the FK is gone). The ONLY thing separating
        // them is that this call names its vertical, so assert the type filter
        // is present with the value asked for — not merely that some type
        // filter exists.
        mockSelect.mockReturnValueOnce(makeChain([]));

        await resolveEntityHasActiveFeaturedAddon({
            entityType: 'gastronomy',
            entityId: 'shared-uuid'
        });

        expect(eqCalls()).toContainEqual(['entity_type', 'gastronomy']);
        expect(eqCalls()).not.toContainEqual(['entity_type', 'accommodation']);
    });

    it('answers false when no live grant matches', async () => {
        mockSelect.mockReturnValueOnce(makeChain([]));

        await expect(
            resolveEntityHasActiveFeaturedAddon({
                entityType: 'experience',
                entityId: 'exp-1'
            })
        ).resolves.toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getEntityIdsWithActiveFeaturedAddon
// ---------------------------------------------------------------------------

describe('getEntityIdsWithActiveFeaturedAddon', () => {
    it.each([
        'accommodation',
        'gastronomy',
        'experience'
    ] as const)('narrows the candidate set within %s only', async (entityType) => {
        mockSelect.mockReturnValueOnce(makeChain([{ entityId: 'a' }, { entityId: 'c' }]));

        const result = await getEntityIdsWithActiveFeaturedAddon({
            entityType,
            entityIds: ['a', 'b', 'c']
        });

        expect(result).toEqual(['a', 'c']);
        expect(eqCalls()).toContainEqual(['entity_type', entityType]);
        expect(inArray).toHaveBeenCalledWith('entity_id', ['a', 'b', 'c']);
    });

    it('returns [] WITHOUT querying when the candidate set is empty', async () => {
        // `inArray(col, [])` is a SQL syntax error in Drizzle, not an empty
        // match, so the early return is load-bearing rather than an
        // optimisation.
        const result = await getEntityIdsWithActiveFeaturedAddon({
            entityType: 'gastronomy',
            entityIds: []
        });

        expect(result).toEqual([]);
        expect(mockSelect).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// getActiveFeaturedGrantEntityIds
// ---------------------------------------------------------------------------

describe('getActiveFeaturedGrantEntityIds', () => {
    it.each([
        'gastronomy',
        'experience'
    ] as const)('sweeps only the %s vertical', async (entityType) => {
        mockSelectDistinct.mockReturnValueOnce(
            makeChain([{ entityId: 'l-1' }, { entityId: 'l-2' }])
        );

        const result = await getActiveFeaturedGrantEntityIds({ entityType });

        expect(result).toEqual(['l-1', 'l-2']);
        // The reconcile cron uses this as the COMPLETE expected set for a
        // vertical. Without the type filter it would hand a gastronomy sweep
        // every experience's grants and clear the flags of both.
        expect(eqCalls()).toContainEqual(['entity_type', entityType]);
        expect(and).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// getFeaturedAddonGrantTarget
// ---------------------------------------------------------------------------

describe('getFeaturedAddonGrantTarget', () => {
    it('returns the vertical alongside the id, so callers never assume one', async () => {
        mockSelect.mockReturnValueOnce(
            makeChain([{ entityType: 'gastronomy', entityId: 'gastro-9' }])
        );

        await expect(getFeaturedAddonGrantTarget({ purchaseId: 'p-1' })).resolves.toEqual({
            entityType: 'gastronomy',
            entityId: 'gastro-9'
        });
    });

    it('is undefined for a purchase with no grant row', async () => {
        // The HOS-675 gap, and every non-targeted add-on. Callers must not write
        // anything for it.
        mockSelect.mockReturnValueOnce(makeChain([]));

        await expect(
            getFeaturedAddonGrantTarget({ purchaseId: 'p-none' })
        ).resolves.toBeUndefined();
    });

    it('is NOT filtered by purchase status', async () => {
        // The expiry path calls this to find the listing it is expiring. A
        // status filter here would make an expired boost impossible to clear —
        // it would stay featured forever, which is product given away for free.
        mockSelect.mockReturnValueOnce(
            makeChain([{ entityType: 'accommodation', entityId: 'acc-1' }])
        );

        await getFeaturedAddonGrantTarget({ purchaseId: 'p-expired' });

        expect(eqCalls()).not.toContainEqual(['status', 'active']);
    });
});
