/**
 * @file user-admin-list-with-counts.integration.test.ts
 * @description HOS-1638 (B13a.10): `findAllWithCounts` must not read the old
 * billing tables that U1 dropped. Regression test for the 500 on
 * `GET /api/v1/admin/users` caused by `currentPlanSlugSq` referencing
 * `billing_subscriptions` / `billing_customers` / `billing_plans`.
 *
 * After the fix the query must:
 * 1. Not throw (no 42P01).
 * 2. Return inserted users with their relationship counts.
 * 3. Not carry `currentPlanSlug` on any row.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { UserModel } from '../../src/models/user/user.model';
import { users } from '../../src/schemas/user/user.dbschema';
import { closeTestPool, testData, withTestTransaction } from './helpers';

const DB_AVAILABLE = Boolean(process.env.HOSPEDA_TEST_DATABASE_URL);

const model = new UserModel();

describe.skipIf(!DB_AVAILABLE)(
    'HOS-1638 · 500 de /admin/users — findAllWithCounts survives',
    () => {
        afterAll(async () => {
            await closeTestPool();
        });

        it('returns users with counts and total without throwing', async () => {
            await withTestTransaction(async (tx) => {
                // Arrange — two plain users (no accommodation rows).
                const u1 = testData.user({ displayName: 'Alice' });
                const u2 = testData.user({ displayName: 'Bob' });
                await tx.insert(users).values([u1, u2]);

                // Act — the admin list path.
                const result = await model.findAllWithCounts(
                    {},
                    { page: 1, pageSize: 10 },
                    undefined,
                    tx
                );

                // Assert — no throw, correct count.
                expect(result.items).toHaveLength(2);
                expect(result.total).toBe(2);
            });
        });

        it('returns each user with correct relationship counts', async () => {
            await withTestTransaction(async (tx) => {
                // Arrange — one user.
                const u1 = testData.user({ displayName: 'Alice' });
                await tx.insert(users).values(u1);

                // Act.
                const result = await model.findAllWithCounts(
                    {},
                    { page: 1, pageSize: 10 },
                    undefined,
                    tx
                );

                // Assert — all counts are zero (no relations inserted).
                const item = result.items[0];
                expect(item?.accommodationsCount).toBe(0);
                expect(item?.gastronomiesCount).toBe(0);
                expect(item?.experiencesCount).toBe(0);
                expect(item?.eventsCount).toBe(0);
                expect(item?.postsCount).toBe(0);
            });
        });

        it('does not carry currentPlanSlug on any row', async () => {
            await withTestTransaction(async (tx) => {
                // Arrange.
                const u1 = testData.user({ displayName: 'Alice' });
                await tx.insert(users).values(u1);

                // Act.
                const result = await model.findAllWithCounts(
                    {},
                    { page: 1, pageSize: 10 },
                    undefined,
                    tx
                );

                // Assert — the field is gone entirely.
                result.items.forEach((item) => {
                    expect(item).not.toHaveProperty('currentPlanSlug');
                });
            });
        });
    }
);
