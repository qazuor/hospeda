/**
 * Unit tests for the HOS-176 plan price-change enqueue seam.
 *
 * Pure functions (`resolvePriceChangeDirection`, `computeEffectiveAt`) are tested
 * directly; `enqueuePlanPriceChange` is tested against a mocked `@repo/db` (no live
 * database) verifying the inserted row shape and the returned blast-radius count.
 *
 * @module test/services/billing/plan-price-change.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock @repo/db (column handles + operator stubs only) ──────────────────
vi.mock('@repo/db', () => ({
    billingPlanPriceChanges: { id: 'id' },
    billingSubscriptions: {
        planId: 'planId',
        status: 'status',
        mpSubscriptionId: 'mpSubscriptionId'
    },
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    inArray: vi.fn((col: unknown, vals: unknown) => ({ type: 'inArray', col, vals })),
    isNotNull: vi.fn((col: unknown) => ({ type: 'isNotNull', col })),
    count: vi.fn(() => ({ type: 'count' })),
    sql: vi.fn((strings: TemplateStringsArray) => ({ type: 'sql', strings }))
}));

import {
    computeEffectiveAt,
    enqueuePlanPriceChange,
    PRICE_INCREASE_NOTICE_GRACE_DAYS,
    resolvePriceChangeDirection
} from '../../../src/services/billing/plan/plan-price-change.service.js';

describe('resolvePriceChangeDirection', () => {
    it('classifies a higher new amount as an increase', () => {
        expect(resolvePriceChangeDirection({ oldAmount: 1000, newAmount: 1500 })).toBe('increase');
    });

    it('classifies a lower new amount as a decrease', () => {
        expect(resolvePriceChangeDirection({ oldAmount: 1500, newAmount: 1000 })).toBe('decrease');
    });

    it('treats equal amounts as a decrease (guarded at the call site)', () => {
        expect(resolvePriceChangeDirection({ oldAmount: 1000, newAmount: 1000 })).toBe('decrease');
    });
});

describe('computeEffectiveAt', () => {
    const now = new Date('2026-07-22T12:00:00.000Z');

    it('applies a decrease immediately (effectiveAt = now)', () => {
        const at = computeEffectiveAt({ direction: 'decrease', now, graceDays: 15 });
        expect(at.getTime()).toBe(now.getTime());
    });

    it('defers an increase by the grace window', () => {
        const at = computeEffectiveAt({ direction: 'increase', now, graceDays: 15 });
        expect(at.getTime()).toBe(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    });

    it('honors a custom grace window', () => {
        const at = computeEffectiveAt({ direction: 'increase', now, graceDays: 7 });
        expect(at.getTime()).toBe(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    });
});

describe('enqueuePlanPriceChange', () => {
    const now = new Date('2026-07-22T12:00:00.000Z');
    let insertedValues: Record<string, unknown> | undefined;

    // Minimal chainable mock: insert().values().returning() + select().from().where()
    function makeMockDb(affectedCount: number) {
        insertedValues = undefined;
        return {
            insert: vi.fn(() => ({
                values: vi.fn((v: Record<string, unknown>) => {
                    insertedValues = v;
                    return { returning: vi.fn(async () => [{ id: 'pc-1' }]) };
                })
            })),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(async () => [{ n: affectedCount }])
                }))
            }))
        } as unknown as Parameters<typeof enqueuePlanPriceChange>[0]['db'];
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('enqueues an increase deferred by the grace window and returns the blast radius', async () => {
        const db = makeMockDb(3);
        const result = await enqueuePlanPriceChange({
            db,
            planId: 'plan-1',
            priceId: 'price-1',
            billingInterval: 'month',
            oldAmount: 1000,
            newAmount: 1500,
            actorId: 'admin-1',
            now
        });

        expect(result.direction).toBe('increase');
        expect(result.priceChangeId).toBe('pc-1');
        expect(result.affectedSubscriberCount).toBe(3);
        expect(result.effectiveAt.getTime()).toBe(
            now.getTime() + PRICE_INCREASE_NOTICE_GRACE_DAYS * 24 * 60 * 60 * 1000
        );
        expect(insertedValues).toMatchObject({
            planId: 'plan-1',
            priceId: 'price-1',
            billingInterval: 'month',
            oldAmount: 1000,
            newAmount: 1500,
            direction: 'increase',
            status: 'pending',
            actorId: 'admin-1'
        });
    });

    it('enqueues a decrease effective immediately', async () => {
        const db = makeMockDb(0);
        const result = await enqueuePlanPriceChange({
            db,
            planId: 'plan-1',
            priceId: 'price-2',
            billingInterval: 'year',
            oldAmount: 20000,
            newAmount: 18000,
            now
        });

        expect(result.direction).toBe('decrease');
        expect(result.effectiveAt.getTime()).toBe(now.getTime());
        expect(result.affectedSubscriberCount).toBe(0);
        expect(insertedValues).toMatchObject({ direction: 'decrease', status: 'pending' });
    });
});
