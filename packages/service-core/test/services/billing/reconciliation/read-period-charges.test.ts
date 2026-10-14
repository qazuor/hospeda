import type { Clock } from '@repo/billing-verticals-contract';
import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it } from 'vitest';
import { readPeriodCharges } from '../../../../src/services/billing/reconciliation/period-charges/read-period-charges.js';

function fixture() {
    let now = Date.parse('2026-10-12T03:00:00.000Z');
    const clock: Clock = { now: () => new Date(now) };
    const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    return {
        clock,
        provider,
        advance: ({ ms }: { readonly ms: number }) => {
            now += ms;
        }
    };
}

async function authorization(provider: FakePaymentProvider) {
    const result = await provider.authorize({
        reference: crypto.randomUUID(),
        amount: { amountMinor: 25_000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'current period read test',
        returnUrl: 'https://example.test/return'
    });
    await provider.approve({ authorizationId: result.authorizationId });
    return result.authorizationId;
}

describe('readPeriodCharges', () => {
    it('returns NOT_CHARGED for a complete inventory whose current record is rejected', async () => {
        const { clock, provider } = fixture();
        const authorizationId = await authorization(provider);
        const { chargeId } = await provider.declineCharge({
            authorizationId,
            declineReason: 'issuer_declined'
        });
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        const authorizationRead = await provider.readAuthorization({ authorizationId });

        await expect(readPeriodCharges({ authorizationRead, act }, { provider })).resolves.toEqual({
            verdict: 'NOT_CHARGED',
            chargeId
        });
    });

    it('returns CHARGED only from an approved current record read by id', async () => {
        const { clock, provider, advance } = fixture();
        const authorizationId = await authorization(provider);
        const { chargeId } = await provider.charge({
            authorizationId,
            amount: { amountMinor: 25_000, currency: 'ARS' },
            reference: crypto.randomUUID()
        });
        advance({ ms: 60 * 60 * 1000 });
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        const authorizationRead = await provider.readAuthorization({ authorizationId });

        await expect(readPeriodCharges({ authorizationRead, act }, { provider })).resolves.toEqual({
            verdict: 'CHARGED',
            chargeId
        });
    });

    it('returns UNKNOWN with the latest record when the counter is ahead of the list (M7 honest)', async () => {
        let now = Date.parse('2026-10-12T03:00:00.000Z');
        const clock: Clock = { now: () => new Date(now) };
        const provider = new FakePaymentProvider({
            clock,
            idNamespace: crypto.randomUUID(),
            honestAbout: [
                { lie: 'M7', why: 'the counter must disagree with the listed rejected record' }
            ]
        });
        const authorizationId = await authorization(provider);
        await provider.declineCharge({ authorizationId, declineReason: 'issuer_declined' });
        now += 60_000;
        const newest = await provider.declineCharge({
            authorizationId,
            declineReason: 'issuer_declined'
        });
        const newestRead = await provider.readCharge({ chargeId: newest.chargeId });
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        const authorizationRead = await provider.readAuthorization({ authorizationId });

        await expect(readPeriodCharges({ authorizationRead, act }, { provider })).resolves.toEqual({
            verdict: 'UNKNOWN',
            reason: 'INCOMPLETE_INVENTORY',
            latestCharge: { chargeId: newest.chargeId, createdAt: newestRead.snapshot.createdAt }
        });
    });

    it('returns UNKNOWN without a record when the counter is ahead of an empty list', async () => {
        const { clock, provider } = fixture();
        const authorizationId = await authorization(provider);
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        const read = await provider.readAuthorization({ authorizationId });
        const authorizationRead = { ...read, snapshot: { ...read.snapshot, chargeRecordCount: 1 } };

        await expect(readPeriodCharges({ authorizationRead, act }, { provider })).resolves.toEqual({
            verdict: 'UNKNOWN',
            reason: 'INCOMPLETE_INVENTORY'
        });
    });

    it('returns UNKNOWN with the pending current record (M8: lands on the next batch)', async () => {
        const { clock, provider } = fixture();
        const authorizationId = await authorization(provider);
        const { chargeId } = await provider.charge({
            authorizationId,
            amount: { amountMinor: 25_000, currency: 'ARS' },
            reference: crypto.randomUUID()
        });
        const pending = await provider.readCharge({ chargeId });
        expect(pending.snapshot.status).toBe('pending');
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        const authorizationRead = await provider.readAuthorization({ authorizationId });

        await expect(readPeriodCharges({ authorizationRead, act }, { provider })).resolves.toEqual({
            verdict: 'UNKNOWN',
            reason: 'PENDING_CHARGE',
            latestCharge: { chargeId, createdAt: pending.snapshot.createdAt }
        });
    });

    it('returns UNKNOWN without a record when the list cannot be read', async () => {
        const { clock, provider } = fixture();
        const authorizationId = await authorization(provider);
        await provider.declineCharge({ authorizationId, declineReason: 'issuer_declined' });
        const failing = new Proxy(provider, {
            get(target, property, receiver) {
                if (property === 'listCharges')
                    return async () => {
                        throw new Error('listing failed');
                    };
                const value = Reflect.get(target, property, receiver);
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        const authorizationRead = await provider.readAuthorization({ authorizationId });

        await expect(
            readPeriodCharges({ authorizationRead, act }, { provider: failing })
        ).resolves.toEqual({ verdict: 'UNKNOWN', reason: 'READ_FAILED' });
    });

    describe('Coord-454: a period whose money went back is not CHARGED', () => {
        async function approvedPeriod() {
            const clock: Clock = { now: () => new Date('2026-10-12T03:00:00.000Z') };
            const provider = new FakePaymentProvider({
                clock,
                idNamespace: crypto.randomUUID(),
                honestAbout: [
                    { lie: 'M8', why: 'the period charge must be approved when it is read' },
                    { lie: 'M13', why: 'the partial case refunds from the first refund' }
                ]
            });
            const authorizationId = await authorization(provider);
            const { chargeId } = await provider.charge({
                authorizationId,
                amount: { amountMinor: 25_000, currency: 'ARS' },
                reference: crypto.randomUUID()
            });
            const read = async () =>
                readPeriodCharges(
                    {
                        authorizationRead: await provider.readAuthorization({ authorizationId }),
                        act: { kind: 'decision' as const, startedAt: clock.now() }
                    },
                    { provider }
                );
            return { provider, chargeId, read };
        }

        it('a charged-back period charge is NOT_CHARGED', async () => {
            const { provider, chargeId, read } = await approvedPeriod();
            await provider.chargeBack({ chargeId });

            await expect(read()).resolves.toEqual({ verdict: 'NOT_CHARGED', chargeId });
        });

        it('a period charge refunded in full is NOT_CHARGED', async () => {
            const { provider, chargeId, read } = await approvedPeriod();
            await provider.refund({
                chargeId,
                amount: { amountMinor: 25_000, currency: 'ARS' },
                reference: 'refund-all'
            });

            await expect(read()).resolves.toEqual({ verdict: 'NOT_CHARGED', chargeId });
        });

        it('a period charge refunded in part is still CHARGED', async () => {
            const { provider, chargeId, read } = await approvedPeriod();
            await provider.refund({
                chargeId,
                amount: { amountMinor: 10_000, currency: 'ARS' },
                reference: 'refund-part'
            });

            await expect(read()).resolves.toEqual({ verdict: 'CHARGED', chargeId });
        });
    });

    it('never reads lastChargedAt: a rejected record that moved it is still NOT_CHARGED', async () => {
        const { clock, provider } = fixture();
        const authorizationId = await authorization(provider);
        const { chargeId } = await provider.declineCharge({
            authorizationId,
            declineReason: 'issuer_declined'
        });
        const act = { kind: 'decision' as const, startedAt: clock.now() };
        const authorizationRead = await provider.readAuthorization({ authorizationId });
        expect(authorizationRead.snapshot.lastChargedAt).not.toBeNull();

        await expect(readPeriodCharges({ authorizationRead, act }, { provider })).resolves.toEqual({
            verdict: 'NOT_CHARGED',
            chargeId
        });
    });
});
