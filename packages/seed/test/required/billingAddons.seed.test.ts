/**
 * Unit tests for the billing add-ons seed (SPEC-192 T-005).
 *
 * WHY UNIT (NOT INTEGRATION):
 * The existing seed-test pattern in this package (see billingPlans.seed.test.ts)
 * is mock/unit-based: `ensureAddon` accepts an injectable `db` parameter so tests
 * use an in-memory stub and never require a live PostgreSQL connection. Following
 * that same pattern here avoids standing up or resetting any database, keeps the
 * suite fast, and matches the project's CI constraints.
 *
 * WHAT THIS VERIFIES:
 * 1. Idempotency: running ensureAddon twice for the same addon does NOT produce a
 *    second insert (row count stays at ALL_ADDONS.length regardless of how many
 *    times the seed function is invoked).
 * 2. Mapper schema match: the column/metadata layout written by ensureAddon is
 *    exactly what mapRowToAddonDefinition reads (slug, targetCategories, limits
 *    JSONB, entitlements array, billingInterval).
 * 3. Skip-by-name branch: when the DB already has a row matching addon.name, the
 *    function returns { status: 'skipped' } and makes no insert call.
 *
 * @module test/required/billingAddons.seed
 */

import type { AddonDefinition } from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @repo/billing — the dist may not be built in the worktree.
// ensureAddon tests use injectable `db` and do not call ALL_ADDONS at runtime;
// the mock prevents module-resolution failure at import time.
// ---------------------------------------------------------------------------

vi.mock('@repo/billing', () => ({
    ALL_ADDONS: []
}));

