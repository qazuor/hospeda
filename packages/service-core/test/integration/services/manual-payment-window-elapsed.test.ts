import {
    billingOptions,
    coverageLosses,
    coveredPeriods,
    eq,
    getDb,
    manualPaymentModel,
    manualPayments,
    plans,
    planVersions,
    sql,
    subscriptionModel,
    subscriptions,
    successionRetainedPayments,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { cancelDirectSubscription } from '../../../src/services/billing/subscription/cancel-direct-subscription.service';
import { expireManualGraces } from '../../../src/services/billing/subscription/expire-manual-grace.service';
import { registerManualPayment } from '../../../src/services/billing/subscription/register-manual-payment.service';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers';

const now = new Date('2026-10-20T12:00:00.000Z');
const graceStartedAt = new Date('2026-10-18T12:00:00.000Z');
const clock = { now: () => now };
afterAll(closeServiceTestPool);

async function seed(
    input: {
        readonly status?: 'GRACE_PERIOD' | 'PENDING_AUTHORIZATION';
        readonly graceEndsAt?: Date;
    } = {}
) {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `mp3-${crypto.randomUUID()}@example.test`,
            displayName: 'MP3 Payer',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('User fixture failed');
    const [admin] = await db
        .insert(users)
        .values({
            email: `mp3-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'MP3 Admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!admin) throw new Error('Admin fixture failed');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'partner',
            slug: `mp3-${crypto.randomUUID()}`,
            name: 'MP3 plan'
        })
        .returning();
    if (!plan) throw new Error('Plan fixture failed');
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
    if (!version) throw new Error('Version fixture failed');
    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 3000000,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('Option fixture failed');
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: user.id,
            vertical: 'partner',
            class: 'PRINCIPAL',
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'MANUAL',
            status: input.status ?? 'GRACE_PERIOD',
            graceStartedAt,
            graceEndsAt: input.graceEndsAt ?? new Date(now.getTime() - 1000),
            nextChargeAt: new Date('2026-11-18T12:00:00.000Z')
        })
        .returning();
    if (!subscription) throw new Error('Subscription fixture failed');
    const [installment] = await db
        .insert(manualPayments)
        .values({
            subscriptionId: subscription.id,
            periodStart: graceStartedAt,
            status: 'AWAITING'
        })
        .returning();
    if (!installment) throw new Error('Installment fixture failed');
    return { user, admin, plan, version, subscription, installment };
}

async function read(fixture: Awaited<ReturnType<typeof seed>>) {
    const db = getServiceTestDb();
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, fixture.subscription.id));
    const [installment] = await db
        .select()
        .from(manualPayments)
        .where(eq(manualPayments.id, fixture.installment.id));
    const losses = await db
        .select()
        .from(coverageLosses)
        .where(eq(coverageLosses.userId, fixture.user.id));
    return { subscription, installment, losses };
}

function ports() {
    const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>(async () => 'SENT');
    const emitCoverageChanged = vi.fn(async () => {});
    return {
        clock,
        beforeCancelNotice: { beforeCancel },
        coverageNotices: { emitCoverageChanged },
        beforeCancel,
        emitCoverageChanged
    };
}

async function cancelS24(fixture: Awaited<ReturnType<typeof seed>>) {
    const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    await cancelDirectSubscription(
        {
            actor: { id: fixture.user.id, roles: [], permissions: [] },
            subscriptionId: fixture.subscription.id
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
}

describe.skipIf(!isServiceTestDbAvailable())('TEST:B5:8 MP3', () => {
    it('expires due grace, preserves its anchor, and sends one arrears notice', async () => {
        const fixture = await seed();
        const p = ports();
        await expireManualGraces({ pageSize: 100 }, p);
        const written = await read(fixture);
        expect(written.installment?.status).toBe('DECLARED_UNPAID');
        expect(written.subscription?.status).toBe('SUSPENDED');
        expect(written.subscription?.graceStartedAt).toEqual(graceStartedAt);
        expect(written.losses).toHaveLength(1);
        expect(
            p.beforeCancel.mock.calls.filter(
                ([notice]) => notice.subscriptionId === fixture.subscription.id
            )
        ).toHaveLength(1);
        expect(p.beforeCancel).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: fixture.subscription.id,
                kind: 'ARREARS_SUSPENSION'
            })
        );
        expect(p.emitCoverageChanged).toHaveBeenCalledWith({
            userId: fixture.user.id,
            vertical: 'partner',
            sourceType: 'SUBSCRIPTION',
            change: 'REMOVED'
        });
    });

    it('keeps a future grace and installment open', async () => {
        const future = new Date(now.getTime() + 86_400_000);
        const fixture = await seed({ graceEndsAt: future });
        const finder = vi
            .spyOn(manualPaymentModel, 'findManualGracesDue')
            .mockResolvedValueOnce([fixture.subscription]);
        try {
            await expireManualGraces({ pageSize: 100 }, ports());
        } finally {
            finder.mockRestore();
        }
        const written = await read(fixture);
        expect(written.subscription?.status).toBe('GRACE_PERIOD');
        expect(written.subscription?.graceEndsAt).toEqual(future);
        expect(written.installment?.status).toBe('AWAITING');
    });

    it('processes a due grace beyond more than one cron page of open S19 retentions', async () => {
        const pageSize = 3;
        const held = await Promise.all(
            Array.from({ length: pageSize + 1 }, (_, index) =>
                seed({ graceEndsAt: new Date(now.getTime() - (index + 2) * 60_000) })
            )
        );
        for (const fixture of held) {
            await getDb().insert(successionRetainedPayments).values({
                subscriptionId: fixture.subscription.id,
                manualPaymentId: fixture.installment.id,
                unpaidSince: graceStartedAt
            });
        }
        const due = await seed({ graceEndsAt: new Date(now.getTime() - 30_000) });

        const result = await expireManualGraces({ pageSize }, ports());

        expect(result.suspended).toBe(1);
        expect(result.scanned).toBe(1);
        expect((await read(due)).installment?.status).toBe('DECLARED_UNPAID');
        for (const fixture of held) {
            expect((await read(fixture)).installment?.status).toBe('AWAITING');
        }
    });

    it('waits for a concurrent manual registration before expiring its grace', {
        timeout: 30_000
    }, async () => {
        const fixture = await seed();
        const originalLock = manualPaymentModel.lockInstallment;
        let releaseMp1!: () => void;
        let reachedLock!: () => void;
        const heldAtLock = new Promise<void>((resolve) => {
            reachedLock = resolve;
        });
        const continueMp1 = new Promise<void>((resolve) => {
            releaseMp1 = resolve;
        });
        let pid: number | undefined;
        const registrationLock = vi
            .spyOn(manualPaymentModel, 'lockInstallment')
            .mockImplementation(async (input) => {
                if (pid !== undefined) return originalLock.call(manualPaymentModel, input);
                const result = await input.tx.execute(sql`SELECT pg_backend_pid() AS pid`);
                pid = Number(result.rows[0]?.pid);
                reachedLock();
                await continueMp1;
                return originalLock.call(manualPaymentModel, input);
            });
        const originalMark = manualPaymentModel.markDeclaredUnpaid;
        let declared = false;
        const mark = vi
            .spyOn(manualPaymentModel, 'markDeclaredUnpaid')
            .mockImplementation(async (input) => {
                const result = await originalMark.call(manualPaymentModel, input);
                declared = result;
                return result;
            });
        const finder = vi
            .spyOn(manualPaymentModel, 'findManualGracesDue')
            .mockResolvedValueOnce([fixture.subscription]);
        let expiry: Promise<Awaited<ReturnType<typeof expireManualGraces>>> | undefined;
        let registration: ReturnType<typeof registerManualPayment> | undefined;
        try {
            // MP1 has locked the subscription and pauses before locking its installment.
            registration = registerManualPayment(
                {
                    actor: {
                        id: fixture.admin.id,
                        roles: [RoleEnum.ADMIN],
                        permissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT]
                    },
                    subscriptionId: fixture.subscription.id,
                    manualPaymentId: fixture.installment.id
                },
                { clock }
            );
            await heldAtLock;
            expiry = expireManualGraces({ pageSize: 1 }, ports());

            // A lock waiter proves B reached the row; a completed unpaid write proves
            // the missing-lock mutation overtook A. Neither branch relies on elapsed time.
            let parked = false;
            for (let poll = 0; poll < 500 && !parked && !declared; poll++) {
                const result = await getServiceTestPool().query<{ parked: number }>(
                    'SELECT count(*)::int AS parked FROM pg_stat_activity WHERE $1 = ANY (pg_blocking_pids(pid))',
                    [pid]
                );
                parked = (result.rows[0]?.parked ?? 0) > 0;
                if (!parked && !declared)
                    await new Promise<void>((resolve) => setTimeout(resolve, 10));
            }
            expect(parked || declared).toBe(true);

            releaseMp1();
            const registered = await registration;
            expect(registered.effect).toBe('S5');
            expect(registered.receiptId).toBeTruthy();

            expect(await expiry).toEqual({ scanned: 1, suspended: 0, skipped: 1, errors: 0 });
            const written = await read(fixture);
            expect(written.subscription?.status).toBe('ACTIVE');
            expect(written.installment?.status).toBe('REGISTERED');
            expect(written.subscription?.nextChargeAt).toEqual(registered.nextChargeAt);
            expect(written.losses).toHaveLength(0);
            const coverage = await getDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.manualPaymentId, fixture.installment.id));
            expect(coverage).toHaveLength(1);
        } finally {
            releaseMp1();
            await Promise.allSettled(
                [registration, expiry].filter((promise) => promise !== undefined)
            );
            registrationLock.mockRestore();
            finder.mockRestore();
            mark.mockRestore();
        }
    });

    it('rolls back the installment for an open S19 retention', async () => {
        const fixture = await seed();
        await getDb().insert(successionRetainedPayments).values({
            subscriptionId: fixture.subscription.id,
            manualPaymentId: fixture.installment.id,
            unpaidSince: graceStartedAt
        });
        await expireManualGraces({ pageSize: 100 }, ports());
        const written = await read(fixture);
        expect(written.subscription?.status).toBe('GRACE_PERIOD');
        expect(written.installment?.status).toBe('AWAITING');
        expect(written.losses).toHaveLength(0);
    });

    it('keeps the suspension when the notice throws', async () => {
        const fixture = await seed();
        const p = ports();
        p.beforeCancel.mockRejectedValueOnce(new Error('notice failed'));
        await expireManualGraces({ pageSize: 100 }, p);
        const written = await read(fixture);
        expect(written.subscription?.status).toBe('SUSPENDED');
        expect(written.installment?.status).toBe('DECLARED_UNPAID');
    });

    it('closes the first installment when S3 abandons pending authorization', async () => {
        const fixture = await seed({ status: 'PENDING_AUTHORIZATION' });
        await subscriptionModel.abandonPendingAuthorization({
            subscriptionId: fixture.subscription.id,
            now
        });
        const written = await read(fixture);
        expect(written.subscription?.status).toBe('ABANDONED');
        expect(written.installment?.status).toBe('DECLARED_UNPAID');
    });

    it('closes awaiting and preserves registered installments on S24', async () => {
        const fixture = await seed();
        const [registered] = await getDb()
            .insert(manualPayments)
            .values({
                subscriptionId: fixture.subscription.id,
                periodStart: new Date('2026-09-18T12:00:00.000Z'),
                status: 'REGISTERED',
                registeredBy: fixture.user.id,
                registeredAt: graceStartedAt
            })
            .returning();
        if (!registered) throw new Error('Registered fixture failed');
        await cancelS24(fixture);
        const written = await read(fixture);
        const [old] = await getDb()
            .select()
            .from(manualPayments)
            .where(eq(manualPayments.id, registered.id));
        expect(written.subscription?.status).toBe('CANCELLED');
        expect(written.installment?.status).toBe('DECLARED_UNPAID');
        expect(old?.status).toBe('REGISTERED');
    });

    it('rejects MP1 after S24 without advancing next charge date', async () => {
        const fixture = await seed();
        await cancelS24(fixture);
        await expect(
            registerManualPayment(
                {
                    actor: {
                        id: fixture.admin.id,
                        roles: [RoleEnum.ADMIN],
                        permissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT]
                    },
                    subscriptionId: fixture.subscription.id,
                    manualPaymentId: fixture.installment.id
                },
                { clock }
            )
        ).rejects.toMatchObject({ reason: 'MANUAL_PAYMENT_NOT_AWAITING' });
        const afterRegistration = await read(fixture);
        expect(afterRegistration.subscription?.status).toBe('CANCELLED');
        expect(afterRegistration.installment?.status).toBe('DECLARED_UNPAID');
        expect(afterRegistration.subscription?.nextChargeAt).toEqual(
            fixture.subscription.nextChargeAt
        );
    });
});
