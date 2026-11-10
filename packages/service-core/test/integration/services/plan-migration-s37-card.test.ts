import {
    and,
    domainEvent,
    emailOutbox,
    eq,
    planMigrationSubscriptions,
    promoRedemptions,
    subscriptionScheduledChanges
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cancelPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-cancel.service.js';
import {
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { runPlanMigrationS37ForRow } from '../../../src/services/billing/plan-migration/plan-migration-s37.service.js';
import { requestPlanChange } from '../../../src/services/billing/subscription/request-plan-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { seedPlanChangePromo } from './support/plan-change-fixtures.js';
import { migrationClock } from './support/plan-migration-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';
import {
    cleanupS37Cases,
    createS37MigrationCase,
    S37_DAY,
    S37_NEXT_CHARGE_AT,
    type S37Case
} from './support/plan-migration-s37-fixtures.js';

registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();

afterEach(cleanupS37Cases);
afterAll(closeServiceTestPool);

function run(caseRow: S37Case, provider: PaymentProvider = caseRow.provider) {
    return runPlanMigrationS37ForRow(
        {
            planMigrationSubscriptionId: caseRow.scope.id,
            correlationId: crypto.randomUUID()
        },
        { provider, clock: caseRow.clock }
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

async function markNoticeSent(caseRow: S37Case) {
    await db
        .update(emailOutbox)
        .set({ status: 'sent' })
        .where(eq(emailOutbox.dedupKey, upcomingKey(caseRow)));
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

/** Delegates every port method to the fake and overrides only `changeAmount`. */
function withChangeAmount(
    fake: FakePaymentProvider,
    changeAmount: PaymentProvider['changeAmount']
): PaymentProvider {
    return {
        capabilitySupport: fake.capabilitySupport,
        authorize: (input) => fake.authorize(input),
        charge: (input) => fake.charge(input),
        chargeOnce: (input) => fake.chargeOnce(input),
        changeAmount,
        pause: (input) => fake.pause(input),
        resume: (input) => fake.resume(input),
        cancel: (input) => fake.cancel(input),
        refund: (input) => fake.refund(input),
        refundOrder: (input) => fake.refundOrder(input),
        readAuthorization: (input) => fake.readAuthorization(input),
        searchAuthorizations: (input) => fake.searchAuthorizations(input),
        readCharge: (input) => fake.readCharge(input),
        listCharges: (input) => fake.listCharges(input),
        readOrder: (input) => fake.readOrder(input),
        searchOrders: (input) => fake.searchOrders(input),
        decodeNotice: (input) => fake.decodeNotice(input)
    };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:4 AC:B12:4 S37 sobre un pagador con tarjeta: un tercer camino',
    () => {
        it('siete días antes, el correo sale y la misma fila queda sent antes de la mutación del falso', async () => {
            const caseRow = await createS37MigrationCase();

            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            const first = await upcomingRows(caseRow);
            expect(first).toHaveLength(1);
            expect(first[0]).toMatchObject({
                dedupKey: upcomingKey(caseRow),
                status: 'pending'
            });

            // Declared seed: the sender marks the row `sent` before S37 retries.
            await markNoticeSent(caseRow);
            let noticeAtMutation: string | null = null;
            const original = caseRow.fake.changeAmount.bind(caseRow.fake);
            const provider = withChangeAmount(caseRow.fake, async (input) => {
                const [mail] = await db
                    .select({ status: emailOutbox.status })
                    .from(emailOutbox)
                    .where(eq(emailOutbox.dedupKey, upcomingKey(caseRow)))
                    .limit(1);
                noticeAtMutation = mail?.status ?? null;
                return original(input);
            });

            expect(await run(caseRow, provider)).toEqual({
                outcome: 'APPLIED_CARD',
                escalated: false
            });
            expect(noticeAtMutation).toBe('sent');
            const after = await upcomingRows(caseRow);
            expect(after).toHaveLength(1);
            expect(after[0]).toMatchObject({
                dedupKey: upcomingKey(caseRow),
                status: 'sent'
            });
        });

        it('muta transaction_amount al precio de lista de la versión destino para su ciclo, sin promos, sobre la misma autorización, sin re-autorizar, y lo verifica releyendo', async () => {
            const caseRow = await createS37MigrationCase();
            const promo = await seedPlanChangePromo({
                subscriptionId: caseRow.subscriptionId,
                userId: caseRow.userId
            });
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow);
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');
            const authorize = vi.spyOn(caseRow.fake, 'authorize');
            const before = await caseRow.fake.readAuthorization({
                authorizationId: caseRow.authorizationId
            });

            expect(await run(caseRow)).toEqual({
                outcome: 'APPLIED_CARD',
                escalated: false
            });

            expect(changeAmount).toHaveBeenCalledTimes(1);
            expect(changeAmount).toHaveBeenCalledWith({
                authorizationId: caseRow.authorizationId,
                amount: { amountMinor: caseRow.targetAmountMinor, currency: 'ARS' }
            });
            expect(authorize).toHaveBeenCalledTimes(0);
            vi.restoreAllMocks();
            const after = await caseRow.fake.readAuthorization({
                authorizationId: caseRow.authorizationId
            });
            expect(after.snapshot.amount).toEqual({
                amountMinor: caseRow.targetAmountMinor,
                currency: 'ARS'
            });
            expect(after.snapshot.status).toBe(before.snapshot.status);
            const [redemption] = await db
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.id, promo.id));
            expect(redemption?.remainingCharges).toBe(0);
        });

        it('la cola tiene el cambio y la fila de alcance está APLICADA', async () => {
            const caseRow = await createS37MigrationCase();
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow);
            expect(await run(caseRow)).toEqual({
                outcome: 'APPLIED_CARD',
                escalated: false
            });

            const queue = await queueRows(caseRow.subscriptionId);
            expect(queue).toHaveLength(1);
            expect(queue[0]).toMatchObject({
                subscriptionId: caseRow.subscriptionId,
                targetPlanVersionId: caseRow.targetPlanVersionId,
                targetBillingOptionId: caseRow.targetOptionId,
                planMigrationSubscriptionId: caseRow.scope.id,
                keepSelection: null
            });
            expect(queue[0]?.effectiveAt).toEqual(S37_NEXT_CHARGE_AT);
            const scope = await scopeRow(caseRow.scope.id);
            expect(scope?.status).toBe('APLICADA');
            expect(scope?.appliedAt).toEqual(S37_DAY);
            expect(scope?.outReason).toBeNull();
        });

        it('una corrida de S37 tras APPLIED_CARD queda SKIPPED, sin segunda decisión ni segunda llamada', async () => {
            const caseRow = await createS37MigrationCase();
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow);
            const changeAmount = vi.spyOn(caseRow.fake, 'changeAmount');
            expect(await run(caseRow)).toEqual({
                outcome: 'APPLIED_CARD',
                escalated: false
            });

            expect(await run(caseRow)).toMatchObject({
                outcome: 'SKIPPED',
                reason: 'SCOPE_NOT_PENDING'
            });
            expect(await decisionEvents(caseRow.subscriptionId)).toHaveLength(1);
            expect(changeAmount).toHaveBeenCalledTimes(1);
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(1);
        });

        it('la carrera determinista: cancelPlanMigration gana entre la decisión y el cierre', async () => {
            const caseRow = await createS37MigrationCase();
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow);
            const original = caseRow.fake.changeAmount.bind(caseRow.fake);
            let cancelled = false;
            const provider = withChangeAmount(caseRow.fake, async (input) => {
                const acknowledgement = await original(input);
                if (!cancelled) {
                    cancelled = true;
                    await cancelPlanMigration(
                        {
                            actor: caseRow.case.actor,
                            planMigrationId: caseRow.migrationId
                        },
                        { clock: migrationClock }
                    );
                }
                return acknowledgement;
            });

            expect(await run(caseRow, provider)).toEqual({
                outcome: 'MUTATED_BUT_ROW_LEFT'
            });
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(0);
            expect((await scopeRow(caseRow.scope.id))?.status).toBe('CANCELADA');
        });

        it('No es el upgrade ni el downgrade: el cambio real del cliente queda con MIGRATION_CHANGE_QUEUED', async () => {
            const caseRow = await createS37MigrationCase();
            expect(await run(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow);
            expect(await run(caseRow)).toEqual({
                outcome: 'APPLIED_CARD',
                escalated: false
            });
            caseRow.case.verticals.setChangeDirection({
                fromPlanVersionId: caseRow.case.planVersionId,
                toPlanVersionId: caseRow.targetPlanVersionId,
                direction: 'DOWN'
            });

            const requested = await requestPlanChange(
                {
                    actor: { id: caseRow.userId },
                    subscriptionId: caseRow.subscriptionId,
                    billingOptionId: caseRow.targetOptionId,
                    returnUrl: 'https://hospeda.example/account'
                },
                {
                    ...caseRow.case.ports,
                    provider: caseRow.provider,
                    clock: caseRow.clock,
                    changeDirection: caseRow.case.verticals.changeDirection.bind(
                        caseRow.case.verticals
                    )
                }
            );

            expect(requested).toEqual({
                path: 'REJECTED',
                reason: 'MIGRATION_CHANGE_QUEUED'
            });
            expect(await queueRows(caseRow.subscriptionId)).toHaveLength(1);
        });
    }
);
