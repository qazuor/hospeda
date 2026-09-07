/**
 * Integration tests for the two monthly rollup writers (HOS-1063 A-6).
 *
 * ## Why these had to exist, stated plainly
 *
 * Both `rollUpMonth` statements shipped in a form Postgres REJECTED AT PARSE
 * TIME, on every single execution:
 *
 * ```
 * ERROR: column "entity_views.viewed_at" must appear in the GROUP BY clause
 *        or be used in an aggregate function
 * ```
 *
 * `MARKET_TIMEZONE` is a plain string, so each `${MARKET_TIMEZONE}` inside a
 * Drizzle `sql` template emitted a DISTINCT placeholder — `$1` in the SELECT,
 * `$5` in the GROUP BY — and Postgres compares `GROUP BY` expressions by node
 * identity, not by bound value.
 *
 * The unit suite was fully green throughout. `view-monthly-rollup.job.test.ts`
 * mocks `@repo/db` wholesale, and the AC-17 assertions are `toContain` over the
 * method's TEXT — they assert the SQL that gets BUILT, never the SQL Postgres
 * ACCEPTS. That is the same trap `marketTimezoneSql()` documents having been
 * "found the hard way (HOS-1169)", hit a second time in a different method.
 *
 * The consequence was invisible by construction: the cron would run daily,
 * return `{ success: false, errors: 1 }`, log, and write nothing — and then the
 * 95-day purge would destroy the raw rows that the rollup existed to outlive.
 * Nobody reads a rollup table, so nobody would have noticed until a partner
 * asked how last season went and the answer was permanently gone.
 *
 * ## What these tests assert that a source test cannot
 *
 * That the statements EXECUTE, and that they execute CORRECTLY: rows land, the
 * month boundaries are the local ones, a re-run corrects instead of doubling,
 * and — AC-17 for real this time — every trackable entity type is rolled up
 * rather than just PARTNER.
 *
 * These run in CI: `.github/workflows/ci.yml` has an "Integration Tests" job
 * with a `postgres:15-alpine` service, and `global-setup.ts` creates its own
 * ephemeral `hospeda_integration_test` database and applies the versioned
 * migrations into it. Nothing here touches a shared database.
 */
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { EntityViewModel } from '../../src/models/entity-view/entity-view.model.ts';
import { PartnerLogoClickModel } from '../../src/models/partner/partner-logo-click.model.ts';
import { entityViews } from '../../src/schemas/entity-view/entity_view.dbschema.ts';
import { partners } from '../../src/schemas/partner/partner.dbschema.ts';
import { partnerLogoClicks } from '../../src/schemas/partner/partner_logo_click.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

const viewModel = new EntityViewModel();
const clickModel = new PartnerLogoClickModel();

/**
 * Two instants comfortably inside August 2026 in Buenos Aires (UTC-3), so the
 * local month and the UTC month agree and the fixture cannot be read as
 * asserting a timezone edge it does not test. The boundary cases get their own
 * test below.
 */
const AUG_10 = new Date('2026-08-10T12:00:00.000Z');
const AUG_20 = new Date('2026-08-20T12:00:00.000Z');
const SEP_10 = new Date('2026-09-10T12:00:00.000Z');

/** Inserts a partner and returns its id. */
async function seedPartner(tx: DrizzleClient): Promise<string> {
    const uid = crypto.randomUUID().slice(0, 8);
    const id = crypto.randomUUID();
    await tx.insert(partners).values({
        id,
        slug: `rollup-partner-${uid}`,
        name: `Rollup Partner ${uid}`,
        type: 'commerce' as const,
        tier: 'gold' as const
    });
    return id;
}

/** Reads back the view rollup rows for one entity id. */
async function readViewRollup(
    tx: DrizzleClient,
    entityId: string
): Promise<Array<{ entity_type: string; month: string; total: number; unique_visitors: number }>> {
    const res = await tx.execute(sql`
        SELECT entity_type, month::text AS month, total, unique_visitors
        FROM entity_view_monthly_rollups
        WHERE entity_id = ${entityId}::uuid
        ORDER BY month
    `);
    const rows = Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
    return rows as Array<{
        entity_type: string;
        month: string;
        total: number;
        unique_visitors: number;
    }>;
}

