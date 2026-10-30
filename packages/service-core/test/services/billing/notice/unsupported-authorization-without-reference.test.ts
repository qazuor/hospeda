/**
 * HOS-1895 (AC:1895:2 and AC:1895:3): the real Mercado Pago adapter answers a
 * preapproval without `external_reference` with UNSUPPORTED, so both notice
 * paths (the authorization notice and a charge of it) end in
 * `UNSUPPORTED_AUTHORIZATION`, never in a receipt tombstone. A tombstone would
 * cancel the provider authorization, and the authorization is a third party's:
 * our own creation always sends the reference.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { MercadoPagoPaymentProvider, type PaymentProvider } from '@repo/payments';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const doubles = vi.hoisted(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    recordChargeFact: vi.fn(),
    findLinkByProviderId: vi.fn(),
    insertReceiptTombstone: vi.fn()
}));
vi.mock('@repo/logger', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/logger')>();
    return { ...original, createLogger: () => ({ error: doubles.error, warn: doubles.warn }) };
});
vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        reconciliationInventoryModel: {
            ...original.reconciliationInventoryModel,
            findLinkByProviderId: doubles.findLinkByProviderId,
            insertReceiptTombstone: doubles.insertReceiptTombstone
        },
        getDb: () => ({
            select: () => ({
                from: () => ({
                    where: () => ({ limit: async () => [] })
                })
            })
        })
    };
});
vi.mock('../../../../src/services/billing/payment/record-charge-fact.service.js', () => ({
    recordChargeFact: doubles.recordChargeFact
}));

import { processProviderNotice } from '../../../../src/services/billing/notice/process-provider-notice.service.js';

const clock: Clock = { now: () => new Date('2026-10-24T12:00:00.000Z') };

/** A preapproval read with no `external_reference`, as staging saw it. */
const foreignPreapproval = {
    id: 'foreign-preapproval',
    status: 'authorized',
    auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 1500,
        currency_id: 'ARS',
        start_date: '2026-10-24T12:00:00.000-04:00'
    },
    summarized: null,
    last_modified: '2026-10-24T12:00:00.000-04:00',
    next_payment_date: '2026-11-24T12:00:00.000-04:00',
    init_point: null
};

/** One real adapter over a fake transport, with its notice decoding pinned. */
function providerArrivingAs(
    notice:
        | {
              readonly resourceKind: 'authorization';
              readonly resourceId: string;
              readonly version: string;
          }
        | { readonly resourceKind: 'charge'; readonly resourceId: string; readonly version: string }
): PaymentProvider {
    const adapter = new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'token',
        fetch: async () => new Response(JSON.stringify(foreignPreapproval))
    });
    vi.spyOn(adapter, 'decodeNotice').mockResolvedValueOnce(
        notice as Awaited<ReturnType<PaymentProvider['decodeNotice']>>
    );
    vi.spyOn(adapter, 'cancel').mockResolvedValue({
        accepted: true,
        resourceId: 'foreign-preapproval'
    });
    return adapter;
}

function delivery(body = '{}') {
    return { channel: 'WEBHOOKS' as const, delivery: { headers: {}, body } };
}

function lastLoggedError() {
    const [logged, message, options] = doubles.error.mock.calls[0] ?? [];
    return { logged, message, options };
}

describe('HOS-1895 a foreign preapproval without external_reference', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        doubles.findLinkByProviderId.mockResolvedValue(null);
        doubles.insertReceiptTombstone.mockResolvedValue({ id: 'tombstone-1' });
    });

    it('TEST:1895:2 ignores the authorization notice and never writes a tombstone or cancels', async () => {
        // Arrange
        const provider = providerArrivingAs({
            resourceKind: 'authorization',
            resourceId: 'foreign-preapproval',
            version: '1'
        });

        // Act
        const result = await processProviderNotice(delivery(), {
            provider,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        });

        // Assert
        expect(result).toEqual({ ack: 'OK', outcome: 'UNSUPPORTED_AUTHORIZATION' });
        expect(doubles.insertReceiptTombstone).not.toHaveBeenCalled();
        expect(provider.cancel).not.toHaveBeenCalled();
        const { logged, message, options } = lastLoggedError();
        expect(logged).toBeInstanceOf(Error);
        expect(logged).toMatchObject({
            name: 'UnsupportedProviderAuthorizationError',
            authorizationId: 'foreign-preapproval',
            providerStatus: 'authorized',
            providerCadence: 'months',
            correlationId: expect.any(String),
            cause: expect.objectContaining({
                code: 'UNSUPPORTED',
                message: expect.stringContaining('without external_reference')
            })
        });
        expect(message).toBe(
            'Ignored unsupported foreign provider authorization foreign-preapproval'
        );
        expect(options).toEqual({ capture: true });
    });

    it('TEST:1895:3 ignores a charge whose unknown authorization has no reference', async () => {
        // Arrange
        doubles.recordChargeFact.mockResolvedValueOnce({
            outcome: 'NO_SUBSCRIPTION',
            authorizationId: 'foreign-preapproval'
        });
        const provider = providerArrivingAs({
            resourceKind: 'charge',
            resourceId: 'foreign-charge',
            version: '1'
        });

        // Act
        const result = await processProviderNotice(delivery('{"type":"payment"}'), {
            provider,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        });

        // Assert
        expect(result).toEqual({ ack: 'OK', outcome: 'UNSUPPORTED_AUTHORIZATION' });
        expect(doubles.insertReceiptTombstone).not.toHaveBeenCalled();
        expect(provider.cancel).not.toHaveBeenCalled();
        const { logged, message } = lastLoggedError();
        expect(logged).toMatchObject({
            name: 'UnsupportedProviderAuthorizationError',
            authorizationId: 'foreign-preapproval',
            chargeId: 'foreign-charge',
            providerStatus: 'authorized',
            providerCadence: 'months',
            cause: expect.objectContaining({
                code: 'UNSUPPORTED',
                message: expect.stringContaining('without external_reference')
            })
        });
        expect(message).toBe(
            'Ignored unsupported foreign provider authorization foreign-preapproval'
        );
    });
});
