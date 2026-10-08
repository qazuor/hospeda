/**
 * TEST:B1:3 (AC:B1:3, INV:D5): every mutation is confirmed by re-reading by id
 * and comparing field by field; an acknowledgement closes nothing.
 *
 * SCOPE: the lies run against a LOCAL test double built on the fake, which
 * acknowledges a mutation and does not apply it (the shape of M:M1) or applies
 * one field of two under a single acknowledgement (the shape of M:M2). The
 * fake's own named, switchable M1 and M2 do not exist yet: the payment
 * interface carries no surface where the real provider tells them (a cycle,
 * plan or date change; a request with two changes). B1.4a (HOS-1510) left
 * their rows in the closed list and moved them, and the M2 part of this test,
 * to the units that add that surface.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';
import {
    type AuthorizationRef,
    type BillingCadence,
    confirmAuthorizationMutation,
    type Money,
    type MutationAcknowledgement
} from '../src/index';

const ARS = (amountMinor: number): Money => ({ amountMinor, currency: 'ARS' });

/**
 * A provider that says yes and does not do it. Built on the honest fake so its
 * reads are real reads by id; only the mutations lie.
 */
class AcknowledgesWithoutApplying extends FakePaymentProvider {
    /** M1 shape: acknowledges the amount change, applies nothing. */
    override async changeAmount(input: {
        readonly authorizationId: string;
        readonly amount: Money;
    }): Promise<MutationAcknowledgement> {
        return { accepted: true, resourceId: input.authorizationId };
    }

    /** M1 shape: acknowledges the pause, applies nothing. */
    override async pause(input: AuthorizationRef): Promise<MutationAcknowledgement> {
        return { accepted: true, resourceId: input.authorizationId };
    }

    /**
     * M2 shape: one request with two fields, one success. The amount lands and
     * the cadence is silently dropped.
     */
    async changeAmountAndCadence(input: {
        readonly authorizationId: string;
        readonly amount: Money;
        readonly cadence: BillingCadence;
    }): Promise<MutationAcknowledgement> {
        await super.changeAmount({ authorizationId: input.authorizationId, amount: input.amount });
        return { accepted: true, resourceId: input.authorizationId };
    }
}

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });

let liar: AcknowledgesWithoutApplying;
let honest: FakePaymentProvider;

/** An active authorization of 18.000 ARS a month on the given provider. */
async function activeOn({ provider }: { readonly provider: FakePaymentProvider }): Promise<string> {
    const { authorizationId } = await provider.authorize({
        reference: 'sub-1',
        amount: ARS(1_800_000),
        cadence: { everyMonths: 1 },
        reason: 'Plan Anfitrión mensual',
        returnUrl: 'https://hospeda.test/return'
    });
    await provider.approve({ authorizationId });
    return authorizationId;
}

beforeEach(() => {
    liar = new AcknowledgesWithoutApplying({ clock });
    honest = new FakePaymentProvider({ clock });
});

describe('TEST:B1:3 confirm a mutation by re-reading, field by field', () => {
    it('an amount change acknowledged and not applied is a failed mutation', async () => {
        // Arrange
        const authorizationId = await activeOn({ provider: liar });

        // Act
        const acknowledgement = await liar.changeAmount({
            authorizationId,
            amount: ARS(2_000_000)
        });
        const verdict = await confirmAuthorizationMutation({
            provider: liar,
            acknowledgement,
            sent: { amount: ARS(2_000_000) }
        });

        // Assert: the acknowledgement said yes; the re-read says no
        expect(acknowledgement.accepted).toBe(true);
        expect(verdict.outcome).toBe('notApplied');
        expect(verdict.outcome === 'notApplied' && verdict.unapplied).toEqual([
            { field: 'amount', sent: ARS(2_000_000), read: ARS(1_800_000) }
        ]);
    });

    it('a pause acknowledged and not applied is a failed mutation', async () => {
        // Arrange
        const authorizationId = await activeOn({ provider: liar });

        // Act
        const acknowledgement = await liar.pause({ authorizationId });
        const verdict = await confirmAuthorizationMutation({
            provider: liar,
            acknowledgement,
            sent: { status: 'paused' }
        });

        // Assert
        expect(verdict.outcome === 'notApplied' && verdict.unapplied).toEqual([
            { field: 'status', sent: 'paused', read: 'active' }
        ]);
    });

    it('two fields under one acknowledgement: names the dropped one, not the applied one', async () => {
        // Arrange
        const authorizationId = await activeOn({ provider: liar });

        // Act
        const acknowledgement = await liar.changeAmountAndCadence({
            authorizationId,
            amount: ARS(9_900),
            cadence: { everyMonths: 6 }
        });
        const verdict = await confirmAuthorizationMutation({
            provider: liar,
            acknowledgement,
            sent: { amount: ARS(9_900), cadence: { everyMonths: 6 } }
        });

        // Assert: the failed field does not drag the one that worked
        expect(verdict.outcome).toBe('notApplied');
        expect(verdict.outcome === 'notApplied' && verdict.unapplied).toEqual([
            { field: 'cadence', sent: { everyMonths: 6 }, read: { everyMonths: 1 } }
        ]);
        expect(verdict.read.snapshot.amount).toEqual(ARS(9_900));
    });

    it('detects each non-applied field when neither of two lands', async () => {
        // Arrange
        const authorizationId = await activeOn({ provider: liar });

        // Act
        const acknowledgement = await liar.changeAmount({ authorizationId, amount: ARS(9_900) });
        const verdict = await confirmAuthorizationMutation({
            provider: liar,
            acknowledgement,
            sent: { amount: ARS(9_900), cadence: { everyMonths: 6 } }
        });

        // Assert
        expect(verdict.outcome === 'notApplied' && verdict.unapplied.map((u) => u.field)).toEqual([
            'amount',
            'cadence'
        ]);
    });

    it('with the lie off (the honest fake) the same mutation is confirmed', async () => {
        // Arrange
        const authorizationId = await activeOn({ provider: honest });

        // Act
        const acknowledgement = await honest.changeAmount({
            authorizationId,
            amount: ARS(2_000_000)
        });
        const verdict = await confirmAuthorizationMutation({
            provider: honest,
            acknowledgement,
            sent: { amount: ARS(2_000_000) }
        });

        // Assert
        expect(verdict.outcome).toBe('applied');
        expect(verdict.read.snapshot.amount).toEqual(ARS(2_000_000));
    });

    it('re-reads the resource the acknowledgement names, by id', async () => {
        // Arrange
        const authorizationId = await activeOn({ provider: honest });
        const acknowledgement = await honest.pause({ authorizationId });

        // Act
        const verdict = await confirmAuthorizationMutation({
            provider: honest,
            acknowledgement,
            sent: { status: 'paused' }
        });

        // Assert
        expect(verdict.outcome).toBe('applied');
        expect(verdict.read.snapshot.authorizationId).toBe(authorizationId);
    });

    it('refuses to confirm a mutation that sent no field', async () => {
        // Arrange
        const authorizationId = await activeOn({ provider: honest });
        const acknowledgement = await honest.pause({ authorizationId });

        // Act / Assert
        await expect(
            confirmAuthorizationMutation({ provider: honest, acknowledgement, sent: {} })
        ).rejects.toThrow();
    });
});
