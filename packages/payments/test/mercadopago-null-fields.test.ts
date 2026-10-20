/**
 * HOS-1724: Mercado Pago sends `null` for optional fields it has no value for,
 * where the adapter's schemas only accepted an absent key. The preapproval
 * fixture is a sanitized capture of `GET /preapproval/{id}` on a freshly
 * created, never-charged authorization (staging, real sandbox, 2026-10-20):
 * ids, urls and the reference are fake, every key, type and null is kept.
 */
import { readFileSync } from 'node:fs';
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { confirmAuthorizationCreation } from '../src/provider/confirm-creation';

const pendingPreapproval = JSON.parse(
    readFileSync(
        new URL(
            './fixtures/mercadopago-preapproval-pending-never-charged-2026-10-20.json',
            import.meta.url
        ),
        'utf8'
    )
) as Record<string, unknown> & { readonly id: string; readonly external_reference: string };

const clock = createAdjustableClock({ start: new Date('2026-10-20T23:10:13.000Z') });

/** Builds an adapter whose transport answers every request with the router's body. */
function adapterAnswering({
    route
}: {
    readonly route: (path: string) => unknown;
}): MercadoPagoPaymentProvider {
    return new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'token',
        fetch: async (url) => {
            const { pathname, search } = new URL(String(url));
            return new Response(JSON.stringify(route(pathname + search)));
        }
    });
}

describe('HOS-1724 a never-charged preapproval read back by id', () => {
    it('parses the real pending response with null summary fields', async () => {
        // Arrange
        const provider = adapterAnswering({ route: () => pendingPreapproval });

        // Act
        const read = await provider.readAuthorization({ authorizationId: pendingPreapproval.id });

        // Assert
        expect(read.snapshot).toEqual({
            authorizationId: pendingPreapproval.id,
            reference: pendingPreapproval.external_reference,
            status: 'pending',
            amount: { amountMinor: 1_800_000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            firstChargeAt: '2026-10-20T19:10:00.000-04:00',
            nextChargeAt: '2026-10-20T23:10:00.000Z',
            freePeriodDays: null,
            chargeRecordCount: null,
            lastChargedAt: null,
            lastModifiedAt: '2026-10-20T19:10:12.968-04:00'
        });
    });

    it('confirms the creation instead of failing the checkout', async () => {
        // Arrange
        const provider = adapterAnswering({ route: () => pendingPreapproval });

        // Act
        const confirmation = await confirmAuthorizationCreation({
            provider,
            authorizationId: pendingPreapproval.id,
            sent: {
                reference: pendingPreapproval.external_reference,
                amount: { amountMinor: 1_800_000, currency: 'ARS' },
                cadence: { everyMonths: 1 },
                reason: 'Basic',
                returnUrl: 'https://example.invalid/return'
            }
        });

        // Assert
        expect(confirmation.outcome).toBe('applied');
    });

    it('reads a null summary object as no summary', async () => {
        // Arrange
        const provider = adapterAnswering({
            route: () => ({ ...pendingPreapproval, summarized: null })
        });

        // Act
        const read = await provider.readAuthorization({ authorizationId: pendingPreapproval.id });

        // Assert
        expect(read.snapshot.chargeRecordCount).toBeNull();
        expect(read.snapshot.lastChargedAt).toBeNull();
    });

    it('keeps a reported charge count when Mercado Pago sends one', async () => {
        // Arrange
        const provider = adapterAnswering({
            route: () => ({
                ...pendingPreapproval,
                status: 'authorized',
                summarized: {
                    ...(pendingPreapproval.summarized as object),
                    charged_quantity: 2,
                    last_charged_date: '2026-10-20T19:12:00.000-04:00'
                }
            })
        });

        // Act
        const read = await provider.readAuthorization({ authorizationId: pendingPreapproval.id });

        // Assert
        expect(read.snapshot.chargeRecordCount).toBe(2);
        expect(read.snapshot.lastChargedAt).toBe('2026-10-20T19:12:00.000-04:00');
    });
});

describe('HOS-1724 optional payment fields sent as null', () => {
    const payment = {
        id: 1001,
        date_created: '2026-10-20T19:12:00.000-04:00',
        external_reference: null,
        metadata: null,
        point_of_interaction: null,
        status: 'rejected',
        status_detail: 'cc_rejected_other_reason',
        transaction_amount: 18000,
        currency_id: 'ARS',
        transaction_amount_refunded: null
    };

    it('reads a null refunded amount on a rejected payment as nothing refunded', async () => {
        // Arrange
        const provider = adapterAnswering({ route: () => payment });

        // Act
        const read = await provider.readCharge({ chargeId: '1001' });

        // Assert
        expect(read.snapshot.refundedAmount).toEqual({ amountMinor: 0, currency: 'ARS' });
        expect(read.snapshot.declineReason).toBe('cc_rejected_other_reason');
    });

    it('still fails closed on an approved payment whose refunded amount is null', async () => {
        // Arrange
        const provider = adapterAnswering({ route: () => ({ ...payment, status: 'approved' }) });

        // Act
        const read = provider.readCharge({ chargeId: '1001' });

        // Assert
        await expect(read).rejects.toThrow('Mercado Pago payment has no refunded amount');
    });

    it('treats a charge record whose payment id is null as an unnamed record', async () => {
        // Arrange
        const provider = adapterAnswering({
            route: (path) =>
                path.startsWith('/authorized_payments/search')
                    ? {
                          paging: { total: 2 },
                          results: [
                              {
                                  id: 1,
                                  date_created: '2026-10-20T19:12:00.000-04:00',
                                  expire_date: null,
                                  external_reference: null,
                                  payment: { id: 5001 }
                              },
                              {
                                  id: 2,
                                  date_created: '2026-11-20T19:12:00.000-03:00',
                                  expire_date: null,
                                  external_reference: null,
                                  payment: { id: null }
                              }
                          ]
                      }
                    : { paging: { total: 0 }, results: [] }
        });

        // Act
        const list = await provider.listCharges({ authorizationId: pendingPreapproval.id });

        // Assert
        expect(list.chargeIds).toEqual(['5001']);
    });
});

describe('HOS-1724 optional order and notice fields sent as null', () => {
    it('falls back to date_created when created_date is null', async () => {
        // Arrange
        const provider = adapterAnswering({
            route: () => ({
                id: 'ORD-1',
                status: 'processed',
                external_reference: 'ref-1',
                created_date: null,
                date_created: '2026-10-20T19:12:00.000-04:00'
            })
        });

        // Act
        const read = await provider.readOrder({ orderId: 'ORD-1' });

        // Assert
        expect(read.snapshot.createdAt).toBe('2026-10-20T19:12:00.000-04:00');
    });

    it('reads a null notice version like an absent one', async () => {
        // Arrange
        const provider = adapterAnswering({ route: () => ({}) });

        // Act
        const notice = await provider.decodeNotice({
            body: JSON.stringify({
                type: 'subscription_preapproval',
                data: { id: pendingPreapproval.id },
                version: null
            }),
            headers: {}
        });

        // Assert
        expect(notice).toEqual({
            resourceKind: 'authorization',
            resourceId: pendingPreapproval.id,
            version: '0'
        });
    });
});
