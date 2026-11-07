import type { ApplyScheduledChangeResult } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { finishApplied, callbacks } = vi.hoisted(() => ({
    finishApplied: vi.fn(),
    callbacks: [] as Array<(applied: unknown) => void>
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    createScheduledChangeApplier: ({ onApplied }: { onApplied: (applied: unknown) => void }) => {
        callbacks.push(onApplied);
        return { applyScheduledChange: vi.fn() };
    },
    finishAppliedScheduledChange: finishApplied
}));
vi.mock('../../src/utils/clock', () => ({
    getClock: () => ({ clock: { now: () => new Date('2026-10-12T12:00:00.000Z') } })
}));
vi.mock('../../src/utils/listing-access/coverage-notices', () => ({
    getCoverageNotices: () => ({ emitCoverageChanged: vi.fn() })
}));
vi.mock('../../src/utils/listing-publication/scheduled-change-surplus-step', () => ({
    createScheduledChangeSurplusStep: () => ({ reconcile: vi.fn() })
}));

import { createScheduledChangeCollector } from '../../src/utils/billing-succession-ports';

const applied: Extract<ApplyScheduledChangeResult, { outcome: 'APPLIED' }> = {
    outcome: 'APPLIED',
    subscriptionId: '00000000-0000-4000-8000-000000000001',
    userId: '00000000-0000-4000-8000-000000000002',
    vertical: 'ACCOMMODATION',
    fromPlanVersionId: 'old',
    toPlanVersionId: 'new',
    fromBillingOptionId: 'old-option',
    toBillingOptionId: 'new-option',
    motive: 'DOWNGRADE',
    keepSelection: null
};

beforeEach(() => {
    callbacks.length = 0;
    finishApplied.mockReset().mockResolvedValue({ warnings: [] });
});

describe('TEST:B8b:24 scheduled change collector', () => {
    it('finishes exactly once per accumulated change and drains the queue', async () => {
        const collector = createScheduledChangeCollector();
        const collect = callbacks[0];
        if (!collect) throw new Error('Missing S38 callback');
        collect(applied);
        collect({ ...applied, subscriptionId: '00000000-0000-4000-8000-000000000003' });
        await collector.finish();
        await collector.finish();
        expect(finishApplied).toHaveBeenCalledTimes(2);
    });

    it('discards effects of a failed service without emitting them', async () => {
        const collector = createScheduledChangeCollector();
        callbacks[0]?.(applied);
        collector.discard();
        await collector.finish();
        expect(finishApplied).toHaveBeenCalledTimes(0);
    });

    it('returns warnings from the post-commit finisher', async () => {
        finishApplied.mockResolvedValueOnce({ warnings: ['COVERAGE_NOTICE_FAILED'] });
        const collector = createScheduledChangeCollector();
        callbacks[0]?.(applied);
        expect(await collector.finish()).toEqual({ warnings: ['COVERAGE_NOTICE_FAILED'] });
    });
});
