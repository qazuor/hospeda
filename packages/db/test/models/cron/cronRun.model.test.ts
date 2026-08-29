/**
 * Unit tests for CronRunModel's hand-written retention/failure queries
 * (HOS-918 — `partial` status must not be orphaned by the retention purge).
 *
 * These queries use raw drizzle `and`/`or`/`inArray` conditions that BaseModel's
 * generic equality-only `where` cannot express, so they are exercised here by
 * running the real model method against a fake `tx` whose `.query()` captures
 * the compiled SQL text/params — no live database connection is made (the fake
 * pool never talks to a socket, it only intercepts the query drizzle would send).
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it, vi } from 'vitest';
import { CronRunModel } from '../../../src/models/cron/cronRun.model';
import type { DrizzleClient } from '../../../src/types';

vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

/** A pg-node-compatible fake pool: captures the compiled query, never opens a socket. */
const createCapturingTx = () => {
    const captured: { text: string; values: unknown[] }[] = [];
    const fakePool = {
        // node-postgres calls `pool.query(config, values)` as two positional args —
        // `config` itself carries no `.values` key, so both must be captured.
        query: async (config: { text: string }, values: unknown[]) => {
            captured.push({ text: config.text, values });
            return { rows: [], rowCount: 0 };
        },
        on: () => undefined
    };
    const tx = drizzle(fakePool) as unknown as DrizzleClient;
    return { tx, captured };
};

describe('CronRunModel — retention/failure queries (HOS-918)', () => {
    describe('purgeOlderThan', () => {
        it('includes `partial` in the long-retention failure branch, not the short success branch', async () => {
            const model = new CronRunModel();
            const { tx, captured } = createCapturingTx();

            await model.purgeOlderThan(
                {
                    successBefore: new Date('2026-06-01T00:00:00.000Z'),
                    failedBefore: new Date('2026-01-01T00:00:00.000Z')
                },
                tx
            );

            expect(captured).toHaveLength(1);
            const { text, values } = captured[0] as { text: string; values: unknown[] };

            // The failure branch (status IN (...)) must list `partial` alongside
            // `failed`/`timeout` — a `partial` row that matches neither branch would
            // never be purged (unbounded table growth).
            expect(text).toMatch(/"status" in \(\$\d, \$\d, \$\d\).*"created_at" < \$\d/);
            expect(values).toContain('partial');
            expect(values).toContain('failed');
            expect(values).toContain('timeout');

            // The success branch stays a plain equality check on 'success' only —
            // 'partial' must NOT be eligible for the short success-retention window.
            expect(text).toMatch(/"status" = \$\d and "cron_runs"\."created_at" < \$\d/);
        });
    });

    describe('getRecentFailures', () => {
        it('includes `partial` runs in the recent-failures list', async () => {
            const model = new CronRunModel();
            const { tx, captured } = createCapturingTx();

            await model.getRecentFailures(20, tx);

            expect(captured).toHaveLength(1);
            const { text, values } = captured[0] as { text: string; values: unknown[] };
            expect(text).toMatch(/"status" in \(\$\d, \$\d, \$\d\)/);
            expect(values).toEqual(expect.arrayContaining(['failed', 'partial', 'timeout']));
        });
    });
});
