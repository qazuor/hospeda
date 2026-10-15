/** TEST:B5:12 AC:B5:24: S36 runs A5 and requests the one-time addon RF1 in its own act. */

import {
    addonInstances,
    addonProducts,
    and,
    eq,
    getDb,
    inArray,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    refunds,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service';
import { revokeSubscription } from '../../../src/services/billing/subscription/revoke-subscription.service';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers';
import {
    seedComplementCharge,
    seedOrphanInstance,
    seedVerticalAddon
} from './support/addon-orphan-fixtures';
import {
    retireRevocationRows,
    revocationFixture,
    seedCreditedPayment,
    seedRevocationActor,
    seedSiblingPrincipal,
    trackSubscription
} from './support/revocation-fixtures';

const created: { instanceId: string; paymentId?: string }[] = [];
const createdSubscriptions: string[] = [];

afterAll(closeServiceTestPool);
afterEach(async () => {
    const db = getDb();
    const subscriptionIds = createdSubscriptions.splice(0);
    if (subscriptionIds.length > 0) {
        const marks = await db
            .select({ id: reconciliationMarks.id })
            .from(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, subscriptionIds));
        if (marks.length > 0)
            await db.delete(reconciliationMarkPayments).where(
                inArray(
                    reconciliationMarkPayments.markId,
                    marks.map(({ id }) => id)
                )
            );
        await db
            .delete(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, subscriptionIds));
    }
    for (const row of created.splice(0)) {
        if (row.paymentId) {
            await db.delete(refunds).where(eq(refunds.paymentId, row.paymentId));
            await db.delete(payments).where(eq(payments.id, row.paymentId));
        }
        await db
            .update(addonInstances)
            .set({ status: 'CANCELLED' })
            .where(eq(addonInstances.id, row.instanceId));
    }
    await retireRevocationRows();
});

