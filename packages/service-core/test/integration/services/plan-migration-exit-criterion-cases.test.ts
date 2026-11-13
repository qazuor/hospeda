import {
    and,
    billingOptions,
    emailOutbox,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    providerLinks,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cancelPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-cancel.service.js';
import { launchPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import {
    PLAN_MIGRATION_CANCELLED_TEMPLATE,
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { getPlanMigrationDetail } from '../../../src/services/billing/plan-migration/plan-migration-read.service.js';
import { runPlanMigrationS37ForRow } from '../../../src/services/billing/plan-migration/plan-migration-s37.service.js';
import { applyPlanMigrationUpcomingNotice } from '../../../src/services/billing/plan-migration/plan-migration-upcoming-notice.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { requestPlanChange } from '../../../src/services/billing/subscription/request-plan-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cleanupAnnouncedExitCases,
    createAnnouncedExitCase
} from './support/plan-migration-exit-fixtures.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    migrationClock,
    setMigrationTargetCycle
} from './support/plan-migration-fixtures.js';
import { localDayInstant, shiftLocalDay } from './support/plan-migration-increase-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';
import { S37_NEXT_CHARGE_AT } from './support/plan-migration-s37-fixtures.js';

registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();
const migrationIds: string[] = [];
const recipients: string[] = [];
const subscriptionsToClean: string[] = [];
const complements = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};
const coverageNotices = { emitCoverageChanged: async () => undefined };

afterEach(async () => {
    vi.restoreAllMocks();
    if (recipients.length)
        await db
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, recipients.splice(0)));
    if (subscriptionsToClean.length)
        await db
            .delete(subscriptionScheduledChanges)
            .where(
                inArray(subscriptionScheduledChanges.subscriptionId, subscriptionsToClean.splice(0))
            );
    for (const id of migrationIds.splice(0)) {
        await db
            .delete(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, id));
        await db.delete(planMigrations).where(eq(planMigrations.id, id));
    }
    await cleanupAnnouncedExitCases();
    await cleanupPlanMigrationCases();
});
afterAll(closeServiceTestPool);

type Case = Awaited<ReturnType<typeof createPlanMigrationCase>>;

async function launch(seeded: Case) {
    const input = {
        sourcePlanVersionId: seeded.planVersionId,
        targetPlanVersionId: seeded.targetPlanVersionId
    };
    const preview = await previewPlanMigration({
        actor: seeded.actor,
        input,
        verticals: seeded.verticals,
        clock: migrationClock
    });
    const launched = await launchPlanMigration({
        actor: seeded.actor,
        input: { ...input, cohortFingerprint: preview.cohortFingerprint },
        verticals: seeded.verticals,
        clock: migrationClock
    });
    migrationIds.push(launched.planMigrationId);
    recipients.push(seeded.user.id);
    subscriptionsToClean.push(seeded.predecessor.id);
    const [scope] = await db
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.planMigrationId, launched.planMigrationId));
    if (!scope) throw new Error('Migration scope missing');
    return { planMigrationId: launched.planMigrationId, scope };
}

function runS37(scopeId: string, provider: Case['provider']) {
    return runPlanMigrationS37ForRow(
        { planMigrationSubscriptionId: scopeId, correlationId: crypto.randomUUID() },
        { provider, clock: migrationClock }
    );
}

async function scopeRow(scopeId: string) {
    const [row] = await db
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.id, scopeId));
    if (!row) throw new Error('Migration scope row missing');
    return row;
}

async function scopeBySubscription(subscriptionId: string) {
    const [row] = await db
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.subscriptionId, subscriptionId));
    if (!row) throw new Error('Migration scope row missing');
    return row;
}

async function subscriptionSnapshot(subscriptionId: string) {
    const [row] = await db
        .select({
            planVersionId: subscriptions.planVersionId,
            billingOptionId: subscriptions.billingOptionId,
            nextChargeAt: subscriptions.nextChargeAt
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    return row;
}

async function queueRows(subscriptionId: string) {
    return db
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, subscriptionId));
}

