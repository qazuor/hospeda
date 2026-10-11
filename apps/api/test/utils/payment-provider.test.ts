/** TEST:B3:43 (soporte): the API's validated env wires its provider to HTTP. */

import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { startFakeProviderServer } from '@repo/payments/fake-server';
import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';
import { getPaymentProvider } from '../../src/utils/payment-provider';

describe('default API payment provider (TEST:B3:43 soporte)', () => {
    afterEach(() => vi.unstubAllEnvs());
    it('uses the validated API base URL and token to reach the fake server', async () => {
        const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
        const fake = new FakePaymentProvider({ clock });
        const server = await startFakeProviderServer({ provider: fake, clock });
        try {
            vi.stubEnv('HOSPEDA_MERCADO_PAGO_API_BASE_URL', server.url);
            vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', 'test-token');
            validateApiEnv();
            initApp({ clock });
            const provider = getPaymentProvider();
            expect(provider).toBeInstanceOf(MercadoPagoPaymentProvider);
            await provider.authorize({
                reference: 'api-http-wiring',
                amount: { amountMinor: 10_000, currency: 'ARS' },
                cadence: { everyMonths: 1 },
                reason: 'Plan mensual',
                returnUrl: 'https://example.test/return'
            });
            expect(server.requests()).toHaveLength(1);
            expect(server.requests()[0]).toMatchObject({ method: 'POST', path: '/preapproval' });
        } finally {
            await server.close();
        }
    });
});
