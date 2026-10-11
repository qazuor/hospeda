import { type LogEntry, registerHook, unregisterHook } from '@repo/logger';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    noCancellationSeenAnnotation,
    noCreditedPayments,
    recordCancellationSeen,
    unimplementedSuccessionCloser
} from '../../../../src/services/billing/subscription/subscription-billing-ports';

afterEach(() => unregisterHook('cancellation-seen-port-test'));

describe('subscription billing ports defaults', () => {
    it('reports no credited payments before B5 creates the payment tables', async () => {
        await expect(
            noCreditedPayments.hasCreditedPayment({ subscriptionId: crypto.randomUUID() })
        ).resolves.toBe(false);
    });

    it('fails visibly when the succession closer has not been registered', async () => {
        await expect(
            unimplementedSuccessionCloser.closeSuccession({
                predecessorSubscriptionId: crypto.randomUUID(),
                tx: {} as never
            })
        ).rejects.toMatchObject({ reason: 'SUCCESSION_CLOSER_NOT_REGISTERED' });
    });

    it('keeps the default annotation a no-op and logs but swallows annotator errors', async () => {
        const subscriptionId = crypto.randomUUID();
        const seenAt = new Date('2026-10-01T03:00:00.000Z');
        const annotations = vi.fn(async () => undefined);
        await noCancellationSeenAnnotation.annotateCancellationSeen({ subscriptionId, seenAt });
        expect(annotations).not.toHaveBeenCalled();

        const errors: LogEntry[] = [];
        registerHook('cancellation-seen-port-test', (entry) => {
            if (entry.level === 'ERROR' && entry.category === 'cancellation-seen')
                errors.push(entry);
        });
        const annotator = {
            annotateCancellationSeen: vi.fn(async () => {
                throw new Error('annotation unavailable');
            })
        };
        await expect(
            recordCancellationSeen({ annotator, subscriptionId, seenAt })
        ).resolves.toBeUndefined();
        expect(annotator.annotateCancellationSeen).toHaveBeenCalledWith({ subscriptionId, seenAt });
        expect(errors).toHaveLength(1);
        expect(errors[0]?.data).toMatchObject({ subscriptionId });
    });
});
