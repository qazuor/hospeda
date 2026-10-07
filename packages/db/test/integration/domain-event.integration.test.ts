/**
 * `domain_event` on a database built from scratch (HOS-1424, unit U2, AC:U2:11).
 *
 * TEST:U2:11 — the branch's migrations, applied to an empty database, create
 * `domain_event` with its columns and constraints and without `deleted_at`.
 * TEST:U2:12 — an UPDATE and a DELETE on a `domain_event` row are rejected, and
 * an event written for an intention carries the correlation minted at the edge,
 * the same one its outbox row carries.
 *
 * Event rows cannot be deleted (that is the point), so every row written here
 * is committed for good on the disposable integration database; the outbox
 * rows are deleted in `afterEach`.
 */
import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { DomainEventModel } from '../../src/models/domain-event/domain-event.model.ts';
import { EmailOutboxModel } from '../../src/models/email-outbox/email-outbox.model.ts';
import { buildEmailDedupKey } from '../../src/models/email-outbox/email-outbox-dedup-key.ts';
import { emailOutbox } from '../../src/schemas/email-outbox/email_outbox.dbschema.ts';
import { closeTestPool, getTestDb, getTestPool } from './helpers.ts';

const events = new DomainEventModel();
const outbox = new EmailOutboxModel();
const createdKeys: string[] = [];

/** Runs one statement in a transaction that is always rolled back; returns its error, if any. */
async function rejectedBy(
    sqlText: string,
    params: readonly unknown[] = []
): Promise<{ code?: string; message?: string; constraint?: string } | null> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        await client.query(sqlText, [...params]);
        return null;
    } catch (error) {
        return error as { code?: string; message?: string; constraint?: string };
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}

/** Writes one committed event and returns it. */
async function writeEvent(correlationId = randomUUID()) {
    return events.insert({
        eventType: 'email.undeliverable',
        entityType: 'email_outbox',
        entityId: randomUUID(),
        actorType: 'job',
        correlationId,
        changes: [{ field: 'status', old: 'processing', new: 'failed' }],
        reason: 'retries_exhausted'
    });
}

beforeAll(() => {
    setDb(getTestDb());
});

afterEach(async () => {
    if (createdKeys.length > 0) {
        await getTestDb().delete(emailOutbox).where(inArray(emailOutbox.dedupKey, createdKeys));
        createdKeys.length = 0;
    }
});

afterAll(async () => {
    await closeTestPool();
});

describe('TEST:U2:11 domain_event after db:migrate from empty', () => {
    it('exists with the minimum fields of NUCLEO/08 §1.2 and no deleted_at or updated_at', async () => {
        // Act
        const { rows } = await getTestPool().query<{
            column_name: string;
            data_type: string;
            is_nullable: 'YES' | 'NO';
        }>(
            `SELECT column_name, data_type, is_nullable
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'domain_event'
             ORDER BY column_name`
        );

        // Assert
        const byName = Object.fromEntries(rows.map((r) => [r.column_name, r]));
        expect(Object.keys(byName).sort()).toEqual([
            'actor_id',
            'actor_type',
            'changes',
            'correlation_id',
            'entity_id',
            'entity_type',
            'event_type',
            'id',
            'occurred_at',
            'reason'
        ]);
        expect(byName.deleted_at).toBeUndefined();
        expect(byName.updated_at).toBeUndefined();
        expect(byName.occurred_at?.data_type).toBe('timestamp with time zone');
        expect(byName.correlation_id).toMatchObject({ data_type: 'uuid', is_nullable: 'NO' });
        expect(byName.actor_id).toMatchObject({ data_type: 'uuid', is_nullable: 'YES' });
        expect(byName.changes?.data_type).toBe('jsonb');
    });

    it('carries its constraints, its indexes and the append-only trigger, and no FK on actor_id', async () => {
        // Act
        const constraints = await getTestPool().query<{ conname: string; contype: string }>(
            `SELECT conname, contype FROM pg_constraint
             WHERE conrelid = 'public.domain_event'::regclass ORDER BY conname`
        );
        const indexes = await getTestPool().query<{ indexname: string }>(
            `SELECT indexname FROM pg_indexes
             WHERE schemaname = 'public' AND tablename = 'domain_event' ORDER BY indexname`
        );
        const triggers = await getTestPool().query<{ tgname: string }>(
            `SELECT tgname FROM pg_trigger
             WHERE tgrelid = 'public.domain_event'::regclass AND NOT tgisinternal`
        );

        // Assert
        expect(constraints.rows).toEqual([
            { conname: 'domain_event_actor_type_check', contype: 'c' },
            { conname: 'domain_event_changes_array_check', contype: 'c' },
            { conname: 'domain_event_event_type_check', contype: 'c' },
            { conname: 'domain_event_person_actor_check', contype: 'c' },
            { conname: 'domain_event_pkey', contype: 'p' }
        ]);
        expect(indexes.rows.map((r) => r.indexname)).toEqual([
            'domain_event_correlation_idx',
            'domain_event_entity_idx',
            'domain_event_pkey',
            'domain_event_type_idx'
        ]);
        expect(triggers.rows.map((r) => r.tgname)).toEqual(['domain_event_append_only']);
    });

    it('rejects an event type outside the closed catalog and an unknown actor type', async () => {
        const badType = await rejectedBy(
            `INSERT INTO domain_event (event_type, entity_type, entity_id, actor_type, correlation_id)
             VALUES ('subscription.made_up', 'x', 'y', 'job', $1)`,
            [randomUUID()]
        );
        const badActor = await rejectedBy(
            `INSERT INTO domain_event (event_type, entity_type, entity_id, actor_type, correlation_id)
             VALUES ('email.undeliverable', 'x', 'y', 'robot', $1)`,
            [randomUUID()]
        );
        const personWithoutId = await rejectedBy(
            `INSERT INTO domain_event (event_type, entity_type, entity_id, actor_type, correlation_id)
             VALUES ('email.undeliverable', 'x', 'y', 'admin', $1)`,
            [randomUUID()]
        );

        expect(badType).toMatchObject({
            code: '23514',
            constraint: 'domain_event_event_type_check'
        });
        expect(badActor).toMatchObject({
            code: '23514',
            constraint: 'domain_event_actor_type_check'
        });
        expect(personWithoutId).toMatchObject({
            code: '23514',
            constraint: 'domain_event_person_actor_check'
        });
    });
});

