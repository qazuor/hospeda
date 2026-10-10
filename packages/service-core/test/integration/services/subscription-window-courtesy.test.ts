// TEST:B3:12 (service: S3 closure and signup-incomplete outbox)
import {
    billingDeadlineVersions,
    courtesyGrants,
    emailOutbox,
    eq,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expireAuthorizationWindows } from '../../../src/services/billing/subscription/expire-authorization-windows.service.ts';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';

const values = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} satisfies BillingDeadlineValues;
beforeAll(async () => {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values })
        .onConflictDoNothing();
});
afterAll(closeServiceTestPool);
const openedAt = new Date('2026-05-01T00:00:00.000Z');
let current = openedAt;
const clock = { now: () => current };
beforeEach(() => {
    current = openedAt;
});
function advance(hours: number) {
    current = new Date(openedAt.getTime() + hours * 60 * 60 * 1000);
}
function setup() {
    const provider = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M1', why: 'healthy signup fixture' }]
    });
    return { provider, clock, beforeCancelNotice: { beforeCancel: async () => 'SENT' as const } };
}

async function seedChoice() {
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `b3-courtesy-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 courtesy user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `b3-courtesy-${crypto.randomUUID()}`, 'Básico']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('No plan');
    const planVersionId = (
        await getServiceTestPool().query<{ id: string }>(
            `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
           VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id`,
            [planId, Math.floor(Math.random() * 100000000) + 1000]
        )
    ).rows[0]?.id;
    if (!planVersionId) throw new Error('No version');
    const billingOptionId = (
        await getServiceTestPool().query<{ id: string }>(
            `INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
           VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id`,
            [planVersionId]
        )
    ).rows[0]?.id;
    if (!billingOptionId) throw new Error('No option');
    return { userId: user.id, planVersionId, billingOptionId };
}

async function seedPending(withCourtesy: boolean) {
    const choice = await seedChoice();
    const [predecessor] = await getServiceTestDb()
        .insert(subscriptions)
        .values({
            ...choice,
            vertical: 'accommodation',
            class: 'PRINCIPAL',
            status: 'CANCELLED',
            paymentMethod: 'CARD'
        })
        .returning();
    if (!predecessor) throw new Error('No predecessor');
    const pending = await subscriptionModel.createPendingAuthorization({
        ...choice,
        vertical: 'accommodation',
        authorizationWindowDeadlineVersion: 1,
        authorizationWindowEndsAt: new Date(openedAt.getTime() + 72 * 60 * 60 * 1000)
    });
    await getServiceTestDb()
        .update(subscriptions)
        .set({ succeededById: pending.subscription.id })
        .where(eq(subscriptions.id, predecessor.id));
    let grantId: string | null = null;
    if (withCourtesy) {
        const [grant] = await getServiceTestDb()
            .insert(courtesyGrants)
            .values({
                beneficiaryUserId: choice.userId,
                grantedBy: choice.userId,
                subscriptionId: predecessor.id,
                months: 6,
                balanceMonths: 3,
                startsAt: openedAt,
                endsAt: new Date('2027-05-01T00:00:00.000Z'),
                reason: 'TEST:B3:12'
            })
            .returning();
        grantId = grant?.id ?? null;
    }
    return {
        subscriptionId: pending.subscription.id,
        predecessorId: predecessor.id,
        userId: choice.userId,
        grantId
    };
}
async function ownStatus(id: string) {
    const [row] = await getServiceTestDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    return row?.status;
}
async function ownOutbox(userId: string, subscriptionId: string) {
    const rows = await getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
    return rows.filter(
        (row) => (row.payload as { subscriptionId?: string }).subscriptionId === subscriptionId
    );
}

describe('TEST:B3:12 S3 courtesy closure and notice', () => {
    it('abandons the successor, closes the predecessor’s balance, and queues one email', async () => {
        const own = await seedPending(true);
        advance(73);
        await expireAuthorizationWindows(100, setup());
        expect(await ownStatus(own.subscriptionId)).toBe('ABANDONED');
        const [grant] = await getServiceTestDb()
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.id, own.grantId!));
        expect(grant?.balanceClosedAt).toEqual(current);
        expect(grant?.closeReason).toBe('VENTANA_DE_AUTORIZACION_VENCIDA');
        const mails = await ownOutbox(own.userId, own.subscriptionId);
        expect(mails).toHaveLength(1);
        expect(mails[0]).toMatchObject({
            template: 'billing.signup-incomplete',
            recipientUserId: own.userId
        });
        expect(mails[0]?.payload).toMatchObject({ closedCourtesyMonths: 3 });
    });

    it('abandons without courtesy, writes no grants, and queues null balance', async () => {
        const own = await seedPending(false);
        advance(73);
        await expireAuthorizationWindows(100, setup());
        expect(await ownStatus(own.subscriptionId)).toBe('ABANDONED');
        expect(
            await getServiceTestDb()
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.subscriptionId, own.predecessorId))
        ).toHaveLength(0);
        const mails = await ownOutbox(own.userId, own.subscriptionId);
        expect(mails).toHaveLength(1);
        expect(mails[0]?.payload).toMatchObject({ closedCourtesyMonths: null });
    });

    it('keeps exactly one email after two sweeps', async () => {
        const own = await seedPending(false);
        advance(73);
        const ports = setup();
        await expireAuthorizationWindows(100, ports);
        await expireAuthorizationWindows(100, ports);
        expect(await ownStatus(own.subscriptionId)).toBe('ABANDONED');
        expect(await ownOutbox(own.userId, own.subscriptionId)).toHaveLength(1);
    });

    it('does not touch a still-open window, courtesy, or outbox', async () => {
        const own = await seedPending(true);
        advance(30);
        await expireAuthorizationWindows(100, setup());
        expect(await ownStatus(own.subscriptionId)).toBe('PENDING_AUTHORIZATION');
        const [grant] = await getServiceTestDb()
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.id, own.grantId!));
        expect(grant?.balanceClosedAt).toBeNull();
        expect(grant?.closeReason).toBeNull();
        expect(await ownOutbox(own.userId, own.subscriptionId)).toHaveLength(0);
        await subscriptionModel.abandonPendingAuthorization({
            subscriptionId: own.subscriptionId,
            now: current
        });
    });
});
