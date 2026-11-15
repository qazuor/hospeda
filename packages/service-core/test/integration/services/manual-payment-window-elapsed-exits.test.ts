import { eq, inArray, manualPayments, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service';
import { cancelDirectSubscription } from '../../../src/services/billing/subscription/cancel-direct-subscription.service';
import { cancelSuccessionPredecessor } from '../../../src/services/billing/subscription/cancel-succession-predecessor.service';
import { applyS21 } from '../../../src/services/billing/subscription/complement-s21';
import { revokeSubscription } from '../../../src/services/billing/subscription/revoke-subscription.service';
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
import { retireCancelDirectRows, seedDirectCancellation } from './support/cancel-direct-fixtures';
import {
    addonPolicyFromTx,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures';
import {
    currentFloorPolicy,
    grantSignerActor,
    seedGrantPlan
} from './support/permanent-grant-fixtures';
import { retireS20Rows, seedS20Addon } from './support/permanent-grant-s20-fixtures';
import {
    retireRevocationRows,
    revocationFixture,
    seedRevocationActor
} from './support/revocation-fixtures';
import { retireS17, s17Ports, seedS17 } from './support/succession-s17-fixtures';

const now = new Date('2026-10-14T12:00:00.000Z');
const clock = { now: () => now };
const manualIds: string[] = [];
afterAll(closeServiceTestPool);
afterEach(async () => {
    if (manualIds.length)
        await getServiceTestDb()
            .delete(manualPayments)
            .where(inArray(manualPayments.id, manualIds.splice(0)));
    await retireS17();
    await retireS20Rows();
    await retireRevocationRows();
    await retireCancelDirectRows();
});

async function insertAwaiting(subscriptionId: string) {
    const [row] = await getServiceTestDb()
        .insert(manualPayments)
        .values({
            subscriptionId,
            periodStart: new Date('2026-10-10T10:00:00.000Z'),
            status: 'AWAITING'
        })
        .returning();
    if (!row) throw new Error('Awaiting fixture failed');
    manualIds.push(row.id);
    return row.id;
}

async function assertClosed(subscriptionId: string, manualPaymentId: string) {
    const db = getServiceTestDb();
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    const [installment] = await db
        .select()
        .from(manualPayments)
        .where(eq(manualPayments.id, manualPaymentId));
    expect(subscription?.status).toBe('CANCELLED');
    expect(installment?.status).toBe('DECLARED_UNPAID');
}

async function runS13(origin: 'GRACE_PERIOD' | 'PENDING_AUTHORIZATION') {
    const db = getServiceTestDb();
    const user = await seedCoverageUser(db);
    const admin = await seedCoverageUser(db);
    const version = await seedCoveragePlanVersion(db, 'accommodation');
    const { subscriptionId } = await seedCoverageSubscription(db, {
        userId: user.userId,
        vertical: 'accommodation',
        ...version,
        status: origin
    });
    await db
        .update(subscriptions)
        .set({ paymentMethod: 'MANUAL' })
        .where(eq(subscriptions.id, subscriptionId));
    const id = await insertAwaiting(subscriptionId);
    const anchor = await seedGrantPlan(db, 'accommodation');
    await grantPermanentGrant(
        {
            beneficiaryUserId: user.userId,
            actor: grantSignerActor(admin.userId),
            reason: 'MP3 terminal exit',
            includesAddons: false,
            anchors: [{ vertical: 'accommodation', ...anchor }]
        },
        {
            planPolicy: currentFloorPolicy,
            clock,
            provider: new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock }),
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
    await assertClosed(subscriptionId, id);
}

async function runS17() {
    const fixture = await seedS17({ predecessorStatus: 'GRACE_PERIOD' });
    const db = getServiceTestDb();
    await db
        .update(subscriptions)
        .set({ paymentMethod: 'MANUAL' })
        .where(eq(subscriptions.id, fixture.predecessorId));
    const id = await insertAwaiting(fixture.predecessorId);
    const result = await cancelSuccessionPredecessor(
        { successorSubscriptionId: fixture.successorId },
        s17Ports(fixture.provider, { deliver: true })
    );
    expect(result.outcome).toBe('CANCELLED');
    await assertClosed(fixture.predecessorId, id);
}

async function runS20(origin: 'GRACE_PERIOD' | 'PENDING_AUTHORIZATION') {
    const db = getServiceTestDb();
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
    const id = await insertAwaiting(addon.complementId);
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
    await assertClosed(addon.complementId, id);
}

async function runS21(origin: 'GRACE_PERIOD' | 'PENDING_AUTHORIZATION') {
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
        const result = await applyS21({ tx, complementSubscriptionId: subscriptionId, now });
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
}

async function runS24() {
    const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    const seeded = await seedDirectCancellation({
        fake,
        status: 'GRACE_PERIOD',
        paymentMethod: 'MANUAL',
        withLink: false
    });
    const id = await insertAwaiting(seeded.subscriptionId);
    await cancelDirectSubscription(
        {
            actor: { id: seeded.userId, roles: [], permissions: [] },
            subscriptionId: seeded.subscriptionId
        },
        {
            provider: fake,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            coverageNotices: { emitCoverageChanged: async () => {} },
            orphanhood: {
                addonPolicy: async () => {
                    throw new Error('Unexpected addon policy');
                },
                listing: async () => {
                    throw new Error('Unexpected listing');
                }
            }
        }
    );
    await assertClosed(seeded.subscriptionId, id);
}

async function runS36() {
    const f = await revocationFixture({ origin: 'GRACE_PERIOD', withPayment: false });
    const db = getServiceTestDb();
    await db
        .update(subscriptions)
        .set({ paymentMethod: 'MANUAL' })
        .where(eq(subscriptions.id, f.subscriptionId));
    await db.insert(manualPayments).values({
        subscriptionId: f.subscriptionId,
        periodStart: new Date('2026-10-01T03:00:00.000Z'),
        status: 'REGISTERED',
        registeredBy: f.userId,
        registeredAt: f.day(3)
    });
    const id = await insertAwaiting(f.subscriptionId);
    f.at(f.day(5));
    await revokeSubscription(
        { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
        f.ports
    );
    await assertClosed(f.subscriptionId, id);
}

const cases = [
    { transition: 'S13', origin: 'GRACE_PERIOD', run: () => runS13('GRACE_PERIOD') },
    { transition: 'S17', origin: 'GRACE_PERIOD', run: runS17 },
    { transition: 'S20', origin: 'GRACE_PERIOD', run: () => runS20('GRACE_PERIOD') },
    { transition: 'S21', origin: 'GRACE_PERIOD', run: () => runS21('GRACE_PERIOD') },
    { transition: 'S24', origin: 'GRACE_PERIOD', run: runS24 },
    {
        transition: 'S13',
        origin: 'PENDING_AUTHORIZATION',
        run: () => runS13('PENDING_AUTHORIZATION')
    },
    {
        transition: 'S20',
        origin: 'PENDING_AUTHORIZATION',
        run: () => runS20('PENDING_AUTHORIZATION')
    },
    {
        transition: 'S21',
        origin: 'PENDING_AUTHORIZATION',
        run: () => runS21('PENDING_AUTHORIZATION')
    },
    { transition: 'S36', origin: 'GRACE_PERIOD', run: runS36 }
] as const;

describe.skipIf(!isServiceTestDbAvailable())('TEST:B5:8 MP3 terminal exits', () => {
    it.each(
        cases
    )('$transition from $origin closes the manual installment with the terminal state', async ({
        run
    }) => {
        await run();
    });
});
