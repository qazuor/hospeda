/** Account dashboard plan summary: which live statuses count (HOS-2543). */

import { OWN_PLAN_STATUSES } from '@repo/schemas';
import type { DeclinedSignupCandidateRow } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { SUBSCRIPTION_STATUSES } =
    await vi.importActual<typeof import('@repo/db/schemas')>('@repo/db/schemas');

const rowsRef: { current: unknown[] } = { current: [] };
const inArraySpy = vi.fn();

vi.mock('@repo/db', async () => {
    const { LIVE_SUBSCRIPTION_STATUSES } =
        await vi.importActual<typeof import('@repo/db/schemas')>('@repo/db/schemas');
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'from', 'innerJoin', 'where']) chain[name] = () => chain;
    chain.orderBy = async () => rowsRef.current;
    const table = { id: 'id', planId: 'planId', slug: 'slug', name: 'name' };
    return {
        LIVE_SUBSCRIPTION_STATUSES,
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

const candidatesRef: { current: DeclinedSignupCandidateRow[] } = { current: [] };

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        // The real rule over the seeded candidate rows: only the query is replaced.
        readOwnDeclinedSignupNotices: async (input: { readonly now: Date }) =>
            actual.selectDeclinedSignupNotices({ rows: candidatesRef.current, now: input.now })
    };
});

const { readAccountPlanSummary } = await import(
    '../../../../src/routes/user/protected/stats-plan-summary'
);

const NOW = new Date('2026-11-22T12:00:00.000Z');
const DAY = 86_400_000;

const row = (status: string, slug = 'owner-basico', id = `${status}-${slug}`) => ({
    id,
    slug,
    name: slug,
    status,
    vertical: 'accommodation'
});

beforeEach(() => {
    rowsRef.current = [];
    candidatesRef.current = [];
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
        const result = await readAccountPlanSummary({ userId: 'u1', now: NOW });

        // Assert
        expect(inArraySpy.mock.calls.some(([, statuses]) => statuses.includes('PAUSED'))).toBe(
            true
        );
        expect(result.activeSubscriptionsCount).toBe(1);
        expect(result.plan?.status).toBe('PAUSED');
    });

    it('returns plan null with the count when there are several live principals', async () => {
        rowsRef.current = [row('ACTIVE'), row('PAUSED', 'venue-basico')];
        const result = await readAccountPlanSummary({ userId: 'u1', now: NOW });
        expect(result.plan).toBeNull();
        expect(result.activeSubscriptionsCount).toBe(2);
        expect(result.subscriptions.map((item) => item.status)).toEqual(['ACTIVE', 'PAUSED']);
    });

    it('shows a PENDING_AUTHORIZATION row but never counts it as active (HOS-2553)', async () => {
        // Arrange
        rowsRef.current = [row('ACTIVE'), row('PENDING_AUTHORIZATION', 'venue-basico')];

        // Act
        const result = await readAccountPlanSummary({ userId: 'u1', now: NOW });

        // Assert
        expect(result.subscriptions.map((item) => item.status)).toEqual([
            'ACTIVE',
            'PENDING_AUTHORIZATION'
        ]);
        expect(result.activeSubscriptionsCount).toBe(1);
    });

    it('drops an old declined row next to an ACTIVE one in the same vertical (HOS-2553)', async () => {
        // Arrange: the decline was the first attempt; the paying subscription came after
        const declined = row('CHARGE_DECLINED');
        const active = row('ACTIVE');
        rowsRef.current = [declined, active];
        candidatesRef.current = [
            candidate({ id: declined.id, status: 'CHARGE_DECLINED', ageDays: 3 }),
            candidate({ id: active.id, status: 'ACTIVE', ageDays: 2 })
        ];

        // Act
        const result = await readAccountPlanSummary({ userId: 'u1', now: NOW });

        // Assert
        expect(result.subscriptions.map((item) => item.status)).toEqual(['ACTIVE']);
        expect(result.activeSubscriptionsCount).toBe(1);
        expect(result.plan?.status).toBe('ACTIVE');
    });

    it('shows a recent decline with nothing live as the plan, without counting it active', async () => {
        // Arrange
        const declined = row('CHARGE_DECLINED');
        rowsRef.current = [declined];
        candidatesRef.current = [
            candidate({ id: declined.id, status: 'CHARGE_DECLINED', ageDays: 1 })
        ];

        // Act
        const result = await readAccountPlanSummary({ userId: 'u1', now: NOW });

        // Assert
        expect(result.plan?.status).toBe('CHARGE_DECLINED');
        expect(result.subscriptions).toHaveLength(1);
        expect(result.activeSubscriptionsCount).toBe(0);
    });

    it('hides a decline older than seven days', async () => {
        // Arrange
        const declined = row('CHARGE_DECLINED');
        rowsRef.current = [declined];
        candidatesRef.current = [
            candidate({ id: declined.id, status: 'CHARGE_DECLINED', ageDays: 8 })
        ];

        // Act
        const result = await readAccountPlanSummary({ userId: 'u1', now: NOW });

        // Assert
        expect(result).toEqual({ plan: null, activeSubscriptionsCount: 0, subscriptions: [] });
    });
});

function candidate(input: {
    readonly id: string;
    readonly status: string;
    readonly ageDays: number;
}): DeclinedSignupCandidateRow {
    const at = new Date(NOW.getTime() - input.ageDays * DAY);
    return {
        id: input.id,
        vertical: 'accommodation',
        status: input.status,
        succeedsId: null,
        createdAt: at,
        updatedAt: at,
        billingOptionId: 'option-1',
        declaredPayerEmail: null,
        planSlug: 'owner-basico',
        planName: 'owner-basico'
    };
}
