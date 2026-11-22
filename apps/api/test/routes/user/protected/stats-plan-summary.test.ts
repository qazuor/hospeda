/** Account dashboard plan summary: which live statuses count (HOS-2543). */

import { OWN_PLAN_STATUSES } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { SUBSCRIPTION_STATUSES } =
    await vi.importActual<typeof import('@repo/db/schemas')>('@repo/db/schemas');

const rowsRef: { current: unknown[] } = { current: [] };
const inArraySpy = vi.fn();

vi.mock('@repo/db', () => {
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'from', 'innerJoin', 'where']) chain[name] = () => chain;
    chain.orderBy = async () => rowsRef.current;
    const table = { id: 'id', planId: 'planId', slug: 'slug', name: 'name' };
    return {
        getDb: () => chain,
        and: (...args: unknown[]) => args,
        asc: (column: unknown) => column,
        eq: (...args: unknown[]) => args,
        isNull: (...args: unknown[]) => args,
        ne: (...args: unknown[]) => args,
        or: (...args: unknown[]) => args,
        inArray: (...args: unknown[]) => {
            inArraySpy(...args);
            return args;
        },
        plans: table,
        planVersions: table,
        subscriptions: { ...table, status: 'status', class: 'class', userId: 'userId' }
    };
});

const { readAccountPlanSummary } = await import(
    '../../../../src/routes/user/protected/stats-plan-summary'
);

const row = (status: string, slug = 'owner-basico') => ({
    slug,
    name: slug,
    status,
    vertical: 'accommodation'
});

beforeEach(() => {
    rowsRef.current = [];
    inArraySpy.mockClear();
});

describe('readAccountPlanSummary', () => {
    it('only lists statuses that exist in SUBSCRIPTION_STATUSES', () => {
        for (const status of OWN_PLAN_STATUSES) {
            expect(SUBSCRIPTION_STATUSES).toContain(status);
        }
    });

    it('counts a PAUSED principal as live (it is queried and accepted)', async () => {
        // Arrange
        rowsRef.current = [row('PAUSED')];

        // Act
        const result = await readAccountPlanSummary({ userId: 'u1' });

        // Assert
        expect(inArraySpy.mock.calls.some(([, statuses]) => statuses.includes('PAUSED'))).toBe(
            true
        );
        expect(result.activeSubscriptionsCount).toBe(1);
        expect(result.plan?.status).toBe('PAUSED');
    });

    it('returns plan null with the count when there are several live principals', async () => {
        rowsRef.current = [row('ACTIVE'), row('PAUSED', 'venue-basico')];
        const result = await readAccountPlanSummary({ userId: 'u1' });
        expect(result.plan).toBeNull();
        expect(result.activeSubscriptionsCount).toBe(2);
        expect(result.subscriptions.map((item) => item.status)).toEqual(['ACTIVE', 'PAUSED']);
    });

    it('lists CHARGE_DECLINED and PENDING_AUTHORIZATION as live (HOS-2553)', async () => {
        // Arrange
        rowsRef.current = [row('CHARGE_DECLINED'), row('PENDING_AUTHORIZATION', 'venue-basico')];

        // Act
        const result = await readAccountPlanSummary({ userId: 'u1' });

        // Assert
        expect(
            inArraySpy.mock.calls.some(
                ([, statuses]) =>
                    statuses.includes('CHARGE_DECLINED') &&
                    statuses.includes('PENDING_AUTHORIZATION')
            )
        ).toBe(true);
        expect(result.activeSubscriptionsCount).toBe(2);
        expect(result.subscriptions.map((item) => item.status)).toEqual([
            'CHARGE_DECLINED',
            'PENDING_AUTHORIZATION'
        ]);
    });

    it('returns the single declined subscription as the plan, not as none', async () => {
        rowsRef.current = [row('CHARGE_DECLINED')];
        const result = await readAccountPlanSummary({ userId: 'u1' });
        expect(result.plan?.status).toBe('CHARGE_DECLINED');
        expect(result.subscriptions).toHaveLength(1);
    });
});
