/**
 * @file hos-2095-ai-usage-consumer-count.integration.test.ts
 * @description HOS-2095: a listing-chat request writes ONE `ai_usage` row —
 * the owner bears it (`user_id`) and the tourist who asked rides on it
 * (`consumer_user_id`). This suite proves, against the real table, that the
 * quota count reads the right column for each side:
 *
 * 1. `keyedBy: 'user'` (default) counts the rows a user is billed for.
 * 2. `keyedBy: 'consumer'` counts the rows a user consumed on someone else's
 *    listing, and never the rows billed to that user as an owner.
 * 3. A self-chat (owner === consumer) is ONE row that advances each side once.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { countAiUsageForUserFeatureMonth } from '../../../ai-core/src/storage/usage.queries.ts';
import { insertAiUsage } from '../../../ai-core/src/storage/usage.storage.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

const DB_AVAILABLE = Boolean(process.env.HOSPEDA_TEST_DATABASE_URL);

// Rows take `created_at = now()`, so the window is the current UTC month.
const NOW = new Date();
const MONTH_START = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), 1));
const MONTH_END = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 1, 1));
const QUOTA_STATUSES = ['success', 'fallback'] as const;

describe.skipIf(!DB_AVAILABLE)('HOS-2095 · ai_usage consumer-keyed quota count', () => {
    afterAll(async () => {
        await closeTestPool();
    });

    it('counts the owner by user_id and the tourist by consumer_user_id', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — an owner who is ALSO a tourist on another listing.
            const owner = testData.user({ displayName: 'Owner' });
            const tourist = testData.user({ displayName: 'Tourist' });
            await tx.insert(users).values([owner, tourist]);

            const row = (userId: string, consumerUserId: string, status = 'success') =>
                insertAiUsage({
                    userId,
                    consumerUserId,
                    feature: 'chat',
                    provider: 'stub',
                    model: 'stub-model',
                    tokensIn: 10,
                    tokensOut: 5,
                    costEstimateMicroUsd: 100,
                    latencyMs: 1,
                    status,
                    tx
                });

            // Two tourist questions on the owner's listing, one error (not counted).
            await row(owner.id, tourist.id);
            await row(owner.id, tourist.id);
            await row(owner.id, tourist.id, 'error');
            // The owner asks once on the tourist's listing (roles reversed).
            await row(tourist.id, owner.id);

            const count = (userId: string, keyedBy?: 'user' | 'consumer') =>
                countAiUsageForUserFeatureMonth({
                    userId,
                    feature: 'chat',
                    monthStart: MONTH_START,
                    monthEnd: MONTH_END,
                    statuses: QUOTA_STATUSES,
                    ...(keyedBy ? { keyedBy } : {}),
                    tx
                });

            // Act + Assert — owner side (billed rows).
            expect(await count(owner.id)).toBe(2);
            expect(await count(owner.id, 'user')).toBe(2);
            // Consumer side: the questions each user ASKED, never their billed rows.
            expect(await count(tourist.id, 'consumer')).toBe(2);
            expect(await count(owner.id, 'consumer')).toBe(1);
            expect(await count(tourist.id, 'user')).toBe(1);
        });
    });

    it('a self-chat is one row that advances each side exactly once', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user({ displayName: 'Self chatter' });
            await tx.insert(users).values(owner);

            const inserted = await insertAiUsage({
                userId: owner.id,
                consumerUserId: owner.id,
                feature: 'chat',
                provider: 'stub',
                model: 'stub-model',
                tokensIn: 10,
                tokensOut: 5,
                costEstimateMicroUsd: 100,
                latencyMs: 1,
                status: 'success',
                tx
            });
            expect(inserted.consumerUserId).toBe(owner.id);

            const base = {
                userId: owner.id,
                feature: 'chat',
                monthStart: MONTH_START,
                monthEnd: MONTH_END,
                statuses: QUOTA_STATUSES,
                tx
            } as const;
            expect(await countAiUsageForUserFeatureMonth(base)).toBe(1);
            expect(await countAiUsageForUserFeatureMonth({ ...base, keyedBy: 'consumer' })).toBe(1);
        });
    });

    it('stores consumer_user_id as NULL when the caller omits it', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user({ displayName: 'Text improver' });
            await tx.insert(users).values(user);

            const inserted = await insertAiUsage({
                userId: user.id,
                feature: 'text_improve',
                provider: 'stub',
                model: 'stub-model',
                tokensIn: 1,
                tokensOut: 1,
                costEstimateMicroUsd: 0,
                latencyMs: 1,
                status: 'success',
                tx
            });
            expect(inserted.consumerUserId).toBeNull();
        });
    });
});
