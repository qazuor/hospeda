/**
 * Tests for the commerce visibility reconcile wiring (SPEC-239 T-050).
 *
 * Verifies that `reconcileCommerceListingForSubscription` (the bridge invoked by
 * the MP webhook + dunning/finalize crons) flips a linked commerce listing:
 *   - active  → PUBLIC  + ACTIVE
 *   - cancelled → PRIVATE + INACTIVE
 * and is a no-op when the subscription has no commerce link row.
 *
 * `@repo/db` is stubbed for the link lookup/update; the gastronomy model is
 * stubbed via `resolveCommerceEntityModel`-compatible behaviour. The real
 * reconciler (`reconcileCommerceListingVisibility` from @repo/service-core) runs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// ── @repo/db stub: link lookup + denormalized status update ────────────────
const linkRows: Array<{ entityType: string; entityId: string }> = [];
const selectWhere = vi.fn(() => Promise.resolve(linkRows));
const selectFrom = vi.fn(() => ({ where: selectWhere }));
const dbSelect = vi.fn(() => ({ from: selectFrom }));
const updateWhere = vi.fn(() => Promise.resolve(undefined));
const updateSet = vi.fn(() => ({ where: updateWhere }));
const dbUpdate = vi.fn(() => ({ set: updateSet }));

// ── gastronomy entity store the fake model reads/writes ────────────────────
// Backed directly into the mocked @repo/db `gastronomyModel`, so the REAL
// `resolveCommerceEntityModel` → REAL reconciler runs end-to-end against it.
const entityStore = new Map<string, { id: string; visibility: string; lifecycleState: string }>();

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({ select: dbSelect, update: dbUpdate })),
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    commerceListingSubscriptions: {
        subscriptionId: 'subscription_id',
        entityType: 'entity_type',
        entityId: 'entity_id',
        status: 'status'
    },
    // Real-shaped fake model: resolveCommerceEntityModel returns this for
    // entityType='gastronomy', and the real reconciler drives findById/update.
    gastronomyModel: {
        findById: (id: string) => Promise.resolve(entityStore.get(id) ?? null),
        update: (id: string, data: { visibility?: string; lifecycleState?: string }) => {
            const cur = entityStore.get(id);
            if (cur) entityStore.set(id, { ...cur, ...data });
            return Promise.resolve(undefined);
        }
    }
}));

import { reconcileCommerceListingForSubscription } from '../../src/services/commerce-reconcile.service';

const SUB_ID = '22222222-2222-4222-8222-222222222222';
const ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('reconcileCommerceListingForSubscription (SPEC-239 T-050)', () => {
    beforeEach(() => {
        linkRows.length = 0;
        entityStore.clear();
        dbSelect.mockClear();
        dbUpdate.mockClear();
        updateSet.mockClear();
    });

    it('flips a linked listing PUBLIC + ACTIVE on an active subscription', async () => {
        linkRows.push({ entityType: 'gastronomy', entityId: ENTITY_ID });
        entityStore.set(ENTITY_ID, {
            id: ENTITY_ID,
            visibility: 'PRIVATE',
            lifecycleState: 'INACTIVE'
        });

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_ID,
            subscriptionStatus: 'active',
            source: 'mp-webhook'
        });

        expect(entityStore.get(ENTITY_ID)).toEqual({
            id: ENTITY_ID,
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE'
        });
        // Denormalized link status kept in sync.
        expect(updateSet).toHaveBeenCalled();
    });

    it('hides a linked listing PRIVATE + INACTIVE on a cancelled subscription', async () => {
        linkRows.push({ entityType: 'gastronomy', entityId: ENTITY_ID });
        entityStore.set(ENTITY_ID, {
            id: ENTITY_ID,
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE'
        });

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_ID,
            subscriptionStatus: 'cancelled',
            source: 'dunning-cron'
        });

        expect(entityStore.get(ENTITY_ID)).toEqual({
            id: ENTITY_ID,
            visibility: 'PRIVATE',
            lifecycleState: 'INACTIVE'
        });
    });

    it('is a no-op when the subscription has no commerce link row', async () => {
        // linkRows empty → accommodation subscription path.
        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_ID,
            subscriptionStatus: 'cancelled',
            source: 'finalize-cancelled-cron'
        });

        // No status update issued, no entity touched.
        expect(updateSet).not.toHaveBeenCalled();
        expect(entityStore.size).toBe(0);
    });

    it('does not throw when the reconcile lookup fails (non-blocking)', async () => {
        selectWhere.mockRejectedValueOnce(new Error('db down'));

        await expect(
            reconcileCommerceListingForSubscription({
                subscriptionId: SUB_ID,
                subscriptionStatus: 'active',
                source: 'mp-webhook'
            })
        ).resolves.toBeUndefined();
    });
});
