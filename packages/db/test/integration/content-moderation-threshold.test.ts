import { afterAll, describe, expect, it } from 'vitest';
import { ContentModerationThresholdModel } from '../../src/models/content-moderation/threshold.model.ts';
import { contentModerationThresholds } from '../../src/schemas/content-moderation/threshold.dbschema.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

describe('content moderation thresholds integration', () => {
    afterAll(async () => {
        await closeTestPool();
    });

    it('findByContext falls back to the default row when a specific row is missing', async () => {
        await withTestTransaction(async (tx) => {
            await tx.insert(contentModerationThresholds).values({
                context: 'default',
                pending: 0.5,
                reject: 0.85
            });

            const model = new ContentModerationThresholdModel();
            const row = await model.findByContext('review', tx);

            expect(row).not.toBeNull();
            expect(row?.context).toBe('default');
            expect(row?.pending).toBe(0.5);
            expect(row?.reject).toBe(0.85);
        });
    });

    it('rejects pending >= reject through the DB CHECK constraint', async () => {
        await expect(
            withTestTransaction(async (tx) => {
                await tx.insert(contentModerationThresholds).values({
                    context: 'invalid',
                    pending: 0.9,
                    reject: 0.85
                });
            })
        ).rejects.toThrow();
    });

    it('returns a specific context row before falling back to default', async () => {
        await withTestTransaction(async (tx) => {
            await tx.insert(contentModerationThresholds).values([
                {
                    context: 'default',
                    pending: 0.5,
                    reject: 0.85
                },
                {
                    context: 'message',
                    pending: 0.3,
                    reject: 0.7
                }
            ]);

            const model = new ContentModerationThresholdModel();
            const row = await model.findByContext('message', tx);

            expect(row).not.toBeNull();
            expect(row?.context).toBe('message');
            expect(row?.pending).toBe(0.3);
            expect(row?.reject).toBe(0.7);
        });
    });
});
