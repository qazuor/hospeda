import {
    emailOutbox,
    eq,
    planMigrationSubscriptions,
    subscriptionScheduledChanges
} from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { runPlanMigrationS37ForRow } from '../../../src/services/billing/plan-migration/plan-migration-s37.service.js';
import { applyPlanMigrationUpcomingNotice } from '../../../src/services/billing/plan-migration/plan-migration-upcoming-notice.js';
import { canPause } from '../../../src/services/billing/subscription/pause-policy.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import {
    type ResumeSubscriptionResult,
    resumeSubscription
} from '../../../src/services/billing/subscription/resume-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { pausePlanPolicy, retirePauseRows } from './support/pause-fixtures.js';
import {
    cleanupPausedIncreaseCases,
    createPausedIncreaseCase,
    localDayInstant,
    type PausedIncreaseCase
} from './support/plan-migration-increase-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';

registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();
const ANNOUNCED_DAY = '2026-10-11';
/** The application day the increase is announced with, from the seeded next charge. */
const STORED_APPLICATION_DAY = '2026-12-15';
/** Seven local days before the stored application day. */
const PAUSED_DAY = '2026-12-08';
/** The first resumed charge after the 60-day notice has already elapsed. */
const RESUMED_CHARGE_AFTER_NOTICE = '2027-01-15';
/** The resumed charge still inside the 60-day notice. */
const RESUMED_CHARGE_BEFORE_NOTICE = '2026-12-05';
/** One monthly cycle after {@link RESUMED_CHARGE_BEFORE_NOTICE}. */
const DEFERRED_APPLICATION_DAY = '2027-01-05';

const complements = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};

afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupPausedIncreaseCases();
    await retirePauseRows();
});
afterAll(closeServiceTestPool);

function announceKey(caseRow: PausedIncreaseCase): string {
    return planMigrationNoticeDedupKey({
        recipientUserId: caseRow.userId,
        template: PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
        planMigrationSubscriptionId: caseRow.scope.id,
        milestone: 'mig:announce',
        targetDate: ANNOUNCED_DAY
    });
}

function upcomingKey(caseRow: PausedIncreaseCase, targetDay: string): string {
    return planMigrationNoticeDedupKey({
        recipientUserId: caseRow.userId,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        planMigrationSubscriptionId: caseRow.scope.id,
        milestone: 'mig:-7d',
        targetDate: targetDay
    });
}

async function outboxKeys(caseRow: PausedIncreaseCase): Promise<string[]> {
    const rows = await db
        .select({ dedupKey: emailOutbox.dedupKey })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, caseRow.userId));
    return rows.map((row) => row.dedupKey).sort();
}

async function markNoticeSent(caseRow: PausedIncreaseCase, targetDay: string): Promise<void> {
    await db
        .update(emailOutbox)
        .set({ status: 'sent' })
        .where(eq(emailOutbox.dedupKey, upcomingKey(caseRow, targetDay)));
}

function runS37(caseRow: PausedIncreaseCase) {
    return runPlanMigrationS37ForRow(
        { planMigrationSubscriptionId: caseRow.scope.id, correlationId: crypto.randomUUID() },
        { provider: caseRow.provider, clock: caseRow.harness.clock }
    );
}

function notify(caseRow: PausedIncreaseCase) {
    return db.transaction((tx) =>
        applyPlanMigrationUpcomingNotice({
            tx,
            planMigrationSubscriptionId: caseRow.scope.id,
            now: caseRow.harness.clock.now()
        })
    );
}

async function scopeRow(caseRow: PausedIncreaseCase) {
    const [row] = await db
        .select({
            status: planMigrationSubscriptions.status,
            applicationDate: planMigrationSubscriptions.applicationDate,
            appliedAt: planMigrationSubscriptions.appliedAt
        })
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.id, caseRow.scope.id));
    return row;
}

async function queueRows(caseRow: PausedIncreaseCase) {
    return db
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, caseRow.subscriptionId));
}

async function pauseCase(caseRow: PausedIncreaseCase): Promise<void> {
    caseRow.harness.clock.set({ at: localDayInstant('2026-10-14') });
    const allowed = await canPause(
        { subscriptionId: caseRow.subscriptionId, requestedMonths: 2 },
        { clock: caseRow.harness.clock, planPolicy: pausePlanPolicy() }
    );
    expect(allowed.allowed).toBe(true);
    const paused = await pauseSubscription(
        { subscriptionId: caseRow.subscriptionId, requestedMonths: 2 },
        {
            provider: caseRow.provider,
            clock: caseRow.harness.clock,
            planPolicy: pausePlanPolicy(),
            complements
        }
    );
    expect(paused.outcome).toBe('PAUSED');
}