async function cancellationMails(userId: string) {
    return db
        .select({ template: emailOutbox.template, payload: emailOutbox.payload })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId))
        .then((rows) => rows.filter((row) => row.template === PLAN_MIGRATION_CANCELLED_TEMPLATE));
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:8 AC:B12:8 el criterio de salida de B12 — los que no se tocan, esperan, salen o se cancelan',
    () => {
        it('al que no tiene su ciclo en el destino lo deja en el listado sin tocarlo', async () => {
            const seeded = await createPlanMigrationCase({ sourceCycle: 'annual' });
            const { planMigrationId, scope } = await launch(seeded);
            const before = await subscriptionSnapshot(seeded.predecessor.id);

            const detail = await getPlanMigrationDetail(
                { actor: seeded.actor, planMigrationId, db },
                { clock: migrationClock }
            );
            expect(
                detail.rows.filter((row) => row.subscriptionId === seeded.predecessor.id)
            ).toEqual([
                {
                    id: scope.id,
                    subscriptionId: seeded.predecessor.id,
                    ownerUserId: seeded.user.id,
                    status: 'PARA_RESOLVER',
                    outReason: null,
                    applicationDate: null,
                    appliedAt: null,
                    ageDays: 0
                }
            ]);

            expect(await runS37(scope.id, seeded.provider)).toEqual({
                outcome: 'SKIPPED',
                reason: 'SCOPE_NOT_PENDING'
            });
            expect(await subscriptionSnapshot(seeded.predecessor.id)).toEqual(before);
            expect(await queueRows(seeded.predecessor.id)).toEqual([]);
        });

        it('al pausado lo espera', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const { scope } = await launch(seeded);
            const changeAmount = vi.spyOn(seeded.fake, 'changeAmount');

            const paused = await pauseSubscription(
                { subscriptionId: seeded.predecessor.id, requestedMonths: 2 },
                {
                    provider: seeded.provider,
                    clock: migrationClock,
                    planPolicy: async () => ({
                        graceDays: 10,
                        allowsPause: true,
                        current: true,
                        sellable: true
                    }),
                    complements,
                    coverageNotices
                }
            );
            expect(paused.outcome).toBe('PAUSED');

            expect(
                await db.transaction((tx) =>
                    applyPlanMigrationUpcomingNotice({
                        tx,
                        planMigrationSubscriptionId: scope.id,
                        now: migrationClock.now()
                    })
                )
            ).toEqual({ outcome: 'WAITING', milestone: null, recalculated: false });
            expect(await runS37(scope.id, seeded.provider)).toEqual({
                outcome: 'WAITING',
                reason: 'SUBSCRIPTION_NOT_ACTIVE'
            });
            expect(changeAmount).toHaveBeenCalledTimes(0);
            expect((await scopeRow(scope.id)).status).toBe('PENDIENTE');
        });

        it('al que cambió de plan en el medio lo saca', async () => {
            const { seeded } = await createAnnouncedExitCase();
            recipients.push(seeded.user.id);
            subscriptionsToClean.push(seeded.predecessor.id);
            seeded.verticals.setChangeDirection({
                fromPlanVersionId: seeded.planVersionId,
                toPlanVersionId: seeded.targetPlanVersionId,
                direction: 'DOWN'
            });
            const [monthly] = await db
                .select({ id: billingOptions.id })
                .from(billingOptions)
                .where(
                    and(
                        eq(billingOptions.planVersionId, seeded.targetPlanVersionId),
                        eq(billingOptions.cycle, 'monthly')
                    )
                )
                .limit(1);
            if (!monthly) throw new Error('Migration monthly option missing');

            const accepted = await requestPlanChange(
                { ...seeded.input, billingOptionId: monthly.id },
                {
                    ...seeded.ports,
                    changeDirection: seeded.verticals.changeDirection.bind(seeded.verticals)
                }
            );
            expect(accepted.path).toBe('DOWNGRADE');

            const row = await scopeBySubscription(seeded.predecessor.id);
            expect({
                status: row.status,
                outReason: row.outReason,
                appliedAt: row.appliedAt
            }).toEqual({ status: 'FUERA', outReason: 'CAMBIO_DE_PLAN', appliedAt: null });
        });

        it('cancelar la migración no toca a los ya aplicados y le manda a cada pendiente el correo «ya no cambia nada»', async () => {
            const { seeded, pendingCustomer, additionalCustomers, migrationId } =
                await createAnnouncedExitCase({
                    addPendingCustomer: true,
                    additionalPendingCustomers: 1
                });
            if (!pendingCustomer || additionalCustomers.length !== 1)
                throw new Error('Cancellation cohort fixture missing');
            const pending = [...additionalCustomers, pendingCustomer];
            recipients.push(seeded.user.id, ...pending.map((customer) => customer.userId));
            subscriptionsToClean.push(
                seeded.predecessor.id,
                ...pending.map((customer) => customer.subscriptionId)
            );

            const appliedScope = await scopeBySubscription(seeded.predecessor.id);
            const applicationDay = getLocalDateString({
                instant: appliedScope.applicationDate
            });
            expect(applicationDay).toBe('2026-12-11');
            // SEEDED: the application day the launch stored is 2026-12-11; a real renewal would have
            // advanced next_charge_at to it, and no service runs that renewal here.
            await db
                .update(subscriptions)
                .set({ nextChargeAt: S37_NEXT_CHARGE_AT })
                .where(eq(subscriptions.id, seeded.predecessor.id));

            const noticeDay = localDayInstant(shiftLocalDay(applicationDay, -7));
            const s37Clock = { now: () => noticeDay };
            // SEEDED: S37 reads the preapproval on its own clock, so this case points the link at a
            // fresh healthy authorization created on that clock (same assembly as createS37MigrationCase).
            const fake = new FakePaymentProvider({
                clock: s37Clock,
                idNamespace: crypto.randomUUID(),
                honestAbout: [
                    { lie: 'M1', why: 'cancellation fixture starts from a healthy authorization' }
                ]
            });
            const authorization = await fake.authorize({
                reference: `cancel-${crypto.randomUUID()}`,
                amount: { amountMinor: 250000, currency: 'ARS' },
                cadence: { everyMonths: 1 },
                reason: 'Cancellation fixture authorization',
                returnUrl: 'https://hospeda.example/account',
                payerEmail: seeded.user.email
            });
            await fake.approve({ authorizationId: authorization.authorizationId });
            await db
                .update(providerLinks)
                .set({ providerId: authorization.authorizationId, provider: 'MERCADO_PAGO' })
                .where(eq(providerLinks.subscriptionId, seeded.predecessor.id));

            expect(
                await db.transaction((tx) =>
                    applyPlanMigrationUpcomingNotice({
                        tx,
                        planMigrationSubscriptionId: appliedScope.id,
                        now: noticeDay
                    })
                )
            ).toEqual({ outcome: 'ENQUEUED', milestone: 'mig:-7d', recalculated: false });
            // SEEDED: the sender stamps the third notice as delivered before S37 retries.
            await db
                .update(emailOutbox)
                .set({ status: 'sent' })
                .where(
                    eq(
                        emailOutbox.dedupKey,
                        planMigrationNoticeDedupKey({
                            recipientUserId: seeded.user.id,
                            template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
                            planMigrationSubscriptionId: appliedScope.id,
                            milestone: 'mig:-7d',
                            targetDate: applicationDay
                        })
                    )
                );
            const applied = await runPlanMigrationS37ForRow(
                {
                    planMigrationSubscriptionId: appliedScope.id,
                    correlationId: crypto.randomUUID()
                },
                { provider: fake, clock: s37Clock }
            );
            expect(applied).toEqual({ outcome: 'APPLIED_CARD', escalated: false });
            const before = await scopeRow(appliedScope.id);
            expect(before.status).toBe('APLICADA');
            const queueBefore = await queueRows(seeded.predecessor.id);
            expect(queueBefore).toHaveLength(1);

            const result = await cancelPlanMigration(
                { actor: seeded.actor, planMigrationId: migrationId, db },
                { clock: { now: () => migrationClock.now() } }
            );
            expect(result).toEqual({
                planMigrationId: migrationId,
                cancelledAt: migrationClock.now(),
                rows: { cancelled: 2, alreadyStarted: 1, untouched: 0 }
            });

            expect(await scopeRow(appliedScope.id)).toEqual({
                ...before,
                updatedAt: expect.any(Date)
            });
            for (const customer of pending) {
                expect((await scopeBySubscription(customer.subscriptionId)).status).toBe(
                    'CANCELADA'
                );
                const mails = await cancellationMails(customer.userId);
                expect(mails).toHaveLength(1);
                expect(mails[0]).toMatchObject({
                    template: PLAN_MIGRATION_CANCELLED_TEMPLATE,
                    payload: { variant: 'NOTHING_CHANGES', applicationDate: null }
                });
            }
            expect(
                (await cancellationMails(seeded.user.id)).map(
                    (mail) => (mail.payload as { variant?: string }).variant
                )
            ).toEqual(['ALREADY_STARTED']);
            expect(await queueRows(seeded.predecessor.id)).toEqual(queueBefore);
        });
    }
);
