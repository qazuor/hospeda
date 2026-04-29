/**
 * SPEC-064 IT-7 & IT-8 — billing concurrency and statement timeout.
 *
 * These tests validate two real-PostgreSQL behaviours that cannot be
 * exercised with mocks:
 *
 *   IT-7: `tryRedeemAtomically` uses `SELECT ... FOR UPDATE` inside a
 *         transaction so that under N concurrent callers, only `maxUses`
 *         redemptions succeed; the rest fail with `PROMO_CODE_MAX_USES`
 *         and the persisted `usedCount` matches `maxUses` exactly.
 *
 *   IT-8: A transaction with `SET LOCAL statement_timeout = 1000` aborted
 *         while running `SELECT pg_sleep(2)` raises PostgreSQL error code
 *         57014 ("canceling statement due to statement timeout"). Rows
 *         inserted in the same transaction must NOT be persisted.
 *
 * Runs against the ephemeral `hospeda_integration_test` database created
 * by `global-setup.ts`. The runtime `getDb()` client is wired to the same
 * pool via `setDb()` so service-core's `tryRedeemAtomically` (which calls
 * `getDb()` internally) sees the test DB transparently.
 *
 * Originally tracked at `apps/api/test/services/spec-064-it7-it8.test.ts`
 * as `it.todo()` stubs blocked on SPEC-061 infrastructure.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// Relative import into @repo/service-core's source. Declaring service-core as a
// devDependency would create a workspace build cycle (service-core depends on
// @repo/db at runtime), so the test reaches into the sibling package's source
// directly. Vite/Vitest resolves it via tsconfig paths.
import { tryRedeemAtomically } from '../../../service-core/src/services/billing/promo-code/promo-code.redemption.ts';
import { billingPromoCodes } from '../../src/billing/index.ts';
import { setDb } from '../../src/client.ts';
import { sql } from '../../src/index.ts';
import { closeTestPool, getTestDb } from './helpers.ts';

describe('SPEC-064 — billing concurrency and statement timeout (real PostgreSQL)', () => {
    beforeAll(() => {
        // Wire the global @repo/db client to the SPEC-061 test pool so that
        // tryRedeemAtomically() (which calls getDb() internally) targets the
        // ephemeral hospeda_integration_test database instead of the
        // production runtime client.
        setDb(getTestDb());
    });

    afterAll(async () => {
        await closeTestPool();
    });

    // ── IT-7: row-level lock prevents over-redemption under concurrency ─────
    describe('IT-7 — promo code concurrency', () => {
        it('exactly maxUses redemptions succeed; the rest fail with PROMO_CODE_MAX_USES; usedCount matches maxUses', async () => {
            const db = getTestDb();
            const codeId = crypto.randomUUID();
            const code = `CONCURRENT-${crypto.randomUUID().slice(0, 8)}`;

            // Commit the promo code so concurrent tryRedeemAtomically txs can
            // observe it. Using db (not withTestTransaction) ensures the row
            // is durable across the 10 child transactions below.
            await db.insert(billingPromoCodes).values({
                id: codeId,
                code,
                type: 'percentage',
                value: 10,
                active: true,
                maxUses: 5,
                usedCount: 0,
                livemode: false
            } as typeof billingPromoCodes.$inferInsert);

            const attempts = 10;
            const results = await Promise.all(
                Array.from({ length: attempts }, () => tryRedeemAtomically(codeId))
            );

            const successes = results.filter((r) => r.success);
            const failures = results.filter(
                (r) => !r.success && r.error?.code === 'PROMO_CODE_MAX_USES'
            );

            expect(successes).toHaveLength(5);
            expect(failures).toHaveLength(5);

            // No "other" failures (e.g., NOT_FOUND, INTERNAL_ERROR) leaked through.
            const otherFailures = results.filter(
                (r) => !r.success && r.error?.code !== 'PROMO_CODE_MAX_USES'
            );
            expect(otherFailures).toHaveLength(0);

            const persisted = await db
                .select({ usedCount: billingPromoCodes.usedCount })
                .from(billingPromoCodes)
                .where(eq(billingPromoCodes.id, codeId));

            expect(persisted[0]?.usedCount).toBe(5);

            // Cleanup: ephemeral DB is dropped post-suite, but explicit delete
            // keeps test isolation tight if the suite grows.
            await db.delete(billingPromoCodes).where(eq(billingPromoCodes.id, codeId));
        });
    });

    // ── IT-8: SET LOCAL statement_timeout aborts long-running statements ────
    describe('IT-8 — transaction statement_timeout abort', () => {
        it('aborts with PG error 57014 when pg_sleep exceeds SET LOCAL statement_timeout', async () => {
            const db = getTestDb();

            // The pg.DatabaseError code may live on the wrapping
            // DrizzleQueryError or its `cause`; check both manually.
            try {
                await db.transaction(async (tx) => {
                    await tx.execute(sql`SET LOCAL statement_timeout = 1000`);
                    await tx.execute(sql`SELECT pg_sleep(2)`);
                });
                expect.fail('Transaction should have aborted with statement timeout');
            } catch (error: unknown) {
                const direct = (error as { code?: string }).code;
                const cause = (error as { cause?: { code?: string } }).cause?.code;
                expect(direct ?? cause).toBe('57014');
            }
        });

        it('does not persist rows from a transaction aborted by statement timeout', async () => {
            const db = getTestDb();
            const codeId = crypto.randomUUID();
            const code = `TIMEOUT-${crypto.randomUUID().slice(0, 8)}`;

            try {
                await db.transaction(async (tx) => {
                    await tx.execute(sql`SET LOCAL statement_timeout = 1000`);
                    // Insert before the slow statement so we can assert the
                    // insert was rolled back when the timeout fires.
                    await tx.insert(billingPromoCodes).values({
                        id: codeId,
                        code,
                        type: 'percentage',
                        value: 10,
                        active: true,
                        maxUses: 1,
                        usedCount: 0,
                        livemode: false
                    } as typeof billingPromoCodes.$inferInsert);
                    await tx.execute(sql`SELECT pg_sleep(2)`);
                });
                expect.fail('Transaction should have aborted with statement timeout');
            } catch {
                // Expected: timeout-induced abort.
            }

            const persisted = await db
                .select()
                .from(billingPromoCodes)
                .where(eq(billingPromoCodes.id, codeId));

            expect(persisted).toHaveLength(0);
        });
    });
});
