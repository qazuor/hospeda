import {
    coveredPeriods,
    eq,
    inArray,
    payments,
    permanentGrants,
    permanentGrantVerticals,
    receipts,
    reconciliationInventoryModel,
    reconciliationMarkPayments,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    resetSeededReconciliationInventory,
    trackSeededReconciliationRow,
    withSeededCancellationRetryInventory,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import { cancelActiveNow, unusedComplementPolicy } from './support/cancel-active-fixtures.js';
import {
    chargeOn,
    crossingClock,
    hungPaymentsOf,
    marksOf,
    paymentsForSubscription,
    recordOn,
    refundsOfPayment,
    retireCancelCrossingRows,
    seedCrossingActive
} from './support/cancel-crossing-fixtures.js';
import { addonPolicyFromTx, seedCoverageUser } from './support/coverage-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './support/permanent-grant-fixtures.js';
import { retireS20Rows, seedS20Addon } from './support/permanent-grant-s20-fixtures.js';

const DAY = 24 * 60 * 60 * 1000;
const users: string[] = [];
const addonSubscriptions: string[] = [];
afterAll(closeServiceTestPool);
afterEach(async () => {
    vi.restoreAllMocks();
    resetSeededReconciliationInventory();
    for (const subscriptionId of addonSubscriptions.splice(0)) {
        const db = getServiceTestDb();
        const marks = await marksOf(subscriptionId);
        const paymentRows = await db
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.subscriptionId, subscriptionId));
        if (marks.length)
            await db.delete(reconciliationMarkPayments).where(
                inArray(
                    reconciliationMarkPayments.markId,
                    marks.map(({ id }) => id)
                )
            );
        if (paymentRows.length) {
            const ids = paymentRows.map(({ id }) => id);
            await db.delete(receipts).where(inArray(receipts.paymentId, ids));
            await db.delete(coveredPeriods).where(inArray(coveredPeriods.paymentId, ids));
            await db.delete(payments).where(inArray(payments.id, ids));
        }
    }
    await retireS20Rows();
    await retireCancelCrossingRows();
    await retirePermanentGrantRows(users.splice(0));
});

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:13 — C3, charges after the grant (AC:B9a:13)',
    () => {
        it('hangs two later charges on one grant mark and retries the still live preapproval for three days', async () => {
            const { clock, setNow } = crossingClock();
            const start = clock.now();
            const fake = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock,
                honestAbout: [{ lie: 'M8', why: 'C3 reads approved charges immediately' }]
            });
            const seeded = await seedCrossingActive({ fake, payment: 'payment' });
            const admin = await seedCoverageUser(getServiceTestDb());
            users.push(seeded.userId, admin.userId);
            const plan = await seedGrantPlan(getServiceTestDb(), 'accommodation');
            const cancel = vi.spyOn(fake, 'cancel').mockRejectedValue(new Error('timeout'));
            const beforeCancelNotice = outboxBeforeCancelNotice({ deliver: true });
            const grant = await grantPermanentGrant(
                {
                    beneficiaryUserId: seeded.userId,
                    actor: grantSignerActor(admin.userId),
                    reason: 'C3 charge crossing',
                    includesAddons: false,
                    anchors: [{ vertical: 'accommodation', ...plan }]
                },
                {
                    planPolicy: currentFloorPolicy,
                    clock,
                    provider: fake,
                    beforeCancelNotice,
                    coverageNotices: { emitCoverageChanged: async () => undefined },
                    orphanhood: {
                        addonPolicy: async () => {
                            throw new Error('Unexpected addon');
                        },
                        listing: async () => {
                            throw new Error('Unexpected listing');
                        }
                    }
                }
            );
            expect(grant.cancelledSubscriptionIds).toContain(seeded.subscriptionId);
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(subscriptions)
                        .where(eq(subscriptions.id, seeded.subscriptionId))
                )[0]?.status
            ).toBe('CANCELLED');
            expect(
                await reconciliationInventoryModel.findCancellationDecision({
                    subscriptionId: seeded.subscriptionId
                })
            ).toMatchObject({ transition: 'S13' });
            expect(
                (await fake.readAuthorization({ authorizationId: seeded.authorizationId })).snapshot
                    .status
            ).toBe('active');
            const [liveGrant] = await getServiceTestDb()
                .select()
                .from(permanentGrants)
                .where(eq(permanentGrants.id, grant.permanentGrantId));
            expect(liveGrant?.revokedAt).toBeNull();
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(permanentGrantVerticals)
                        .where(eq(permanentGrantVerticals.permanentGrantId, grant.permanentGrantId))
                ).map(({ id }) => id)
            ).toEqual(grant.anchorIds);
            trackSeededReconciliationRow(seeded.subscriptionId);

            const runDay = async (day: number) => {
                setNow(new Date(start.getTime() + day * DAY + 60_000));
                cancel.mockClear();
                return withSeededReconciliationInventory(() =>
                    withSeededCancellationRetryInventory(() =>
                        runReconciliationSweep(
                            { mode: 'single', correlationId: crypto.randomUUID() },
                            { provider: fake, clock, cancellationRetry: { beforeCancelNotice } }
                        )
                    )
                );
            };
            for (const day of [0, 1, 2]) {
                const summary = await runDay(day);
                expect(summary.cancellationRetry?.callFailed).toBeGreaterThanOrEqual(1);
                expect(
                    cancel.mock.calls.filter(
                        ([input]) => input.authorizationId === seeded.authorizationId
                    )
                ).toHaveLength(1);
                if (day === 2) continue;
                const charge = await chargeOn({
                    fake,
                    authorizationId: seeded.authorizationId,
                    at: new Date(start.getTime() + (day + 1) * DAY),
                    setNow,
                    reference: `${seeded.subscriptionId}:cycle-${day + 1}`
                });
                const recorded = await recordOn({ fake, chargeId: charge.chargeId, clock });
                expect(recorded).toMatchObject({
                    outcome: 'CREDITED',
                    crossing: {
                        outcome: 'MARKED',
                        markOutcome: day === 0 ? 'OPENED' : 'ACCUMULATED',
                        transition: 'S13'
                    }
                });
                if (day === 0) {
                    const replay = await recordOn({ fake, chargeId: charge.chargeId, clock });
                    expect(replay).toMatchObject({ crossing: { outcome: 'ALREADY_MARKED' } });
                }
            }
            await runDay(3);
            const marks = await marksOf(seeded.subscriptionId);
            const grantMarks = marks.filter(
                (mark) => mark.reason === 'COBRO_POSTERIOR_AL_GRANT' && mark.liftedAt === null
            );
            expect(grantMarks).toHaveLength(1);
            expect(
                marks.filter((mark) =>
                    ['COBRO_POSTERIOR_A_LA_BAJA', 'PAGO_TARDIO_RECHAZADO'].includes(mark.reason)
                )
            ).toHaveLength(0);
            expect(
                marks.filter(
                    (mark) => mark.reason === 'CANCELACION_SIN_CONFIRMAR' && mark.liftedAt === null
                )
            ).toHaveLength(1);
            const payments = await paymentsForSubscription(seeded.subscriptionId);
            const hung = await hungPaymentsOf(grantMarks[0]!.id);
            expect(hung).toHaveLength(2);
            for (const { paymentId } of hung) {
                if (!paymentId) throw new Error('Expected a hung payment');
                expect(payments.some((payment) => payment.id === paymentId)).toBe(true);
                expect(await refundsOfPayment(paymentId)).toHaveLength(0);
            }
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(subscriptions)
                        .where(eq(subscriptions.id, seeded.subscriptionId))
                )[0]?.status
            ).toBe('CANCELLED');
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(permanentGrants)
                        .where(eq(permanentGrants.id, grant.permanentGrantId))
                )[0]?.revokedAt
            ).toBeNull();
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(permanentGrantVerticals)
                        .where(eq(permanentGrantVerticals.permanentGrantId, grant.permanentGrantId))
                ).map(({ id }) => id)
            ).toEqual(grant.anchorIds);
        });

        it('marks a charge after S20 converted a live complement', async () => {
            const { clock, setNow } = crossingClock(cancelActiveNow);
            const fake = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock,
                honestAbout: [{ lie: 'M8', why: 'C3 reads the S20 charge immediately' }]
            });
            const principal = await seedCrossingActive({ fake, payment: 'payment' });
            const admin = await seedCoverageUser(getServiceTestDb());
            users.push(principal.userId, admin.userId);
            const addon = await seedS20Addon({
                fake,
                userId: principal.userId,
                vertical: 'accommodation',
                targetId: principal.subscriptionId,
                compatibleVerticals: ['accommodation']
            });
            addonSubscriptions.push(addon.complementId);
            vi.spyOn(fake, 'cancel').mockRejectedValue(new Error('timeout'));
            const plan = await seedGrantPlan(getServiceTestDb(), 'accommodation');
            await grantPermanentGrant(
                {
                    beneficiaryUserId: principal.userId,
                    actor: grantSignerActor(admin.userId),
                    reason: 'S20 C3 charge',
                    includesAddons: true,
                    anchors: [{ vertical: 'accommodation', ...plan }]
                },
                {
                    planPolicy: currentFloorPolicy,
                    clock,
                    provider: fake,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: async () => undefined },
                    orphanhood: {
                        addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                        listing: async () => {
                            throw new Error('Unexpected listing');
                        }
                    }
                }
            );
            expect(
                await reconciliationInventoryModel.findCancellationDecision({
                    subscriptionId: addon.complementId
                })
            ).toMatchObject({ transition: 'S20' });
            expect(
                (await fake.readAuthorization({ authorizationId: addon.authorizationId })).snapshot
                    .status
            ).toBe('active');
            const charge = await chargeOn({
                fake,
                authorizationId: addon.authorizationId,
                at: new Date(clock.now().getTime() + DAY),
                setNow,
                reference: addon.complementId
            });
            const recorded = await recordOn({ fake, chargeId: charge.chargeId, clock });
            expect(recorded).toMatchObject({
                outcome: 'CREDITED',
                crossing: { outcome: 'MARKED', transition: 'S20' }
            });
            expect(
                (await marksOf(addon.complementId)).filter(
                    (mark) => mark.reason === 'COBRO_POSTERIOR_AL_GRANT' && mark.liftedAt === null
                )
            ).toHaveLength(1);
        });

        it('keeps an S11 cancellation crossing on the original reason', async () => {
            const { clock, setNow } = crossingClock(cancelActiveNow);
            const fake = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock,
                honestAbout: [{ lie: 'M8', why: 'C2 control reads the charge immediately' }]
            });
            const seeded = await seedCrossingActive({ fake, payment: 'payment' });
            await cancelActiveSubscription(
                {
                    actor: {
                        id: seeded.userId,
                        roles: [],
                        permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
                    },
                    subscriptionId: seeded.subscriptionId
                },
                {
                    provider: fake,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice(),
                    complements: unusedComplementPolicy,
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            );
            const charge = await chargeOn({
                fake,
                authorizationId: seeded.authorizationId,
                at: new Date(clock.now().getTime() + DAY),
                setNow,
                reference: seeded.subscriptionId
            });
            expect(await recordOn({ fake, chargeId: charge.chargeId, clock })).toMatchObject({
                crossing: { outcome: 'MARKED', transition: 'S11' }
            });
            expect(
                (await marksOf(seeded.subscriptionId)).filter(
                    (mark) => mark.reason === 'COBRO_POSTERIOR_A_LA_BAJA' && mark.liftedAt === null
                )
            ).toHaveLength(1);
        });
    }
);