afterAll(async () => {
    await closeTestPool();
});

describe('EntityViewModel.rollUpMonth — against real Postgres', () => {
    /**
     * The regression test for the parse failure. It does not assert a number:
     * it asserts that the statement RUNS. Before the fix this threw a `DbError`
     * wrapping the GROUP BY error, on any input at all — including none.
     */
    it('executes without Postgres rejecting the statement', async () => {
        await withTestTransaction(async (tx) => {
            await expect(viewModel.rollUpMonth({ month: AUG_10 }, tx)).resolves.toBeTypeOf(
                'number'
            );
        });
    });

    it('writes one row per entity for the requested month', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — one entity, two visitors, one of them twice.
            const entityId = crypto.randomUUID();
            await tx.insert(entityViews).values([
                { entityType: 'PARTNER', entityId, visitorHash: 'v1', viewedAt: AUG_10 },
                { entityType: 'PARTNER', entityId, visitorHash: 'v2', viewedAt: AUG_10 },
                { entityType: 'PARTNER', entityId, visitorHash: 'v2', viewedAt: AUG_20 }
            ]);

            // Act
            const written = await viewModel.rollUpMonth({ month: AUG_10 }, tx);

            // Assert
            expect(written).toBe(1);
            const rows = await readViewRollup(tx, entityId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.month).toBe('2026-08-01');
            expect(Number(rows[0]?.unique_visitors)).toBe(2);
            // v2's two views are 10 days apart, so they are two distinct
            // 30-minute buckets: three deduplicated visits, not two.
            expect(Number(rows[0]?.total)).toBe(3);
        });
    });

    /**
     * AC-17, asserted for real rather than by grepping the method for the
     * absence of a filter. A rollup that silently covered one entity type is
     * indistinguishable from a correct one when only that type is seeded, so
     * two types are seeded and both must come back.
     */
    it('rolls up EVERY entity type present, not only PARTNER', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const partnerEntity = crypto.randomUUID();
            const accommodationEntity = crypto.randomUUID();
            await tx.insert(entityViews).values([
                {
                    entityType: 'PARTNER',
                    entityId: partnerEntity,
                    visitorHash: 'p1',
                    viewedAt: AUG_10
                },
                {
                    entityType: 'ACCOMMODATION',
                    entityId: accommodationEntity,
                    visitorHash: 'a1',
                    viewedAt: AUG_10
                }
            ]);

            // Act
            await viewModel.rollUpMonth({ month: AUG_10 }, tx);

            // Assert — BOTH, and each tagged with its own type.
            const partnerRows = await readViewRollup(tx, partnerEntity);
            const accommodationRows = await readViewRollup(tx, accommodationEntity);
            expect(partnerRows).toHaveLength(1);
            expect(partnerRows[0]?.entity_type).toBe('PARTNER');
            expect(accommodationRows).toHaveLength(1);
            expect(accommodationRows[0]?.entity_type).toBe('ACCOMMODATION');
        });
    });

    /**
     * The idempotency the retry story depends on. Repairing a failed cron run is
     * the normal reason this runs twice, and the daily schedule re-rolls the
     * current month every day — without `ON CONFLICT DO UPDATE` that would
     * either duplicate every row or fail outright against the unique index.
     */
    it('CORRECTS a month on re-run instead of duplicating it', async () => {
        await withTestTransaction(async (tx) => {
            const entityId = crypto.randomUUID();
            await tx
                .insert(entityViews)
                .values([{ entityType: 'PARTNER', entityId, visitorHash: 'v1', viewedAt: AUG_10 }]);

            await viewModel.rollUpMonth({ month: AUG_10 }, tx);

            // A late-arriving view for the same month, then a re-run.
            await tx
                .insert(entityViews)
                .values([{ entityType: 'PARTNER', entityId, visitorHash: 'v2', viewedAt: AUG_20 }]);
            await viewModel.rollUpMonth({ month: AUG_10 }, tx);

            const rows = await readViewRollup(tx, entityId);
            expect(rows).toHaveLength(1);
            expect(Number(rows[0]?.unique_visitors)).toBe(2);
        });
    });

    it('does not pull views from a neighbouring month into the window', async () => {
        await withTestTransaction(async (tx) => {
            const entityId = crypto.randomUUID();
            await tx.insert(entityViews).values([
                { entityType: 'PARTNER', entityId, visitorHash: 'aug', viewedAt: AUG_10 },
                { entityType: 'PARTNER', entityId, visitorHash: 'sep', viewedAt: SEP_10 }
            ]);

            await viewModel.rollUpMonth({ month: AUG_10 }, tx);

            const rows = await readViewRollup(tx, entityId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.month).toBe('2026-08-01');
            expect(Number(rows[0]?.unique_visitors)).toBe(1);
        });
    });

    /**
     * The half-open window is resolved from LOCAL midnight, so an event at
     * 22:00 on 31 August Buenos Aires time — which is 01:00 on 1 September in
     * UTC — belongs to August, the month the partner thinks it does.
     */
    it('buckets a late-evening event by the LOCAL month, not the UTC one', async () => {
        await withTestTransaction(async (tx) => {
            const entityId = crypto.randomUUID();
            // 2026-08-31T22:00:00-03:00 === 2026-09-01T01:00:00Z
            await tx.insert(entityViews).values([
                {
                    entityType: 'PARTNER',
                    entityId,
                    visitorHash: 'late',
                    viewedAt: new Date('2026-09-01T01:00:00.000Z')
                }
            ]);

            await viewModel.rollUpMonth({ month: AUG_10 }, tx);

            const rows = await readViewRollup(tx, entityId);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.month).toBe('2026-08-01');
        });
    });
});

