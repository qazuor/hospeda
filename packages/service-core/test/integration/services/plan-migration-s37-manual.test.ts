import {
    and,
    billingOptions,
    emailOutbox,
    eq,
    getDb,
    manualPayments,
    planMigrationSubscriptions,
    promoRedemptions,
    subscriptionScheduledChanges,
    subscriptions,
    users
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { runPlanMigrationS37ForRow } from '../../../src/services/billing/plan-migration/plan-migration-s37.service.js';
import { createScheduledChangeApplier } from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { openDueManualInstallments } from '../../../src/services/billing/subscription/open-manual-installment.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { seedPlanChangePromo } from './support/plan-change-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';
import {
    cleanupS37Cases,
    createS37MigrationCase,
    S37_DAY,
    S37_NEXT_CHARGE_AT,
    type S37Case,
    trackS37Recipient
} from './support/plan-migration-s37-fixtures.js';

registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();

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

async function queueFor(subscriptionId: string) {
    return db
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, subscriptionId));
}

async function upcomingFor(caseRow: S37Case) {
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

function upcomingKey(caseRow: S37Case) {
    return planMigrationNoticeDedupKey({
        recipientUserId: caseRow.userId,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        planMigrationSubscriptionId: caseRow.scope.id,
        milestone: 'mig:-7d',
        targetDate: '2026-12-11'
    });
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

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:5 AC:B12:5 S37 sobre un pagador manual: no relee ni muta',
    () => {
        it('encola el cambio de versión para la fecha de aplicación, manda el tercer correo y pasa la fila de alcance a APLICADA en el mismo acto', async () => {
            const caseRow = await createS37MigrationCase({ paymentMethod: 'MANUAL' });
            const promo = await seedPlanChangePromo({
                subscriptionId: caseRow.subscriptionId,
                userId: caseRow.userId
            });
            const before = await anchor(caseRow.subscriptionId);
            const transaction = vi.spyOn(getDb(), 'transaction');

            const result = await run(caseRow);

            // The whole manual act — queue, promo and APLICADA — is one transaction.
            expect(transaction).toHaveBeenCalledTimes(1);
            vi.restoreAllMocks();
            expect(result).toEqual({ outcome: 'APPLIED_MANUAL' });
            const queue = await queueFor(caseRow.subscriptionId);
            expect(queue).toHaveLength(1);
            expect(queue[0]).toMatchObject({
                subscriptionId: caseRow.subscriptionId,
                targetPlanVersionId: caseRow.targetPlanVersionId,
                targetBillingOptionId: caseRow.targetOptionId,
                effectiveAt: S37_NEXT_CHARGE_AT,
                planMigrationSubscriptionId: caseRow.scope.id,
                keepSelection: null
            });
            const mails = await db
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.dedupKey, upcomingKey(caseRow)));
            expect(mails).toHaveLength(1);
            expect(mails[0]).toMatchObject({
                template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
                status: 'pending',
                recipientUserId: caseRow.userId
            });
            expect(await upcomingFor(caseRow)).toHaveLength(1);
            const scope = await scopeRow(caseRow.scope.id);
            expect(scope).toMatchObject({
                status: 'APLICADA',
                appliedAt: S37_DAY,
                outReason: null
            });
            const [redemption] = await db
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.id, promo.id));
            expect(redemption?.remainingCharges).toBe(0);
            expect(await anchor(caseRow.subscriptionId)).toEqual(before);
        });

        it('no llama al falso por ningún método', async () => {
            const caseRow = await createS37MigrationCase({ paymentMethod: 'MANUAL' });
            const spies = {
                readAuthorization: vi.spyOn(caseRow.fake, 'readAuthorization'),
                changeAmount: vi.spyOn(caseRow.fake, 'changeAmount'),
                charge: vi.spyOn(caseRow.fake, 'charge'),
                chargeOnce: vi.spyOn(caseRow.fake, 'chargeOnce'),
                pause: vi.spyOn(caseRow.fake, 'pause'),
                resume: vi.spyOn(caseRow.fake, 'resume'),
                cancel: vi.spyOn(caseRow.fake, 'cancel')
            };

            await run(caseRow);

            expect(spies.readAuthorization).toHaveBeenCalledTimes(0);
            expect(spies.changeAmount).toHaveBeenCalledTimes(0);
            expect(spies.charge).toHaveBeenCalledTimes(0);
            expect(spies.chargeOnce).toHaveBeenCalledTimes(0);
            expect(spies.pause).toHaveBeenCalledTimes(0);
            expect(spies.resume).toHaveBeenCalledTimes(0);
            expect(spies.cancel).toHaveBeenCalledTimes(0);
        });

        it('S38 cambia la versión antes de que MP5 abra la cuota de ese período, que sale con el precio destino', async () => {
            const caseRow = await createS37MigrationCase({ paymentMethod: 'MANUAL' });
            await run(caseRow);
            caseRow.clock.set(S37_NEXT_CHARGE_AT);
            const admin = await createRecipient();
            const applier = createScheduledChangeApplier({
                clock: caseRow.clock,
                onApplied: () => undefined
            });

            await openDueManualInstallments(
                { pageSize: 1000 },
                {
                    clock: caseRow.clock,
                    planPolicy: async () => ({
                        graceDays: 10,
                        allowsPause: false,
                        current: true,
                        sellable: true
                    }),
                    recipients: {
                        list: async () => [{ userId: admin.id, email: admin.email }]
                    },
                    scheduledChangeApplier: applier
                }
            );

            const [current] = await db
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, caseRow.subscriptionId));
            expect(current?.planVersionId).toBe(caseRow.targetPlanVersionId);
            expect(current?.billingOptionId).toBe(caseRow.targetOptionId);
            const [option] = await db
                .select({ amount: billingOptions.amount })
                .from(billingOptions)
                .where(eq(billingOptions.id, caseRow.targetOptionId));
            expect(option?.amount).toBe(caseRow.targetAmountMinor);
            const [installment] = await db
                .select()
                .from(manualPayments)
                .where(eq(manualPayments.subscriptionId, caseRow.subscriptionId));
            expect(installment).toMatchObject({
                periodStart: S37_NEXT_CHARGE_AT,
                status: 'AWAITING'
            });
            expect(await queueFor(caseRow.subscriptionId)).toHaveLength(0);
        });

        it('el día -8 no está en la ventana y no escribe; una segunda corrida el mismo día queda SKIPPED', async () => {
            const caseRow = await createS37MigrationCase({
                paymentMethod: 'MANUAL',
                start: new Date('2026-12-03T13:00:00.000Z')
            });

            expect(await run(caseRow)).toMatchObject({
                outcome: 'NOT_DUE',
                reason: 'NOT_YET_DUE'
            });
            expect(await queueFor(caseRow.subscriptionId)).toHaveLength(0);
            expect(await upcomingFor(caseRow)).toHaveLength(0);
            expect(await scopeRow(caseRow.scope.id)).toMatchObject({
                status: 'PENDIENTE',
                appliedAt: null
            });

            caseRow.clock.set(S37_DAY);
            expect(await run(caseRow)).toEqual({ outcome: 'APPLIED_MANUAL' });
            expect(await run(caseRow)).toMatchObject({ outcome: 'SKIPPED' });
            expect(await queueFor(caseRow.subscriptionId)).toHaveLength(1);
            expect(await upcomingFor(caseRow)).toHaveLength(1);
        });
    }
);

async function createRecipient() {
    const [row] = await db
        .insert(users)
        .values({
            email: `s37-recipient-${crypto.randomUUID()}@example.test`,
            displayName: 'S37 recipient',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!row) throw new Error('S37 recipient fixture failed');
    trackS37Recipient(row.id);
    return row;
}
