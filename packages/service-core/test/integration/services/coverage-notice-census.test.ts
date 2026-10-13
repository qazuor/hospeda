/**
 * TEST:B4:2 — the coverage-notice census (HOS-1533, B4.2, corrida 2).
 *
 * Every billing transition that already exists in the epic and changes the
 * answer of `coverage()` emits the coverage-changed notice AFTER its commit:
 * the port re-reads the row on ANOTHER connection the moment the notice
 * arrives, so a notice sent inside the transaction would see the old state.
 * A rolled-back write emits nothing.
 */
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { billingDeadlineVersions } from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service';
import { cancelInheritedTouristVips } from '../../../src/services/billing/subscription/cancel-inherited-tourist-vip.service';
import { declineFirstCharge } from '../../../src/services/billing/subscription/decline-first-charge.service';
import { expireAuthorizationWindows } from '../../../src/services/billing/subscription/expire-authorization-windows.service';
import {
    type BeforeCancelNotice,
    startSubscription
} from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import {
    cleanUpCoverageNoticeRows,
    committedSubscriptionStatus,
    insertCensusSubscription,
    recordingCoverageNotices,
    seedCensusChoice
} from './support/coverage-notice-fixtures';
import { graceWithFailedCycle } from './support/grace-fixtures';
import { billingDeadlineValues } from './support/payment-fixtures';
import { namespaceFake } from './support/payment-provider';
import {
    seededSubscriptionIds,
    withSeededSubscriptionSweep
} from './support/subscription-window-sweep';
import { noTouristVip } from './support/tourist-vip';

afterAll(closeServiceTestPool);

const openedAt = new Date('2026-10-01T03:00:00.000Z');
let current = openedAt;
const clock = { now: () => current };
const beforeCancelNotice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' };
const planPolicy = async () => ({
    graceDays: 10,
    allowsPause: false,
    current: true,
    sellable: true
});
const seededUserIds: string[] = [];

beforeAll(async () => {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineValues })
        .onConflictDoNothing();
});
beforeEach(() => {
    current = openedAt;
});
afterEach(async () => {
    vi.restoreAllMocks();
    seededSubscriptionIds.clear();
    await cleanUpCoverageNoticeRows({ userIds: seededUserIds.splice(0), promoCodeIds: [] });
});

/** An `accommodation` signup left PENDING_AUTHORIZATION on the given fake. */
async function startPending(provider: FakePaymentProvider | ReturnType<typeof namespaceFake>) {
    const choice = await seedCensusChoice();
    seededUserIds.push(choice.userId);
    const started = await startSubscription(
        {
            userId: choice.userId,
            billingOptionId: choice.billingOptionId,
            returnUrl: 'https://example.test/return'
        },
        { provider, clock, beforeCancelNotice, touristVipInheritance: noTouristVip, planPolicy }
    );
    return { choice, started };
}

/** An ACTIVE signup: authorized at the fake and activated without any notice port. */
async function seedActive(provider: FakePaymentProvider) {
    const pending = await startPending(provider);
    await provider.approve({ authorizationId: pending.started.authorizationId });
    await activateSubscription(pending.started.subscriptionId, {
        provider,
        clock,
        beforeCancelNotice,
        touristVipInheritance: noTouristVip
    });
    expect(await committedSubscriptionStatus(pending.started.subscriptionId)).toBe('ACTIVE');
    return pending;
}

function plainFake() {
    return new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [{ lie: 'M1', why: 'census signup must land its authorization' }]
    });
}

/** A fake whose authorization changes produce one immediate delivery (for the webhook cases). */
function deliveringFake() {
    return new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [
            { lie: 'M1', why: 'census signup must land its authorization' },
            { lie: 'M6', why: 'the authorization change must produce one immediate delivery' }
        ]
    });
}

async function takeAuthorizationDelivery(
    provider: FakePaymentProvider
): Promise<NoticeDelivery | undefined> {
    for (const delivery of provider.takeDeliveries().deliveries) {
        if ((await provider.decodeNotice(delivery)).resourceKind === 'authorization')
            return delivery;
    }
    return undefined;
}

function noticeFor(
    userId: string,
    change: CoverageChangedEvent['change'],
    vertical: CoverageChangedEvent['vertical'] = VerticalEnum.ACCOMMODATION
): CoverageChangedEvent {
    return { userId, vertical, sourceType: 'SUBSCRIPTION', change };
}

