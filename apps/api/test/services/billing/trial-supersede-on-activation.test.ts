/**
 * HOS-1012 T-023 — `supersedeLocalTrialsOnActivation` unit tests.
 *
 * Covers the SHAPE of the supersede: which rows it claims, what it writes on
 * them, which event it stamps, and that it refuses to swallow a failure.
 *
 * The ATOMICITY proof — that the supersede and the activation commit together,
 * so no committed state ever shows two entitlement-granting rows — lives in
 * `test/webhooks/subscription-logic.test.ts` ("HOS-1012 T-022/T-023"), because
 * it can only be observed from the call site that owns the transaction.
 *
 * `@repo/db`'s operators are mocked into plain tagged objects so the predicate
 * this builds can be asserted structurally. Dropping `isNull(mpSubscriptionId)`
 * or the `ne(id, activated)` self-exclusion is invisible to any test that lets
 * a fake apply its own filter instead; here the predicate itself is the
 * assertion.
 *
 * @module test/services/billing/trial-supersede-on-activation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', () => ({
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    ne: vi.fn((col: unknown, val: unknown) => ({ op: 'ne', col, val })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    billingSubscriptions: {
        id: 'sub.id',
        customerId: 'sub.customer_id',
        status: 'sub.status',
        mpSubscriptionId: 'sub.mp_subscription_id',
        productDomain: 'sub.product_domain',
        deletedAt: 'sub.deleted_at'
    },
    billingSubscriptionEvents: {
        id: 'evt.id',
        subscriptionId: 'evt.subscription_id',
        eventType: 'evt.event_type'
    }
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Imported after the mocks. `@repo/service-core` is NOT mocked: the event type
// asserted below must be the real constant, or this test asserts its own stub.
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import {
    SUPERSEDED_TRIAL_STATUS,
    supersedeLocalTrialsOnActivation
} from '../../../src/services/billing/trial-supersede-on-activation';

const NOW = new Date('2026-09-01T12:00:00.000Z');

/** Records every write, plus the predicate the claim query was built with. */
function makeTx(candidates: Array<{ id: string; status: string }>) {
    const forUpdate = vi.fn().mockResolvedValue(candidates);
    const selectWhere = vi.fn((_predicate: unknown) => ({ for: forUpdate }));
    const selectFrom = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from: selectFrom }));

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn((_payload: Record<string, unknown>) => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set: updateSet }));

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values: insertValues }));

    return {
        tx: { select, update, insert },
        select,
        selectFrom,
        selectWhere,
        forUpdate,
        update,
        updateSet,
        updateWhere,
        insert,
        insertValues
    };
}

function run(
    harness: ReturnType<typeof makeTx>,
    overrides: Record<string, unknown> = {}
): Promise<{ superseded: readonly { id: string; previousStatus: string }[] }> {
    return supersedeLocalTrialsOnActivation({
        tx: harness.tx as never,
        activatedSubscriptionId: 'sub-paid-1',
        customerId: 'cust-1',
        productDomain: 'accommodation',
        providerEventId: 'evt-mp-1',
        source: 'webhook',
        now: NOW,
        ...overrides
    });
}

/** Flattens the nested `{op:'and'|'or', args}` tree into a list of leaves. */
function leaves(node: unknown): Array<Record<string, unknown>> {
    if (!node || typeof node !== 'object') return [];
    const obj = node as Record<string, unknown>;
    if ((obj.op === 'and' || obj.op === 'or') && Array.isArray(obj.args)) {
        return obj.args.flatMap(leaves);
    }
    return [obj];
}

