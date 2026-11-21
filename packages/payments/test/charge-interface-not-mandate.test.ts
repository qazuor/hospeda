import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { ChargeInput, ChargeResult, PaymentProviderMethod } from '../src/index';
import { CAPABILITY_METHODS, MercadoPagoPaymentProvider } from '../src/index';

const clock = createAdjustableClock({ start: new Date('2026-10-01T00:00:00Z') });

describe('HOS-1554 TEST:B6:9 AC:B6:11 charge interface', () => {
    it('keeps the exact domain fields and capability methods, with no card-token charge', () => {
        // Arrange / Act / Assert: the one-time order charge (`chargeOnce`) was retired with the
        // order path (HOS-2179 T-7); a one-time amount is paid on a provider page.
        expectTypeOf<keyof ChargeInput>().toEqualTypeOf<
            'authorizationId' | 'amount' | 'reference'
        >();
        expectTypeOf<keyof ChargeResult>().toEqualTypeOf<'chargeId'>();
        expectTypeOf<'chargeOnce'>().not.toMatchTypeOf<PaymentProviderMethod>();
        expect(CAPABILITY_METHODS.charge).toEqual(['charge', 'requestOneTimePayment']);
    });

    it('rejects an on-demand recurring charge without any HTTP request', async () => {
        // Arrange
        const fetch = vi.fn<typeof globalThis.fetch>();
        const adapter = new MercadoPagoPaymentProvider({ clock, accessToken: 'test-token', fetch });

        // Act / Assert
        await expect(
            adapter.charge({
                authorizationId: 'A',
                amount: { amountMinor: 1500, currency: 'ARS' },
                reference: 'R'
            })
        ).rejects.toMatchObject({ code: 'REJECTED' });
        expect(fetch).not.toHaveBeenCalled();
        expect('chargeOnce' in adapter).toBe(false);
    });
});
