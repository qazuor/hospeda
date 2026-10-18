import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);
type DbError = { code?: string; constraint?: string };
async function withRollback(body: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        await body(client);
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}
async function rejected(
    client: PoolClient,
    statement: string,
    params: unknown[]
): Promise<DbError | null> {
    await client.query('SAVEPOINT expected_rejection');
    try {
        await client.query(statement, params);
        return null;
    } catch (error) {
        return error as DbError;
    } finally {
        await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
    }
}

const migrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/migrations');
const expectedColumns: Readonly<Record<string, readonly string[]>> = {
    subscription: [
        'status',
        'class',
        'service_ends_at',
        'grace_started_at',
        'grace_ends_at',
        'succeeds_id',
        'updated_at'
    ],
    reconciliation_mark: ['subscription_id', 'reason', 'lifted_at'],
    reconciliation_mark_payment: ['mark_id', 'payment_id', 'refund_id'],
    payment: ['subscription_id', 'status', 'fact_at', 'amount'],
    covered_period: ['subscription_id', 'payment_id', 'period_start', 'released_at'],
    coverage_loss: ['user_id', 'vertical', 'lost_at'],
    provider_link: ['subscription_id', 'cancelled_seen_at'],
    domain_event: ['entity_id', 'event_type', 'changes'],
    email_outbox: [],
    addon_instance: ['complement_subscription_id'],
    addon_product: ['cycle', 'charge_kind']
};
const migrationCreators: Readonly<Record<string, string>> = {
    subscription: '0139_serious_vampiro.sql',
    addon_instance: '0139_serious_vampiro.sql',
    addon_product: '0139_serious_vampiro.sql',
    manual_payment: '0139_serious_vampiro.sql',
    reconciliation_mark: '0149_b34_reconciliation_mark.sql',
    payment: '0151_b58_payment_schema.sql',
    covered_period: '0151_b58_payment_schema.sql',
    reconciliation_mark_payment: '0151_b58_payment_schema.sql',
    refund: '0151_b58_payment_schema.sql',
    coverage_loss: '0162_b43_retention_and_can_charge.sql',
    domain_event: '0131_brief_sentinels.sql',
    provider_link: '0142_easy_prism.sql',
    email_outbox: '0130_wakeful_electro.sql'
};

describe('TEST:B8a:14 — the cancellation schema from empty, with no migration of its own (AC:B8a:14)', () => {
    it('has every column B8a reads or writes and the addon model columns', async () => {
        const result = await getTestPool().query<{ table_name: string; column_name: string }>(
            `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
        );
        const present = new Set(
            result.rows.map(({ table_name, column_name }) => `${table_name}.${column_name}`)
        );
        const tables = new Set(result.rows.map(({ table_name }) => table_name));
        const missing = Object.entries(expectedColumns).flatMap(([table, columns]) =>
            (tables.has(table) ? [] : [`${table} (table)`]).concat(
                columns
                    .filter((column) => !present.has(`${table}.${column}`))
                    .map((column) => `${table}.${column}`)
            )
        );
        expect(missing, `B8a schema columns missing: ${missing.join(', ')}`).toEqual([]);
    });

    it('has the closed status, mark-reason and domain-event domains', async () => {
        const result = await getTestPool().query<{ conname: string; definition: string }>(
            `SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = ANY($1::text[])`,
            [
                [
                    'ck_subscription_status',
                    'ck_reconciliation_mark_reason',
                    'domain_event_event_type_check'
                ]
            ]
        );
        const definitions = new Map(
            result.rows.map(({ conname, definition }) => [conname, definition])
        );
        const required: Readonly<Record<string, readonly string[]>> = {
            ck_subscription_status: ["'CANCEL_SCHEDULED'", "'CANCELLED'"],
            ck_reconciliation_mark_reason: [
                "'TRANSICION_NO_DECLARADA'",
                "'COBRO_POSTERIOR_A_LA_BAJA'",
                "'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA'",
                "'CANCELACION_SIN_CONFIRMAR'"
            ],
            domain_event_event_type_check: [
                "'reconciliation.mark_opened'",
                "'subscription.provider_cancellation_decided'"
            ]
        };
        const missing = Object.entries(required).flatMap(([constraint, values]) =>
            values
                .filter((value) => !definitions.get(constraint)?.includes(value))
                .map((value) => `${constraint}: ${value}`)
        );
        expect(missing, `constraint values missing: ${missing.join(', ')}`).toEqual([]);
    });

    it('enforces one open mark per subscription and reason in the database', async () => {
        await withRollback(async (client) => {
            const subscription = await client.query<{ id: string }>(
                "INSERT INTO subscription (status, class) VALUES ('CANCELLED', 'LAPIDA') RETURNING id"
            );
            const id = subscription.rows[0]?.id;
            await client.query(
                "INSERT INTO reconciliation_mark (subscription_id, reason) VALUES ($1, 'TRANSICION_NO_DECLARADA')",
                [id]
            );
            const duplicate = await rejected(
                client,
                "INSERT INTO reconciliation_mark (subscription_id, reason) VALUES ($1, 'TRANSICION_NO_DECLARADA')",
                [id]
            );
            expect(duplicate?.code).toBe('23505');
            expect(duplicate?.constraint).toBe('uq_reconciliation_mark_open_subscription_reason');
            await expect(
                client.query(
                    "INSERT INTO reconciliation_mark (subscription_id, reason) VALUES ($1, 'COBRO_POSTERIOR_A_LA_BAJA')",
                    [id]
                )
            ).resolves.toBeDefined();
        });
    });

    it('gets every measured table from exactly its recorded migration, all journaled', () => {
        const files = readdirSync(migrationDir).filter((file) => file.endsWith('.sql'));
        const journal = JSON.parse(
            readFileSync(join(migrationDir, 'meta/_journal.json'), 'utf8')
        ) as { entries: { tag: string }[] };
        const tags = new Set(journal.entries.map(({ tag }) => `${tag}.sql`));
        const missing: string[] = [];
        for (const [table, creator] of Object.entries(migrationCreators)) {
            const creators = files.filter((file) =>
                readFileSync(join(migrationDir, file), 'utf8').includes(`CREATE TABLE "${table}"`)
            );
            if (creators.length !== 1 || creators[0] !== creator)
                missing.push(`${table}: expected [${creator}], got [${creators.join(', ')}]`);
            if (!tags.has(creator)) missing.push(`${table}: ${creator} is not a journal tag`);
        }
        expect(missing, `migration creator mismatches: ${missing.join('; ')}`).toEqual([]);
    });
});
