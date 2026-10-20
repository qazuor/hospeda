import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it, vi } from 'vitest';
import { observeAuthorizationRead } from '../../../../src/services/billing/reconciliation/sweep/cancellation-observation.js';
import type { CancellationSeenAnnotator } from '../../../../src/services/billing/subscription/subscription-billing-ports.js';

async function fixture() {
    const clock = { now: () => new Date('2026-10-11T12:00:00.000Z') };
    const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const { authorizationId } = await provider.authorize({
        reference: crypto.randomUUID(),
        amount: { amountMinor: 1500, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'observation test',
        returnUrl: 'https://example.test'
    });
    const calls: unknown[] = [];
    const annotator: CancellationSeenAnnotator = {
        annotateCancellationSeen: vi.fn(async (input) => {
            calls.push(['cancelled', input]);
        }),
        clearCancellationSeen: vi.fn(async (input) => {
            calls.push(['alive', input]);
        })
    };
    const act = { kind: 'decision' as const, startedAt: clock.now() };
    return {
        provider,
        authorizationId,
        calls,
        annotator,
        act,
        subscriptionId: crypto.randomUUID()
    };
}

describe('observeAuthorizationRead', () => {
    it('records the read instant when cancelled', async () => {
        const f = await fixture();
        await f.provider.cancel({ authorizationId: f.authorizationId });
        const read = await f.provider.readAuthorization({ authorizationId: f.authorizationId });
        await expect(
            observeAuthorizationRead({
                read,
                act: f.act,
                subscriptionId: f.subscriptionId,
                annotator: f.annotator,
                previouslySeenAt: null
            })
        ).resolves.toEqual({ cancelled: true, readAt: read.readAt });
        expect(f.calls).toEqual([
            ['cancelled', { subscriptionId: f.subscriptionId, seenAt: read.readAt }]
        ]);
    });

    it('clears an earlier observation for a live authorization', async () => {
        const f = await fixture();
        const read = await f.provider.readAuthorization({ authorizationId: f.authorizationId });
        await observeAuthorizationRead({
            read,
            act: f.act,
            subscriptionId: f.subscriptionId,
            annotator: f.annotator,
            previouslySeenAt: new Date(0)
        });
        expect(f.calls).toEqual([
            ['alive', { subscriptionId: f.subscriptionId, seenAliveAt: read.readAt }]
        ]);
    });

    it('does nothing for a live authorization when no earlier observation exists', async () => {
        const f = await fixture();
        const read = await f.provider.readAuthorization({ authorizationId: f.authorizationId });
        await observeAuthorizationRead({
            read,
            act: f.act,
            subscriptionId: f.subscriptionId,
            annotator: f.annotator,
            previouslySeenAt: null
        });
        expect(f.calls).toEqual([]);
    });

    it('rejects an old read before annotation', async () => {
        const f = await fixture();
        const read = await f.provider.readAuthorization({ authorizationId: f.authorizationId });
        await expect(
            observeAuthorizationRead({
                read,
                act: { ...f.act, startedAt: new Date(read.readAt.getTime() + 1) },
                subscriptionId: f.subscriptionId,
                annotator: f.annotator,
                previouslySeenAt: null
            })
        ).rejects.toThrow(/before the act started/i);
        expect(f.calls).toEqual([]);
    });

    it('swallows annotator failures', async () => {
        const f = await fixture();
        const read = await f.provider.readAuthorization({ authorizationId: f.authorizationId });
        const broken: CancellationSeenAnnotator = {
            annotateCancellationSeen: async () => {
                throw new Error('failed');
            },
            clearCancellationSeen: async () => {
                throw new Error('failed');
            }
        };
        await expect(
            observeAuthorizationRead({
                read,
                act: f.act,
                subscriptionId: f.subscriptionId,
                annotator: broken,
                previouslySeenAt: null
            })
        ).resolves.toEqual({ cancelled: false, readAt: read.readAt });
    });
});
