import type { Clock } from '@repo/billing-verticals-contract';
import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it } from 'vitest';
import {
    lastCycleRecordIsOpen,
    readLastCycleRecordIsOpen
} from '../../../../src/services/billing/reconciliation/sweep/last-cycle-record.js';

const stamp = '2026-10-15T00:00:00.000Z';
const charge = (
    status: string,
    expiresAt: string | null = null,
    createdAt = stamp,
    purpose = 'charge'
) => ({ status, expiresAt, createdAt, purpose });

describe('last cycle record', () => {
    it.each([
        ['incomplete inventory stays open', [charge('approved')], false, true],
        ['empty complete inventory is closed', [], true, false],
        ['pending is open', [charge('pending')], true, true],
        ['approved is closed', [charge('approved')], true, false],
        ['rejected without expiry is open', [charge('rejected')], true, true],
        [
            'rejected with future expiry is open',
            [charge('rejected', '2026-10-16T00:00:00.000Z')],
            true,
            true
        ],
        [
            'expired rejection is closed',
            [charge('rejected', '2026-10-14T00:00:00.000Z')],
            true,
            false
        ],
        [
            'non-charge purpose is ignored',
            [charge('pending', null, stamp, 'validation')],
            true,
            false
        ],
        [
            'latest approved closes after earlier rejection',
            [charge('rejected', null, '2026-10-14T00:00:00.000Z'), charge('approved', null, stamp)],
            true,
            false
        ]
    ])('%s', (_name, charges, complete, expected) => {
        expect(lastCycleRecordIsOpen({ charges, complete, actStartedAt: Date.parse(stamp) })).toBe(
            expected
        );
    });

    it('reads provider records and retains a rejected record until expiry', async () => {
        let now = Date.parse(stamp);
        const clock: Clock = { now: () => new Date(now) };
        const provider = new FakePaymentProvider({
            clock,
            idNamespace: crypto.randomUUID(),
            honestAbout: [
                {
                    lie: 'M8',
                    why: 'the test needs a rejected retry-cycle record to remain rejected'
                }
            ]
        });
        const { authorizationId } = await provider.authorize({
            reference: crypto.randomUUID(),
            amount: { amountMinor: 25000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'last cycle test',
            returnUrl: 'https://example.test'
        });
        await provider.approve({ authorizationId });
        await provider.charge({
            authorizationId,
            amount: { amountMinor: 25000, currency: 'ARS' },
            reference: crypto.randomUUID()
        });
        const failed = await provider.failChargeCycle({
            authorizationId,
            declineReason: 'issuer_declined'
        });
        const act = () => ({ kind: 'decision' as const, startedAt: new Date(now) });
        expect(
            await readLastCycleRecordIsOpen(
                {
                    authorizationRead: await provider.readAuthorization({ authorizationId }),
                    act: act()
                },
                { provider }
            )
        ).toBe(true);
        const record = await provider.readCharge({ chargeId: failed.chargeId });
        if (record.snapshot.expiresAt === null) throw new Error('Expected retry record expiry');
        now = Date.parse(record.snapshot.expiresAt) + 1;
        expect(
            await readLastCycleRecordIsOpen(
                {
                    authorizationRead: await provider.readAuthorization({ authorizationId }),
                    act: act()
                },
                { provider }
            )
        ).toBe(false);

        const noExpiry = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const second = await noExpiry.authorize({
            reference: crypto.randomUUID(),
            amount: { amountMinor: 25000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'no expiry test',
            returnUrl: 'https://example.test'
        });
        await noExpiry.approve({ authorizationId: second.authorizationId });
        await noExpiry.declineCharge({
            authorizationId: second.authorizationId,
            declineReason: 'issuer_declined'
        });
        expect(
            await readLastCycleRecordIsOpen(
                {
                    authorizationRead: await noExpiry.readAuthorization({
                        authorizationId: second.authorizationId
                    }),
                    act: act()
                },
                { provider: noExpiry }
            )
        ).toBe(true);
    });

    it('treats an incomplete listed inventory as open', async () => {
        const clock: Clock = { now: () => new Date(stamp) };
        const provider = new FakePaymentProvider({
            clock,
            idNamespace: crypto.randomUUID(),
            honestAbout: [
                { lie: 'M7', why: 'the test requires record count to omit rejected records' }
            ]
        });
        const { authorizationId } = await provider.authorize({
            reference: crypto.randomUUID(),
            amount: { amountMinor: 25000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'incomplete inventory test',
            returnUrl: 'https://example.test'
        });
        await provider.approve({ authorizationId });
        await provider.declineCharge({ authorizationId, declineReason: 'issuer_declined' });
        expect(
            await readLastCycleRecordIsOpen(
                {
                    authorizationRead: await provider.readAuthorization({ authorizationId }),
                    act: { kind: 'decision', startedAt: clock.now() }
                },
                { provider }
            )
        ).toBe(true);
    });
});