describe('TEST:U2:12 domain_event is append-only and carries the edge correlation', () => {
    it('rejects an UPDATE of a row', async () => {
        // Arrange
        const event = await writeEvent();

        // Act
        const error = await rejectedBy(`UPDATE domain_event SET reason = 'edited' WHERE id = $1`, [
            event.id
        ]);

        // Assert
        expect(error).toMatchObject({ code: 'P0001' });
        expect(error?.message).toMatch(/append-only.*UPDATE/);
    });

    it('rejects a soft delete, which is an UPDATE of a column that does not exist anyway', async () => {
        // Arrange
        const event = await writeEvent();

        // Act: the closest a soft delete can get is rewriting the row.
        const error = await rejectedBy(
            `UPDATE domain_event SET reason = 'deleted', changes = '[]'::jsonb WHERE id = $1`,
            [event.id]
        );

        // Assert
        expect(error).toMatchObject({ code: 'P0001' });
    });

    it('rejects a DELETE of a row, and the row is still there', async () => {
        // Arrange
        const event = await writeEvent();

        // Act
        const error = await rejectedBy('DELETE FROM domain_event WHERE id = $1', [event.id]);
        const after = await events.findByEntity({
            entityType: event.entityType,
            entityId: event.entityId
        });

        // Assert
        expect(error).toMatchObject({ code: 'P0001' });
        expect(error?.message).toMatch(/append-only.*DELETE/);
        expect(after.map((e) => e.id)).toEqual([event.id]);
    });

    it('an intention writes its outbox row and its event under the same edge correlation', async () => {
        // Arrange: the correlation minted at the edge for one business intention.
        const correlationId = randomUUID();
        const dedupKey = buildEmailDedupKey({
            recipient: `u2-3-${randomUUID()}@example.com`,
            template: 'tpl',
            occurrence: `event:${randomUUID()}`
        });
        createdKeys.push(dedupKey);

        // Act: the domain transaction enqueues the mail and records the event.
        const { row, event } = await getTestDb().transaction(async (tx) => {
            const enqueued = await outbox.enqueue(
                {
                    recipientEmail: 'someone@example.com',
                    template: 'tpl',
                    dedupKey,
                    correlationId
                },
                tx
            );
            if (!enqueued.row) throw new Error('enqueue wrote no row');
            const written = await events.insert({
                eventType: 'email.undeliverable',
                entityType: 'email_outbox',
                entityId: enqueued.row.id,
                actorType: 'job',
                correlationId,
                tx
            });
            return { row: enqueued.row, event: written };
        });
        const chain = await events.findByCorrelationId({ correlationId });

        // Assert
        expect(row.correlationId).toBe(correlationId);
        expect(event.correlationId).toBe(correlationId);
        expect(chain.map((e) => e.id)).toEqual([event.id]);
        expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('an outbox row enqueued without a correlation keeps NULL (no default is invented)', async () => {
        // Arrange
        const dedupKey = buildEmailDedupKey({
            recipient: `u2-3-${randomUUID()}@example.com`,
            template: 'tpl',
            occurrence: `event:${randomUUID()}`
        });
        createdKeys.push(dedupKey);

        // Act
        const { row } = await outbox.enqueue({
            recipientEmail: 'someone@example.com',
            template: 'tpl',
            dedupKey
        });

        // Assert
        expect(row?.correlationId).toBeNull();
    });
});
