/**
 * Integration tests for HostTradeModel.findForHost (SPEC-241 T-008).
 *
 * Each test wraps DB writes in `withTestTransaction` so they are always
 * rolled back — no TRUNCATE overhead, parallel-safe via MVCC isolation.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { HostTradeModel } from '../../src/models/hostTrade/host-trade.model.ts';
import { hostTrades } from '../../src/schemas/host-trade/host_trade.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

beforeAll(() => {
    // Wire the module-level getDb() to the ephemeral test pool so that model
    // methods called WITHOUT an explicit `tx` hit the test DB instead of
    // throwing "Database not initialized".
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

describe('HostTradeModel.findForHost', () => {
    const model = new HostTradeModel();

    /**
     * Returns the minimal set of fields required to insert a host_trades row.
     * `id` and `slug` are randomised per call to avoid unique-constraint
     * collisions across tests running in parallel.
     */
    function tradeFixture(
        destinationId: string,
        overrides: Partial<typeof hostTrades.$inferInsert> = {}
    ): typeof hostTrades.$inferInsert {
        const uid = crypto.randomUUID().slice(0, 8);
        return {
            id: crypto.randomUUID(),
            slug: `trade-${uid}`,
            name: `Trade ${uid}`,
            category: 'PLOMERIA' as const,
            contact: '+54 999 000 001',
            benefit: '10% descuento',
            destinationId,
            is24h: false,
            isActive: true,
            ...overrides
        };
    }

    it('returns only trades whose destinationId is in the provided list', async () => {
        await withTestTransaction(async (tx) => {
            // Seed two destinations and a user (satisfies nullable FK for createdById)
            const user = testData.user();
            const dest1 = testData.destination();
            const dest2 = testData.destination();
            const dest3 = testData.destination();

            await tx.insert(users).values(user);

            // Insert dest tables — destination requires users for createdById (nullable)
            const { destinations } = await import(
                '../../src/schemas/destination/destination.dbschema.ts'
            );
            await tx.insert(destinations).values(dest1);
            await tx.insert(destinations).values(dest2);
            await tx.insert(destinations).values(dest3);

            const trade1 = tradeFixture(dest1.id, { name: 'AAA' });
            const trade2 = tradeFixture(dest2.id, { name: 'BBB' });
            const tradeOther = tradeFixture(dest3.id, { name: 'CCC' });

            await tx.insert(hostTrades).values(trade1);
            await tx.insert(hostTrades).values(trade2);
            await tx.insert(hostTrades).values(tradeOther);

            const results = await model.findForHost([dest1.id, dest2.id], tx);

            const ids = results.map((r) => r.id);
            expect(ids).toContain(trade1.id);
            expect(ids).toContain(trade2.id);
            expect(ids).not.toContain(tradeOther.id);
        });
    });

    it('excludes rows where isActive = false', async () => {
        await withTestTransaction(async (tx) => {
            const dest = testData.destination();
            const { destinations } = await import(
                '../../src/schemas/destination/destination.dbschema.ts'
            );
            await tx.insert(destinations).values(dest);

            const active = tradeFixture(dest.id, { isActive: true, name: 'Active' });
            const inactive = tradeFixture(dest.id, { isActive: false, name: 'Inactive' });

            await tx.insert(hostTrades).values(active);
            await tx.insert(hostTrades).values(inactive);

            const results = await model.findForHost([dest.id], tx);

            expect(results.map((r) => r.id)).toContain(active.id);
            expect(results.map((r) => r.id)).not.toContain(inactive.id);
        });
    });

    it('excludes soft-deleted rows (deletedAt IS NOT NULL)', async () => {
        await withTestTransaction(async (tx) => {
            const dest = testData.destination();
            const { destinations } = await import(
                '../../src/schemas/destination/destination.dbschema.ts'
            );
            await tx.insert(destinations).values(dest);

            const live = tradeFixture(dest.id, { name: 'Live' });
            const deleted = tradeFixture(dest.id, { name: 'Deleted', deletedAt: new Date() });

            await tx.insert(hostTrades).values(live);
            await tx.insert(hostTrades).values(deleted);

            const results = await model.findForHost([dest.id], tx);

            expect(results.map((r) => r.id)).toContain(live.id);
            expect(results.map((r) => r.id)).not.toContain(deleted.id);
        });
    });

    it('orders results by category ASC then name ASC', async () => {
        await withTestTransaction(async (tx) => {
            const dest = testData.destination();
            const { destinations } = await import(
                '../../src/schemas/destination/destination.dbschema.ts'
            );
            await tx.insert(destinations).values(dest);

            // PostgreSQL pgEnum sorts by declaration order, not alphabetically.
            // The HostTradeCategoryEnum declaration order is:
            //   CERRAJERIA (1) < PLOMERIA (2) < ELECTRICIDAD (3) < ...
            // So CERRAJERIA sorts before PLOMERIA in ORDER BY category ASC.
            // Within the same category, name is sorted alphabetically (ASC).
            const tradeA = tradeFixture(dest.id, { category: 'CERRAJERIA', name: 'Zeta' });
            const tradeB = tradeFixture(dest.id, { category: 'PLOMERIA', name: 'Alpha' });
            const tradeC = tradeFixture(dest.id, { category: 'PLOMERIA', name: 'Omega' });

            // Insert in reverse expected order to prove the ORDER BY clause works
            await tx.insert(hostTrades).values(tradeC);
            await tx.insert(hostTrades).values(tradeB);
            await tx.insert(hostTrades).values(tradeA);

            const results = await model.findForHost([dest.id], tx);

            // Expected order: tradeA (CERRAJERIA/Zeta), tradeB (PLOMERIA/Alpha), tradeC (PLOMERIA/Omega)
            const ids = results.map((r) => r.id);
            const posA = ids.indexOf(tradeA.id);
            const posB = ids.indexOf(tradeB.id);
            const posC = ids.indexOf(tradeC.id);

            expect(posA).toBeLessThan(posB);
            expect(posB).toBeLessThan(posC);
        });
    });

    it('returns [] for an empty destinationIds array without hitting the DB', async () => {
        // No transaction needed — the guard short-circuits before any query
        const results = await model.findForHost([]);
        expect(results).toEqual([]);
    });

    it('returns [] when destinationIds match no rows', async () => {
        await withTestTransaction(async (tx) => {
            const nonExistentId = crypto.randomUUID();
            const results = await model.findForHost([nonExistentId], tx);
            expect(results).toEqual([]);
        });
    });
});
