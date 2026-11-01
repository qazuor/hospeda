import { registerCaptureHook, unregisterCaptureHook } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { encodeFakeNotice } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';

const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

afterAll(closeServiceTestPool);
afterEach(unregisterCaptureHook);

function failingProvider(
    fixture: Awaited<ReturnType<typeof paymentFixture>>,
    incompleteRead: boolean,
    transient?: PaymentProviderError['transient']
): { readonly provider: PaymentProvider; readonly error: PaymentProviderError } {
    const error = new PaymentProviderError({
        code: 'UNAVAILABLE',
        capability: 'read',
        message: 'Mercado Pago returned a charge record still being written at results.0.id',
        incompleteRead,
        ...(transient === undefined ? {} : { transient })
    });
    const provider = new Proxy(fixture.provider as unknown as PaymentProvider, {
        get(target, key, receiver) {
            if (key === 'readCharge')
                return async () => {
                    throw error;
                };
            const value = Reflect.get(target, key, receiver) as unknown;
            return typeof value === 'function' ? value.bind(fixture.provider) : value;
        }
    });
    return { provider, error };
}

async function notify(
    fixture: Awaited<ReturnType<typeof paymentFixture>>,
    provider: PaymentProvider
) {
    const { chargeId } = await fixture.provider.charge({
        authorizationId: fixture.started.authorizationId,
        amount: { amountMinor: 250000, currency: 'ARS' },
        reference: fixture.started.subscriptionId
    });
    const encoded = encodeFakeNotice({
        notice: { resourceKind: 'charge', resourceId: chargeId, version: '1' },
        format: 'json'
    });
    return processProviderNotice(
        {
            channel: 'WEBHOOKS',
            delivery: { headers: { 'content-type': encoded.contentType }, body: encoded.body }
        },
        {
            provider,
            clock: fixture.clock,
            beforeCancelNotice,
            coverageNotices: fixture.coverageNotices,
            promoCharges: fixture.promoCharges,
            promoExhaustion: fixture.promoExhaustion
        }
    );
}

describe('TEST:1747:4 provider notice incomplete read retry response', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'does not capture an incomplete provider read',
        async () => {
            const fixture = await paymentFixture();
            const { provider } = failingProvider(fixture, true);
            const captured: unknown[] = [];
            registerCaptureHook((error) => captured.push(error));

            await expect(notify(fixture, provider)).resolves.toEqual({
                ack: 'ERROR',
                outcome: 'DEFERRED'
            });
            expect(captured).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'captures other provider read errors unchanged',
        async () => {
            const fixture = await paymentFixture();
            const { provider, error } = failingProvider(fixture, false);
            const captured: unknown[] = [];
            registerCaptureHook((capturedError) => captured.push(capturedError));

            await expect(notify(fixture, provider)).resolves.toEqual({
                ack: 'ERROR',
                outcome: 'FAILED'
            });
            expect(captured).toHaveLength(1);
            expect(captured[0]).toBe(error);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'keeps a 429 on a webhook read as FAILED, never DEFERRED (HOS-1976)',
        async () => {
            const fixture = await paymentFixture();
            const { provider, error } = failingProvider(fixture, false, {
                kind: 'RATE_LIMITED',
                retryAfterSeconds: 30
            });
            const captured: unknown[] = [];
            registerCaptureHook((capturedError) => captured.push(capturedError));

            await expect(notify(fixture, provider)).resolves.toEqual({
                ack: 'ERROR',
                outcome: 'FAILED'
            });
            expect(captured).toHaveLength(1);
            expect(captured[0]).toBe(error);
        }
    );
});
