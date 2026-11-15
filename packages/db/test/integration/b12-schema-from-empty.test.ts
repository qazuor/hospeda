import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

const migrations = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/migrations');
const tables = ['plan_migration', 'plan_migration_subscription'] as const;
const statusStates = ['APLICADA', 'CANCELADA', 'FUERA', 'PARA_RESOLVER', 'PENDIENTE'];
const reasons = ['PRICE_INCREASE', 'RETIREMENT'];
const EXTRAS_APPLIED = process.env.HOSPEDA_TEST_POSTGRES_EXTRAS_APPLIED === '1';

/** Reads one constraint definition from the live database, never from the migration file. */
async function constraintDefinition(name: string): Promise<string> {
    const result = await getTestPool().query<{ definition: string }>(
        'SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = $1',
        [name]
    );
    return result.rows.map(({ definition }) => definition)[0] ?? '';
}

/** Extracts the uppercase quoted literals of a CHECK definition, ordered. */
function checkLiterals(definition: string): string[] {
    return [...definition.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1] ?? '').sort();
}

// TEST:B12:9: global setup creates an empty DB and applies the complete migration chain.
describe('TEST:B12:9 AC:B12:8 B12 schema from empty without a destructive migration', () => {
    it('both tables exist', async () => {
        const result = await getTestPool().query<{ table_name: string }>(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
            [[...tables]]
        );
        expect(result.rows.map(({ table_name }) => table_name).sort()).toEqual([...tables].sort());
    });

    it('the scope status CHECK holds the five states', async () => {
        const definition = await constraintDefinition('ck_plan_migration_subscription_status');
        expect(checkLiterals(definition)).toEqual(statusStates);
    });

    it('the reason CHECK holds both motives', async () => {
        const definition = await constraintDefinition('ck_plan_migration_reason');
        expect(checkLiterals(definition)).toEqual(reasons);
    });

    it('the notice CHECK keeps the 60-day floor', async () => {
        const definition = await constraintDefinition('ck_plan_migration_notice_days');
        expect(definition).toContain('>= 60');
    });

    it('only 0139 creates them and it is in the journal', () => {
        const journal = JSON.parse(
            readFileSync(join(migrations, 'meta/_journal.json'), 'utf8')
        ) as { entries: { tag: string }[] };
        const tags = new Set(journal.entries.map(({ tag }) => `${tag}.sql`));
        const files = readdirSync(migrations).filter((file) => file.endsWith('.sql'));
        const missing = tables.flatMap((table) => {
            const creators = files.filter((file) =>
                readFileSync(join(migrations, file), 'utf8').includes(`CREATE TABLE "${table}"`)
            );
            return creators.join(',') === '0139_serious_vampiro.sql' &&
                tags.has('0139_serious_vampiro.sql')
                ? []
                : [`${table}: ${creators.join(',')}`];
        });
        expect(missing).toEqual([]);
    });

    it('no later migration drops or retypes them', () => {
        const destructive = /DROP\s+TABLE|DROP\s+COLUMN|ALTER\s+COLUMN[\s\S]*\bTYPE\b|RENAME/i;
        const offenders = readdirSync(migrations)
            .filter((file) => file.endsWith('.sql'))
            .filter((file) => Number.parseInt(file.slice(0, 4), 10) > 139)
            .flatMap((file) =>
                readFileSync(join(migrations, file), 'utf8')
                    .split('--> statement-breakpoint')
                    .filter((statement) => tables.some((table) => statement.includes(`"${table}"`)))
                    .filter((statement) => destructive.test(statement))
                    .map((statement) => `${file}: ${statement.trim().slice(0, 80)}`)
            );
        expect(offenders).toEqual([]);
    });

    it.skipIf(!EXTRAS_APPLIED)('the terminal-exit trigger is installed', async () => {
        const result = await getTestPool().query<{ tgname: string }>(
            'SELECT tgname FROM pg_trigger WHERE tgname = $1',
            ['subscription_plan_migration_exit_on_terminal']
        );
        expect(result.rows.map(({ tgname }) => tgname)).toEqual([
            'subscription_plan_migration_exit_on_terminal'
        ]);
    });
});
