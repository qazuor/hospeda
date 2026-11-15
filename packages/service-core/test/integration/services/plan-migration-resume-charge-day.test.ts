import { eq, subscriptions } from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { pendingIncreaseAmountForCharge } from '../../../src/services/billing/plan-migration/plan-migration-increase-on-resume.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retirePauseRows } from './support/pause-fixtures.js';
import {
    announceKey,
    cleanupPausedIncreaseCases,
    createPausedIncreaseCase,
    markNoticeSent,
    notify,
    outboxKeys,
    pauseCase,
    queueRows,
    resumeCase,
    runS37,
    STORED_APPLICATION_DAY,
    scopeRow,
    upcomingKey
} from './support/paused-increase-fixtures.js';
import {
    localDayInstant,
    S37_INCREASE_TARGET_AMOUNT_MINOR
} from './support/plan-migration-increase-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';

registerPlanMigrationNoticeSerial();

afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupPausedIncreaseCases();
    await retirePauseRows();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-2108 después de reanudar con otra fase de cobro, la fecha pasa al primer día de cobro que cumple el aviso',
    () => {
        it('no queda fija en un día sin cobro', async () => {
            const caseRow = await createPausedIncreaseCase({
                nextChargeAt: localDayInstant(STORED_APPLICATION_DAY)
            });
            await pauseCase(caseRow);
            await resumeCase(caseRow, { at: '2026-12-11', chargeAt: '2026-12-12' });
            caseRow.harness.clock.set({ at: localDayInstant('2026-12-11') });

            expect(await notify(caseRow)).toEqual({
                outcome: 'NOT_DUE',
                milestone: null,
                recalculated: true
            });
            const row = await scopeRow(caseRow);
            expect(row?.status).toBe('PENDIENTE');
            expect(getLocalDateString({ instant: row?.applicationDate ?? new Date() })).toBe(
                '2027-01-12'
            );
        });

        it('no sale un recordatorio para un día sin cobro', async () => {
            const caseRow = await createPausedIncreaseCase({
                nextChargeAt: localDayInstant(STORED_APPLICATION_DAY)
            });
            await pauseCase(caseRow);
            await resumeCase(caseRow, { at: '2026-12-11', chargeAt: '2026-12-12' });
            caseRow.harness.clock.set({ at: localDayInstant('2026-12-11') });

            expect(await notify(caseRow)).toEqual({
                outcome: 'NOT_DUE',
                milestone: null,
                recalculated: true
            });
            expect(await outboxKeys(caseRow)).toEqual([announceKey(caseRow)]);

            caseRow.harness.clock.set({ at: localDayInstant('2026-12-13') });
            expect(await notify(caseRow)).toEqual({
                outcome: 'ENQUEUED',
                milestone: 'mig:-30d',
                recalculated: false
            });
            expect(await outboxKeys(caseRow)).toEqual(
                [announceKey(caseRow), upcomingKey(caseRow, '2027-01-12', 'mig:-30d')].sort()
            );
        });

        it('S37 muta en el día de cobro nuevo, siete días antes', async () => {
            const caseRow = await createPausedIncreaseCase({
                nextChargeAt: localDayInstant(STORED_APPLICATION_DAY)
            });
            await pauseCase(caseRow);
            await resumeCase(caseRow, { at: '2026-12-11', chargeAt: '2026-12-12' });
            caseRow.harness.clock.set({ at: localDayInstant('2026-12-11') });
            expect(await notify(caseRow)).toEqual({
                outcome: 'NOT_DUE',
                milestone: null,
                recalculated: true
            });

            // SEEDED: in production the 2026-12-12 charge advances next_charge_at to
            // the new application day; no service runs that renewal in this test.
            await getServiceTestDb()
                .update(subscriptions)
                .set({ nextChargeAt: localDayInstant('2027-01-12') })
                .where(eq(subscriptions.id, caseRow.subscriptionId));
            caseRow.harness.fake.moveNextCharge({
                authorizationId: caseRow.authorizationId,
                at: localDayInstant('2027-01-12')
            });
            const changeAmount = vi.spyOn(caseRow.harness.fake, 'changeAmount');

            caseRow.harness.clock.set({ at: localDayInstant('2027-01-04') });
            expect(await runS37(caseRow)).toEqual({ outcome: 'NOT_DUE', reason: 'NOT_YET_DUE' });
            expect(changeAmount).toHaveBeenCalledTimes(0);

            caseRow.harness.clock.set({ at: localDayInstant('2027-01-05') });
            expect(await runS37(caseRow)).toEqual({ outcome: 'NOTICE_PENDING' });
            await markNoticeSent(caseRow, '2027-01-12');
            expect(await runS37(caseRow)).toEqual({ outcome: 'APPLIED_CARD', escalated: false });

            expect(changeAmount).toHaveBeenCalledTimes(1);
            expect(changeAmount).toHaveBeenCalledWith({
                authorizationId: caseRow.authorizationId,
                amount: { amountMinor: S37_INCREASE_TARGET_AMOUNT_MINOR, currency: 'ARS' }
            });
            const applied = await scopeRow(caseRow);
            expect(applied?.status).toBe('APLICADA');
            const queue = await queueRows(caseRow);
            expect(queue).toHaveLength(1);
            expect(queue[0]?.effectiveAt).toEqual(localDayInstant('2027-01-12'));
        });

        it('nunca se adelanta antes de lo que garantiza el aviso', async () => {
            const caseRow = await createPausedIncreaseCase({
                nextChargeAt: localDayInstant(STORED_APPLICATION_DAY)
            });
            await pauseCase(caseRow);
            await resumeCase(caseRow, { at: '2026-12-01', chargeAt: '2026-12-05' });

            expect(await notify(caseRow)).toEqual({
                outcome: 'NOT_DUE',
                milestone: null,
                recalculated: true
            });
            const row = await scopeRow(caseRow);
            expect(getLocalDateString({ instant: row?.applicationDate ?? new Date() })).toBe(
                '2027-01-05'
            );
        });

        it('el helper de reanudación usa la misma regla', async () => {
            const caseRow = await createPausedIncreaseCase({
                nextChargeAt: localDayInstant(STORED_APPLICATION_DAY)
            });
            await pauseCase(caseRow);
            const result = await resumeCase(caseRow, {
                at: '2026-12-11',
                chargeAt: '2026-12-12'
            });
            expect(result.nextCharge).toEqual({
                at: localDayInstant('2026-12-12'),
                amountMinor: caseRow.currentAmountMinor,
                currency: 'ARS'
            });
            expect(
                await pendingIncreaseAmountForCharge({
                    subscriptionId: caseRow.subscriptionId,
                    chargeAt: localDayInstant('2027-01-12')
                })
            ).toEqual({ amountMinor: S37_INCREASE_TARGET_AMOUNT_MINOR, currency: 'ARS' });
        });
    }
);
