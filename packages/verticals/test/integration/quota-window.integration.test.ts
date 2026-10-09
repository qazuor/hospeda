import { randomUUID } from 'node:crypto';
import { type DrizzleClient, quotaWindowModel, setDb } from '@repo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FoldableSource } from '../../src/effective-set/types';
import { consumeQuota } from '../../src/quota/consume-quota';
import { at, KEY, source } from '../quota/fixtures';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 4 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
beforeAll(() => setDb(db));
afterAll(async () => {
    await pool.end();
});

async function user(): Promise<string> {
    const suffix = randomUUID();
    const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO users (slug, display_name, email) VALUES ($1, 'Quota integration', $2) RETURNING id`,
        [`quota-${suffix}`, `quota-${suffix}@local.test`]
    );
    return rows[0]!.id;
}

async function rows(userId: string) {
    const result = await pool.query<{ opens_at: Date; closes_at: Date; consumed: number }>(
        `SELECT opens_at, closes_at, consumed FROM cuota_ventana WHERE user_id = $1 ORDER BY opens_at`,
        [userId]
    );
    return result.rows;
}

function scenario(userId: string, start: string) {
    const clock = {
        current: at(start),
        now() {
            return this.current;
        }
    };
    const consume = (amount: number, sources: readonly FoldableSource[]) =>
        consumeQuota({
            store: quotaWindowModel,
            clock,
            userId,
            vertical: 'accommodation',
            key: KEY,
            amount,
            sources
        });
    return { clock, consume };
}

describe('TEST:V3:10 — monthly quota with a real cuota_ventana', () => {
    it('TEST:V3:10 (a) — a 31st signup closes April 30, February 28/29 and March 31', async () => {
        const userId = await user();
        const { clock, consume } = scenario(userId, '2023-01-31');
        const grant = [source('SUBSCRIPTION', at('2023-01-31'), 100)];
        await consume(1, grant);
        clock.current = at('2023-02-28');
        await consume(1, grant);
        clock.current = at('2023-03-31');
        await consume(1, grant);
        clock.current = at('2023-04-30');
        await consume(1, grant);
        expect((await rows(userId)).map((row) => row.closes_at)).toEqual([
            at('2023-02-28'),
            at('2023-03-31'),
            at('2023-04-30'),
            at('2023-05-31')
        ]);
        const leapId = await user();
        const leap = scenario(leapId, '2024-01-31');
        await leap.consume(1, [source('SUBSCRIPTION', at('2024-01-31'), 100)]);
        expect((await rows(leapId))[0]?.closes_at).toEqual(at('2024-02-29'));
    });

    it('TEST:V3:10 (b) — annual payment still renews monthly', async () => {
        const userId = await user();
        const { clock, consume } = scenario(userId, '2026-01-15');
        const annual = [source('SUBSCRIPTION', at('2026-01-15'), 100)];
        await consume(90, annual);
        clock.current = at('2026-02-15');
        expect(await consume(90, annual)).toMatchObject({ status: 'CONSUMED', remaining: 10 });
        expect((await rows(userId)).map((row) => row.closes_at)).toEqual([
            at('2026-02-15'),
            at('2026-03-15')
        ]);
    });

    it('TEST:V3:10 (c) — upgrade leaves 220, downgrade zero, new window follows the 20th', async () => {
        const userId = await user();
        const { clock, consume } = scenario(userId, '2026-01-15');
        await consume(80, [source('SUBSCRIPTION', at('2026-01-15'), 100)]);
        clock.current = at('2026-01-20');
        expect(await consume(221, [source('SUBSCRIPTION', at('2026-01-20'), 300)])).toEqual({
            status: 'EXHAUSTED',
            remaining: 220
        });
        expect(await consume(1, [source('SUBSCRIPTION', at('2026-01-20'), 300)])).toMatchObject({
            status: 'CONSUMED',
            remaining: 219
        });
        expect(await consume(1, [source('SUBSCRIPTION', at('2026-01-20'), 50)])).toEqual({
            status: 'EXHAUSTED',
            remaining: 0
        });
        clock.current = at('2026-02-15');
        expect(await consume(1, [source('SUBSCRIPTION', at('2026-01-20'), 300)])).toMatchObject({
            status: 'CONSUMED',
            remaining: 299
        });
        expect((await rows(userId)).map((row) => row.closes_at)).toEqual([
            at('2026-02-15'),
            at('2026-02-20')
        ]);
    });

    it('TEST:V3:10 (d) — trial renews on its own 10th while active', async () => {
        const userId = await user();
        const { clock, consume } = scenario(userId, '2026-01-10');
        const trial = [source('TRIAL', at('2026-01-10'), 100)];
        await consume(90, trial);
        clock.current = at('2026-02-10');
        expect(await consume(90, trial)).toMatchObject({ status: 'CONSUMED', remaining: 10 });
        expect((await rows(userId)).map((row) => row.closes_at)).toEqual([
            at('2026-02-10'),
            at('2026-03-10')
        ]);
        const convertedId = await user();
        const converted = scenario(convertedId, '2026-01-10');
        await converted.consume(20, trial);
        converted.clock.current = at('2026-01-20');
        expect(await converted.consume(31, [source('SUBSCRIPTION', at('2026-01-20'), 50)])).toEqual(
            { status: 'EXHAUSTED', remaining: 30 }
        );
    });

    it('TEST:V3:10 (e) — complement adds quota to the title window, with no own window', async () => {
        const userId = await user();
        const { consume } = scenario(userId, '2026-01-15');
        expect(
            await consume(120, [
                source('SUBSCRIPTION', at('2026-01-15'), 100),
                source('ADDON', at('2026-01-20'), 50)
            ])
        ).toMatchObject({ status: 'CONSUMED', remaining: 30 });
        expect(await rows(userId)).toMatchObject([{ consumed: 120, closes_at: at('2026-02-15') }]);
    });

    it('TEST:V3:10 (f) — two titles grant quota and the oldest anchors', async () => {
        const userId = await user();
        const { consume } = scenario(userId, '2026-01-20');
        expect(
            await consume(350, [
                source('SUBSCRIPTION', at('2026-01-20'), 300),
                source('TRIAL', at('2026-01-05'), 100)
            ])
        ).toMatchObject({ status: 'CONSUMED', remaining: 50 });
        expect((await rows(userId))[0]?.closes_at).toEqual(at('2026-02-05'));
    });

    it('TEST:V3:10 (g) — conversion keeps the trial window, then follows the subscription 20th', async () => {
        const userId = await user();
        const { clock, consume } = scenario(userId, '2026-01-05');
        await consume(20, [source('TRIAL', at('2026-01-05'), 100)]);
        clock.current = at('2026-01-20');
        expect(await consume(1, [source('SUBSCRIPTION', at('2026-01-20'), 300)])).toMatchObject({
            status: 'CONSUMED',
            remaining: 279
        });
        expect((await rows(userId))[0]?.closes_at).toEqual(at('2026-02-05'));
        clock.current = at('2026-02-10');
        expect(await rows(userId)).toHaveLength(1);
        expect(await consume(1, [source('SUBSCRIPTION', at('2026-01-20'), 300)])).toMatchObject({
            status: 'CONSUMED',
            remaining: 299
        });
        expect((await rows(userId))[1]?.closes_at).toEqual(at('2026-02-20'));
    });

    it('TEST:V3:10 (h) — BASE anchors at account signup only if it grants the measured key', async () => {
        const userId = await user();
        const { consume } = scenario(userId, '2026-01-10');
        expect(await consume(1, [{ ...source('BASE', at('2026-01-03'), 20), grants: [] }])).toEqual(
            { status: 'NOT_METERED' }
        );
        expect(await rows(userId)).toHaveLength(0);
        expect(await consume(1, [source('BASE', at('2026-01-03'), 20)])).toMatchObject({
            status: 'CONSUMED',
            remaining: 19
        });
        expect((await rows(userId))[0]?.closes_at).toEqual(at('2026-02-03'));
    });

    it('TEST:V3:10 — concurrent consumption of one triplet opens only one window', async () => {
        const userId = await user();
        const { consume } = scenario(userId, '2026-01-15');
        const grant = [source('SUBSCRIPTION', at('2026-01-15'), 100)];
        const results = await Promise.all([consume(80, grant), consume(80, grant)]);
        expect(results.map((result) => result.status).sort()).toEqual(['CONSUMED', 'EXHAUSTED']);
        expect(await rows(userId)).toMatchObject([{ consumed: 80 }]);
    });
});
