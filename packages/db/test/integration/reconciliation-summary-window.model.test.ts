import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { reconciliationSummaryWindowModel } from '../../src/models/reconciliation-summary-window/reconciliation-summary-window.model.ts';
import { closeTestPool, getTestDb, withTestTransaction } from './helpers.ts';

beforeAll(() => setDb(getTestDb()));
afterAll(closeTestPool);
describe('TEST:1607:12 reconciliation summary window model', () => {
    it('opens once, finds open/latest, and marks sent once', async () => {
        await withTestTransaction(async (tx) => {
            const coversFrom = new Date('2026-10-01T00:00:00Z');
            const input = {
                coversFrom,
                openedAt: coversFrom,
                closesAt: new Date('2026-10-01T01:00:00Z'),
                windowMinutes: 60,
                deadlinesVersion: 1,
                tx
            };
            const opened = await reconciliationSummaryWindowModel.open(input);
            expect(opened).toMatchObject({
                coversFrom,
                openedAt: input.openedAt,
                closesAt: input.closesAt,
                windowMinutes: 60,
                deadlinesVersion: 1,
                sentAt: null,
                eventCount: null
            });
            expect(await reconciliationSummaryWindowModel.open(input)).toBeNull();
            expect(await reconciliationSummaryWindowModel.findOpen({ tx })).toMatchObject({
                id: opened?.id
            });
            expect(await reconciliationSummaryWindowModel.findLatest({ tx })).toMatchObject({
                id: opened?.id
            });
            expect(
                await reconciliationSummaryWindowModel.markSent({
                    id: opened!.id,
                    sentAt: input.closesAt,
                    eventCount: 4,
                    tx
                })
            ).toBe(true);
            expect(
                await reconciliationSummaryWindowModel.markSent({
                    id: opened!.id,
                    sentAt: input.closesAt,
                    eventCount: 4,
                    tx
                })
            ).toBe(false);
            expect(await reconciliationSummaryWindowModel.findOpen({ tx })).toBeNull();
        });
    });
});
