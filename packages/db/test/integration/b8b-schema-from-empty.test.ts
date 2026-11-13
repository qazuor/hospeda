import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);
const migrations = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/migrations');
const columns: Readonly<Record<string, readonly string[]>> = {
    subscription: ['succeeds_id', 'succeeded_by_id'],
    subscription_scheduled_change: [
        'subscription_id',
        'target_plan_version_id',
        'target_billing_option_id',
        'effective_at'
    ],
    subscription_pause: [
        'subscription_id',
        'reason',
        'starts_at',
        'expected_end_at',
        'actual_end_at'
    ],
    courtesy_grant: ['balance_months', 'balance_closed_at', 'close_reason'],
    reconciliation_mark: ['subscription_id', 'reason']
};
const constraints = [
    'ck_subscription_succession_exclusive',
    'uq_subscription_scheduled_change_subscription',
    'ck_courtesy_grant_balance_close',
    'ck_reconciliation_mark_reason'
] as const;
const reasons = [
    'REEMBOLSO_POR_CONFIRMAR',
    'REANUDACION_NO_APLICADA',
    'COBRO_DURANTE_CORTESIA',
    'PAUSA_NO_APLICADA'
] as const;

// TEST:B8b:23: global setup creates an empty DB and applies the complete migration chain.
describe('TEST:B8b:23 AC:B8b:23 B8b schema from empty without a destructive migration', () => {
    it('contains the succession, queue, pause, courtesy and mark columns', async () => {
        const result = await getTestPool().query<{ table_name: string; column_name: string }>(
            "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'"
        );
        const present = new Set(
            result.rows.map(({ table_name, column_name }) => `${table_name}.${column_name}`)
        );
        const missing = Object.entries(columns).flatMap(([table, names]) =>
            names
                .filter((name) => !present.has(`${table}.${name}`))
                .map((name) => `${table}.${name}`)
        );
        expect(missing).toEqual([]);
    });
    it('contains the required constraints and all four reconciliation reasons', async () => {
        const result = await getTestPool().query<{ conname: string; definition: string }>(
            'SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = ANY($1::text[])',
            [constraints]
        );
        const found = new Map(result.rows.map(({ conname, definition }) => [conname, definition]));
        expect(constraints.filter((name) => !found.has(name))).toEqual([]);
        expect(
            reasons.filter(
                (reason) => !found.get('ck_reconciliation_mark_reason')?.includes(`'${reason}'`)
            )
        ).toEqual([]);
        expect(found.get('ck_subscription_succession_exclusive')).toContain('succeeds_id');
        expect(found.get('ck_subscription_succession_exclusive')).toContain('succeeded_by_id');
        expect(found.get('ck_courtesy_grant_balance_close')).toContain('balance_months');
    });
    it('keeps one open pause per subscription through its partial unique index', async () => {
        const result = await getTestPool().query<{ indexname: string; indexdef: string }>(
            "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'subscription_pause'"
        );
        const index = result.rows.find(
            ({ indexname }) => indexname === 'uq_subscription_pause_open'
        );
        expect(index?.indexdef).toContain('UNIQUE INDEX');
        expect(index?.indexdef).toContain('actual_end_at IS NULL');
    });
    it('attributes the preexisting structures to their recorded journaled migrations', () => {
        const journal = JSON.parse(
            readFileSync(join(migrations, 'meta/_journal.json'), 'utf8')
        ) as { entries: { tag: string }[] };
        const tags = new Set(journal.entries.map(({ tag }) => `${tag}.sql`));
        const creators = [
            ['subscription', '0139_serious_vampiro.sql'],
            ['subscription_scheduled_change', '0139_serious_vampiro.sql'],
            ['courtesy_grant', '0139_serious_vampiro.sql'],
            ['subscription_pause', '0162_b43_retention_and_can_charge.sql'],
            ['reconciliation_mark', '0149_b34_reconciliation_mark.sql']
        ] as const;
        const files = readdirSync(migrations).filter((file) => file.endsWith('.sql'));
        const missing = creators.flatMap(([table, creator]) => {
            const actual = files.filter((file) =>
                readFileSync(join(migrations, file), 'utf8').includes(`CREATE TABLE "${table}"`)
            );
            return actual.length === 1 && actual[0] === creator && tags.has(creator)
                ? []
                : [`${table}: ${actual.join(',')}`];
        });
        expect(missing).toEqual([]);
        expect(
            readFileSync(join(migrations, '0162_b43_retention_and_can_charge.sql'), 'utf8')
        ).toContain('CREATE UNIQUE INDEX "uq_subscription_pause_open"');
    });
});
