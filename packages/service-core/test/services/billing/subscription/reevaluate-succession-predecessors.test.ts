import { FakePaymentProvider } from '@repo/payments/fake';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSuccessionCloser } from '../../../../src/services/billing/subscription/succession-closer.service.js';

const { cancel, selected } = vi.hoisted(() => ({
    cancel: vi.fn(),
    selected: vi.fn()
}));
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/db')>()),
    getDb: () => ({
        select: () => ({
            from: () => ({
                innerJoin: () => ({
                    where: () => ({ orderBy: () => ({ limit: selected }) })
                })
            })
        })
    })
}));
vi.mock(
    '../../../../src/services/billing/subscription/cancel-succession-predecessor.service.js',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../../src/services/billing/subscription/cancel-succession-predecessor.service.js')
        >()),
        cancelSuccessionPredecessor: cancel
    })
);

import { reevaluateSuccessionPredecessors } from '../../../../src/services/billing/subscription/reevaluate-succession-predecessors.service.js';

const successorSubscriptionId = '00000000-0000-4000-8000-000000000001';
const clock = { now: () => new Date('2026-11-13T12:00:00.000Z') };
const ports = {
    provider: new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock }),
    clock,
    beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
    successionCloser: createSuccessionCloser({ clock })
} satisfies Parameters<typeof reevaluateSuccessionPredecessors>[1];

describe('TEST:B8b:8 S17 reevaluation callback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        selected.mockResolvedValue([
            { successorId: successorSubscriptionId, predecessorId: crypto.randomUUID() }
        ]);
    });

    it('runs afterCancelled only for CANCELLED and preserves counts if it throws', async () => {
        cancel.mockResolvedValue({ outcome: 'CANCELLED' });
        const afterCancelled = vi.fn().mockRejectedValue(new Error('S9 unavailable'));
        expect(
            await reevaluateSuccessionPredecessors({ limit: 100 }, { ...ports, afterCancelled })
        ).toEqual({
            selected: 1,
            cancelled: 1,
            deferred: 0,
            notApplicable: 0,
            lostRace: 0
        });
        expect(afterCancelled).toHaveBeenCalledWith({ successorSubscriptionId });
    });

    it('leaves DEFERRED for the next reevaluation', async () => {
        cancel.mockResolvedValue({ outcome: 'DEFERRED', reason: 'NOTICE_PENDING' });
        const afterCancelled = vi.fn();
        expect(
            await reevaluateSuccessionPredecessors({ limit: 100 }, { ...ports, afterCancelled })
        ).toEqual({
            selected: 1,
            cancelled: 0,
            deferred: 1,
            notApplicable: 0,
            lostRace: 0
        });
        expect(afterCancelled).toHaveBeenCalledTimes(0);
    });
});
