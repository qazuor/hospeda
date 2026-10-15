import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { applyS12ToPrincipal } from '../../../src/services/billing/subscription/service-end-s12.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { orphanPorts } from './support/addon-orphan-fixtures.js';
import {
    cancelActiveNow,
    retireCancelActiveRows,
    seedCancelActive
} from './support/cancel-active-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const clock = { now: () => cancelActiveNow };
const ports = (fake: FakePaymentProvider) => ({
    provider: fake,
    clock,
    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
    coverageNotices: { emitCoverageChanged: async () => undefined }
});
const owner = (id: string): Actor => ({ id, roles: [], permissions: [] });
afterEach(retireCancelActiveRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8a:4 S11 credit end', () => {
    it('takes the later of paid formula and successor credit in both directions', async () => {
        const first = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const formulaWins = await seedCancelActive({
            fake: first,
            payment: 'payment',
            credit: {
                firstChargeAt: new Date('2026-10-20T00:00:00.000Z'),
                windowEndsAt: new Date('2026-10-19T00:00:00.000Z')
            }
        });
        const a = await cancelActiveSubscription(
            { actor: owner(formulaWins.userId), subscriptionId: formulaWins.subscriptionId },
            ports(first)
        );
        expect(a).toMatchObject({
            basis: 'PAID_PERIOD',
            serviceEndsAt: new Date('2026-11-01T00:00:00.000Z')
        });

        const second = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const creditWins = await seedCancelActive({
            fake: second,
            payment: 'payment',
            credit: {
                firstChargeAt: new Date('2026-12-01T00:00:00.000Z'),
                windowEndsAt: new Date('2026-10-19T00:00:00.000Z'),
                closed: true
            }
        });
        const b = await cancelActiveSubscription(
            { actor: owner(creditWins.userId), subscriptionId: creditWins.subscriptionId },
            ports(second)
        );
        expect(b).toMatchObject({
            basis: 'CREDIT',
            serviceEndsAt: new Date('2026-12-01T00:00:00.000Z')
        });
    });
    it('uses credit without a covered period and ignores first charge when no qualifying succession exists', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedCancelActive({
            fake,
            payment: 'none',
            credit: {
                firstChargeAt: new Date('2026-12-01T00:00:00.000Z'),
                windowEndsAt: new Date('2026-10-19T00:00:00.000Z')
            }
        });
        const result = await cancelActiveSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        expect(result).toMatchObject({
            basis: 'CREDIT',
            serviceEndsAt: new Date('2026-12-01T00:00:00.000Z')
        });

        const other = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const noCredit = await seedCancelActive({
            fake: other,
            payment: 'none',
            futureFirstChargeAt: new Date('2026-12-01T00:00:00.000Z')
        });
        const nowEnd = await cancelActiveSubscription(
            { actor: owner(noCredit.userId), subscriptionId: noCredit.subscriptionId },
            ports(other)
        );
        expect(nowEnd).toMatchObject({ basis: 'NOW', serviceEndsAt: cancelActiveNow });
        const s12 = await getServiceTestDb().transaction(async (tx) =>
            applyS12ToPrincipal(
                { tx, subscriptionId: noCredit.subscriptionId, now: cancelActiveNow },
                { orphanhood: orphanPorts(tx).ports, clock }
            )
        );
        expect(s12.outcome).toBe('CANCELLED');

        const closedWindowFake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock
        });
        const closedWindow = await seedCancelActive({
            fake: closedWindowFake,
            payment: 'none',
            credit: {
                firstChargeAt: new Date('2026-10-19T00:00:00.000Z'),
                windowEndsAt: new Date('2026-10-19T00:00:00.000Z')
            }
        });
        const noShiftedCredit = await cancelActiveSubscription(
            { actor: owner(closedWindow.userId), subscriptionId: closedWindow.subscriptionId },
            ports(closedWindowFake)
        );
        expect(noShiftedCredit).toMatchObject({ basis: 'NOW', serviceEndsAt: cancelActiveNow });
    });
});
