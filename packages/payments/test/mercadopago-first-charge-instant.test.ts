/**
 * HOS-1724 follow-up: Mercado Pago echoes `auto_recurring.start_date` in its
 * own offset (`-04:00` in the captured fixture) while we send `toISOString()`
 * (`...Z`). The creation check must compare instants, not spellings.
 */
import { readFileSync } from 'node:fs';
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { confirmAuthorizationCreation } from '../src/provider/confirm-creation';
import type { AuthorizationSnapshot, AuthorizeInput } from '../src/provider/payment-provider';
import { stampProviderRead } from '../src/provider/provider-read';

const fixture = JSON.parse(
    readFileSync(
        new URL(
            './fixtures/mercadopago-preapproval-pending-never-charged-2026-10-20.json',
            import.meta.url
        ),
        'utf8'
    )
) as {
    readonly id: string;
    readonly external_reference: string;
    readonly auto_recurring: Record<string, unknown>;
};

const clock = createAdjustableClock({ start: new Date('2026-10-20T23:10:13.000Z') });

/** The creation we send, with a first charge spelled the way `toISOString()` spells it. */
const sent: AuthorizeInput = {
    reference: fixture.external_reference,
    amount: { amountMinor: 1_800_000, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    firstChargeAt: '2026-11-21T03:00:00.000Z',
    reason: 'Basic',
    returnUrl: 'https://example.invalid/return'
};

/** An adapter that reads back the fixture with the given `start_date`. */
function adapterEchoing({ startDate }: { readonly startDate: string }): MercadoPagoPaymentProvider {
    const body = {
        ...fixture,
        auto_recurring: { ...fixture.auto_recurring, start_date: startDate }
    };
    return new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'token',
        fetch: async () => new Response(JSON.stringify(body))
    });
}

describe('HOS-1724 the adapter reads start_date as a UTC instant', () => {
    it('normalizes the offset Mercado Pago echoes', async () => {
        // Arrange
        const provider = adapterEchoing({ startDate: '2026-11-21T00:00:00.000-03:00' });

        // Act
        const read = await provider.readAuthorization({ authorizationId: fixture.id });

        // Assert
        expect(read.snapshot.firstChargeAt).toBe('2026-11-21T03:00:00.000Z');
    });

    it('reads an unparseable start_date as no first charge', async () => {
        // Arrange
        const provider = adapterEchoing({ startDate: 'not-a-date' });

        // Act
        const read = await provider.readAuthorization({ authorizationId: fixture.id });

        // Assert
        expect(read.snapshot.firstChargeAt).toBeNull();
    });
});

describe('HOS-1724 creation confirmation compares the first charge as an instant', () => {
    it.each([
        ['-03:00', '2026-11-21T00:00:00.000-03:00'],
        ['-04:00', '2026-11-20T23:00:00.000-04:00'],
        ['no milliseconds', '2026-11-21T00:00:00-03:00']
    ])('applies when Mercado Pago echoes the same instant at %s', async (_label, startDate) => {
        // Arrange
        const provider = adapterEchoing({ startDate });

        // Act
        const result = await confirmAuthorizationCreation({
            provider,
            authorizationId: fixture.id,
            sent
        });

        // Assert
        expect(result.outcome).toBe('applied');
    });

    it('names firstChargeAt when Mercado Pago kept a different instant', async () => {
        // Arrange
        const provider = adapterEchoing({ startDate: '2026-11-21T01:00:00.000-03:00' });

        // Act
        const result = await confirmAuthorizationCreation({
            provider,
            authorizationId: fixture.id,
            sent
        });

        // Assert
        expect(result.outcome).toBe('notApplied');
        if (result.outcome === 'notApplied')
            expect(result.unapplied.map(({ field }) => field)).toEqual(['firstChargeAt']);
    });

    it('compares instants even when a provider returns the offset spelling itself', async () => {
        // Arrange
        const snapshot: AuthorizationSnapshot = {
            authorizationId: 'auth-1',
            reference: fixture.external_reference,
            status: 'pending',
            amount: sent.amount,
            cadence: sent.cadence,
            firstChargeAt: '2026-11-21T00:00:00.000-03:00',
            nextChargeAt: null,
            freePeriodDays: null,
            chargeRecordCount: null,
            lastChargedAt: null,
            lastModifiedAt: null
        };
        const provider = {
            readAuthorization: async () => stampProviderRead({ clock, snapshot })
        };

        // Act
        const result = await confirmAuthorizationCreation({
            provider,
            authorizationId: 'auth-1',
            sent
        });

        // Assert
        expect(result.outcome).toBe('applied');
    });

    it('still names firstChargeAt when the provider dropped it', async () => {
        // Arrange
        const snapshotProvider = adapterEchoing({ startDate: 'not-a-date' });

        // Act
        const result = await confirmAuthorizationCreation({
            provider: snapshotProvider,
            authorizationId: fixture.id,
            sent
        });

        // Assert
        expect(result.outcome).toBe('notApplied');
    });
});