describe.skipIf(!isServiceTestDbAvailable())('TEST:B5:12 AC:B5:24 S36 orphan refunds', () => {
    it.each([
        2, -7
    ])('TEST:B5:12 (b) cancels UNA_VEZ and refunds only a payment from day %i', async (purchaseDay) => {
        const f = await revocationFixture();
        const { instanceId } = await seedOrphanInstance(getDb(), {
            ownerId: f.userId,
            scopeType: 'VERTICAL_SUBSCRIPTION',
            compatibleVerticals: ['accommodation'],
            status: 'ACTIVE',
            targetId: f.subscriptionId,
            chargeKind: 'UNA_VEZ'
        });
        const [payment] = await getDb()
            .insert(payments)
            .values({
                addonInstanceId: instanceId,
                amount: 5000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'FAKE',
                providerFactId: `b56-${crypto.randomUUID()}`,
                factAt: new Date(f.day(purchaseDay).getTime())
            })
            .returning({ id: payments.id });
        if (!payment) throw new Error('Expected one-time addon payment');
        created.push({ instanceId, paymentId: payment.id });
        f.at(f.day(5));

        const result = await revokeSubscription(
            {
                actor: await seedRevocationActor(),
                subscriptionId: f.subscriptionId,
                expectedPaymentId: f.payment?.id
            },
            f.ports
        );

        expect(result.orphanedAddonIds).toContain(instanceId);
        expect(
            (
                await getDb()
                    .select({ status: addonInstances.status })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, instanceId))
            )[0]?.status
        ).toBe('CANCELLED');
        const addonRefunds = await getDb()
            .select()
            .from(refunds)
            .where(
                and(
                    eq(refunds.paymentId, payment.id),
                    eq(refunds.reason, 'ONE_TIME_ADDON_REVOCATION')
                )
            );
        if (purchaseDay === 2) expect(addonRefunds).toHaveLength(1);
        else expect(addonRefunds).toHaveLength(0);
    });

    it.each([
        2, -7
    ])('TEST:B5:12 (c),(g) S21 refunds a recent charge and marks an older one (%i)', async (chargeDay) => {
        const f = await revocationFixture();
        const addon = await seedVerticalAddon(getDb(), {
            userId: f.userId,
            targetId: f.subscriptionId
        });
        trackSubscription(addon.complementId);
        createdSubscriptions.push(addon.complementId);
        created.push({ instanceId: addon.instanceId });
        const payment = await seedComplementCharge(getDb(), {
            subscriptionId: addon.complementId,
            factAt: f.day(chargeDay),
            coveredPeriodStart: f.day(chargeDay),
            amount: 25000
        });
        f.at(f.day(5));
        const result = await revokeSubscription(
            {
                actor: await seedRevocationActor(),
                subscriptionId: f.subscriptionId,
                expectedPaymentId: f.payment?.id
            },
            f.ports
        );
        expect(result.orphanedAddonIds).toContain(addon.instanceId);
        const chargeRefunds = await getDb()
            .select()
            .from(refunds)
            .where(eq(refunds.paymentId, payment.paymentId));
        const marks = await getDb()
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, addon.complementId));
        if (chargeDay === 2) {
            expect(chargeRefunds).toHaveLength(1);
            expect(chargeRefunds[0]).toMatchObject({ reason: 'ADDON_ORPHAN', amount: 25000 });
            expect(marks).toHaveLength(0);
        } else {
            expect(chargeRefunds).toHaveLength(0);
            expect(marks).toHaveLength(1);
            expect(marks[0]).toMatchObject({
                reason: 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA'
            });
        }
    });

    it('TEST:B5:12 (d) a LISTING lookup failure rolls back the whole S36 transaction', async () => {
        const f = await revocationFixture();
        const { instanceId } = await seedOrphanInstance(getDb(), {
            ownerId: f.userId,
            scopeType: 'LISTING',
            compatibleVerticals: ['accommodation'],
            status: 'ACTIVE',
            targetId: crypto.randomUUID()
        });
        created.push({ instanceId });
        await expect(
            revokeSubscription(
                {
                    actor: await seedRevocationActor(),
                    subscriptionId: f.subscriptionId,
                    expectedPaymentId: f.payment?.id
                },
                f.ports
            )
        ).rejects.toThrow(/listing .* not programmed/);
        const [principal] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, f.subscriptionId));
        expect(principal?.status).toBe('ACTIVE');
        expect(
            await getDb()
                .select()
                .from(refunds)
                .where(eq(refunds.paymentId, f.payment?.id ?? ''))
        ).toHaveLength(0);
        expect(
            (
                await getDb()
                    .select({ status: addonInstances.status })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, instanceId))
            )[0]?.status
        ).toBe('ACTIVE');
    });

    it('TEST:B5:12 (a) revokes principal, complement and one-time addon in one act with three RF1s', async () => {
        const f = await revocationFixture();
        const recurring = await seedVerticalAddon(getDb(), {
            userId: f.userId,
            targetId: f.subscriptionId
        });
        trackSubscription(recurring.complementId);
        createdSubscriptions.push(recurring.complementId);
        created.push({ instanceId: recurring.instanceId });
        const complementPayment = await seedComplementCharge(getDb(), {
            subscriptionId: recurring.complementId,
            factAt: f.day(2),
            coveredPeriodStart: f.day(2),
            amount: 25000
        });
        const once = await seedOrphanInstance(getDb(), {
            ownerId: f.userId,
            scopeType: 'VERTICAL_SUBSCRIPTION',
            compatibleVerticals: ['accommodation'],
            status: 'ACTIVE',
            targetId: f.subscriptionId,
            chargeKind: 'UNA_VEZ'
        });
        const [product] = await getDb()
            .select({ chargeKind: addonProducts.chargeKind })
            .from(addonProducts)
            .where(eq(addonProducts.id, once.productId));
        expect(product?.chargeKind).toBe('UNA_VEZ');
        const [oncePayment] = await getDb()
            .insert(payments)
            .values({
                addonInstanceId: once.instanceId,
                amount: 5000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'FAKE',
                providerFactId: `b56-${crypto.randomUUID()}`,
                factAt: f.day(2)
            })
            .returning({ id: payments.id });
        if (!oncePayment) throw new Error('Expected one-time payment');
        created.push({ instanceId: once.instanceId, paymentId: oncePayment.id });
        f.at(f.day(5));
        const result = await revokeSubscription(
            {
                actor: await seedRevocationActor(),
                subscriptionId: f.subscriptionId,
                expectedPaymentId: f.payment?.id
            },
            f.ports
        );
        expect(
            (
                await getDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, f.subscriptionId))
            )[0]?.status
        ).toBe('CANCELLED');
        expect(
            (
                await getDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, recurring.complementId))
            )[0]?.status
        ).toBe('CANCELLED');
        expect(
            await getDb()
                .select({ status: addonInstances.status })
                .from(addonInstances)
                .where(inArray(addonInstances.id, [recurring.instanceId, once.instanceId]))
        ).toEqual([{ status: 'CANCELLED' }, { status: 'CANCELLED' }]);
        const principalRefunds = await getDb()
            .select()
            .from(refunds)
            .where(eq(refunds.paymentId, f.payment!.id));
        const complementRefunds = await getDb()
            .select()
            .from(refunds)
            .where(eq(refunds.paymentId, complementPayment.paymentId));
        const onceRefunds = await getDb()
            .select()
            .from(refunds)
            .where(eq(refunds.paymentId, oncePayment.id));
        expect(principalRefunds).toHaveLength(1);
        expect(principalRefunds[0]?.reason).toBe('REVOCATION');
        expect(complementRefunds).toMatchObject([{ reason: 'ADDON_ORPHAN', amount: 25000 }]);
        expect(onceRefunds).toMatchObject([{ reason: 'ONE_TIME_ADDON_REVOCATION', amount: 5000 }]);
        expect(onceRefunds[0]?.paymentId).toBe(oncePayment.id);
        expect(
            await getDb()
                .select()
                .from(reconciliationMarks)
                .where(inArray(reconciliationMarks.subscriptionId, [recurring.complementId]))
        ).toHaveLength(0);
        expect(result.oneTimeAddonRefunds).toHaveLength(1);
    });

    it('TEST:B5:12 (e) pending full refunds claim complement and UNA_VEZ balances', async () => {
        const f = await revocationFixture();
        const recurring = await seedVerticalAddon(getDb(), {
            userId: f.userId,
            targetId: f.subscriptionId
        });
        trackSubscription(recurring.complementId);
        createdSubscriptions.push(recurring.complementId);
        created.push({ instanceId: recurring.instanceId });
        const complementPayment = await seedComplementCharge(getDb(), {
            subscriptionId: recurring.complementId,
            factAt: f.day(2),
            amount: 25000,
            coveredPeriodStart: f.day(2)
        });
        const once = await seedOrphanInstance(getDb(), {
            ownerId: f.userId,
            scopeType: 'VERTICAL_SUBSCRIPTION',
            compatibleVerticals: ['accommodation'],
            status: 'ACTIVE',
            targetId: f.subscriptionId,
            chargeKind: 'UNA_VEZ'
        });
        const [oncePayment] = await getDb()
            .insert(payments)
            .values({
                addonInstanceId: once.instanceId,
                amount: 5000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'FAKE',
                providerFactId: `b56-${crypto.randomUUID()}`,
                factAt: f.day(2)
            })
            .returning({ id: payments.id });
        if (!oncePayment) throw new Error('Expected one-time payment');
        created.push({ instanceId: once.instanceId, paymentId: oncePayment.id });
        f.at(f.day(5));
        for (const [id, amount] of [
            [complementPayment.paymentId, 25000],
            [oncePayment.id, 1000]
        ] as const)
            await requestRefund(
                {
                    source: { kind: 'PAYMENT', id },
                    amount,
                    reason: id === oncePayment.id ? 'ONE_TIME_ADDON_REVOCATION' : 'ADDON_ORPHAN'
                },
                { tx: getDb(), clock: f.fixture.clock }
            );
        await revokeSubscription(
            {
                actor: await seedRevocationActor(),
                subscriptionId: f.subscriptionId,
                expectedPaymentId: f.payment?.id
            },
            f.ports
        );
        const complementRefundRows = await getDb()
            .select()
            .from(refunds)
            .where(eq(refunds.paymentId, complementPayment.paymentId));
        const oneTimeRefundRows = await getDb()
            .select()
            .from(refunds)
            .where(eq(refunds.paymentId, oncePayment.id));
        expect(complementRefundRows).toHaveLength(1);
        expect(complementRefundRows[0]).toMatchObject({
            reason: 'ADDON_ORPHAN',
            status: 'REQUESTED'
        });
        expect(oneTimeRefundRows).toHaveLength(2);
        expect(oneTimeRefundRows.map(({ amount }) => amount).sort((a, b) => a - b)).toEqual([
            1000, 4000
        ]);
        expect(
            oneTimeRefundRows.every(
                ({ reason, status }) =>
                    reason === 'ONE_TIME_ADDON_REVOCATION' && status === 'REQUESTED'
            )
        ).toBe(true);
    });

    it('TEST:B5:12 (h) preserves USER addon covered by another live paying principal', async () => {
        const f = await revocationFixture();
        const sibling = await seedSiblingPrincipal({
            like: f,
            status: 'ACTIVE',
            succeedsId: f.subscriptionId
        });
        await seedCreditedPayment({ subscriptionId: sibling.id, factAt: f.day(1) });
        const instance = await seedOrphanInstance(getDb(), {
            ownerId: f.userId,
            scopeType: 'USER',
            compatibleVerticals: ['accommodation'],
            status: 'ACTIVE',
            chargeKind: 'UNA_VEZ'
        });
        created.push({ instanceId: instance.instanceId });
        f.at(f.day(5));
        const result = await revokeSubscription(
            {
                actor: await seedRevocationActor(),
                subscriptionId: f.subscriptionId,
                expectedPaymentId: f.payment?.id
            },
            f.ports
        );
        expect(
            (
                await getDb()
                    .select({ status: addonInstances.status })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, instance.instanceId))
            )[0]?.status
        ).toBe('ACTIVE');
        expect(result.orphanedAddonIds).not.toContain(instance.instanceId);
        expect(result.oneTimeAddonRefunds).toHaveLength(0);
    });

    it('TEST:B5:12 (i) emits addon REMOVED once after commit and never after rollback', async () => {
        const f = await revocationFixture();
        const addon = await seedVerticalAddon(getDb(), {
            userId: f.userId,
            targetId: f.subscriptionId
        });
        trackSubscription(addon.complementId);
        createdSubscriptions.push(addon.complementId);
        created.push({ instanceId: addon.instanceId });
        f.at(f.day(5));
        await revokeSubscription(
            {
                actor: await seedRevocationActor(),
                subscriptionId: f.subscriptionId,
                expectedPaymentId: f.payment?.id
            },
            f.ports
        );
        expect(
            f.coverageSeen.filter(
                ({ event }) => event.change === 'REMOVED' && event.sourceType === 'ADDON'
            )
        ).toHaveLength(1);

        const broken = await revocationFixture();
        const listing = await seedOrphanInstance(getDb(), {
            ownerId: broken.userId,
            scopeType: 'LISTING',
            compatibleVerticals: ['accommodation'],
            status: 'ACTIVE',
            targetId: crypto.randomUUID()
        });
        created.push({ instanceId: listing.instanceId });
        broken.at(broken.day(5));
        await expect(
            revokeSubscription(
                {
                    actor: await seedRevocationActor(),
                    subscriptionId: broken.subscriptionId,
                    expectedPaymentId: broken.payment?.id
                },
                {
                    ...broken.ports,
                    orphanhood: {
                        ...broken.ports.orphanhood,
                        listing: async ({ listingId }) => {
                            throw new Error(`listing ${listingId} not programmed`);
                        }
                    }
                }
            )
        ).rejects.toThrow(/listing .* not programmed/);
        expect(
            broken.coverageSeen.filter(({ event }) => event.sourceType === 'ADDON')
        ).toHaveLength(0);
    });
});
