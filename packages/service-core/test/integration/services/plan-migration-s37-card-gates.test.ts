import {
    and,
    domainEvent,
    emailOutbox,
    eq,
    planMigrationSubscriptions,
    subscriptionScheduledChanges,
    subscriptions,
    users
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cancelPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-cancel.service.js';
import {
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { runPlanMigrationS37ForRow } from '../../../src/services/billing/plan-migration/plan-migration-s37.service.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { requestPlanChange } from '../../../src/services/billing/subscription/request-plan-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { migrationClock } from './support/plan-migration-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';
import {
    cleanupS37Cases,
    createS37MigrationCase,
    S37_DAY,
    S37_NEXT_CHARGE_AT,
    type S37Case
} from './support/plan-migration-s37-fixtures.js';
import { seedScheduledChange } from './support/scheduled-change-fixtures.js';

registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();
const complements = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};
const coverageNotices = { emitCoverageChanged: async () => undefined };

afterEach(cleanupS37Cases);
afterAll(closeServiceTestPool);

function run(caseRow: S37Case) {
    return runPlanMigrationS37ForRow(
        {
            planMigrationSubscriptionId: caseRow.scope.id,
            correlationId: crypto.randomUUID()
        },
        { provider: caseRow.provider, clock: caseRow.clock }
    );
}

function upcomingKey(caseRow: S37Case) {
    return planMigrationNoticeDedupKey({
        recipientUserId: caseRow.userId,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        planMigrationSubscriptionId: caseRow.scope.id,
        milestone: 'mig:-7d',
        targetDate: '2026-12-11'
    });
}

async function setNoticeStatus(caseRow: S37Case, status: 'pending' | 'retry' | 'failed' | 'sent') {
    await db
        .update(emailOutbox)
        .set({ status })
        .where(eq(emailOutbox.dedupKey, upcomingKey(caseRow)));
}

async function upcomingRows(caseRow: S37Case) {
    return db
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.recipientUserId, caseRow.userId),
                eq(emailOutbox.template, PLAN_MIGRATION_UPCOMING_TEMPLATE)
            )
        );
}

async function queueRows(subscriptionId: string) {
    return db
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, subscriptionId));
}

async function scopeRow(scopeId: string) {
    const [row] = await db
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.id, scopeId));
    return row;
}

async function setNextChargeAt(subscriptionId: string, at: Date) {
    await db
        .update(subscriptions)
        .set({ nextChargeAt: at })
        .where(eq(subscriptions.id, subscriptionId));
}

