import {
    and,
    billingOptions,
    emailOutbox,
    eq,
    inArray,
    manualPaymentModel,
    manualPayments,
    planCatalogModel,
    plans,
    planVersions,
    subscriptions,
    userRole,
    users
} from '@repo/db';
import { createPlanCatalogInverse } from '@repo/verticals';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { openDueManualInstallments } from '../../../src/services/billing/subscription/open-manual-installment.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';

const DAY_MS = 86_400_000;
const p0 = new Date('2026-07-03T12:00:00.000Z');
const p1 = new Date('2026-08-03T12:00:00.000Z');
const p2 = new Date('2026-09-03T12:00:00.000Z');
const now = new Date('2026-09-04T12:00:00.000Z');
afterAll(closeServiceTestPool);

async function seed(
    status:
        | 'ACTIVE'
        | 'SUSPENDED'
        | 'GRACE_PERIOD'
        | 'CANCEL_SCHEDULED'
        | 'PAUSED'
        | 'PENDING_AUTHORIZATION' = 'ACTIVE',
    input: {
        nextChargeAt?: Date;
        paymentMethod?: 'MANUAL' | 'CARD';
        priorPeriod?: Date;
    } = {}
) {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `manual-clock-${crypto.randomUUID()}@example.test`,
            displayName: 'Payer',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('User seed failed');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'partner',
            slug: `manual-clock-${crypto.randomUUID()}`,
            name: 'Manual clock plan'
        })
        .returning();
    if (!plan) throw new Error('Plan seed failed');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'partner',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Version seed failed');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 3000000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('Option seed failed');
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: user.id,
            vertical: 'partner',
            class: 'PRINCIPAL',
            status,
            paymentMethod: input.paymentMethod ?? 'MANUAL',
            planVersionId: version.id,
            billingOptionId: option.id,
            nextChargeAt: input.nextChargeAt ?? p1,
            ...(status === 'GRACE_PERIOD' ? { graceStartedAt: p0, graceEndsAt: p1 } : {})
        })
        .returning();
    if (!subscription) throw new Error('Subscription seed failed');
    const [prior] =
        input.paymentMethod === 'CARD'
            ? []
            : await db
                  .insert(manualPayments)
                  .values({
                      subscriptionId: subscription.id,
                      periodStart: input.priorPeriod ?? p0,
                      status: 'REGISTERED',
                      registeredBy: user.id,
                      registeredAt: p0
                  })
                  .returning();
    return { subscription, prior, version };
}

async function admins() {
    const db = getServiceTestDb();
    const rows = await db
        .insert(users)
        .values(
            [1, 2].map(() => ({
                email: `manual-admin-${crypto.randomUUID()}@example.test`,
                displayName: 'Manual admin',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            }))
        )
        .returning();
    await db
        .insert(userRole)
        .values(rows.map((user) => ({ userId: user.id, role: 'SUPER_ADMIN' as const })));
    return {
        ids: rows.map((row) => row.id),
        recipients: { list: async () => rows.map((row) => ({ userId: row.id, email: row.email })) }
    };
}

