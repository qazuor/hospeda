import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { VerticalDeadlineValuesSchema } from '../../../schemas/src/catalog/vertical-deadlines.schema.ts';
import { verticalDeadlineVersions } from '../../src/schemas/vertical/vertical-deadline-version.dbschema.ts';
import { closeTestPool, getTestDb, getTestPool } from './helpers.ts';
import { findCutStatement, readCutMigration, splitCutStatements } from './support/cut-migration.ts';

const migration = readCutMigration();
const statements = splitCutStatements({ sql: migration });

afterAll(async () => closeTestPool());

describe('TEST:V6:20 structural vertical deadline migration from empty', () => {
    it('writes exactly version 1 with all nine values and no changed key', async () => {
        const rows = await getTestDb().select().from(verticalDeadlineVersions);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.version).toBe(1);
        expect(Object.keys(rows[0]?.values ?? {}).sort()).toEqual([
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9'
        ]);
        // OWNER-PENDING (HOS-1479, D-1): 3, 4, 7, 8 and 9 are placeholders.
        expect(rows[0]?.values).toEqual({
            '1': { days: 90 },
            '2': { days: 180 },
            '3': { months: 3 },
            '4': { beforeArchiveDays: 15, beforeDeletionDays: 15 },
            '5': { daysBefore: [10, 5, 2, 0] },
            '6': { daysAfter: [1, 5, 15, 30, 60] },
            '7': { days: 90 },
            '8': { days: 7 },
            '9': { days: 30 }
        });
        expect(rows[0]?.changedKey).toBeNull();
        expect(VerticalDeadlineValuesSchema.safeParse(rows[0]?.values).success).toBe(true);
    });

    it.each([3, 4, 7, 8, 9])('rejects version 1 when key %i is empty', async (key) => {
        const client = await getTestPool().connect();
        try {
            await client.query('BEGIN');
            await client.query('CREATE SCHEMA vertical_deadline_migration_probe');
            await client.query('SET LOCAL search_path TO vertical_deadline_migration_probe');
            await client.query(
                findCutStatement({
                    statements,
                    fragment: 'CREATE TABLE "vertical_deadline_version"'
                })
            );
            const seed = findCutStatement({ statements, fragment: 'initial_values jsonb' });
            const changed = seed.replace(new RegExp(`"${key}": \\{[^\\n]+\\}`), `"${key}": null`);
            expect(changed).not.toBe(seed);
            await expect(client.query(changed)).rejects.toThrow(
                'Vertical deadline version 1 is incomplete'
            );
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });

    it('keeps the passage table in SQL only', async () => {
        const result = await getTestPool().query<{ exists: string | null }>(
            `SELECT to_regclass('public.cutover_v6_deleted_listing')::text AS exists`
        );
        expect(result.rows[0]?.exists).toBe('cutover_v6_deleted_listing');
        const root = resolve(import.meta.dirname, '../../src/schemas');
        const visit = (directory: string): string[] =>
            readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
                const path = resolve(directory, entry.name);
                return entry.isDirectory() ? visit(path) : entry.name.endsWith('.ts') ? [path] : [];
            });
        for (const path of visit(root)) {
            expect(readFileSync(path, 'utf8'), path).not.toContain('cutover_v6_deleted_listing');
        }
    });
});
