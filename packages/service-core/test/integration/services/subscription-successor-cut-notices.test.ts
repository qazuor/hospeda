import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, describe, expect, it } from 'vitest';
import { completeSuccessorCut } from '../../../src/services/billing/subscription/successor-cut-after-commit';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice';

const clock = { now: () => new Date('2026-11-13T12:00:00.000Z') };
const provider = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
const beforeCancelNotice = outboxBeforeCancelNotice();

afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:13 S31 after-commit notices', () => {
    it('emits REMOVED only for active cuts and absorbs notice delivery failures', async () => {
        const events: unknown[] = [];
        await expect(
            completeSuccessorCut(
                {
                    outcome: 'CUT',
                    successorId: crypto.randomUUID(),
                    predecessorId: crypto.randomUUID(),
                    from: 'ACTIVE',
                    to: 'CANCELLED',
                    userId: crypto.randomUUID(),
                    vertical: 'accommodation',
                    paymentMethod: 'CARD',
                    authorizationId: null,
                    closedCourtesyMonths: null,
                    manualInstallmentClosed: false,
                    cancelledAddons: [],
                    cancellationDecided: false
                },
                {
                    provider,
                    clock,
                    beforeCancelNotice,
                    coverageNotices: {
                        emitCoverageChanged: async (event) => {
                            events.push(event);
                            throw new Error('notice down');
                        }
                    }
                }
            )
        ).resolves.toMatchObject({ providerCall: 'NONE', retainedReevaluated: 0 });
        expect(events).toEqual([
            {
                userId: expect.any(String),
                vertical: 'accommodation',
                sourceType: 'SUBSCRIPTION',
                change: 'REMOVED'
            }
        ]);
    });

    it('does not emit a subscription removal for an abandoned pending authorization', async () => {
        const events: unknown[] = [];
        await completeSuccessorCut(
            {
                outcome: 'CUT',
                successorId: crypto.randomUUID(),
                predecessorId: crypto.randomUUID(),
                from: 'PENDING_AUTHORIZATION',
                to: 'ABANDONED',
                userId: crypto.randomUUID(),
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                authorizationId: null,
                closedCourtesyMonths: null,
                manualInstallmentClosed: false,
                cancelledAddons: [],
                cancellationDecided: false
            },
            {
                provider,
                clock,
                beforeCancelNotice,
                coverageNotices: {
                    emitCoverageChanged: async (event) => {
                        events.push(event);
                    }
                }
            }
        );
        expect(events).toEqual([]);
    });
});