function ports(recipients: Awaited<ReturnType<typeof admins>>['recipients'], at = now) {
    return {
        clock: { now: () => at },
        planPolicy: async () => ({
            graceDays: 9,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        recipients
    };
}

async function installments(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(manualPayments)
        .where(eq(manualPayments.subscriptionId, subscriptionId));
}

async function notices(manualPaymentId: string, ids: string[]) {
    return getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(
            and(
                inArray(emailOutbox.recipientUserId, ids),
                eq(emailOutbox.template, 'billing.manual-installment-unpaid')
            )
        )
        .then((rows) =>
            rows.filter(
                (row) =>
                    (row.payload as { manualPaymentId?: string }).manualPaymentId ===
                    manualPaymentId
            )
        );
}

describe('TEST:B5:7 MP5 clock', () => {
    it('opens the due installment, enters S4 for plan grace days, and enqueues two admin notices', async () => {
        const { subscription, prior } = await seed();
        const staff = await admins();
        const result = await openDueManualInstallments({ pageSize: 1000 }, ports(staff.recipients));
        const rows = await installments(subscription.id);
        const [current] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, subscription.id));
        const opened = rows.find((row) => row.periodStart.getTime() === p1.getTime());
        if (!opened || !current?.graceStartedAt || !current.graceEndsAt)
            throw new Error('MP5 fixture did not open');
        const mail = await notices(opened.id, staff.ids);
        expect(result.opened).toBeGreaterThanOrEqual(1);
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.id)).toContain(prior?.id);
        expect(opened).toMatchObject({
            status: 'AWAITING',
            periodStart: p1,
            registeredBy: null,
            registeredAt: null,
            proofRef: null
        });
        expect(current.status).toBe('GRACE_PERIOD');
        expect(current.graceStartedAt).toEqual(now);
        expect(current.graceEndsAt).toEqual(new Date(now.getTime() + 9 * DAY_MS));
        expect(current.graceEndsAt.getTime() - current.graceStartedAt.getTime()).toBe(9 * DAY_MS);
        expect(mail).toHaveLength(2);
        expect(mail.map((row) => row.recipientUserId).sort()).toEqual([...staff.ids].sort());
        for (const row of mail)
            expect(row.payload).toMatchObject({
                manualPaymentId: opened.id,
                subscriptionId: subscription.id,
                vertical: 'partner',
                periodStart: p1.toISOString(),
                openedAt: now.toISOString(),
                firstInstallment: false
            });
    });

    it('serializes two first openings, then remains idempotent on retry', async () => {
        const { subscription, version } = await seed();
        const staff = await admins();
        let arrivals = 0;
        let release!: () => void;
        const bothReady = new Promise<void>((resolve) => {
            release = resolve;
        });
        const run = () =>
            openDueManualInstallments(
                { pageSize: 1000 },
                {
                    ...ports(staff.recipients),
                    planPolicy: async ({ planVersionId }) => {
                        if (planVersionId === version.id) {
                            arrivals++;
                            if (arrivals === 2) release();
                            await bothReady;
                        }
                        return { graceDays: 9, allowsPause: false, current: true, sellable: true };
                    }
                }
            );
        await Promise.all([run(), run()]);
        await run();
        const rows = await installments(subscription.id);
        const opened = rows.find((row) => row.periodStart.getTime() === p1.getTime());
        if (!opened) throw new Error('MP5 fixture did not open');
        expect(rows).toHaveLength(2);
        expect(await notices(opened.id, staff.ids)).toHaveLength(2);
    });

    it('emits one GRACE_STARTED only after the committed row is visible', async () => {
        const { subscription } = await seed();
        const staff = await admins();
        const visible: Promise<unknown>[] = [];
        const facts: unknown[] = [];
        const run = () =>
            openDueManualInstallments(
                { pageSize: 1000 },
                {
                    ...ports(staff.recipients),
                    billingFacts: {
                        emit(fact) {
                            if (fact.subscriptionId !== subscription.id) return;
                            facts.push(fact);
                            visible.push(
                                getServiceTestDb()
                                    .select({ status: subscriptions.status })
                                    .from(subscriptions)
                                    .where(eq(subscriptions.id, fact.subscriptionId))
                                    .then(([row]) => row?.status)
                            );
                        }
                    }
                }
            );
        await run();
        await run();
        expect(facts).toHaveLength(1);
        expect(facts[0]).toMatchObject({
            kind: 'GRACE_STARTED',
            subscriptionId: subscription.id,
            actorKind: 'SYSTEM',
            graceStartedAt: now,
            graceEndsAt: new Date(now.getTime() + 9 * DAY_MS),
            daysOfGrace: 9
        });
        expect(await Promise.all(visible)).toEqual(['GRACE_PERIOD']);
    });

    it('uses the published catalog version grace days through production planPolicy', async () => {
        const { subscription, version } = await seed();
        const staff = await admins();
        const realPolicy = createPlanCatalogInverse({ reader: planCatalogModel }).planPolicy;
        const policy = await realPolicy({ planVersionId: version.id });
        const result = await openDueManualInstallments(
            { pageSize: 1000 },
            {
                ...ports(staff.recipients),
                planPolicy: realPolicy
            }
        );
        const [current] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, subscription.id));
        expect(result.opened).toBeGreaterThanOrEqual(1);
        expect(current?.graceStartedAt).toEqual(now);
        expect(current?.graceEndsAt).toEqual(new Date(now.getTime() + policy.graceDays * DAY_MS));
        expect(policy.graceDays).toBe(version.graceDays);
    });

    it.each([
        'SUSPENDED',
        'GRACE_PERIOD',
        'CANCEL_SCHEDULED',
        'PAUSED',
        'PENDING_AUTHORIZATION'
    ] as const)('does not open in %s', async (status) => {
        const { subscription } = await seed(status);
        const staff = await admins();
        const result = await openDueManualInstallments({ pageSize: 1000 }, ports(staff.recipients));
        const [current] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, subscription.id));
        expect(result.skipped).toBe(0);
        expect(current?.status).toBe(status);
        expect(await installments(subscription.id)).toHaveLength(1);
    });

    it('does not open a second installment when this period is declared unpaid', async () => {
        const { subscription } = await seed();
        const staff = await admins();
        await getServiceTestDb().insert(manualPayments).values({
            subscriptionId: subscription.id,
            periodStart: p1,
            status: 'DECLARED_UNPAID'
        });
        await openDueManualInstallments({ pageSize: 1000 }, ports(staff.recipients));
        const staleCandidate = vi
            .spyOn(manualPaymentModel, 'findDueManualSubscriptions')
            .mockResolvedValueOnce([subscription]);
        try {
            await openDueManualInstallments({ pageSize: 1000 }, ports(staff.recipients));
        } finally {
            staleCandidate.mockRestore();
        }
        expect(
            (await installments(subscription.id)).filter(
                (row) => row.periodStart.getTime() === p1.getTime()
            )
        ).toHaveLength(1);
    });

    it('does not open a future installment', async () => {
        const { subscription } = await seed('ACTIVE', {
            nextChargeAt: new Date('2027-01-01T00:00:00.000Z')
        });
        const staff = await admins();
        await openDueManualInstallments({ pageSize: 1000 }, ports(staff.recipients));
        expect(await installments(subscription.id)).toHaveLength(1);
    });

    it('does not open a CARD installment', async () => {
        const { subscription } = await seed('ACTIVE', { paymentMethod: 'CARD' });
        const staff = await admins();
        await openDueManualInstallments({ pageSize: 1000 }, ports(staff.recipients));
        expect(await installments(subscription.id)).toHaveLength(0);
    });

    it('uses next_charge_at after a skipped cycle, never the prior installment plus a cycle', async () => {
        const { subscription } = await seed('ACTIVE', { nextChargeAt: p2 });
        const staff = await admins();
        await openDueManualInstallments(
            { pageSize: 1000 },
            ports(staff.recipients, new Date('2026-08-15T00:00:00.000Z'))
        );
        expect(await installments(subscription.id)).toHaveLength(1);
        await openDueManualInstallments({ pageSize: 1000 }, ports(staff.recipients));
        const rows = await installments(subscription.id);
        expect(rows.map((row) => row.periodStart.getTime()).sort()).toEqual(
            [p0.getTime(), p2.getTime()].sort()
        );
    });

    it('enqueues a distinct notice for each of two periods', async () => {
        const { subscription } = await seed();
        const staff = await admins();
        await openDueManualInstallments({ pageSize: 1000 }, ports(staff.recipients));
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'ACTIVE', graceStartedAt: null, graceEndsAt: null, nextChargeAt: p2 })
            .where(eq(subscriptions.id, subscription.id));
        await openDueManualInstallments({ pageSize: 1000 }, ports(staff.recipients));
        const opened = (await installments(subscription.id)).filter(
            (row) => row.status === 'AWAITING'
        );
        expect(opened).toHaveLength(2);
        for (const row of opened) expect(await notices(row.id, staff.ids)).toHaveLength(2);
    });
});
