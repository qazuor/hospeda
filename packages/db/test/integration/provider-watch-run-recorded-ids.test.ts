/**
 * HOS-1512 (owner decision on the webhook noise): the lookup the webhook uses to recognise an
 * authorization the battery created. Only an id a run RECORDED matches; a lookalike does not.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { providerWatchRunModel as model } from '../../src/models/provider-watch-run/provider-watch-run.model.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

const START = new Date('2026-11-17T10:00:00.000Z');

describe('findRunRecordingProviderId', () => {
    it('answers the run that recorded the id while it was running', async () => {
        await withTestTransaction(async (tx) => {
            const { runId } = await model.open({ account: 'sandbox', startedAt: START, tx });
            await model.appendProgress({
                runId,
                measurementId: 'lifecycle-sbx',
                providerIds: ['2c9380849a1b'],
                tx
            });
            expect(
                await model.findRunRecordingProviderId({ providerId: '2c9380849a1b', tx })
            ).toEqual({
                runId
            });
        });
    });

    it('answers the run after it closed with the id in its record', async () => {
        await withTestTransaction(async (tx) => {
            const { runId } = await model.open({ account: 'production', startedAt: START, tx });
            await model.close({
                id: runId,
                finishedAt: new Date('2026-11-17T10:05:00.000Z'),
                outcome: 'completed',
                reason: null,
                measurements: { 'lifecycle-prod': { outcome: 'matched', providerIds: ['pre-9'] } },
                ledger: { charged: 0, refunded: 0 },
                alerts: [],
                tx
            });
            expect(await model.findRunRecordingProviderId({ providerId: 'pre-9', tx })).toEqual({
                runId
            });
        });
    });

    it('answers null for an id no run recorded, a prefix of one, or one only in a write key', async () => {
        await withTestTransaction(async (tx) => {
            const { runId } = await model.open({ account: 'sandbox', startedAt: START, tx });
            await model.appendProgress({
                runId,
                measurementId: 'lifecycle-sbx',
                providerIds: ['pre-10'],
                writeKeys: ['pre-11'],
                tx
            });
            expect(await model.findRunRecordingProviderId({ providerId: 'never', tx })).toBeNull();
            expect(await model.findRunRecordingProviderId({ providerId: 'pre-1', tx })).toBeNull();
            expect(await model.findRunRecordingProviderId({ providerId: 'pre-11', tx })).toBeNull();
        });
    });
});