// ---------------------------------------------------------------------------
// Mock the logger and summaryTracker so tests do not produce terminal noise.
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../src/utils/summaryTracker.js', () => ({
    summaryTracker: {
        trackSuccess: vi.fn(),
        trackError: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Import under test — done AFTER vi.mock calls so hoisting works correctly.
// ---------------------------------------------------------------------------

import { _internals } from '../../src/required/billingAddons.seed.js';

// ---------------------------------------------------------------------------
// In-memory DB stub matching the small slice of DrizzleClient ensureAddon uses.
// ---------------------------------------------------------------------------

interface StubState {
    /** Pre-loaded SELECT results: each call to db.select() pops from the front */
    selectQueue: Array<Array<Record<string, unknown>>>;
    /** All insert calls recorded here for assertion */
    insertCalls: Array<{ table: unknown; values: Record<string, unknown> }>;
}

function makeStubDb(state: StubState): DrizzleClient {
    function makeSelectChain<T>(rows: T[]) {
        const chain = {
            from: () => chain,
            where: () => chain,
            limit: async () => rows
        };
        return chain;
    }

    function makeInsertChain(table: unknown) {
        return {
            values(values: Record<string, unknown>) {
                state.insertCalls.push({ table, values });
                return Promise.resolve(undefined);
            }
        };
    }

    const stub = {
        select: () => makeSelectChain(state.selectQueue.shift() ?? []),
        insert: (table: unknown) => makeInsertChain(table)
    };
    return stub as unknown as DrizzleClient;
}

function freshState(): StubState {
    return { selectQueue: [], insertCalls: [] };
}

// ---------------------------------------------------------------------------
// Test fixture factory — mirrors the shape of AddonDefinition
// ---------------------------------------------------------------------------

function makeAddon(overrides: Partial<AddonDefinition> = {}): AddonDefinition {
    return {
        slug: 'visibility-boost-7d',
        name: 'Visibility Boost (7 days)',
        description: 'Your accommodation appears featured in search results for 7 days.',
        billingType: 'one_time',
        priceArs: 500000,
        annualPriceArs: null,
        durationDays: 7,
        affectsLimitKey: null,
        limitIncrease: null,
        grantsEntitlement: 'featured_listing' as AddonDefinition['grantsEntitlement'],
        targetCategories: ['owner', 'complex'],
        isActive: true,
        sortOrder: 1,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// ensureAddon — idempotency (skip-by-name branch)
// ---------------------------------------------------------------------------

describe('ensureAddon — idempotency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns { status: "skipped" } and makes no insert when a row with the same name already exists', async () => {
        // Arrange: DB already has a row for this addon name
        const state = freshState();
        const addon = makeAddon();
        state.selectQueue.push([{ id: 'existing-uuid', name: addon.name }]);
        const db = makeStubDb(state);

        // Act
        const result = await _internals.ensureAddon(addon, false, db);

        // Assert
        expect(result).toEqual({ status: 'skipped' });
        expect(state.insertCalls).toHaveLength(0);
    });

    it('returns { status: "created" } and inserts when no row exists', async () => {
        // Arrange: DB is empty for this addon name
        const state = freshState();
        const addon = makeAddon();
        state.selectQueue.push([]); // no existing row
        const db = makeStubDb(state);

        // Act
        const result = await _internals.ensureAddon(addon, false, db);

        // Assert
        expect(result).toEqual({ status: 'created' });
        expect(state.insertCalls).toHaveLength(1);
    });

    it('idempotency simulation: running ensureAddon twice leaves insert count at 1 (row already present on second call)', async () => {
        // Arrange: first call finds no row; second call simulates the row now existing
        const state = freshState();
        const addon = makeAddon();
        state.selectQueue.push([]); // first call: no row → insert
        state.selectQueue.push([{ id: 'new-uuid', name: addon.name }]); // second call: row exists → skip

        const db = makeStubDb(state);

        // Act: simulate running the seed twice
        const first = await _internals.ensureAddon(addon, false, db);
        const second = await _internals.ensureAddon(addon, false, db);

        // Assert: exactly one insert, second call skipped
        expect(first.status).toBe('created');
        expect(second.status).toBe('skipped');
        expect(state.insertCalls).toHaveLength(1);
    });

    it('idempotency covers ALL_ADDONS.length = 5: simulating 5 addons all pre-existing produces 0 inserts', async () => {
        // Arrange: 5 select calls all return an existing row
        const state = freshState();
        const addons = Array.from({ length: 5 }, (_, i) =>
            makeAddon({ slug: `addon-${i}`, name: `Addon ${i}` })
        );
        for (const _ of addons) {
            state.selectQueue.push([{ id: `uuid-${_}`, name: _.name }]);
        }
        const db = makeStubDb(state);

        // Act: run ensureAddon for all 5 addons (simulates the seed loop)
        const results = await Promise.all(addons.map((a) => _internals.ensureAddon(a, false, db)));

        // Assert: all skipped, no inserts — row count stays at 5 (pre-existing)
        expect(results.every((r) => r.status === 'skipped')).toBe(true);
        expect(state.insertCalls).toHaveLength(0);
    });

    it('idempotency covers ALL_ADDONS.length = 5: simulating 5 new addons produces exactly 5 inserts', async () => {
        // Arrange: 5 select calls all return empty (no existing rows)
        const state = freshState();
        const addons = Array.from({ length: 5 }, (_, i) =>
            makeAddon({ slug: `addon-${i}`, name: `Addon ${i}` })
        );
        for (const _a of addons) {
            state.selectQueue.push([]); // no existing row for each
        }
        const db = makeStubDb(state);

        // Act
        const results = await Promise.all(addons.map((a) => _internals.ensureAddon(a, false, db)));

        // Assert: all created, exactly 5 inserts
        expect(results.every((r) => r.status === 'created')).toBe(true);
        expect(state.insertCalls).toHaveLength(5);
    });
});

// ---------------------------------------------------------------------------
// ensureAddon — mapper schema match (T-005 requirement)
//
// Verifies the inserted column/metadata layout matches exactly what
// addon-catalog.mapper.ts:mapRowToAddonDefinition reads.
// ---------------------------------------------------------------------------

describe('ensureAddon — mapper schema match', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('writes metadata.slug (mapper reads this as primary identifier)', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        const addon = makeAddon({ slug: 'visibility-boost-7d' });
        await _internals.ensureAddon(addon, false, makeStubDb(state));

        const values = state.insertCalls[0]?.values;
        const metadata = values?.metadata as Record<string, unknown>;
        expect(metadata.slug).toBe('visibility-boost-7d');
    });

    it('writes metadata.targetCategories as array (mapper reads and filters owner|complex)', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        const addon = makeAddon({ targetCategories: ['owner', 'complex'] });
        await _internals.ensureAddon(addon, false, makeStubDb(state));

        const values = state.insertCalls[0]?.values;
        const metadata = values?.metadata as Record<string, unknown>;
        expect(metadata.targetCategories).toEqual(['owner', 'complex']);
    });

    it('writes limits JSONB as { [limitKey]: limitIncrease } (mapper reads first entry as affectsLimitKey/limitIncrease)', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        const addon = makeAddon({
            affectsLimitKey: 'max_photos_per_accommodation' as AddonDefinition['affectsLimitKey'],
            limitIncrease: 20,
            grantsEntitlement: null
        });
        await _internals.ensureAddon(addon, false, makeStubDb(state));

        const values = state.insertCalls[0]?.values;
        expect(values?.limits).toEqual({ max_photos_per_accommodation: 20 });
    });

    it('writes empty limits object when affectsLimitKey is null', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        const addon = makeAddon({ affectsLimitKey: null, limitIncrease: null });
        await _internals.ensureAddon(addon, false, makeStubDb(state));

        const values = state.insertCalls[0]?.values;
        expect(values?.limits).toEqual({});
    });

    it('writes entitlements as [grantsEntitlement] (mapper reads entitlements[0] as grantsEntitlement)', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        const addon = makeAddon({
            grantsEntitlement: 'featured_listing' as AddonDefinition['grantsEntitlement']
        });
        await _internals.ensureAddon(addon, false, makeStubDb(state));

        const values = state.insertCalls[0]?.values;
        expect(values?.entitlements).toEqual(['featured_listing']);
    });

    it('writes empty entitlements array when grantsEntitlement is null', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        const addon = makeAddon({ grantsEntitlement: null });
        await _internals.ensureAddon(addon, false, makeStubDb(state));

        const values = state.insertCalls[0]?.values;
        expect(values?.entitlements).toEqual([]);
    });

    it('writes billingInterval "one_time" for one_time billingType (mapper maps one_time → billingType="one_time")', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        const addon = makeAddon({ billingType: 'one_time' });
        await _internals.ensureAddon(addon, false, makeStubDb(state));

        const values = state.insertCalls[0]?.values;
        expect(values?.billingInterval).toBe('one_time');
    });

    it('writes billingInterval "month" for recurring billingType (mapper maps non-one_time → "recurring")', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        const addon = makeAddon({ billingType: 'recurring' });
        await _internals.ensureAddon(addon, false, makeStubDb(state));

        const values = state.insertCalls[0]?.values;
        expect(values?.billingInterval).toBe('month');
    });

    it('writes metadata.durationDays (mapper reads durationDays from metadata)', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        const addon = makeAddon({ durationDays: 30 });
        await _internals.ensureAddon(addon, false, makeStubDb(state));

        const values = state.insertCalls[0]?.values;
        const metadata = values?.metadata as Record<string, unknown>;
        expect(metadata.durationDays).toBe(30);
    });

    it('writes metadata.sortOrder (mapper reads sortOrder from metadata)', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        const addon = makeAddon({ sortOrder: 3 });
        await _internals.ensureAddon(addon, false, makeStubDb(state));

        const values = state.insertCalls[0]?.values;
        const metadata = values?.metadata as Record<string, unknown>;
        expect(metadata.sortOrder).toBe(3);
    });

    it('writes unitAmount as priceArs (mapper reads unitAmount as priceArs)', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        const addon = makeAddon({ priceArs: 1500000 });
        await _internals.ensureAddon(addon, false, makeStubDb(state));

        const values = state.insertCalls[0]?.values;
        expect(values?.unitAmount).toBe(1500000);
    });

    it('writes active from isActive (mapper reads active as isActive)', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        const addon = makeAddon({ isActive: false });
        await _internals.ensureAddon(addon, false, makeStubDb(state));

        const values = state.insertCalls[0]?.values;
        expect(values?.active).toBe(false);
    });

    it('forwards livemode=true to the insert in production mode', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        await _internals.ensureAddon(makeAddon(), true, makeStubDb(state));

        expect(state.insertCalls[0]?.values.livemode).toBe(true);
    });

    it('forwards livemode=false to the insert in dev/test mode', async () => {
        const state = freshState();
        state.selectQueue.push([]);
        await _internals.ensureAddon(makeAddon(), false, makeStubDb(state));

        expect(state.insertCalls[0]?.values.livemode).toBe(false);
    });
});
