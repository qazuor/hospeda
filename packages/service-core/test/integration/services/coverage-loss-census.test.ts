// TEST:B4:3 (AC:B4:4), the census of the other `turns-off` writers: S16 (`declineFirstCharge`)
// and the provider's cancellation (`processProviderNotice`, PROVIDER_CANCEL) write
// `coverage_loss` with their own write instant in their own transaction, so `retentionStopped`
// returns it right after the commit even when the post-commit notice is lost (contract §4.1;
// DEC-ARCH-009📌2). S6 has its own cases in `coverage-retention-stopped.test.ts`.
//
// Cleanup: the real signups end terminal (CHARGE_DECLINED / CANCELLED), and their coverage_loss
// and email_outbox rows are DELETED after each test. Users and the non-sellable plan versions stay.
import {
    billingDeadlineVersions,
    coverageLosses,
    emailOutbox,
    inArray,
    subscriptionModel
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createBillingRetentionStopped } from '../../../src/services/billing/coverage/retention-stopped.js';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { declineFirstCharge } from '../../../src/services/billing/subscription/decline-first-charge.service.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import { seedCoveragePlanVersion, seedCoverageUser } from './support/coverage-fixtures.js';
import { billingDeadlineValues } from './support/payment-fixtures.js';
import { noTouristVip } from './support/tourist-vip.js';

const now = new Date('2026-10-01T03:00:00.000Z');
const clock = { now: () => new Date(now) };
const seededUsers: string[] = [];

beforeAll(async () => {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineValues })
        .onConflictDoNothing();
});
afterEach(async () => {
    const db = getServiceTestDb();
    if (seededUsers.length > 0) {
        await db.delete(coverageLosses).where(inArray(coverageLosses.userId, seededUsers));
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, seededUsers));
    }
    seededUsers.length = 0;
});
afterAll(closeServiceTestPool);

/** A notice listener that loses every notice: the instant must not depend on it. */
const lostNotices: CoverageNotices = {
    emitCoverageChanged: vi.fn(async () => {
        throw new Error('TEST:B4:3 lost notice');
    })
};

/** A real signup authorized by the fake and activated: one ACTIVE principal, the only source. */
async function signup() {
    const db = getServiceTestDb();
    const { userId } = await seedCoverageUser(db);
    seededUsers.push(userId);
    const { billingOptionId } = await seedCoveragePlanVersion(db, VerticalEnum.ACCOMMODATION);
    const provider = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [
            { lie: 'M1', why: 'fixture signup' },
            { lie: 'M6', why: 'single notice delivery' }
        ]
    });
    const started = await startSubscription(
        { userId, billingOptionId, returnUrl: 'https://example.test' },
        {
            provider,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: noTouristVip,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            })
        }
    );
    await provider.approve({ authorizationId: started.authorizationId });
    await subscriptionModel.activatePendingAuthorization({
        subscriptionId: started.subscriptionId,
        now: clock.now()
    });
    provider.takeDeliveries();
    return { provider, userId, ...started };
}

async function lossesOf(userId: string): Promise<{ vertical: string; lost_at: Date }[]> {
    const { rows } = await getServiceTestPool().query<{ vertical: string; lost_at: Date }>(
        'SELECT vertical, lost_at FROM coverage_loss WHERE user_id = $1',
        [userId]
    );
    return rows;
}

async function statusOf(subscriptionId: string): Promise<string | undefined> {
    const { rows } = await getServiceTestPool().query<{ status: string }>(
        'SELECT status FROM subscription WHERE id = $1',
        [subscriptionId]
    );
    return rows[0]?.status;
}

const retention = createBillingRetentionStopped({ ports: { clock } });

describe('TEST:B4:3 the coverage-loss census of the turns-off writers (AC:B4:4)', () => {
    it('S16 declineFirstCharge writes coverage_loss with its instant in its transaction', async () => {
        // Arrange
        const account = await signup();
        const charge = await account.provider.declineCharge({
            authorizationId: account.authorizationId,
            declineReason: 'issuer_declined'
        });

        // Act
        const result = await declineFirstCharge(
            { chargeId: charge.chargeId },
            {
                provider: account.provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                coverageNotices: lostNotices
            }
        );

        // Assert
        expect(result).toMatchObject({ outcome: 'DECLINED' });
        expect(await statusOf(account.subscriptionId)).toBe('CHARGE_DECLINED');
        expect(await lossesOf(account.userId)).toEqual([
            { vertical: VerticalEnum.ACCOMMODATION, lost_at: now }
        ]);
        expect(
            await retention.retentionStopped({
                userId: account.userId,
                vertical: VerticalEnum.ACCOMMODATION
            })
        ).toEqual({ stopped: false, pauseEndedAt: null, coverageLostAt: now });
    });

    it('the provider cancellation (PROVIDER_CANCEL) writes coverage_loss with its instant in its transaction', async () => {
        // Arrange
        const account = await signup();
        await account.provider.cancel({ authorizationId: account.authorizationId });
        let delivery: Parameters<FakePaymentProvider['decodeNotice']>[0] | undefined;
        for (const candidate of account.provider.takeDeliveries().deliveries)
            if ((await account.provider.decodeNotice(candidate)).resourceKind === 'authorization')
                delivery = candidate;
        if (!delivery) throw new Error('missing cancellation delivery');

        // Act
        const result = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery },
            {
                provider: account.provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                payments: { hasCreditedPayment: async () => true },
                coverageNotices: lostNotices
            }
        );

        // Assert
        expect(result).toEqual({ ack: 'OK', outcome: 'APPLIED' });
        expect(await statusOf(account.subscriptionId)).toBe('CANCELLED');
        expect(await lossesOf(account.userId)).toEqual([
            { vertical: VerticalEnum.ACCOMMODATION, lost_at: now }
        ]);
        expect(
            await retention.retentionStopped({
                userId: account.userId,
                vertical: VerticalEnum.ACCOMMODATION
            })
        ).toEqual({ stopped: false, pauseEndedAt: null, coverageLostAt: now });
    });
});
