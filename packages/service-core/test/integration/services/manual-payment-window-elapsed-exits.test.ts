import { eq, getDb, inArray, manualPayments, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service';
import { cancelSuccessionPredecessor } from '../../../src/services/billing/subscription/cancel-succession-predecessor.service';
import { applyS21 } from '../../../src/services/billing/subscription/complement-s21';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    seedComplement,
    seedOrphanInstance,
    seedOrphanOwner
} from './support/addon-orphan-fixtures';
import { addonPolicyFromTx, seedCoverageUser } from './support/coverage-fixtures';
import {
    currentFloorPolicy,
    grantSignerActor,
    seedGrantPlan
} from './support/permanent-grant-fixtures';
import { seedS20Addon } from './support/permanent-grant-s20-fixtures';
import { retireS17, s17Ports, seedS17 } from './support/succession-s17-fixtures';

afterAll(closeServiceTestPool);
const s17InstallmentIds: string[] = [];
afterEach(async () => {
    if (s17InstallmentIds.length)
        await getDb()
            .delete(manualPayments)
            .where(inArray(manualPayments.id, s17InstallmentIds.splice(0)));
    await retireS17();
});

describe.skipIf(!isServiceTestDbAvailable())('TEST:B5:8 MP3 terminal exits', () => {
    it.each([
        'GRACE_PERIOD',
        'PENDING_AUTHORIZATION'
    ] as const)('closes %s manual complement installment through public S20', async (origin) => {
        const db = getServiceTestDb();
        const clock = { now: () => new Date('2026-10-14T12:00:00.000Z') };
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const beneficiary = await seedCoverageUser(db);
        const admin = await seedCoverageUser(db);
        const addon = await seedS20Addon({
            fake,
            userId: beneficiary.userId,
            vertical: 'accommodation',
            targetId: null,
            scopeType: 'USER',
            compatibleVerticals: ['accommodation'],
            complementStatus: origin,
            paymentMethod: 'MANUAL',
            withLink: false
        });
        const [awaiting] = await db
            .insert(manualPayments)
            .values({
                subscriptionId: addon.complementId,
                periodStart: new Date('2026-10-10T10:00:00.000Z'),
                status: 'AWAITING'
            })
            .returning();
        if (!awaiting) throw new Error('Awaiting fixture failed');
        const anchor = await seedGrantPlan(db, 'accommodation');
        await grantPermanentGrant(
            {
                beneficiaryUserId: beneficiary.userId,
                actor: grantSignerActor(admin.userId),
                reason: 'MP3 complement exit',
                includesAddons: true,
                anchors: [{ vertical: 'accommodation', ...anchor }]
            },
            {
                planPolicy: currentFloorPolicy,
                clock,
                provider: fake,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                coverageNotices: { emitCoverageChanged: async () => {} },
                orphanhood: {
                    addonPolicy: addonPolicyFromTx(db),
                    listing: async () => {
                        throw new Error('Unexpected listing');
                    }
                }
            }
        );
        const [row] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, addon.complementId));
        const [installment] = await db
            .select()
            .from(manualPayments)
            .where(eq(manualPayments.id, awaiting.id));
        expect(row?.status).toBe('CANCELLED');
        expect(installment?.status).toBe('DECLARED_UNPAID');
    });
    it('closes a grace predecessor installment through public S17', async () => {
        const fixture = await seedS17({ predecessorStatus: 'GRACE_PERIOD' });
        const db = getServiceTestDb();
        await db
            .update(subscriptions)
            .set({ paymentMethod: 'MANUAL' })
            .where(eq(subscriptions.id, fixture.predecessorId));
        const [awaiting] = await db
            .insert(manualPayments)
            .values({
                subscriptionId: fixture.predecessorId,
                periodStart: new Date('2026-10-10T10:00:00.000Z'),
                status: 'AWAITING'
            })
            .returning();
        if (!awaiting) throw new Error('Awaiting fixture failed');
        s17InstallmentIds.push(awaiting.id);
        const result = await cancelSuccessionPredecessor(
            { successorSubscriptionId: fixture.successorId },
            s17Ports(fixture.provider, { deliver: true })
        );
        const [subscription] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, fixture.predecessorId));
        const [installment] = await db
            .select()
            .from(manualPayments)
            .where(eq(manualPayments.id, awaiting.id));
        expect(result.outcome).toBe('CANCELLED');
        expect(subscription?.status).toBe('CANCELLED');
        expect(installment?.status).toBe('DECLARED_UNPAID');
    });
    it.each([
        'GRACE_PERIOD',
        'PENDING_AUTHORIZATION'
    ] as const)('closes %s manual complement installment through S21', async (origin) => {
        await withServiceTestTransaction(async (tx) => {
            const { userId } = await seedOrphanOwner(tx);
            const { subscriptionId } = await seedComplement(tx, {
                userId,
                vertical: 'accommodation',
                status: origin,
                paymentMethod: 'MANUAL',
                withLink: false,
                grace: origin === 'GRACE_PERIOD'
            });
            await seedOrphanInstance(tx, {
                ownerId: userId,
                scopeType: 'USER',
                compatibleVerticals: ['accommodation'],
                status: 'CANCELLED',
                complementSubscriptionId: subscriptionId
            });
            const [awaiting] = await tx
                .insert(manualPayments)
                .values({
                    subscriptionId,
                    periodStart: new Date('2026-10-10T10:00:00.000Z'),
                    status: 'AWAITING'
                })
                .returning();
            if (!awaiting) throw new Error('Awaiting fixture failed');
            const result = await applyS21({
                tx,
                complementSubscriptionId: subscriptionId,
                now: new Date('2026-10-14T12:00:00.000Z')
            });
            const [subscription] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, subscriptionId));
            const [installment] = await tx
                .select()
                .from(manualPayments)
                .where(eq(manualPayments.id, awaiting.id));
            expect(result.outcome).toBe('CANCELLED');
            expect(subscription?.status).toBe('CANCELLED');
            expect(installment?.status).toBe('DECLARED_UNPAID');
        });
    });
});
