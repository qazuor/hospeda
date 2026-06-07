import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedContentModerationData } from '../../../seed/src/required/contentModeration.seed.ts';
import { resetDb, setDb } from '../../src/client.ts';
import { ContentModerationTermModel } from '../../src/models/content-moderation/term.model.ts';
import { contentModerationTerms } from '../../src/schemas/content-moderation/term.dbschema.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

describe('content moderation terms integration', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    afterAll(async () => {
        resetDb();
        vi.unstubAllEnvs();
        await closeTestPool();
    });

    it('stores seeded env terms exactly once even when the seed runs twice', async () => {
        await withTestTransaction(async (tx) => {
            setDb(tx);
            vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', 'spam,badword,spam');
            vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', 'evil.com,foo.org,evil.com');

            await seedContentModerationData(tx);
            await seedContentModerationData(tx);

            const rows = await tx.select().from(contentModerationTerms);

            expect(rows).toHaveLength(4);
            expect(rows.map((row) => row.term).sort()).toEqual([
                'badword',
                'evil.com',
                'foo.org',
                'spam'
            ]);
        });
    });

    it('findEnabledTerms hides soft-deleted rows from the local provider hot path', async () => {
        await withTestTransaction(async (tx) => {
            await tx.insert(contentModerationTerms).values([
                {
                    term: 'spam',
                    kind: 'word',
                    category: 'other',
                    severity: 1,
                    enabled: true
                },
                {
                    term: 'evil.com',
                    kind: 'domain',
                    category: 'other',
                    severity: 1,
                    enabled: true,
                    deletedAt: new Date()
                },
                {
                    term: 'inactive',
                    kind: 'word',
                    category: 'other',
                    severity: 1,
                    enabled: false
                }
            ]);

            const model = new ContentModerationTermModel();
            const rows = await model.findEnabledTerms(tx);

            expect(rows).toHaveLength(1);
            expect(rows[0]?.term).toBe('spam');
        });
    });
});