describe('TEST:B4:2 coverage notice census — every billing coverage writer notices after commit', () => {
    describe('(a) S16 — the first rejected charge', () => {
        it('declineFirstCharge emits REMOVED once the row is committed CHARGE_DECLINED', async () => {
            // Arrange
            const provider = plainFake();
            const { started, choice } = await seedActive(provider);
            const charge = await provider.declineCharge({
                authorizationId: started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(started.subscriptionId)
            );

            // Act
            const result = await declineFirstCharge(
                { chargeId: charge.chargeId },
                { provider, clock, beforeCancelNotice, coverageNotices }
            );

            // Assert
            expect(result).toMatchObject({ outcome: 'DECLINED' });
            expect(seen).toEqual([
                { event: noticeFor(choice.userId, 'REMOVED'), committed: 'CHARGE_DECLINED' }
            ]);
        });

        it('recordChargeFact of the rejected charge reaches S16 and emits REMOVED after commit', async () => {
            // Arrange
            const provider = plainFake();
            const { started, choice } = await seedActive(provider);
            const charge = await provider.declineCharge({
                authorizationId: started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(started.subscriptionId)
            );

            // Act
            const result = await recordChargeFact(
                { chargeId: charge.chargeId },
                { provider, clock, beforeCancelNotice, planPolicy, coverageNotices }
            );

            // Assert
            expect(result).toMatchObject({ outcome: 'DECLINED', decline: { outcome: 'DECLINED' } });
            expect(seen).toEqual([
                { event: noticeFor(choice.userId, 'REMOVED'), committed: 'CHARGE_DECLINED' }
            ]);
        });

        it('emits nothing when the row is no longer ACTIVE (the race was lost)', async () => {
            // Arrange
            const provider = plainFake();
            const { started } = await seedActive(provider);
            const charge = await provider.declineCharge({
                authorizationId: started.authorizationId,
                declineReason: 'issuer_declined'
            });
            await getServiceTestPool().query(
                "UPDATE subscription SET status = 'CANCELLED', service_ends_at = now() WHERE id = $1",
                [started.subscriptionId]
            );
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(started.subscriptionId)
            );

            // Act
            const result = await declineFirstCharge(
                { chargeId: charge.chargeId },
                { provider, clock, beforeCancelNotice, coverageNotices }
            );

            // Assert
            expect(result).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_ACTIVE' });
            expect(seen).toEqual([]);
        });

        it('emits nothing when the row already has a credited payment', async () => {
            // Arrange
            const provider = plainFake();
            const { started } = await seedActive(provider);
            const charge = await provider.declineCharge({
                authorizationId: started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(started.subscriptionId)
            );

            // Act
            const result = await declineFirstCharge(
                { chargeId: charge.chargeId },
                {
                    provider,
                    clock,
                    beforeCancelNotice,
                    payments: { hasCreditedPayment: async () => true },
                    coverageNotices
                }
            );

            // Assert
            expect(result).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'HAS_CREDITED_PAYMENT' });
            expect(seen).toEqual([]);
            expect(await committedSubscriptionStatus(started.subscriptionId)).toBe('ACTIVE');
        });
    });

    describe('(b) the provider cancellation mirror', () => {
        it('processProviderNotice emits REMOVED once the row is committed CANCELLED', async () => {
            // Arrange
            const provider = deliveringFake();
            const { started, choice } = await seedActive(provider);
            provider.takeDeliveries();
            await provider.cancel({ authorizationId: started.authorizationId });
            const delivery = await takeAuthorizationDelivery(provider);
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(started.subscriptionId)
            );

            // Act
            const result = await processProviderNotice(
                { channel: 'WEBHOOKS', delivery: delivery ?? { headers: {}, body: '' } },
                {
                    provider,
                    clock,
                    beforeCancelNotice,
                    payments: { hasCreditedPayment: async () => true },
                    coverageNotices
                }
            );

            // Assert
            expect(result).toEqual({ ack: 'OK', outcome: 'APPLIED' });
            expect(seen).toEqual([
                { event: noticeFor(choice.userId, 'REMOVED'), committed: 'CANCELLED' }
            ]);
        });
    });

    describe('(c) S2 — the authorization activates the row', () => {
        it('activateSubscription emits ADDED once the row is committed ACTIVE', async () => {
            // Arrange
            const provider = plainFake();
            const { started, choice } = await startPending(provider);
            await provider.approve({ authorizationId: started.authorizationId });
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(started.subscriptionId)
            );

            // Act
            const result = await activateSubscription(started.subscriptionId, {
                provider,
                clock,
                beforeCancelNotice,
                touristVipInheritance: noTouristVip,
                coverageNotices
            });

            // Assert
            expect(result).toEqual({ activated: true, subscriptionId: started.subscriptionId });
            expect(seen).toEqual([
                { event: noticeFor(choice.userId, 'ADDED'), committed: 'ACTIVE' }
            ]);
        });

        it('activateSubscription emits CHANGED when the activated row succeeds another one', async () => {
            // Arrange
            const provider = plainFake();
            const { started, choice } = await startPending(provider);
            const predecessorId = await insertCensusSubscription({
                userId: choice.userId,
                vertical: 'accommodation',
                planVersionId: choice.planVersionId,
                billingOptionId: choice.billingOptionId,
                status: 'CANCELLED'
            });
            await getServiceTestPool().query(
                'UPDATE subscription SET succeeds_id = $2 WHERE id = $1',
                [started.subscriptionId, predecessorId]
            );
            await provider.approve({ authorizationId: started.authorizationId });
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(started.subscriptionId)
            );

            // Act
            await activateSubscription(started.subscriptionId, {
                provider,
                clock,
                beforeCancelNotice,
                touristVipInheritance: noTouristVip,
                coverageNotices
            });

            // Assert
            expect(seen).toEqual([
                { event: noticeFor(choice.userId, 'CHANGED'), committed: 'ACTIVE' }
            ]);
        });

        it('processProviderNotice (authorization notice) emits ADDED once the row is committed ACTIVE', async () => {
            // Arrange
            const provider = deliveringFake();
            const { started, choice } = await startPending(provider);
            provider.takeDeliveries();
            await provider.approve({ authorizationId: started.authorizationId });
            const delivery = await takeAuthorizationDelivery(provider);
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(started.subscriptionId)
            );

            // Act
            const result = await processProviderNotice(
                { channel: 'WEBHOOKS', delivery: delivery ?? { headers: {}, body: '' } },
                { provider, clock, beforeCancelNotice, coverageNotices }
            );

            // Assert
            expect(result).toEqual({ ack: 'OK', outcome: 'APPLIED' });
            expect(seen).toEqual([
                { event: noticeFor(choice.userId, 'ADDED'), committed: 'ACTIVE' }
            ]);
        });

        it('expireAuthorizationWindows emits ADDED when the reread is active, and nothing on S3', async () => {
            // Arrange
            const fake = plainFake();
            const provider = namespaceFake(fake);
            const authorized = await startPending(provider);
            const abandoned = await startPending(provider);
            seededSubscriptionIds.add(authorized.started.subscriptionId);
            seededSubscriptionIds.add(abandoned.started.subscriptionId);
            await fake.approve({
                authorizationId: authorized.started.authorizationId.split(':').at(-1) ?? ''
            });
            current = new Date(openedAt.getTime() + 73 * 60 * 60 * 1000);
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(authorized.started.subscriptionId)
            );

            // Act
            const summary = await withSeededSubscriptionSweep(20, () =>
                expireAuthorizationWindows(20, {
                    provider,
                    clock,
                    beforeCancelNotice,
                    touristVipInheritance: noTouristVip,
                    coverageNotices
                })
            );

            // Assert
            expect(summary).toMatchObject({ activated: 1, abandoned: 1 });
            expect(seen).toEqual([
                { event: noticeFor(authorized.choice.userId, 'ADDED'), committed: 'ACTIVE' }
            ]);
            expect(await committedSubscriptionStatus(abandoned.started.subscriptionId)).toBe(
                'ABANDONED'
            );
        });
    });

    describe('(d) the inherited Tourist VIP', () => {
        it('cancelInheritedTouristVips emits REMOVED in tourist for every closed row', async () => {
            // Arrange
            const provider = plainFake();
            const choice = await seedCensusChoice({ vertical: 'tourist' });
            seededUserIds.push(choice.userId);
            const vipId = await insertCensusSubscription({
                userId: choice.userId,
                vertical: 'tourist',
                planVersionId: choice.planVersionId,
                billingOptionId: choice.billingOptionId,
                status: 'ACTIVE'
            });
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(vipId)
            );

            // Act
            const result = await cancelInheritedTouristVips(
                { userId: choice.userId },
                {
                    provider,
                    clock,
                    beforeCancelNotice,
                    touristVipInheritance: { inherits: async () => true },
                    coverageNotices
                }
            );

            // Assert
            expect(result).toEqual({ cancelled: 1, deferred: 0, skipped: 0 });
            expect(seen).toEqual([
                {
                    event: noticeFor(choice.userId, 'REMOVED', VerticalEnum.TOURIST),
                    committed: 'CANCELLED'
                }
            ]);
        });

        it('emits nothing when the plan no longer inherits the VIP', async () => {
            // Arrange
            const provider = plainFake();
            const choice = await seedCensusChoice({ vertical: 'tourist' });
            seededUserIds.push(choice.userId);
            const vipId = await insertCensusSubscription({
                userId: choice.userId,
                vertical: 'tourist',
                planVersionId: choice.planVersionId,
                billingOptionId: choice.billingOptionId,
                status: 'ACTIVE'
            });
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(vipId)
            );

            // Act
            const result = await cancelInheritedTouristVips(
                { userId: choice.userId },
                {
                    provider,
                    clock,
                    beforeCancelNotice,
                    touristVipInheritance: { inherits: async () => false },
                    coverageNotices
                }
            );

            // Assert
            expect(result).toEqual({ cancelled: 0, deferred: 0, skipped: 1 });
            expect(seen).toEqual([]);
            expect(await committedSubscriptionStatus(vipId)).toBe('ACTIVE');
        });
    });

    describe('(e) rollback', () => {
        it('S16 whose transaction throws keeps the row ACTIVE and emits nothing', async () => {
            // Arrange
            const provider = plainFake();
            const { started, choice } = await seedActive(provider);
            await insertCensusSubscription({
                userId: choice.userId,
                vertical: 'accommodation',
                planVersionId: choice.planVersionId,
                billingOptionId: choice.billingOptionId,
                status: 'PENDING_AUTHORIZATION',
                succeedsId: started.subscriptionId
            });
            const charge = await provider.declineCharge({
                authorizationId: started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(started.subscriptionId)
            );

            // Act
            const call = declineFirstCharge(
                { chargeId: charge.chargeId },
                {
                    provider,
                    clock,
                    beforeCancelNotice,
                    successionCloser: {
                        closeSuccession: async () => {
                            throw new Error('succession closer failed inside the transaction');
                        }
                    },
                    coverageNotices
                }
            );

            // Assert
            await expect(call).rejects.toThrow('succession closer failed inside the transaction');
            expect(seen).toEqual([]);
            expect(await committedSubscriptionStatus(started.subscriptionId)).toBe('ACTIVE');
        });
    });

    describe('(f) S7 — a late payment reactivates a SUSPENDED row (HOS-1560)', () => {
        it('recordChargeFact of the late approved retry emits ADDED once the row is committed ACTIVE', async () => {
            // Arrange: a card principal in grace by a failed cycle the provider approves on attempt 2,
            // left SUSPENDED with its unpaid-period anchor while its authorization stays active (H6).
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            seededUserIds.push(fixture.user.id);
            const subscriptionId = fixture.started.subscriptionId;
            await getServiceTestPool().query(
                "UPDATE subscription SET status = 'SUSPENDED' WHERE id = $1",
                [subscriptionId]
            );
            fixture.advanceToAttempt(2);
            const { coverageNotices, seen } = recordingCoverageNotices(() =>
                committedSubscriptionStatus(subscriptionId)
            );

            // Act
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                { ...fixture.ports, coverageNotices }
            );

            // Assert
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                reactivation: { outcome: 'REACTIVATED', subscriptionId, destination: 'ACTIVE' }
            });
            expect(seen).toEqual([
                { event: noticeFor(fixture.user.id, 'ADDED'), committed: 'ACTIVE' }
            ]);
        });
    });
});