describe('PartnerLogoClickModel.rollUpMonth — against real Postgres', () => {
    it('executes without Postgres rejecting the statement', async () => {
        await withTestTransaction(async (tx) => {
            await expect(clickModel.rollUpMonth({ month: AUG_10 }, tx)).resolves.toBeTypeOf(
                'number'
            );
        });
    });

    it('aggregates a partner’s clicks across BOTH destinations', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — the promise is "cuántos entraron desde tu logo" and it
            // draws no distinction between the two destinations, so both count.
            const partnerId = await seedPartner(tx);
            await tx.insert(partnerLogoClicks).values([
                {
                    partnerId,
                    visitorHash: 'c1',
                    destination: 'OWN_PAGE',
                    clickedAt: AUG_10
                },
                {
                    partnerId,
                    visitorHash: 'c2',
                    destination: 'EXTERNAL',
                    clickedAt: AUG_20
                }
            ]);

            // Act
            const written = await clickModel.rollUpMonth({ month: AUG_10 }, tx);

            // Assert
            expect(written).toBe(1);
            const res = await tx.execute(sql`
                SELECT month::text AS month, total, unique_visitors
                FROM partner_logo_click_monthly_rollups
                WHERE partner_id = ${partnerId}::uuid
            `);
            const rows = (
                Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])
            ) as Array<{ month: string; total: number; unique_visitors: number }>;

            expect(rows).toHaveLength(1);
            expect(rows[0]?.month).toBe('2026-08-01');
            expect(Number(rows[0]?.unique_visitors)).toBe(2);
            expect(Number(rows[0]?.total)).toBe(2);
        });
    });

    it('CORRECTS a month on re-run instead of duplicating it', async () => {
        await withTestTransaction(async (tx) => {
            const partnerId = await seedPartner(tx);
            await tx
                .insert(partnerLogoClicks)
                .values([
                    { partnerId, visitorHash: 'c1', destination: 'OWN_PAGE', clickedAt: AUG_10 }
                ]);

            await clickModel.rollUpMonth({ month: AUG_10 }, tx);
            await tx
                .insert(partnerLogoClicks)
                .values([
                    { partnerId, visitorHash: 'c2', destination: 'EXTERNAL', clickedAt: AUG_20 }
                ]);
            await clickModel.rollUpMonth({ month: AUG_10 }, tx);

            const res = await tx.execute(sql`
                SELECT COUNT(*)::int AS n, MAX(unique_visitors)::int AS uv
                FROM partner_logo_click_monthly_rollups
                WHERE partner_id = ${partnerId}::uuid
            `);
            const rows = (
                Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])
            ) as Array<{ n: number; uv: number }>;

            expect(Number(rows[0]?.n)).toBe(1);
            expect(Number(rows[0]?.uv)).toBe(2);
        });
    });
});