async function anchor(subscriptionId: string) {
    const [row] = await db
        .select({
            planVersionId: subscriptions.planVersionId,
            billingOptionId: subscriptions.billingOptionId
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    return row;
}

async function decisionEvents(subscriptionId: string) {
    return db
        .select({ id: domainEvent.id })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, subscriptionId),
                eq(domainEvent.eventType, 'subscription.amount_mutation_decided')
            )
        );
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:4 AC:B12:4 S37 sobre un pagador con tarjeta: sale el tercer correo antes de mutar',
    () => {
        it('con falla transitoria, la mutación espera esa fila sin encolar otro correo', async () => {
            const caseRow = await createS37MigrationCase();
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');

            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            const first = await upcomingRows(caseRow);
            expect(first).toHaveLength(1);
            expect(first[0]).toMatchObject({
                dedupKey: upcomingKey(caseRow),
                status: 'pending'
            });

            // Declared seed: the sender moves the row to `retry` after a transient failure.
            await setNoticeStatus(caseRow, 'retry');
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            expect(await upcomingRows(caseRow)).toHaveLength(1);
            expect(changeAmount).toHaveBeenCalledTimes(0);
        });

        it('con no-entregable o failed definitivo, la mutación sale igual y el caso se registra y escala', async () => {
            const caseRow = await createS37MigrationCase();
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');
            await run(caseRow);

            // Declared seed: the sender exhausts the retries and marks the row `failed`.
            await setNoticeStatus(caseRow, 'failed');
            expect(await run(caseRow)).toEqual({
                outcome: 'APPLIED_CARD',
                escalated: true
            });
            expect(await scopeRow(caseRow.scope.id)).toMatchObject({ status: 'APLICADA' });
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(1);
            expect(changeAmount).toHaveBeenCalledTimes(1);
        });

        it('con el preapproval no authorized, S37 no corre', async () => {
            for (const status of ['paused', 'cancelled'] as const) {
                const caseRow = await createS37MigrationCase();
                await run(caseRow);
                await setNoticeStatus(caseRow, 'sent');
                if (status === 'paused')
                    await caseRow.fake.pause({ authorizationId: caseRow.authorizationId });
                else await caseRow.fake.cancel({ authorizationId: caseRow.authorizationId });

                const result = await run(caseRow);

                expect(result).toMatchObject({ outcome: 'NOT_AUTHORIZED' });
                expect(await scopeRow(caseRow.scope.id)).toMatchObject({
                    status: 'PENDIENTE',
                    appliedAt: null
                });
                expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);
                expect(await decisionEvents(caseRow.subscriptionId)).toHaveLength(0);
            }
        });

        it('las guardas sobre filas reales: pausada espera, migración cancelada y cambio encolado se saltan', async () => {
            const pausedCase = await createS37MigrationCase();
            const paused = await pauseSubscription(
                { subscriptionId: pausedCase.subscriptionId, requestedMonths: 2 },
                {
                    provider: pausedCase.provider,
                    clock: pausedCase.clock,
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
            expect(await run(pausedCase)).toMatchObject({
                outcome: 'WAITING',
                reason: 'SUBSCRIPTION_NOT_ACTIVE'
            });
            expect(await upcomingRows(pausedCase)).toHaveLength(0);

            const cancelledCase = await createS37MigrationCase();
            await cancelPlanMigration(
                { actor: cancelledCase.case.actor, planMigrationId: cancelledCase.migrationId },
                { clock: migrationClock }
            );
            expect(await run(cancelledCase)).toMatchObject({
                outcome: 'SKIPPED',
                reason: 'MIGRATION_CANCELLED'
            });

            const queuedCase = await createS37MigrationCase();
            queuedCase.case.verticals.setChangeDirection({
                fromPlanVersionId: queuedCase.case.planVersionId,
                toPlanVersionId: queuedCase.targetPlanVersionId,
                direction: 'DOWN'
            });
            const requested = await requestPlanChange(
                {
                    actor: { id: queuedCase.userId },
                    subscriptionId: queuedCase.subscriptionId,
                    billingOptionId: queuedCase.targetOptionId,
                    returnUrl: 'https://hospeda.example/account'
                },
                {
                    ...queuedCase.case.ports,
                    provider: queuedCase.provider,
                    clock: queuedCase.clock,
                    changeDirection: queuedCase.case.verticals.changeDirection.bind(
                        queuedCase.case.verticals
                    )
                }
            );
            expect(requested.path).toBe('DOWNGRADE');
            expect(await scopeRow(queuedCase.scope.id)).toMatchObject({ status: 'FUERA' });
            expect(await run(queuedCase)).toMatchObject({
                outcome: 'SKIPPED',
                reason: 'SCOPE_NOT_PENDING'
            });
            expect(await queueRows(queuedCase.subscriptionId)).toHaveLength(1);
        });

        it('INV: la mutación confirmada no escribe plan_version_id ni billing_option_id: eso es S38', async () => {
            const caseRow = await createS37MigrationCase();
            const beforeAnchor = await anchor(caseRow.subscriptionId);
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');

            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await setNoticeStatus(caseRow, 'sent');
            expect(await run(caseRow)).toEqual({
                outcome: 'APPLIED_CARD',
                escalated: false
            });

            expect(await anchor(caseRow.subscriptionId)).toEqual(beforeAnchor);
            expect(changeAmount).toHaveBeenCalledTimes(1);
            expect(S37_DAY).toEqual(caseRow.clock.now());
            vi.restoreAllMocks();
            const afterRead = await caseRow.fake.readAuthorization({
                authorizationId: caseRow.authorizationId
            });
            expect(afterRead.snapshot.amount).toEqual({
                amountMinor: caseRow.targetAmountMinor,
                currency: 'ARS'
            });
        });

        it('APPLICATION_DATE_MISMATCH también corta al pagador con tarjeta sin llamar al proveedor', async () => {
            const caseRow = await createS37MigrationCase();
            // Declared seed: the notice enqueuer recalcula a 2026-12-15 mientras el
            // día local de `next_charge_at` es 2026-11-15. D-4 corre antes de mutar.
            await setNextChargeAt(caseRow.subscriptionId, new Date('2026-11-15T11:00:00.000Z'));
            const readAuthorization = vi.spyOn(caseRow.fake, 'readAuthorization');
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');
            const before = await scopeRow(caseRow.scope.id);

            expect(await run(caseRow)).toEqual({
                outcome: 'SKIPPED',
                reason: 'APPLICATION_DATE_MISMATCH'
            });

            expect(readAuthorization).toHaveBeenCalledTimes(0);
            expect(changeAmount).toHaveBeenCalledTimes(0);
            vi.restoreAllMocks();
            expect(await upcomingRows(caseRow)).toHaveLength(0);
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);
            expect(await scopeRow(caseRow.scope.id)).toEqual(before);
            expect(before).toMatchObject({ status: 'PENDIENTE', appliedAt: null });
        });

        it('QUEUED_CHANGE_EXISTS saltea una fila PENDIENTE que ya tiene un cambio encolado', async () => {
            const caseRow = await createS37MigrationCase();
            // Declared seed: direct insert into the queue, because requestPlanChange
            // moves the scope to FUERA. The row must stay PENDIENTE for this branch.
            await seedScheduledChange({
                subscriptionId: caseRow.subscriptionId,
                effectiveAt: S37_NEXT_CHARGE_AT
            });
            const before = await scopeRow(caseRow.scope.id);

            expect(await run(caseRow)).toEqual({
                outcome: 'SKIPPED',
                reason: 'QUEUED_CHANGE_EXISTS'
            });

            expect(await upcomingRows(caseRow)).toHaveLength(0);
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(1);
            expect(await scopeRow(caseRow.scope.id)).toEqual(before);
            expect(before).toMatchObject({ status: 'PENDIENTE', appliedAt: null });
        });

        it('SUCCESSION_IN_PROGRESS espera una suscripción en sucesión sin escribir', async () => {
            const caseRow = await createS37MigrationCase();
            // Declared seed: the subscription is its own successor, so one of the
            // two succession slots is non-null without a second live principal.
            await db
                .update(subscriptions)
                .set({ succeededById: caseRow.subscriptionId })
                .where(eq(subscriptions.id, caseRow.subscriptionId));
            const before = await scopeRow(caseRow.scope.id);

            expect(await run(caseRow)).toEqual({
                outcome: 'WAITING',
                reason: 'SUCCESSION_IN_PROGRESS'
            });

            expect(await upcomingRows(caseRow)).toHaveLength(0);
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);
            expect(await scopeRow(caseRow.scope.id)).toEqual(before);
        });

        it('D-5: con el destinatario del tercer correo borrado, la mutación sale escalada', async () => {
            const caseRow = await createS37MigrationCase();
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            expect(await upcomingRows(caseRow)).toHaveLength(1);

            // Declared seed: the recipient is soft-deleted after the mail left.
            await db.update(users).set({ deletedAt: S37_DAY }).where(eq(users.id, caseRow.userId));

            expect(await run(caseRow)).toEqual({
                outcome: 'APPLIED_CARD',
                escalated: true
            });
            const [mail] = await upcomingRows(caseRow);
            expect(mail).toMatchObject({ status: 'pending' });
        });
    }
);
