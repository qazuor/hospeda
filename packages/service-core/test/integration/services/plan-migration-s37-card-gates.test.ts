import {
    and,
    domainEvent,
    emailOutbox,
    eq,
    planMigrationSubscriptions,
    subscriptionScheduledChanges,
    subscriptions
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
    type S37Case
} from './support/plan-migration-s37-fixtures.js';

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
            await run(caseRow);

            // Declared seed: the sender exhausts the retries and marks the row `failed`.
            await setNoticeStatus(caseRow, 'failed');
            expect(await run(caseRow)).toEqual({
                outcome: 'READY_TO_MUTATE',
                escalated: true
            });
            expect(await scopeRow(caseRow.scope.id)).toMatchObject({ status: 'PENDIENTE' });
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);

            await setNoticeStatus(caseRow, 'sent');
            expect(await run(caseRow)).toEqual({
                outcome: 'READY_TO_MUTATE',
                escalated: false
            });
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

        it('INV: una corrida de c1 no escribe plan_version_id, billing_option_id ni transaction_amount', async () => {
            const caseRow = await createS37MigrationCase();
            const beforeAnchor = await anchor(caseRow.subscriptionId);
            const beforeRead = await caseRow.fake.readAuthorization({
                authorizationId: caseRow.authorizationId
            });
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');

            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await setNoticeStatus(caseRow, 'sent');
            expect(await run(caseRow)).toEqual({
                outcome: 'READY_TO_MUTATE',
                escalated: false
            });

            expect(await anchor(caseRow.subscriptionId)).toEqual(beforeAnchor);
            expect(changeAmount).toHaveBeenCalledTimes(0);
            vi.restoreAllMocks();
            const afterRead = await caseRow.fake.readAuthorization({
                authorizationId: caseRow.authorizationId
            });
            expect(afterRead.snapshot.amount).toEqual(beforeRead.snapshot.amount);
            expect(S37_DAY).toEqual(caseRow.clock.now());
        });
    }
);
