import type { SelectProviderLink, SelectSubscription } from '@repo/db';
import { reconciliationMarkModel } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { actStartInstant } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it, vi } from 'vitest';

const { cancelSpy } = vi.hoisted(() => ({ cancelSpy: vi.fn() }));
vi.mock(
    '../../../../src/services/billing/reconciliation/cancel-our-authorization.js',
    async (importOriginal) => ({
        ...(await importOriginal<
            typeof import('../../../../src/services/billing/reconciliation/cancel-our-authorization.js')
        >()),
        cancelOurAuthorization: cancelSpy
    })
);

import { SWEEP_CANCEL_RETRY } from '../../../../src/services/billing/reconciliation/cancel-our-authorization.js';
import { retryOurCancellation } from '../../../../src/services/billing/reconciliation/sweep/our-cancellation-retry.js';

describe('HOS-1995 retryOurCancellation opts the sweep into the cancel retry', () => {
    it('passes SWEEP_CANCEL_RETRY to cancelOurAuthorization', async () => {
        // Arrange
        const now = new Date('2026-10-11T12:00:00.000Z');
        const clock = { now: () => now };
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const { authorizationId } = await fake.authorize({
            reference: `legacy-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'retry policy unit test',
            returnUrl: 'https://example.test/return',
            payerEmail: `payer-${crypto.randomUUID()}@example.test`
        });
        await fake.approve({ authorizationId });
        const act = { kind: 'decision' as const, startedAt: now };
        actStartInstant({ act });
        const read = await fake.readAuthorization({ authorizationId });
        vi.spyOn(reconciliationMarkModel, 'findOpen').mockResolvedValue(undefined as never);
        cancelSpy.mockResolvedValue({ outcome: 'CONFIRMED' });

        // Act
        await retryOurCancellation(
            {
                subscription: {
                    id: crypto.randomUUID(),
                    userId: null
                } as unknown as SelectSubscription,
                providerLink: { providerId: authorizationId } as unknown as SelectProviderLink,
                decision: { transition: 'S40', decidedAt: now },
                correlationId: 'corr',
                prior: { read, act }
            },
            {
                provider: fake as unknown as PaymentProvider,
                clock,
                beforeCancelNotice: { beforeCancel: vi.fn(async () => 'SENT' as const) }
            }
        );

        // Assert
        expect(cancelSpy).toHaveBeenCalledTimes(1);
        expect(cancelSpy.mock.calls[0]?.[0]).toMatchObject({ retry: SWEEP_CANCEL_RETRY });
    });
});
