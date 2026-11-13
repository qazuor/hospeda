import {
    emailOutbox,
    eq,
    planMigrationSubscriptions,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { applyPlanMigrationUpcomingNotice } from '../../../src/services/billing/plan-migration/plan-migration-upcoming-notice.js';
import { runPlanMigrationS37 } from '../../../src/services/billing/plan-migration/run-plan-migration-s37.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';
import {
    cleanupS37Cases,
    createS37MigrationCase,
    type S37Case
} from './support/plan-migration-s37-fixtures.js';

// PM-511: the S37 batch walks the same PENDIENTE rows as the HOS-1613 notice batch.
registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();
afterEach(cleanupS37Cases);
afterAll(closeServiceTestPool);

/**
 * The batch is global: this file seeds its rows far in the future (2031) so only
 * its three cases fall inside the seven-day window of its own clock, and it still
 * filters every assertion by the ids it created.
 */
const BATCH_DAY = new Date('2031-12-04T13:00:00.000Z');
const BATCH_NEXT_CHARGE = new Date('2031-12-11T11:00:00.000Z');
const BATCH_DAY_MINUS_8 = new Date('2031-12-12T11:00:00.000Z');
const BATCH_TODAY_CHARGE = new Date('2031-12-04T11:00:00.000Z');
const TARGET_DATE = '2031-12-11';

function upcomingKey(caseRow: S37Case, targetDate = TARGET_DATE): string {
    return planMigrationNoticeDedupKey({
        recipientUserId: caseRow.userId,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        planMigrationSubscriptionId: caseRow.scope.id,
        milestone: 'mig:-7d',
        targetDate
    });
}

/** Enqueues the third notice and moves it to `sent`, as the real sender would. */
async function sendThirdNotice(caseRow: S37Case): Promise<void> {
    await db.transaction((tx) =>
        applyPlanMigrationUpcomingNotice({
            tx,
            planMigrationSubscriptionId: caseRow.scope.id,
            now: BATCH_DAY
        })
    );
    // Declared seed: production moves this row through the outbox sender.
    await db
        .update(emailOutbox)
        .set({ status: 'sent' })
        .where(eq(emailOutbox.dedupKey, upcomingKey(caseRow)));
}

function runBatch(provider: S37Case['provider'], clock: S37Case['clock'], limit = 500) {
    return runPlanMigrationS37({ limit, correlationId: crypto.randomUUID() }, { provider, clock });
}

async function scopeRow(scopeId: string) {
    const [row] = await db
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.id, scopeId));
    return row;
}

async function queueFor(subscriptionId: string) {
    return db
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, subscriptionId));
}

