import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { retirePauseRows } from './support/pause-fixtures.js';
import {
    announceKey,
    cleanupPausedIncreaseCases,
    createPausedIncreaseCase,
    DEFERRED_APPLICATION_DAY,
    markNoticeSent,
    notify,
    outboxKeys,
    PAUSED_DAY,
    pauseCase,
    queueRows,
    RESUMED_CHARGE_AFTER_NOTICE,
    RESUMED_CHARGE_BEFORE_NOTICE,
    resumeCase,
    runS37,
    STORED_APPLICATION_DAY,
    scopeRow
} from './support/paused-increase-fixtures.js';
import { localDayInstant } from './support/plan-migration-increase-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';

registerPlanMigrationNoticeSerial();

afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupPausedIncreaseCases();
    await retirePauseRows();
});
afterAll(closeServiceTestPool);

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

        it('si el cobro reanudado cumple el aviso pero cae antes de la fecha guardada, informa el precio viejo y la fecha pasa al cobro siguiente (HOS-2108)', async () => {
            const caseRow = await createPausedIncreaseCase({
                nextChargeAt: localDayInstant(STORED_APPLICATION_DAY)
            });
            await pauseCase(caseRow);
            const result = await resumeCase(caseRow, { at: '2026-12-11', chargeAt: '2026-12-12' });
            expect(result.nextCharge).toEqual({
                at: localDayInstant('2026-12-12'),
                amountMinor: caseRow.currentAmountMinor,
                currency: 'ARS'
            });
            expect(await runS37(caseRow)).toEqual({
                outcome: 'NOT_DUE',
                reason: 'UPCOMING_NOTICE_NOT_DUE'
            });
            const recalculated = await scopeRow(caseRow);
            expect(recalculated?.status).toBe('PENDIENTE');
            expect(
                getLocalDateString({ instant: recalculated?.applicationDate ?? new Date() })
            ).toBe('2027-01-12');
        });
    }
);