async function resumeCase(
    caseRow: PausedIncreaseCase,
    input: { readonly at: string; readonly chargeAt: string }
): Promise<Extract<ResumeSubscriptionResult, { outcome: 'RESUMED' }>> {
    caseRow.harness.fake.moveNextCharge({
        authorizationId: caseRow.authorizationId,
        at: localDayInstant(input.chargeAt)
    });
    caseRow.harness.clock.set({ at: localDayInstant(input.at) });
    const result = await resumeSubscription(
        { subscriptionId: caseRow.subscriptionId, cause: 'EARLY' },
        { provider: caseRow.provider, clock: caseRow.harness.clock, complements }
    );
    expect(result.outcome).toBe('RESUMED');
    if (result.outcome !== 'RESUMED') throw new Error('S10 failed');
    return result;
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8b:4 AC:B8b:4 un aumento que cae sobre una pausada se aplica en el primer cobro posterior a la reanudación, nunca recortando los 60 días del aviso',
    () => {
        it('la pausa no se bloquea por el aumento y, mientras está pausada, S37 y el recordatorio esperan', async () => {
            const caseRow = await createPausedIncreaseCase({
                nextChargeAt: localDayInstant(STORED_APPLICATION_DAY)
            });
            expect(caseRow.applicationDate).toBe(STORED_APPLICATION_DAY);
            const changeAmount = vi.spyOn(caseRow.harness.fake, 'changeAmount');

            await pauseCase(caseRow);
            caseRow.harness.clock.set({ at: localDayInstant(PAUSED_DAY) });

            expect(await runS37(caseRow)).toEqual({
                outcome: 'WAITING',
                reason: 'SUBSCRIPTION_NOT_ACTIVE'
            });
            expect(await notify(caseRow)).toEqual({
                outcome: 'WAITING',
                milestone: null,
                recalculated: false
            });
            expect(changeAmount).toHaveBeenCalledTimes(0);

            const row = await scopeRow(caseRow);
            expect(row?.status).toBe('PENDIENTE');
            expect(getLocalDateString({ instant: row?.applicationDate ?? new Date() })).toBe(
                STORED_APPLICATION_DAY
            );
            expect(await queueRows(caseRow)).toHaveLength(0);
            // No second notice took the announcement's place while the row waited.
            expect(await outboxKeys(caseRow)).toEqual([announceKey(caseRow)]);
        });

        it('reanudar con el aviso ya cumplido aplica el aumento en ese cobro y S37 muta el monto nuevo siete días antes', async () => {
            const caseRow = await createPausedIncreaseCase({
                nextChargeAt: localDayInstant(STORED_APPLICATION_DAY)
            });
            await pauseCase(caseRow);
            caseRow.harness.clock.set({ at: localDayInstant(PAUSED_DAY) });
            expect(await runS37(caseRow)).toEqual({
                outcome: 'WAITING',
                reason: 'SUBSCRIPTION_NOT_ACTIVE'
            });
            const changeAmount = vi.spyOn(caseRow.harness.fake, 'changeAmount');

            const result = await resumeCase(caseRow, {
                at: '2026-12-20',
                chargeAt: RESUMED_CHARGE_AFTER_NOTICE
            });
            // Q-3: the resumed charge already honours the notice, so the customer is told
            // the NEW amount at that charge.
            expect(result.nextCharge).toEqual({
                at: localDayInstant(RESUMED_CHARGE_AFTER_NOTICE),
                amountMinor: caseRow.targetAmountMinor,
                currency: 'ARS'
            });

            caseRow.harness.clock.set({ at: localDayInstant('2027-01-08') });
            expect(await notify(caseRow)).toEqual({
                outcome: 'ENQUEUED',
                milestone: 'mig:-7d',
                recalculated: true
            });
            const recalculated = await scopeRow(caseRow);
            expect(recalculated?.status).toBe('PENDIENTE');
            expect(
                getLocalDateString({ instant: recalculated?.applicationDate ?? new Date() })
            ).toBe(RESUMED_CHARGE_AFTER_NOTICE);

            expect(await runS37(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow, RESUMED_CHARGE_AFTER_NOTICE);
            expect(await runS37(caseRow)).toEqual({ outcome: 'APPLIED_CARD', escalated: false });

            expect(changeAmount).toHaveBeenCalledTimes(1);
            expect(changeAmount).toHaveBeenCalledWith({
                authorizationId: caseRow.authorizationId,
                amount: { amountMinor: caseRow.targetAmountMinor, currency: 'ARS' }
            });
            const applied = await scopeRow(caseRow);
            expect(applied?.status).toBe('APLICADA');
            expect(applied?.appliedAt).toEqual(localDayInstant('2027-01-08'));
            const queue = await queueRows(caseRow);
            expect(queue).toHaveLength(1);
            expect(queue[0]).toMatchObject({
                targetPlanVersionId: caseRow.targetPlanVersionId,
                targetBillingOptionId: caseRow.targetOptionId,
                planMigrationSubscriptionId: caseRow.scope.id
            });
            expect(queue[0]?.effectiveAt).toEqual(localDayInstant(RESUMED_CHARGE_AFTER_NOTICE));
        });

        it('si los sesenta días no se cumplieron, el aumento espera al cobro siguiente y el reanudado informa el precio viejo', async () => {
            const caseRow = await createPausedIncreaseCase({
                nextChargeAt: localDayInstant(STORED_APPLICATION_DAY)
            });
            await pauseCase(caseRow);

            const result = await resumeCase(caseRow, {
                at: '2026-12-01',
                chargeAt: RESUMED_CHARGE_BEFORE_NOTICE
            });
            // Q-3: this charge is not the increase's day, so the anchored amount stays.
            expect(result.nextCharge).toEqual({
                at: localDayInstant(RESUMED_CHARGE_BEFORE_NOTICE),
                amountMinor: caseRow.currentAmountMinor,
                currency: 'ARS'
            });

            expect(await notify(caseRow)).toEqual({
                outcome: 'NOT_DUE',
                milestone: null,
                recalculated: true
            });
            const row = await scopeRow(caseRow);
            expect(row?.status).toBe('PENDIENTE');
            expect(getLocalDateString({ instant: row?.applicationDate ?? new Date() })).toBe(
                DEFERRED_APPLICATION_DAY
            );
        });
    }
);