async function upcomingMail(caseRow: S37Case) {
    const [mail] = await db
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.dedupKey, upcomingKey(caseRow)));
    if (!mail) throw new Error('Third migration notice missing');
    return mail;
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:4 AC:B12:4 el job de S37 corre siete días antes de la fecha de aplicación de cada fila',
    () => {
        it('procesa el pagador manual y el de tarjeta y deja afuera la fila del día -8', async () => {
            const manual = await createS37MigrationCase({
                paymentMethod: 'MANUAL',
                nextChargeAt: BATCH_NEXT_CHARGE
            });
            const card = await createS37MigrationCase({
                paymentMethod: 'CARD',
                nextChargeAt: BATCH_NEXT_CHARGE,
                start: BATCH_DAY
            });
            const late = await createS37MigrationCase({
                paymentMethod: 'MANUAL',
                nextChargeAt: BATCH_DAY_MINUS_8,
                start: BATCH_DAY
            });
            await sendThirdNotice(card);

            const result = await runBatch(card.provider, card.clock);
            const ids = new Set([manual.scope.id, card.scope.id, late.scope.id]);
            const ownRows = result.rows.filter((row) => ids.has(row.planMigrationSubscriptionId));

            expect(
                ownRows.filter((row) => row.planMigrationSubscriptionId === manual.scope.id)
            ).toEqual([
                { planMigrationSubscriptionId: manual.scope.id, outcome: 'APPLIED_MANUAL' }
            ]);
            expect(
                ownRows.filter((row) => row.planMigrationSubscriptionId === card.scope.id)
            ).toEqual([
                {
                    planMigrationSubscriptionId: card.scope.id,
                    outcome: 'APPLIED_CARD',
                    escalated: false
                }
            ]);
            // The day -8 row is outside [today, today + 7]: the batch never visits it.
            expect(ownRows.some((row) => row.planMigrationSubscriptionId === late.scope.id)).toBe(
                false
            );
            expect(await scopeRow(late.scope.id)).toMatchObject({
                status: 'PENDIENTE',
                appliedAt: null
            });

            expect(await queueFor(manual.subscriptionId)).toHaveLength(1);
            expect(await queueFor(card.subscriptionId)).toHaveLength(1);
            expect(await queueFor(late.subscriptionId)).toHaveLength(0);
            expect(await scopeRow(manual.scope.id)).toMatchObject({ status: 'APLICADA' });
            expect(await scopeRow(card.scope.id)).toMatchObject({ status: 'APLICADA' });

            expect((await upcomingMail(manual)).payload).toMatchObject({
                providerNotifies: false
            });
            expect((await upcomingMail(card)).payload).toMatchObject({ providerNotifies: true });
        });

        it('con limit 1 el cursor keyset visita las tres filas elegibles sin repetir ni saltear', async () => {
            const cards: S37Case[] = [];
            for (let index = 0; index < 3; index += 1)
                cards.push(
                    await createS37MigrationCase({
                        paymentMethod: 'CARD',
                        nextChargeAt: BATCH_NEXT_CHARGE,
                        start: BATCH_DAY
                    })
                );
            // Their third notice is still unsent, so each stays NOTICE_PENDING and eligible.
            const ids = new Set(cards.map((card) => card.scope.id));

            const result = await runBatch(cards[0]!.provider, cards[0]!.clock, 1);
            const ownRows = result.rows.filter((row) => ids.has(row.planMigrationSubscriptionId));

            expect(ownRows).toHaveLength(3);
            expect(new Set(ownRows.map((row) => row.planMigrationSubscriptionId)).size).toBe(3);
            expect(ownRows.every((row) => row.outcome === 'NOTICE_PENDING')).toBe(true);
        });

        it('una fila que tira no corta el lote: las otras dos se procesan y se cuenta en failed', async () => {
            const throwing = await createS37MigrationCase({
                paymentMethod: 'MANUAL',
                nextChargeAt: BATCH_TODAY_CHARGE,
                start: BATCH_DAY
            });
            const first = await createS37MigrationCase({
                paymentMethod: 'MANUAL',
                nextChargeAt: BATCH_NEXT_CHARGE,
                start: BATCH_DAY
            });
            const second = await createS37MigrationCase({
                paymentMethod: 'MANUAL',
                nextChargeAt: BATCH_NEXT_CHARGE,
                start: BATCH_DAY
            });
            // Declared seed: nulling the anchor makes runInsideTransaction throw on this row.
            await db
                .update(subscriptions)
                .set({ nextChargeAt: null })
                .where(eq(subscriptions.id, throwing.subscriptionId));

            const result = await runBatch(first.provider, first.clock);
            const ids = new Set([throwing.scope.id, first.scope.id, second.scope.id]);
            const ownRows = result.rows.filter((row) => ids.has(row.planMigrationSubscriptionId));

            expect(
                ownRows.filter((row) => row.planMigrationSubscriptionId === first.scope.id)
            ).toEqual([{ planMigrationSubscriptionId: first.scope.id, outcome: 'APPLIED_MANUAL' }]);
            expect(
                ownRows.filter((row) => row.planMigrationSubscriptionId === second.scope.id)
            ).toEqual([
                { planMigrationSubscriptionId: second.scope.id, outcome: 'APPLIED_MANUAL' }
            ]);
            expect(
                ownRows.find((row) => row.planMigrationSubscriptionId === throwing.scope.id)
                    ?.outcome
            ).toBe('FAILED');
            expect(result.failedIds).toContain(throwing.scope.id);
        });
    }
);