describe('supersedeLocalTrialsOnActivation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('which rows it claims', () => {
        it('claims only trialing, provider-less, non-deleted rows of the same customer, excluding the activated one', async () => {
            const h = makeTx([]);
            await run(h);

            const predicate = h.selectWhere.mock.calls[0]?.[0];
            const flat = leaves(predicate);

            expect(flat).toContainEqual({
                op: 'eq',
                col: 'sub.customer_id',
                val: 'cust-1'
            });
            // Self-exclusion: the row being activated is never superseded.
            expect(flat).toContainEqual({ op: 'ne', col: 'sub.id', val: 'sub-paid-1' });
            expect(flat).toContainEqual({ op: 'eq', col: 'sub.status', val: 'trialing' });
            // The provider-less filter is what keeps this off a card-first trial
            // whose preapproval would go on charging.
            expect(flat).toContainEqual({ op: 'isNull', col: 'sub.mp_subscription_id' });
            expect(flat).toContainEqual({ op: 'isNull', col: 'sub.deleted_at' });
        });

        it('locks the claim FOR UPDATE so two concurrent activations cannot both take it', async () => {
            const h = makeTx([]);
            await run(h);

            expect(h.forUpdate).toHaveBeenCalledWith('update');
        });

        it('accommodation fails OPEN — a NULL product_domain is claimed too', async () => {
            const h = makeTx([]);
            await run(h, { productDomain: 'accommodation' });

            const domainClause = leaves(h.selectWhere.mock.calls[0]?.[0]);
            expect(domainClause).toContainEqual({ op: 'isNull', col: 'sub.product_domain' });
            expect(domainClause).toContainEqual({
                op: 'eq',
                col: 'sub.product_domain',
                val: 'accommodation'
            });
        });

        it('an absent product_domain on the activated row reads as accommodation', async () => {
            const h = makeTx([]);
            await run(h, { productDomain: null });

            const flat = leaves(h.selectWhere.mock.calls[0]?.[0]);
            expect(flat).toContainEqual({ op: 'isNull', col: 'sub.product_domain' });
            expect(flat).toContainEqual({
                op: 'eq',
                col: 'sub.product_domain',
                val: 'accommodation'
            });
        });

        it('every other vertical fails CLOSED — no NULL escape hatch', async () => {
            const h = makeTx([]);
            await run(h, { productDomain: 'gastronomy' });

            const flat = leaves(h.selectWhere.mock.calls[0]?.[0]);
            expect(flat).toContainEqual({
                op: 'eq',
                col: 'sub.product_domain',
                val: 'gastronomy'
            });
            expect(flat).not.toContainEqual({ op: 'isNull', col: 'sub.product_domain' });
        });

        it('writes nothing at all when the customer holds no local trial', async () => {
            const h = makeTx([]);
            const result = await run(h);

            expect(result.superseded).toEqual([]);
            expect(h.update).not.toHaveBeenCalled();
            expect(h.insert).not.toHaveBeenCalled();
        });
    });

    describe('what it writes', () => {
        it('moves the trial to the terminal expired status and stamps it converted', async () => {
            const h = makeTx([{ id: 'sub-trial-1', status: 'trialing' }]);
            const result = await run(h);

            expect(h.updateSet).toHaveBeenCalledWith({
                status: 'expired',
                trialConverted: true,
                trialConvertedAt: NOW,
                updatedAt: NOW
            });
            expect(SUPERSEDED_TRIAL_STATUS).toBe('expired');
            expect(h.updateWhere).toHaveBeenCalledWith({
                op: 'eq',
                col: 'sub.id',
                val: 'sub-trial-1'
            });
            expect(result.superseded).toEqual([{ id: 'sub-trial-1', previousStatus: 'trialing' }]);
        });

        it('NEVER writes an mp_subscription_id onto the trial row (supersede, do not mutate)', async () => {
            const h = makeTx([{ id: 'sub-trial-1', status: 'trialing' }]);
            await run(h);

            for (const [payload] of h.updateSet.mock.calls) {
                expect(Object.keys(payload as Record<string, unknown>)).not.toContain(
                    'mpSubscriptionId'
                );
                expect(Object.keys(payload as Record<string, unknown>)).not.toContain('planId');
            }
        });

        it('stamps TRIAL_SUPERSEDED_BY_PAID, never TRIAL_EXPIRED', async () => {
            const h = makeTx([{ id: 'sub-trial-1', status: 'trialing' }]);
            await run(h);

            const event = h.insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(event.eventType).toBe(BILLING_EVENT_TYPES.TRIAL_SUPERSEDED_BY_PAID);
            // The win-back cohort query INNER JOINs on TRIAL_EXPIRED. Stamping
            // that here would mail "tu publicación salió del sitio" to someone
            // who just paid.
            expect(event.eventType).not.toBe(BILLING_EVENT_TYPES.TRIAL_EXPIRED);
            expect(event).toMatchObject({
                subscriptionId: 'sub-trial-1',
                previousStatus: 'trialing',
                newStatus: 'expired',
                triggerSource: 'webhook',
                providerEventId: 'evt-mp-1'
            });
            expect(event.metadata).toMatchObject({
                supersededBySubscriptionId: 'sub-paid-1',
                productDomain: 'accommodation'
            });
        });

        it('supersedes every local trial the customer holds in the domain, not just the first', async () => {
            const h = makeTx([
                { id: 'sub-trial-1', status: 'trialing' },
                { id: 'sub-trial-2', status: 'trialing' }
            ]);
            const result = await run(h);

            expect(h.updateSet).toHaveBeenCalledTimes(2);
            expect(h.insertValues).toHaveBeenCalledTimes(2);
            expect(result.superseded.map((row) => row.id)).toEqual(['sub-trial-1', 'sub-trial-2']);
        });
    });

    describe('failure handling', () => {
        it('propagates a failed status write instead of swallowing it', async () => {
            const h = makeTx([{ id: 'sub-trial-1', status: 'trialing' }]);
            h.updateWhere.mockRejectedValueOnce(new Error('update blew up'));

            // Swallowing here would commit the activation on its own, which IS
            // the two-granting-rows state this exists to prevent.
            await expect(run(h)).rejects.toThrow('update blew up');
        });

        it('propagates a failed audit write instead of swallowing it', async () => {
            const h = makeTx([{ id: 'sub-trial-1', status: 'trialing' }]);
            h.insertValues.mockRejectedValueOnce(new Error('insert blew up'));

            await expect(run(h)).rejects.toThrow('insert blew up');
        });
    });
});
