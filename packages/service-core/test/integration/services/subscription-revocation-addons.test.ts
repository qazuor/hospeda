/** TEST:B5:12 AC:B5:24: S36 runs A5 and requests the one-time addon RF1 in its own act. */

import {
    addonInstances,
    and,
    eq,
    getDb,
    inArray,
    payments,
    reconciliationMarks,
    refunds
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
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
    seedRevocationActor,
    trackSubscription
} from './support/revocation-fixtures';

const created: { instanceId: string; paymentId?: string }[] = [];
const createdSubscriptions: string[] = [];

afterAll(closeServiceTestPool);
afterEach(async () => {
    const db = getDb();
    const subscriptionIds = createdSubscriptions.splice(0);
    if (subscriptionIds.length > 0)
        await db
            .delete(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, subscriptionIds));
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
    ])('TEST:B5:12 cancels UNA_VEZ and refunds only a payment from day %i', async (purchaseDay) => {
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
    ])('TEST:B5:12 S21 refunds a recent complement charge and marks an older one (%i)', async (chargeDay) => {
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
                reason: 'COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA'
            });
        }
    });

    it('TEST:B5:12 a LISTING lookup failure rolls back the whole S36 transaction', async () => {
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
});
