import { randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { DomainEventModel } from '../../src/models/domain-event/domain-event.model.ts';
import { closeTestPool, getTestDb, getTestPool } from './helpers.ts';

const events = new DomainEventModel();
const occurredAt = new Date('2026-10-13T12:00:00.000Z');

beforeAll(() => {
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

describe('TEST:HOS-2314:c5 domain_event total write order', () => {
    it('orders occurred_at ties by seq for entity and correlation readers', async () => {
        const entityId = randomUUID();
        const correlationId = randomUUID();
        const base = 1_000_000_000_000 + randomInt(1_000_000) * 10;
        const ids = [randomUUID(), randomUUID(), randomUUID()];
        const physical = [
            { reason: 'X', id: ids[0], seq: base + 3 },
            { reason: 'Y', id: ids[1], seq: base + 1 },
            { reason: 'Z', id: ids[2], seq: base + 2 }
        ];
        while (
            [...physical]
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((row) => row.reason)
                .join('') === 'YZX'
        ) {
            physical.forEach((row) => {
                row.id = randomUUID();
            });
        }

        for (const row of physical) {
            await getTestPool().query(
                `INSERT INTO domain_event
                    (id, seq, event_type, entity_type, entity_id, actor_type, occurred_at, reason, correlation_id)
                 OVERRIDING SYSTEM VALUE
                 VALUES ($1, $2, 'email.undeliverable', 'test', $3, 'job', $4, $5, $6)`,
                [row.id, row.seq, entityId, occurredAt, row.reason, correlationId]
            );
        }

        const physicalOrder = await getTestPool().query<{ reason: string }>(
            'SELECT reason FROM domain_event WHERE entity_id = $1 ORDER BY ctid',
            [entityId]
        );
        expect(physicalOrder.rows.map((row) => row.reason)).toEqual(['X', 'Y', 'Z']);

        expect(
            (await events.findByEntity({ entityType: 'test', entityId })).map((row) => row.reason)
        ).toEqual(['Y', 'Z', 'X']);
        expect(
            (await events.findByCorrelationId({ correlationId })).map((row) => row.reason)
        ).toEqual(['Y', 'Z', 'X']);
    });

    it('backfills every row when the generated identity DDL is applied to a populated table', async () => {
        const migration = readFileSync(
            resolve(import.meta.dirname, '../../src/migrations/0228_hos2314_domain_event_seq.sql'),
            'utf8'
        );
        const addIdentity = migration.match(
            /ALTER TABLE "domain_event" ADD COLUMN "seq"[^;]+;/
        )?.[0];
        const addUnique = migration.match(
            /ALTER TABLE "domain_event" ADD CONSTRAINT "domain_event_seq_unique"[^;]+;/
        )?.[0];
        expect(addIdentity).toBeDefined();
        expect(addUnique).toBeDefined();

        const client = await getTestPool().connect();
        try {
            await client.query(
                'CREATE TEMP TABLE t AS SELECT id, occurred_at FROM domain_event LIMIT 3'
            );
            await client.query(addIdentity?.replace('"domain_event"', 't') ?? '');
            await client.query(addUnique?.replace('"domain_event"', 't') ?? '');
            const result = await client.query<{ total: string; missing: string; distinct: string }>(
                `SELECT count(*) AS total,
                        count(*) FILTER (WHERE seq IS NULL) AS missing,
                        count(DISTINCT seq) AS distinct
                 FROM t`
            );
            expect(result.rows[0]).toBeDefined();
            expect(Number(result.rows[0]?.total)).toBeGreaterThan(0);
            expect(result.rows[0]?.missing).toBe('0');
            expect(result.rows[0]?.distinct).toBe(result.rows[0]?.total);
        } finally {
            client.release();
        }
    });
});
