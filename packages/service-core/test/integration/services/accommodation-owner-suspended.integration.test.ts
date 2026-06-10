/**
 * SPEC-143 #29 — owner-suspended public-read filter (integration).
 *
 * Validates against a real PostgreSQL database that the
 * `excludeOwnerSuspended` model filter actually removes a service-suspended
 * owner's accommodations from the query results — the WHERE clause the mocked
 * unit tests cannot exercise (they assert the flag is forwarded, not that the
 * SQL filters correctly).
 *
 * The filter lives in `AccommodationModel` (search / searchWithRelations /
 * countByFilters), which is transaction-aware (accepts a `tx`), so the test
 * drives the model directly inside `withServiceTestTransaction`. The
 * service-level decision of WHEN to set the flag (`!hasVipAccess && !isOwnScope`)
 * is covered by the mocked unit tests in `searchWithRelations.test.ts`.
 *
 * Isolation: each case scopes the query by `ownerId`, so only the seeded rows
 * can match. All rows are PUBLIC + ACTIVE so the visibility/lifecycle filters
 * do not interfere with the suspension filter.
 */
import { AccommodationModel } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedAccommodation,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('SPEC-143 #29 — owner-suspended model filter (integration)', () => {
    let model: AccommodationModel;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        model = new AccommodationModel();
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'excludeOwnerSuspended=true drops a suspended owner but keeps a normal owner',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const suspended = await seedAccommodation(tx, {
                    visibility: 'PUBLIC',
                    ownerSuspended: true
                });
                const visible = await seedAccommodation(tx, {
                    visibility: 'PUBLIC',
                    ownerSuspended: false
                });

                const suspendedResult = await model.searchWithRelations(
                    {
                        ownerId: suspended.userId,
                        excludeOwnerSuspended: true,
                        page: 1,
                        pageSize: 100
                    },
                    tx
                );
                expect(suspendedResult.items.map((i) => i.id)).not.toContain(
                    suspended.accommodationId
                );

                const visibleResult = await model.searchWithRelations(
                    {
                        ownerId: visible.userId,
                        excludeOwnerSuspended: true,
                        page: 1,
                        pageSize: 100
                    },
                    tx
                );
                expect(visibleResult.items.map((i) => i.id)).toContain(visible.accommodationId);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'excludeOwnerSuspended=false includes a suspended owner (admin / owner-self path)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const suspended = await seedAccommodation(tx, {
                    visibility: 'PUBLIC',
                    ownerSuspended: true
                });

                const result = await model.searchWithRelations(
                    {
                        ownerId: suspended.userId,
                        excludeOwnerSuspended: false,
                        page: 1,
                        pageSize: 100
                    },
                    tx
                );
                expect(result.items.map((i) => i.id)).toContain(suspended.accommodationId);
            });
        }
    );

    it.skipIf(!dbAvailable)('countByFilters honours excludeOwnerSuspended', async () => {
        await withServiceTestTransaction(async (tx) => {
            const suspended = await seedAccommodation(tx, {
                visibility: 'PUBLIC',
                ownerSuspended: true
            });

            const excluded = await model.countByFilters(
                { ownerId: suspended.userId, excludeOwnerSuspended: true, page: 1, pageSize: 100 },
                tx
            );
            expect(excluded.count).toBe(0);

            const included = await model.countByFilters(
                { ownerId: suspended.userId, excludeOwnerSuspended: false, page: 1, pageSize: 100 },
                tx
            );
            expect(included.count).toBe(1);
        });
    });
});
